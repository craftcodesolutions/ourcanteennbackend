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

// === GET: Get all topup transactions for the authenticated staff or owner ===
export async function GET(req) {
    try {
        const owner = await authenticate(req);
        const db = (await clientPromise).db();

        // Owner/staff check
        const ownerRecord = await db.collection('users').findOne({
            _id: new ObjectId(owner.userId),
            isOwner: true
        });

        if (!ownerRecord) {
            return NextResponse.json({ error: 'You are not Owner or Staff' }, { status: 401 });
        }

        let restaurant = await db
            .collection('restaurants')
            .findOne({ ownerId: new ObjectId(owner.userId) })

        if (!restaurant) {
            return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
        }

        // Collect memberIds: owner + active staff
        const memberIds = [{
            id: owner.userId,
            isActive: true,
            title: "Owner"
        }];

        if (Array.isArray(restaurant.staff)) {
            restaurant.staff.forEach(staffMember => {
                memberIds.push({
                    id: staffMember.sid.toString(),
                    isActive: staffMember.isActive,
                    title: "Staff"
                });
            });
        }

        // Fetch member details from users collection
        const userDetails = await db.collection('users').find({
            _id: { $in: memberIds.map(member => new ObjectId(member.id)) }
        }, {
            projection: { name: 1, email: 1, phoneNumber: 1 }
        }).toArray();

        // Map user details by id for quick lookup
        const userDetailsMap = {};
        userDetails.forEach(user => {
            userDetailsMap[user._id.toString()] = {
                name: user.name || '',
                email: user.email || '',
                phoneNumber: user.phoneNumber || ''
            };
        });

        // ...existing code...

        topupTracks = await db.collection('topup').find({
            topupMaker: {
                $in: memberIds.map(member => member.id)
            }
        }).toArray();

        ordersTracks = await db.collection('orders').find({
            succeededBy: {
                $in: memberIds.map(member => member.id)
            }
        }).toArray();

        // Categorize by memberIds
        // Helper to group by day
        function groupByDay(arr, dateField) {
            const grouped = {};
            arr.forEach(item => {
                const dateObj = new Date(item[dateField]);
                const day = dateObj.toISOString().slice(0, 10);
                if (!grouped[day]) grouped[day] = [];
                grouped[day].push(item);
            });
            return grouped;
        }

        // Build a map of all dates from both topup and order tracks
        const allDatesSet = new Set();
        topupTracks.forEach(track => {
            if (track.createdAt) {
                const day = new Date(track.createdAt).toISOString().slice(0, 10);
                allDatesSet.add(day);
            }
        });
        ordersTracks.forEach(track => {
            if (track.updatedAt) {
                const day = new Date(track.updatedAt).toISOString().slice(0, 10);
                allDatesSet.add(day);
            }
        });
        const allDates = Array.from(allDatesSet).sort().reverse(); // latest first

        // For each date, collect member-wise topups/orders
        const categorizedByDate = {};
        allDates.forEach(day => {
            categorizedByDate[day] = {};
            memberIds.forEach(member => {
                const memberTopups = topupTracks.filter(track => track.topupMaker === member.id && track.createdAt && new Date(track.createdAt).toISOString().slice(0, 10) === day);
                const memberOrders = ordersTracks.filter(track => track.succeededBy === member.id && track.updatedAt && new Date(track.updatedAt).toISOString().slice(0, 10) === day);
                categorizedByDate[day][member.id] = {
                    info: {
                        ...member,
                        ...(userDetailsMap[member.id] || {})
                    },
                    topupTracks: memberTopups,
                    ordersTracks: memberOrders
                };
            });
        });

        return NextResponse.json({ categorizedByDate }, { status: 200 });
    } catch (err) {
        console.error(err);
        const status = err.status || 500;
        return NextResponse.json({ error: err.error || 'Server error' }, { status });
    }
}