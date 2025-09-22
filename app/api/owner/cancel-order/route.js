import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';

const JWT_SECRET = process.env.JWT_SECRET;

// Authentication middleware
async function authenticate(req) {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw { status: 401, error: 'Access token required' };
    }
    
    const token = authHeader.split(' ')[1];
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        throw { status: 403, error: 'Invalid or expired token' };
    }
}

// === PATCH: Cancel an order as owner/admin ===
export async function PATCH(req) {
    try {
        const user = await authenticate(req);
        const db = (await clientPromise).db();
        const body = await req.json();
        const { orderId, userId } = body;

        if (!orderId || !userId) {
            return NextResponse.json({ error: 'Order ID and User ID are required' }, { status: 400 });
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
            return NextResponse.json({ error: 'You are not authorized to cancel orders' }, { status: 401 });
        }

        // Find the restaurant this user owns/manages
        const restaurant = await db.collection('restaurants').findOne({
            $or: [
                { ownerId: new ObjectId(user.userId) },
                { 'staff.sid': new ObjectId(user.userId) }
            ]
        });

        if (!restaurant) {
            return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
        }

        // Find the order
        const order = await db.collection('orders').findOne({ 
            _id: new ObjectId(orderId), 
            userId: userId 
        });

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Verify order belongs to this restaurant
        if (order.restaurantId !== restaurant._id.toString()) {
            return NextResponse.json({ error: 'Order does not belong to your restaurant' }, { status: 403 });
        }

        // Check if order is already cancelled
        if (order.status === 'CANCELLED') {
            return NextResponse.json({ 
                message: 'Order already cancelled', 
                order: order 
            }, { status: 200 });
        }

        // Check if order is completed (SUCCESS status) - cannot cancel if food already taken
        if (order.status === 'SUCCESS') {
            return NextResponse.json({ 
                error: 'Cannot cancel completed orders. Food has already been taken by customer.' 
            }, { status: 400 });
        }

        // Find the customer to refund credit (if order was SCANNED)
        const customer = await db.collection('users').findOne({ _id: new ObjectId(userId) });
        if (!customer) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        // Use transaction to ensure atomic operations
        const session = (await clientPromise).startSession();
        let transactionResult;

        try {
            transactionResult = await session.withTransaction(async () => {
                // Cancel the order
                const orderUpdate = await db.collection('orders').updateOne(
                    { _id: new ObjectId(orderId) },
                    { 
                        $set: { 
                            status: 'CANCELLED',
                            cancelledBy: user.userId,
                            cancelledByType: userRecord.isOwner ? 'OWNER' : 'STAFF',
                            updatedAt: new Date()
                        }
                    },
                    { session }
                );

                if (orderUpdate.modifiedCount !== 1) {
                    throw { status: 500, error: 'Failed to cancel order' };
                }

                // No refund needed for PENDING or SCANNED orders since user hasn't paid yet
                // SUCCESS orders cannot be cancelled (blocked above)

                return true;
            });
        } finally {
            await session.endSession();
        }

        if (transactionResult === undefined || transactionResult === false) {
            return NextResponse.json({ error: 'Transaction failed, order not cancelled.' }, { status: 500 });
        }

        // Fetch updated order
        const updatedOrder = await db.collection('orders').findOne({ _id: new ObjectId(orderId) });

        return NextResponse.json({ 
            message: 'Order cancelled successfully',
            order: updatedOrder,
            refunded: 0 // No refunds since SUCCESS orders can't be cancelled
        }, { status: 200 });

    } catch (error) {
        console.error('Owner cancel order error:', error);
        const status = error.status || 500;
        return NextResponse.json({ error: error.error || 'Server error' }, { status });
    }
}

// === CORS ===
export async function OPTIONS() {
    return NextResponse.json({}, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
