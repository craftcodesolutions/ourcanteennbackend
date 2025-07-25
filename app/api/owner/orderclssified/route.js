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

// === GET: Grouped Orders with Item Summary ===
export async function GET(req) {
    try {
        const user = await authenticate(req);
        const db = (await clientPromise).db();

        const userRecord = await db.collection('users').findOne({ _id: new ObjectId(user.userId) });
        if (!userRecord) {
            return NextResponse.json({ error: 'You are not An User' }, { status: 401 });
        }

        let restaurant = await db
            .collection('restaurants')
            .findOne({
                $or: [
                    { ownerId: new ObjectId(user.userId) },
                    { 'staff.sid': new ObjectId(user.userId) }
                ]
            })

        if (!restaurant) {
            return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
        }

        const orders = await db.collection('orders')
            .find({
                restaurantId: restaurant._id.toString(),
            })
            .sort({ collectionTime: -1, status: -1 })
            .toArray();

        const grouped = {};

        for (const order of orders) {
            const dateStr = order.collectionTime.split('T')[0];

            if (!grouped[dateStr]) {
                grouped[dateStr] = {
                    stats: {
                        totalOrders: 0,
                        pendingOrders: 0,
                        successOrders: 0,
                        cancelledOrders: 0
                    },
                    orders: [],
                    itemsMap: {}
                };
            }

            grouped[dateStr].orders.push(order);
            grouped[dateStr].stats.totalOrders++;

            if (order.status === 'PENDING') {
                grouped[dateStr].stats.pendingOrders++;
                // Only count quantities for PENDING orders
                for (const item of order.items || []) {
                    const itemId = item._id;
                    if (!grouped[dateStr].itemsMap[itemId]) {
                        grouped[dateStr].itemsMap[itemId] = {
                            itemId,
                            name: item.name,
                            image: item.image,
                            quantity: 0
                        };
                    }
                    grouped[dateStr].itemsMap[itemId].quantity += item.quantity || 1;
                }
            } else if (order.status === 'SUCCESS') {
                grouped[dateStr].stats.successOrders++;
            } else if (order.status === 'CANCELLED') {
                grouped[dateStr].stats.cancelledOrders++;
            }
        }

        // Convert itemsMap to itemsSummary array for each date
        for (const date in grouped) {
            grouped[date].itemsSummary = Object.values(grouped[date].itemsMap);
            delete grouped[date].itemsMap;
        }

        return NextResponse.json(grouped);
    } catch (err) {
        console.error('[Order Grouping Error]', err);
        const status = err.status || 500;
        return NextResponse.json({ error: err.error || 'Server error' }, { status });
    }
}

// === CORS (Optional) ===
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
