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

// === Helper: Get staff list for a restaurant ===
async function getStaffList(db, restaurant) {
    const staffArray = restaurant.staff || [];
    const staffIds = staffArray.map(s => s.sid);
    let staffList = staffIds.length > 0
        ? await db.collection('users').find({ _id: { $in: staffIds } }).toArray()
        : [];
    staffList = staffList.map(user => {
        const staffObj = staffArray.find(s => String(s.sid) === String(user._id));
        return { ...user, isActive: staffObj ? staffObj.isActive : undefined };
    });
    staffList.sort((a, b) => (b.isActive === true) - (a.isActive === true));
    return staffList;
}

// === GET: Get all staff for owner's restaurant ===
export async function GET(req) {
    try {
        const user = await authenticate(req);
        const db = (await clientPromise).db();
        const restaurant = await db.collection('restaurants').findOne({ ownerId: new ObjectId(user.userId) });
        if (!restaurant) {
            return NextResponse.json({ error: 'Restaurant not found for owner' }, { status: 404 });
        }
        const staffList = await getStaffList(db, restaurant);
        return NextResponse.json({ staff: staffList }, { status: 200 });
    } catch (err) {
        console.error(err);
        const status = err.status || 500;
        return NextResponse.json({ error: err.error || 'Server error' }, { status });
    }
}

// === POST: Add staff to restaurant ===
export async function POST(req) {
    try {
        const user = await authenticate(req);
        const body = await req.json();
        const { email, topupAccess } = body;
        if (!email) {
            return NextResponse.json({ error: 'Staff email is required' }, { status: 400 });
        }
        const db = (await clientPromise).db();
        const staffUser = await db.collection('users').findOne({ email: email.trim() });
        if (!staffUser) {
            return NextResponse.json({ error: 'Staff user not found' }, { status: 404 });
        }
        const restaurant = await db.collection('restaurants').findOne({ ownerId: new ObjectId(user.userId) });
        if (!restaurant) {
            return NextResponse.json({ error: 'Restaurant not found for owner' }, { status: 404 });
        }
        await db.collection('restaurants').updateOne(
            { _id: restaurant._id },
            { $addToSet: { staff: { sid: staffUser._id, isActive: true } }, $set: { updatedAt: new Date() } }
        );
        await db.collection('users').updateOne(
            { _id: staffUser._id },
            { $set: { 'staff.isStaff': true, 'staff.access': topupAccess ? 'A' : 'Z', updatedAt: new Date() } }
        );
        const updatedRestaurant = await db.collection('restaurants').findOne({ _id: restaurant._id });
        const staffList = await getStaffList(db, updatedRestaurant);
        return NextResponse.json({ staff: staffList }, { status: 200 });
    } catch (err) {
        console.error(err);
        const status = err.status || 500;
        return NextResponse.json({ error: err.error || 'Server error' }, { status });
    }
}

// === PATCH: Edit staff access for owner's restaurant ===
export async function PATCH(req) {
    try {
        const user = await authenticate(req);
        const body = await req.json();
        const { staffId, topupAccess } = body;
        if (!staffId) {
            return NextResponse.json({ error: 'Staff ID is required' }, { status: 400 });
        }
        const db = (await clientPromise).db();
        const restaurant = await db.collection('restaurants').findOne({ ownerId: new ObjectId(user.userId) });
        if (!restaurant) {
            return NextResponse.json({ error: 'Restaurant not found for owner' }, { status: 404 });
        }
        // Update staff access in restaurant staff array
        await db.collection('restaurants').updateOne(
            { _id: restaurant._id, "staff.sid": new ObjectId(staffId) },
            { $set: { "staff.$.isActive": true, updatedAt: new Date() } }
        );
        // Update staff access in user document
        await db.collection('users').updateOne(
            { _id: new ObjectId(staffId) },
            { $set: { 'staff.isStaff': true, 'staff.access': topupAccess ? 'A' : 'Z', updatedAt: new Date() } }
        );
        const updatedRestaurant = await db.collection('restaurants').findOne({ _id: restaurant._id });
        const staffList = await getStaffList(db, updatedRestaurant);
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

// === DELETE: Remove staff from owner's restaurant ===
export async function DELETE(req) {
    try {
        const user = await authenticate(req);
        const body = await req.json();
        const { staffId } = body;
        if (!staffId) {
            return NextResponse.json({ error: 'Staff ID is required' }, { status: 400 });
        }
        const db = (await clientPromise).db();
        const restaurant = await db.collection('restaurants').findOne({ ownerId: new ObjectId(user.userId) });
        if (!restaurant) {
            return NextResponse.json({ error: 'Restaurant not found for owner' }, { status: 404 });
        }
        await db.collection('restaurants').updateOne(
            { _id: restaurant._id, "staff.sid": new ObjectId(staffId) },
            { $set: { "staff.$.isActive": false, updatedAt: new Date() } }
        );
        await db.collection('users').updateOne(
            { _id: new ObjectId(staffId) },
            { $set: { 'staff.isStaff': false, 'staff.access': 'N', updatedAt: new Date() } }
        );
        const updatedRestaurant = await db.collection('restaurants').findOne({ _id: restaurant._id });
        const staffList = await getStaffList(db, updatedRestaurant);
        return NextResponse.json({ staff: staffList }, { status: 200 });
    } catch (err) {
        console.error(err);
        const status = err.status || 500;
        return NextResponse.json({ error: err.error || 'Server error' }, { status });
    }
}
