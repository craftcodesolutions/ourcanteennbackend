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

// === POST: Create a new order for the authenticated user ===
export async function POST(req) {
    try {
        const user = await authenticate(req);
        const db = (await clientPromise).db();

        const body = await req.json();

        const { orderId, userId } = body;
        if (!orderId || !userId) {
            return NextResponse.json({ error: 'Order ID and User ID are required' }, { status: 400 });
        }

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

        let restaurant = await db
            .collection('restaurants')
            .findOne({
                $or: [
                    { ownerId: new ObjectId(user.userId) },
                    { 'staff.sid': new ObjectId(user.userId) }
                ]
            })

        let order = await db.collection('orders').findOne({ _id: new ObjectId(orderId), userId: userId });
        // Fetch customer to check credit
        const customer = await db.collection('users').findOne({ _id: new ObjectId(userId) });
        
        if (!customer) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        if (Number(customer.credit) < Number(order.total)) {
            return NextResponse.json({ error: 'insufficient balance on user' }, { status: 406 });
        }

        if (!restaurant) {
            return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
        }

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        if (order.restaurantId !== restaurant._id.toString()) {
            return NextResponse.json({ error: 'Order does not belong to your restaurant' }, { status: 403 });
        }

        if (order.status === 'SUCCESS') {
            return NextResponse.json({
                success: false,
                alreadySuccess: true,
                message: 'Order already marked as SUCCESS'
            }, { status: 200 });
        }

        // Update order status to SCANNED and add scannedBy field
        await db.collection('orders').updateOne(
            { _id: new ObjectId(orderId), userId: userId },
            { $set: { status: 'SCANNED', scannedBy: user.userId } }
        );
        // Fetch updated order
        const updatedOrder = await db.collection('orders').findOne({ _id: new ObjectId(orderId), userId: userId });

        return NextResponse.json({ success: true, order: updatedOrder }, { status: 200 });
    } catch (err) {
        console.error(err);
        const status = err.status || 500;
        return NextResponse.json({ error: err.error || 'Server error' }, { status });
    }
}

// === POST: Create a new order for the authenticated user ===
export async function PUT(req) {
    try {
        const user = await authenticate(req);
        const db = (await clientPromise).db();

        const body = await req.json();

        const { orderId, userId } = body;
        if (!orderId || !userId) {
            return NextResponse.json({ error: 'Order ID and User ID are required' }, { status: 400 });
        }

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

        const customer = await db.collection('users').findOne({ _id: new ObjectId(userId) });

        if (!customer) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        let restaurant = await db
            .collection('restaurants')
            .findOne({
                $or: [
                    { ownerId: new ObjectId(user.userId) },
                    { 'staff.sid': new ObjectId(user.userId) }
                ]
            })

        let order = await db.collection('orders').findOne({ _id: new ObjectId(orderId), userId: userId });

        if (!restaurant) {
            return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
        }

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        if (Number(customer.credit) < Number(order.total)) {
            return NextResponse.json({ error: 'Insufficient credit to mark order as SUCCESS' }, { status: 403 });
        }

        if (order.restaurantId !== restaurant._id.toString()) {
            return NextResponse.json({ error: 'Order does not belong to your restaurant' }, { status: 403 });
        }

        // Use a transaction to ensure both updates are atomic
        const session = (await clientPromise).startSession();
        let transactionResult;
        try {
            transactionResult = await session.withTransaction(async () => {
                const userUpdate = await db.collection('users').updateOne(
                    { _id: new ObjectId(userId) },
                    { $set: { credit: Number(customer.credit) - Number(order.total) } },
                    { session }
                );
                if (userUpdate.modifiedCount !== 1) throw { status: 500, error: 'Failed to update user credit' };

                const orderUpdate = await db.collection('orders').updateOne(
                    { _id: new ObjectId(orderId), userId: userId },
                    { $set: { status: 'SUCCESS', succeededBy: user.userId } },
                    { session }
                );
                if (orderUpdate.modifiedCount !== 1) throw { status: 500, error: 'Failed to update order status' };
            });
        } finally {
            await session.endSession();
        }
        if (transactionResult === undefined || transactionResult === false) {
            return NextResponse.json({ error: 'Transaction failed, no changes applied.' }, { status: 500 });
        }

        return NextResponse.json({ status: 'SUCCESS', succeededBy: user.userId }, { status: 200 });
    } catch (err) {
        console.error(err);
        const status = err.status || 500;
        return NextResponse.json({ error: err.error || err.message || 'Server error' }, { status });
    }
}

// === CORS ===
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
