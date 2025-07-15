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

// === GET: Grouped Orders by Collection Date ===
export async function GET(req) {
    try {
        const user = await authenticate(req);
        const db = (await clientPromise).db();

        const userRecord = await db.collection('users').findOne({ _id: new ObjectId(user.userId) });
        if (!userRecord) {
            return NextResponse.json({ error: 'You are not Owner' }, { status: 401 });
        }

        const orders = await db.collection('orders')
            .find({ userId: user.userId })
            .sort({ collectionTime: -1 }) // string ISO works for sort
            .toArray();

        const grouped = {};

        for (const order of orders) {
            const dateStr = order.collectionTime.split('T')[0]; // "YYYY-MM-DD"

            if (!grouped[dateStr]) {
                grouped[dateStr] = {
                    stats: {
                        totalOrders: 0,
                        pendingOrders: 0,
                        successOrders: 0
                    },
                    orders: []
                };
            }

            grouped[dateStr].orders.push(order);
            grouped[dateStr].stats.totalOrders++;

            if (order.status === 'PENDING') {
                grouped[dateStr].stats.pendingOrders++;
            } else if (order.status === 'SUCCESS') {
                grouped[dateStr].stats.successOrders++;
            }
        }

        return NextResponse.json(grouped);
    } catch (err) {
        console.error('[Order Grouping Error]', err);
        const status = err.status || 500;
        return NextResponse.json({ error: err.error || 'Server error' }, { status });
    }
}

// === CORS (Optional, if needed for frontend fetch) ===
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
