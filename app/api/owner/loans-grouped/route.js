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

export async function GET(request) {
    try {
        // Authenticate user as owner or staff
        const { user, userRecord, restaurant, db } = await authenticateOwnerOrStaff(request);

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') || '';
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50'); // Increase limit for grouped view
        const skip = (page - 1) * limit;

        // Build match criteria for aggregation
        const matchCriteria = {};
        if (status && status !== 'ALL') {
            matchCriteria.status = status;
        }

        // Aggregation pipeline to group loans by user
        const pipeline = [
            { $match: matchCriteria },
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: "$userId",
                    customerInfo: { $first: "$customerInfo" },
                    loans: { 
                        $push: {
                            _id: "$_id",
                            loanApprover: "$loanApprover",
                            restaurantId: "$restaurantId",
                            userId: "$userId",
                            orderId: "$orderId",
                            customerInfo: "$customerInfo",
                            loanAmount: "$loanAmount",
                            orderTotal: "$orderTotal",
                            status: "$status",
                            approvedAt: "$approvedAt",
                            createdAt: "$createdAt",
                            updatedAt: "$updatedAt",
                            description: "$description",
                            paymentMethod: "$paymentMethod",
                            paidAt: "$paidAt",
                            cancelledAt: "$cancelledAt",
                            notes: "$notes"
                        }
                    },
                    totalActive: {
                        $sum: {
                            $cond: [{ $eq: ["$status", "ACTIVE"] }, 1, 0]
                        }
                    },
                    totalActiveAmount: {
                        $sum: {
                            $cond: [{ $eq: ["$status", "ACTIVE"] }, "$loanAmount", 0]
                        }
                    },
                    totalPaid: {
                        $sum: {
                            $cond: [{ $eq: ["$status", "PAID"] }, 1, 0]
                        }
                    },
                    totalPaidAmount: {
                        $sum: {
                            $cond: [{ $eq: ["$status", "PAID"] }, "$loanAmount", 0]
                        }
                    },
                    totalCancelled: {
                        $sum: {
                            $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0]
                        }
                    },
                    totalCancelledAmount: {
                        $sum: {
                            $cond: [{ $eq: ["$status", "CANCELLED"] }, "$loanAmount", 0]
                        }
                    },
                    lastLoanDate: { $max: "$createdAt" }
                }
            },
            {
                $addFields: {
                    userId: "$_id"
                }
            },
            {
                $project: {
                    _id: 0,
                    userId: 1,
                    customerInfo: 1,
                    loans: 1,
                    totalActive: 1,
                    totalActiveAmount: 1,
                    totalPaid: 1,
                    totalPaidAmount: 1,
                    totalCancelled: 1,
                    totalCancelledAmount: 1,
                    lastLoanDate: 1
                }
            },
            {
                $sort: {
                    totalActiveAmount: -1, // Highest active amount first
                    lastLoanDate: -1       // Then most recent loans
                }
            },
            { $skip: skip },
            { $limit: limit }
        ];

        // Execute aggregation
        const groupedLoans = await db.collection('loans').aggregate(pipeline).toArray();

        // Sort loans within each group by creation date (newest first)
        groupedLoans.forEach(group => {
            group.loans.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        });

        // Get total count for pagination
        const totalCountPipeline = [
            { $match: matchCriteria },
            {
                $group: {
                    _id: "$userId"
                }
            },
            {
                $count: "totalUsers"
            }
        ];

        const totalCountResult = await db.collection('loans').aggregate(totalCountPipeline).toArray();
        const totalUsers = totalCountResult.length > 0 ? totalCountResult[0].totalUsers : 0;

        // Calculate overall statistics
        const statsPipeline = [
            { $match: {} }, // Get all loans for stats
            {
                $group: {
                    _id: null,
                    totalLoans: { $sum: 1 },
                    totalAmount: { $sum: "$loanAmount" },
                    activeCount: {
                        $sum: { $cond: [{ $eq: ["$status", "ACTIVE"] }, 1, 0] }
                    },
                    activeAmount: {
                        $sum: { $cond: [{ $eq: ["$status", "ACTIVE"] }, "$loanAmount", 0] }
                    },
                    paidCount: {
                        $sum: { $cond: [{ $eq: ["$status", "PAID"] }, 1, 0] }
                    },
                    paidAmount: {
                        $sum: { $cond: [{ $eq: ["$status", "PAID"] }, "$loanAmount", 0] }
                    },
                    cancelledCount: {
                        $sum: { $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0] }
                    },
                    cancelledAmount: {
                        $sum: { $cond: [{ $eq: ["$status", "CANCELLED"] }, "$loanAmount", 0] }
                    }
                }
            }
        ];

        const statsResult = await db.collection('loans').aggregate(statsPipeline).toArray();
        const stats = statsResult.length > 0 ? {
            total: { 
                count: statsResult[0].totalLoans, 
                totalAmount: statsResult[0].totalAmount 
            },
            active: { 
                count: statsResult[0].activeCount, 
                totalAmount: statsResult[0].activeAmount 
            },
            paid: { 
                count: statsResult[0].paidCount, 
                totalAmount: statsResult[0].paidAmount 
            },
            cancelled: { 
                count: statsResult[0].cancelledCount, 
                totalAmount: statsResult[0].cancelledAmount 
            }
        } : {
            total: { count: 0, totalAmount: 0 },
            active: { count: 0, totalAmount: 0 },
            paid: { count: 0, totalAmount: 0 },
            cancelled: { count: 0, totalAmount: 0 }
        };

        // Pagination info
        const totalPages = Math.ceil(totalUsers / limit);
        const pagination = {
            currentPage: page,
            totalPages,
            totalUsers,
            hasMore: page < totalPages
        };

        return NextResponse.json({
            success: true,
            groupedLoans,
            statistics: stats,
            pagination
        });

    } catch (err) {
        console.error('Error fetching grouped loans:', err);
        return NextResponse.json({ 
            success: false, 
            error: err.error || 'Internal server error',
        }, { status: err.status || 500 });
    }
}

// CORS handler
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
