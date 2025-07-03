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

        const userRecord = await db.collection('users').findOne({ _id: new ObjectId(user.userId), isOwner: true });

        if (!userRecord) {
            return NextResponse.json({ error: 'You are not Owner' }, { status: 401 });
        }

        let restaurant = await db
            .collection('restaurants')
            .findOne({ ownerId: new ObjectId(user.userId) })

        let order = await db.collection('orders').findOne({ _id: new ObjectId(orderId), userId: userId });

        if (!restaurant) {
            return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
        }

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        if (order.restaurantId !== restaurant._id.toString()) {
            return NextResponse.json({ error: 'Order does not belong to your restaurant' }, { status: 403 });
        }

        // Update order status to SCANNED
        await db.collection('orders').updateOne(
            { _id: new ObjectId(orderId), userId: userId },
            { $set: { status: 'SCANNED' } }
        );
        // Fetch updated order
        const updatedOrder = await db.collection('orders').findOne({ _id: new ObjectId(orderId), userId: userId });

        return NextResponse.json({ order: updatedOrder }, { status: 200 });
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

        const userRecord = await db.collection('users').findOne({ _id: new ObjectId(user.userId), isOwner: true });

        if (!userRecord) {
            return NextResponse.json({ error: 'You are not Owner' }, { status: 401 });
        }

        let restaurant = await db
            .collection('restaurants')
            .findOne({ ownerId: new ObjectId(user.userId) })

        let order = await db.collection('orders').findOne({ _id: new ObjectId(orderId), userId: userId });

        if (!restaurant) {
            return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
        }

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        if (order.restaurantId !== restaurant._id.toString()) {
            return NextResponse.json({ error: 'Order does not belong to your restaurant' }, { status: 403 });
        }

        // Update order status to SCANNED
        await db.collection('orders').updateOne(
            { _id: new ObjectId(orderId), userId: userId },
            { $set: { status: 'SUCCESS' } }
        );

        return NextResponse.json({ status: 'SUCCESS' }, { status: 200 });
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
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
