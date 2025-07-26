import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';

const JWT_SECRET = process.env.JWT_SECRET;

// === Auth Helper ===
async function authenticate(req) {
    const authHeader = req.headers.get('authorization');
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) throw { status: 401, error: 'Access token required' };

    try {
        const user = jwt.verify(token, JWT_SECRET);
        return user;
    } catch {
        throw { status: 403, error: 'Invalid or expired token' };
    }
}

// === GET Handler ===
export async function GET(req) {
    try {
        const owner = await authenticate(req);
        const db = (await clientPromise).db();

        // 1. Verify Owner
        const ownerRecord = await db.collection('users').findOne({
            _id: new ObjectId(owner.userId),
            isOwner: true
        });

        if (!ownerRecord) {
            return NextResponse.json({ error: 'You are not Owner or Staff' }, { status: 401 });
        }

        // 2. Fetch Restaurant
        const restaurant = await db.collection('restaurants').findOne({
            ownerId: new ObjectId(owner.userId)
        });

        if (!restaurant) {
            return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
        }

        // 3. Build Member List (Owner + Staff)
        const memberIds = [{
            id: owner.userId,
            isActive: true,
            title: "Owner"
        }];

        if (Array.isArray(restaurant.staff)) {
            restaurant.staff.forEach(staff => {
                memberIds.push({
                    id: staff.sid.toString(),
                    isActive: staff.isActive,
                    title: "Staff"
                });
            });
        }

        // 4. Fetch User Details and Cache in a Lookup Map
        const userIds = memberIds.map(member => new ObjectId(member.id));
        const userDetails = await db.collection('users').find(
            { _id: { $in: userIds } },
            { projection: { name: 1, email: 1, phoneNumber: 1 } }
        ).toArray();

        const userDetailsMap = userDetails.reduce((acc, user) => {
            acc[user._id.toString()] = {
                name: user.name || '',
                email: user.email || '',
                phoneNumber: user.phoneNumber || ''
            };
            return acc;
        }, {});

        // 5. Fetch Topup and Order Tracks
        const topupTracks = await db.collection('topup').find({
            topupMaker: { $in: memberIds.map(m => m.id) }
        }).toArray();

        const ordersTracks = await db.collection('orders').find({
            succeededBy: { $in: memberIds.map(m => m.id) }
        }).toArray();

        // 6. Collect All Active Dates (YYYY-MM-DD format)
        const allDatesSet = new Set();
        topupTracks.forEach(t => {
            if (t.createdAt) {
                const day = new Date(t.createdAt).toISOString().slice(0, 10);
                allDatesSet.add(day);
            }
        });
        ordersTracks.forEach(o => {
            if (o.updatedAt) {
                const day = new Date(o.updatedAt).toISOString().slice(0, 10);
                allDatesSet.add(day);
            }
        });

        const allDates = Array.from(allDatesSet).sort().reverse(); // latest first

        // 7. Group Topups and Orders by Date and Member
        const categorizedByDate = {};

        for (const day of allDates) {
            categorizedByDate[day] = {};

            for (const member of memberIds) {
                const memberTopups = topupTracks.filter(t =>
                    t.topupMaker === member.id &&
                    t.createdAt &&
                    new Date(t.createdAt).toISOString().slice(0, 10) === day
                );

                const memberOrders = ordersTracks.filter(o =>
                    o.succeededBy === member.id &&
                    o.updatedAt &&
                    new Date(o.updatedAt).toISOString().slice(0, 10) === day
                );

                const topupStat = {
                    count: memberTopups.length,
                    amount: memberTopups.reduce((sum, t) => sum + (typeof t.amount === 'number' ? t.amount : 0), 0)
                };

                const orderStat = {
                    count: memberOrders.length,
                    amount: memberOrders.reduce((sum, o) => sum + (typeof o.amount === 'number' ? o.amount : 0), 0)
                };

                categorizedByDate[day][member.id] = {
                    info: {
                        ...member,
                        ...(userDetailsMap[member.id] || {})
                    },
                    topupTracks: memberTopups,
                    ordersTracks: memberOrders,
                    topupStat,
                    orderStat
                };
            }
        }

        // 8. Return JSON Response
        return NextResponse.json({ categorizedByDate }, { status: 200 });

    } catch (err) {
        console.error(err);
        const status = err.status || 500;
        return NextResponse.json({ error: err.error || 'Server error' }, { status });
    }
}
