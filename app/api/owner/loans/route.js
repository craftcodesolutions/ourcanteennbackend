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

// === GET: Get all loans for restaurant owner ===
export async function GET(req) {
    try {
        const user = await authenticate(req);
        const db = (await clientPromise).db();

        // Check if user is owner or staff
        const userRecord = await db.collection('users').findOne({
            _id: new ObjectId(user.userId),
            $or: [
                { isOwner: true },
                { 'staff.isStaff': true }
            ]
        });

        if (!userRecord) {
            return NextResponse.json({ error: 'You are not Owner or Staff' }, { status: 401 });
        }

        // Get restaurant ID
        let restaurantId;
        if (userRecord.isOwner) {
            const restaurant = await db.collection('restaurants').findOne({ ownerId: user.userId });
            if (!restaurant) {
                return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
            }
            restaurantId = restaurant._id.toString();
        } else {
            // For staff, get restaurant from staff record
            restaurantId = userRecord.staff.restaurantId;
        }

        // Get URL parameters for filtering
        const url = new URL(req.url);
        const status = url.searchParams.get('status'); // ACTIVE, PAID, CANCELLED
        const page = parseInt(url.searchParams.get('page')) || 1;
        const limit = parseInt(url.searchParams.get('limit')) || 20;
        const skip = (page - 1) * limit;

        // Build query
        const query = { restaurantId: restaurantId };
        if (status) {
            query.status = status.toUpperCase();
        }

        // Get loans with pagination
        const loans = await db.collection('loans')
            .find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();

        // Get total count for pagination
        const totalLoans = await db.collection('loans').countDocuments(query);

        // Get loan statistics
        const stats = await db.collection('loans').aggregate([
            { $match: { restaurantId: restaurantId } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$loanAmount' }
                }
            }
        ]).toArray();

        // Format statistics
        const loanStats = {
            active: { count: 0, totalAmount: 0 },
            paid: { count: 0, totalAmount: 0 },
            cancelled: { count: 0, totalAmount: 0 },
            total: { count: 0, totalAmount: 0 }
        };

        stats.forEach(stat => {
            const status = stat._id.toLowerCase();
            if (loanStats[status]) {
                loanStats[status] = {
                    count: stat.count,
                    totalAmount: stat.totalAmount
                };
            }
            loanStats.total.count += stat.count;
            loanStats.total.totalAmount += stat.totalAmount;
        });

        return NextResponse.json({
            success: true,
            loans: loans,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalLoans / limit),
                totalLoans: totalLoans,
                limit: limit
            },
            statistics: loanStats
        }, { status: 200 });

    } catch (err) {
        console.error('Error fetching loans:', err);
        const status = err.status || 500;
        return NextResponse.json({ error: err.error || 'Server error' }, { status });
    }
}

// === PUT: Update loan status (mark as paid/cancelled) ===
export async function PUT(req) {
    try {
        const user = await authenticate(req);
        const db = (await clientPromise).db();

        const body = await req.json();
        const { loanId, status, notes } = body;

        if (!loanId || !status) {
            return NextResponse.json({ error: 'Loan ID and status are required' }, { status: 400 });
        }

        if (!['PAID', 'CANCELLED'].includes(status.toUpperCase())) {
            return NextResponse.json({ error: 'Invalid status. Must be PAID or CANCELLED' }, { status: 400 });
        }

        // Check if user is owner or staff
        const userRecord = await db.collection('users').findOne({
            _id: new ObjectId(user.userId),
            $or: [
                { isOwner: true },
                { 'staff.isStaff': true }
            ]
        });

        if (!userRecord) {
            return NextResponse.json({ error: 'You are not Owner or Staff' }, { status: 401 });
        }

        // Get restaurant ID
        let restaurantId;
        if (userRecord.isOwner) {
            const restaurant = await db.collection('restaurants').findOne({ ownerId: user.userId });
            if (!restaurant) {
                return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
            }
            restaurantId = restaurant._id.toString();
        } else {
            restaurantId = userRecord.staff.restaurantId;
        }

        // Find and update the loan
        const loan = await db.collection('loans').findOne({
            _id: new ObjectId(loanId),
            restaurantId: restaurantId
        });

        if (!loan) {
            return NextResponse.json({ error: 'Loan not found or access denied' }, { status: 404 });
        }

        if (loan.status !== 'ACTIVE') {
            return NextResponse.json({ error: 'Can only update active loans' }, { status: 400 });
        }

        // Update loan status
        const updateData = {
            status: status.toUpperCase(),
            updatedAt: new Date(),
            updatedBy: user.userId
        };

        if (status.toUpperCase() === 'PAID') {
            updateData.paidAt = new Date();
        } else if (status.toUpperCase() === 'CANCELLED') {
            updateData.cancelledAt = new Date();
        }

        if (notes) {
            updateData.notes = notes;
        }

        const result = await db.collection('loans').updateOne(
            { _id: new ObjectId(loanId) },
            { $set: updateData }
        );

        if (result.modifiedCount === 0) {
            return NextResponse.json({ error: 'Failed to update loan' }, { status: 500 });
        }

        // Get updated loan
        const updatedLoan = await db.collection('loans').findOne({ _id: new ObjectId(loanId) });

        return NextResponse.json({
            success: true,
            message: `Loan marked as ${status.toLowerCase()}`,
            loan: updatedLoan
        }, { status: 200 });

    } catch (err) {
        console.error('Error updating loan:', err);
        const status = err.status || 500;
        return NextResponse.json({ error: err.error || 'Server error' }, { status });
    }
}
