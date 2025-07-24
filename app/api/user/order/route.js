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

// === GET: Get all orders for the authenticated user ===
export async function GET(req) {
    try {
        const user = await authenticate(req);
        const db = (await clientPromise).db();
        const orders = await db.collection('orders').find({ userId: user.userId }).sort({ createdAt: -1 }).toArray();
        return NextResponse.json({ orders });
    } catch (err) {
        console.error(err);
        const status = err.status || 500;
        return NextResponse.json({ error: err.error || 'Server error' }, { status });
    }
}

// === POST: Create a new order for the authenticated user ===
export async function POST(req) {
    try {
        const user = await authenticate(req);
        const db = (await clientPromise).db();
        const body = await req.json();
        const {cart, collectionTime} = body;
        if (!Array.isArray(cart) || cart.length === 0) {
            return NextResponse.json({ error: 'Cart is empty or invalid' }, { status: 400 });
        }

        console.log('Creating order for user:', cart);

        const restaurantId = cart[0].restaurantId;

        // Calculate total price
        const total = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
        const order = {
            userId: user.userId,
            restaurantId: restaurantId,
            items: cart,
            total,
            status: 'PENDING',
            collectionTime,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await db.collection('orders').insertOne(order);
        return NextResponse.json({ orderId: result.insertedId, order });
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


// === PATCH: Cancel an order for the authenticated user ===
export async function PATCH(req) {
    try {
        const user = await authenticate(req);
        const db = (await clientPromise).db();
        const body = await req.json();
        const { orderId } = body;
        if (!orderId) {
            return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
        }
        const orderObjectId = new ObjectId(orderId);
        // Only allow cancelling if the order belongs to the user and is not already cancelled
        const result = await db.collection('orders').findOneAndUpdate(
            { _id: orderObjectId, userId: user.userId, status: { $ne: 'CANCELLED' } },
            { $set: { status: 'CANCELLED', updatedAt: new Date() } },
            { returnDocument: 'after' }
        );
        if (!result.value) {
            return NextResponse.json({ error: 'Order not found or already cancelled' }, { status: 404 });
        }
        // After cancelling, return all orders for the user (like GET)
        const orders = await db.collection('orders').find({ userId: user.userId }).sort({ createdAt: -1 }).toArray();
        return NextResponse.json({ message: 'Order cancelled', order: result.value, orders });
    } catch (err) {
        console.error(err);
        const status = err.status || 500;
        return NextResponse.json({ error: err.error || 'Server error' }, { status });
    }
}
