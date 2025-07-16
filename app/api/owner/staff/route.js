// === GET: Get all staff for owner's restaurant ===
export async function GET(req) {
    try {
        const user = await authenticate(req);
        const db = (await clientPromise).db();
        // Find restaurant by ownerId
        const restaurant = await db.collection('restaurants').findOne({ ownerId: new ObjectId(user.userId) });
        if (!restaurant) {
            return NextResponse.json({ error: 'Restaurant not found for owner' }, { status: 404 });
        }
        // Get all staff userIds from restaurant.staff array
        const staffArray = restaurant.staff || [];
        const staffIds = staffArray.map(s => s.sid);
        // Find all staff user docs
        const staffList = staffIds.length > 0
            ? await db.collection('users').find({ _id: { $in: staffIds } }).toArray()
            : [];
        // Return staff list
        return NextResponse.json({ staff: staffList }, { status: 200 });
    } catch (err) {
        console.error(err);
        const status = err.status || 500;
        return NextResponse.json({ error: err.error || 'Server error' }, { status });
    }
}
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

// === POST: Create restaurant (same as before) ===
export async function POST(req) {
    try {
        const user = await authenticate(req);
        const body = await req.json();
        const { email } = body;
        if (!email) {
            return NextResponse.json({ error: 'Staff email is required' }, { status: 400 });
        }
        const db = (await clientPromise).db();
        // Find staff user by email
        const staffUser = await db.collection('users').findOne({ email: email.trim() });
        if (!staffUser) {
            return NextResponse.json({ error: 'Staff user not found' }, { status: 404 });
        }
        // Find restaurant by ownerId
        const restaurant = await db.collection('restaurants').findOne({ ownerId: new ObjectId(user.userId) });
        if (!restaurant) {
            return NextResponse.json({ error: 'Restaurant not found for owner' }, { status: 404 });
        }
        // Add staff userId to restaurant staff array
        await db.collection('restaurants').updateOne(
            { _id: restaurant._id },
            { $addToSet: { staff: { sid: staffUser._id } }, $set: { updatedAt: new Date() } }
        );
        // Update staff user doc
        await db.collection('users').updateOne(
            { _id: staffUser._id },
            { $set: { 'staff.isStaff': true, 'staff.access': 'A', updatedAt: new Date() } }
        );
        // Get updated restaurant doc
        const updatedRestaurant = await db.collection('restaurants').findOne({ _id: restaurant._id });
        // Get all staff userIds from restaurant.staff array
        const staffArray = updatedRestaurant.staff || [];
        const staffIds = staffArray.map(s => s.sid);
        // Find all staff user docs
        const staffList = staffIds.length > 0
            ? await db.collection('users').find({ _id: { $in: staffIds } }).toArray()
            : [];
        // Return staff list
        return NextResponse.json({ staff: staffList }, { status: 200 });
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
