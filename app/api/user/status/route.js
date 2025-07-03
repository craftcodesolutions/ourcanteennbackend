import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';

const JWT_SECRET = process.env.JWT_SECRET;

// === POST: Create a new order for the authenticated user ===
export async function POST(req) {
    try {
        const db = (await clientPromise).db();
        const body = await req.json();
        const { orderId, userId } = body;

        if (!orderId || !userId) {
            return NextResponse.json({ error: 'Order ID and User ID are required' }, { status: 400 });
        }

        let order = await db.collection('orders').findOne({ _id: new ObjectId(orderId), userId: userId });

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        return NextResponse.json({ orderStatus: order.status }, { status: 200 });

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
