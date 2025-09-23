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

// === POST: Approve loan for a customer order ===
export async function POST(req) {
    try {
        const user = await authenticate(req);
        const db = (await clientPromise).db();

        const body = await req.json();
        const { orderId, userId, loanAmount } = body;

        if (!orderId || !userId || !loanAmount) {
            return NextResponse.json({ error: 'Order ID, User ID, and loan amount are required' }, { status: 400 });
        }

        // Verify user is owner or staff
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

        // Check if user has access level A or is owner (required for loan approval)
        if (!userRecord.isOwner && (!userRecord.staff || userRecord.staff.access !== "A")) {
            return NextResponse.json({ error: 'Insufficient permissions. Only owners or staff with access level A can approve loans.' }, { status: 403 });
        }

        // Find the restaurant
        let restaurant = await db.collection('restaurants').findOne({
            $or: [
                { ownerId: new ObjectId(user.userId) },
                { 'staff.sid': new ObjectId(user.userId) }
            ]
        });

        if (!restaurant) {
            return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
        }

        // Find the order
        let order = await db.collection('orders').findOne({ 
            _id: new ObjectId(orderId), 
            userId: userId 
        });

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Verify order belongs to the user's restaurant
        if (order.restaurantId !== restaurant._id.toString()) {
            return NextResponse.json({ error: 'Order does not belong to your restaurant' }, { status: 403 });
        }

        // Find the customer
        const customer = await db.collection('users').findOne({ _id: new ObjectId(userId) });
        if (!customer) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        // Validate loan amount matches order total
        if (Number(loanAmount) !== Number(order.total)) {
            return NextResponse.json({ error: 'Loan amount must match order total' }, { status: 400 });
        }

        // Use a transaction to ensure both operations are atomic
        const session = (await clientPromise).startSession();
        let transactionResult;

        try {
            transactionResult = await session.withTransaction(async () => {
                // Create negative topup instance for loan
                const loanTopupDoc = {
                    topupMaker: user.userId,
                    userId: userId,
                    name: customer.name || '',
                    phoneNumber: customer.phoneNumber || '',
                    email: customer.email || '',
                    amount: -Number(order.total), // Negative amount for loan
                    type: 'LOAN',
                    orderId: orderId,
                    description: `Loan for Order #${orderId.slice(-8).toUpperCase()}`,
                    createdAt: new Date()
                };

                await db.collection('topup').insertOne(loanTopupDoc, { session });

                // Deduct order amount from customer's credit (can go negative)
                const creditUpdate = await db.collection('users').updateOne(
                    { _id: new ObjectId(userId) },
                    { $inc: { credit: -Number(order.total) } },
                    { session }
                );

                if (creditUpdate.modifiedCount !== 1) {
                    throw { status: 500, error: 'Failed to update customer credit' };
                }

                // Update order status to SUCCESS immediately (loan completes the order)
                const orderUpdate = await db.collection('orders').updateOne(
                    { _id: new ObjectId(orderId), userId: userId },
                    { 
                        $set: { 
                            status: 'SUCCESS', 
                            scannedBy: user.userId,
                            succeededBy: user.userId,
                            loanApproved: true,
                            loanAmount: Number(loanAmount),
                            loanApprovedBy: user.userId,
                            loanApprovedAt: new Date(),
                            loanCompletedAt: new Date(),
                            updatedAt: new Date()
                        } 
                    },
                    { session }
                );

                if (orderUpdate.modifiedCount !== 1) {
                    throw { status: 500, error: 'Failed to update order status' };
                }

                return true;
            });
        } finally {
            await session.endSession();
        }

        if (transactionResult === undefined || transactionResult === false) {
            return NextResponse.json({ error: 'Loan approval transaction failed, no changes applied.' }, { status: 500 });
        }

        // Fetch updated order for response
        const updatedOrder = await db.collection('orders').findOne({ 
            _id: new ObjectId(orderId), 
            userId: userId 
        });

        return NextResponse.json({ 
            success: true, 
            message: 'Loan approved and order completed',
            order: updatedOrder
        }, { status: 200 });

    } catch (err) {
        console.error(err);
        const status = err.status || 500;
        return NextResponse.json({ error: err.error || 'Server error' }, { status });
    }
}

// === CORS ===
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
