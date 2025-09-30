import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { authenticate } from '@/lib/auth';

// === Authentication helper ===
async function authenticateOwnerOrStaff(req) {
    const user = await authenticate(req);
    const db = (await clientPromise).db();
    
    // Verify user is owner or staff
    const userRecord = await db.collection('users').findOne({
        _id: new ObjectId(user.userId),
        $or: [
            { isOwner: true },
            { 'staff.isStaff': true }
        ]
    });

    if (!userRecord) {
        throw { status: 401, error: 'You are not Owner or Staff' };
    }

    // Find the restaurant
    const restaurant = await db.collection('restaurants').findOne({
        $or: [
            { ownerId: new ObjectId(user.userId) },
            { 'staff.sid': new ObjectId(user.userId) }
        ]
    });

    if (!restaurant) {
        throw { status: 404, error: 'Restaurant not found' };
    }

    return { user, userRecord, restaurant, db };
}

// === GET Handler ===
export async function GET(req) {
    try {
        // Authenticate user as owner or staff
        const { user, userRecord, restaurant, db } = await authenticateOwnerOrStaff(req);

        // 3. Build Member List (Owner + Staff)
        // Find the actual owner of the restaurant
        const restaurantOwner = await db.collection('users').findOne({
            _id: restaurant.ownerId
        });

        const memberIds = [{
            id: restaurant.ownerId.toString(),
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

        // 5. Fetch Topup, Order, and Loan Settlement Tracks
        const topupTracks = await db.collection('topup').find({
            topupMaker: { $in: memberIds.map(m => m.id) }
        }).toArray();

        const ordersTracks = await db.collection('orders').find({
            succeededBy: { $in: memberIds.map(m => m.id) }
        }).toArray();

        // Fetch loan settlements (loans that have been paid/settled)
        // All paid loans should be included since they represent settled amounts
        const loanTracks = await db.collection('loans').find({
            status: 'PAID',
            paidAt: { $exists: true }
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
        loanTracks.forEach(l => {
            if (l.paidAt) {
                const day = new Date(l.paidAt).toISOString().slice(0, 10);
                allDatesSet.add(day);
            }
        });

        const allDates = Array.from(allDatesSet).sort().reverse(); // latest first

        // 7. Group Topups, Orders, and Loan Settlements by Date and Member
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

                // Filter loan settlements by member and date
                const memberLoans = loanTracks.filter(l => {
                    if (!l.paidAt || new Date(l.paidAt).toISOString().slice(0, 10) !== day) {
                        return false;
                    }
                    
                    // Check if this member settled the loan using settledBy field
                    return l.settledBy === member.id;
                });

                const topupStat = {
                    count: memberTopups.length,
                    amount: memberTopups.reduce((sum, t) => sum + (typeof t.amount === 'number' ? t.amount : 0), 0)
                };

                const orderStat = {
                    count: memberOrders.length,
                    amount: memberOrders.reduce((sum, o) => sum + (typeof o.total === 'number' ? o.total : 0), 0)
                };

                const loanStat = {
                    count: memberLoans.length,
                    amount: memberLoans.reduce((sum, l) => sum + (typeof l.loanAmount === 'number' ? l.loanAmount : 0), 0)
                };

                categorizedByDate[day][member.id] = {
                    info: {
                        ...member,
                        ...(userDetailsMap[member.id] || {})
                    },
                    topupTracks: memberTopups,
                    ordersTracks: memberOrders,
                    loanTracks: memberLoans,
                    topupStat,
                    orderStat,
                    loanStat
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
