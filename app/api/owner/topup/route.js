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
        const owner = await authenticate(req);
        const db = (await clientPromise).db();
        const body = await req.json();
        const { key, type, amount } = body;
        if (!key || !type || !amount) {
            return NextResponse.json({ error: 'key, type, and amount are required' }, { status: 400 });
        }

        // Owner/staff check
        const ownerRecord = await db.collection('users').findOne({
            _id: new ObjectId(owner.userId),
            $or: [
                { isOwner: true },
                { 'staff.isStaff': true }
            ]
        });
        if (!ownerRecord) {
            return NextResponse.json({ error: 'You are not Owner or Staff' }, { status: 401 });
        }

        // Find user by type
        let userQuery = {};
        if (type === 'userId') {
            userQuery._id = new ObjectId(key);
        } else if (type === 'phoneNumber') {
            userQuery.phoneNumber = key;
        } else if (type === 'email') {
            userQuery.email = key;
        } else {
            return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
        }

        const targetUser = await db.collection('users').findOne(userQuery);
        if (!targetUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Create topup instance
        const topupDoc = {
            topupMaker: owner.userId,
            userId: targetUser._id.toString(),
            name: targetUser.name || '',
            phoneNumber: targetUser.phoneNumber || '',
            email: targetUser.email || '',
            amount: Number(amount),
            createdAt: new Date()
        };

        await db.collection('topup').insertOne(topupDoc);

        // Update user credit
        await db.collection('users').updateOne(
            { _id: targetUser._id },
            { $inc: { credit: Number(amount) } }
        );

        // Get all topup instances by owner
        const allTopups = await db.collection('topup').find({ topupMaker: owner.userId }).toArray();

        // Group topups by day
        const groupedByDay = {};
        allTopups.forEach(topup => {
            // Format date as YYYY-MM-DD
            const date = new Date(topup.createdAt);
            const dayStr = date.toISOString().slice(0, 10);
            if (!groupedByDay[dayStr]) {
                groupedByDay[dayStr] = {
                    date: dayStr,
                    totalAmount: 0,
                    count: 0,
                    topups: []
                };
            }
            groupedByDay[dayStr].topups.push(topup);
            groupedByDay[dayStr].totalAmount += Number(topup.amount);
            groupedByDay[dayStr].count += 1;
        });

        // Sort each day's topups by createdAt (newest first)
        Object.values(groupedByDay).forEach(day => {
            day.topups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        });

        // Convert grouped object to array sorted by date descending
        const days = Object.values(groupedByDay).sort((a, b) => b.date.localeCompare(a.date));

        return NextResponse.json({ success: true, days }, { status: 200 });
    } catch (err) {
        console.error(err);
        const status = err.status || 500;
        return NextResponse.json({ error: err.error || 'Server error' }, { status });
    }
}


// === GET: Get all topup transactions for the authenticated staff or owner ===
export async function GET(req) {
    try {
        const owner = await authenticate(req);
        const db = (await clientPromise).db();

        // Owner/staff check
        const ownerRecord = await db.collection('users').findOne({
            _id: new ObjectId(owner.userId),
            $or: [
                { isOwner: true },
                { 'staff.isStaff': true }
            ]
        });
        if (!ownerRecord) {
            return NextResponse.json({ error: 'You are not Owner or Staff' }, { status: 401 });
        }

        // Get all topup transactions made by this owner/staff
        const allTopups = await db.collection('topup').find({ topupMaker: owner.userId }).toArray();

        // Group topups by day
        const groupedByDay = {};
        allTopups.forEach(topup => {
            // Format date as YYYY-MM-DD
            const date = new Date(topup.createdAt);
            const dayStr = date.toISOString().slice(0, 10);
            if (!groupedByDay[dayStr]) {
                groupedByDay[dayStr] = {
                    date: dayStr,
                    totalAmount: 0,
                    count: 0,
                    topups: []
                };
            }
            groupedByDay[dayStr].topups.push(topup);
            groupedByDay[dayStr].totalAmount += Number(topup.amount);
            groupedByDay[dayStr].count += 1;
        });

        // Sort each day's topups by createdAt (newest first)
        Object.values(groupedByDay).forEach(day => {
            day.topups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        });

        // Convert grouped object to array sorted by date descending
        const days = Object.values(groupedByDay).sort((a, b) => b.date.localeCompare(a.date));

        return NextResponse.json({ success: true, days }, { status: 200 });
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
            'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
