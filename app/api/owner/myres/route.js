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

// === GET: Return all restaurants from user's institute ===
export async function GET(req) {
    try {
        const user = await authenticate(req);
        const db = (await clientPromise).db();

        // Fetch user's full record to get their institute
        const userRecord = await db.collection('users').findOne({ _id: new ObjectId(user.userId), isOwner: true });

        if (!userRecord) {
            return NextResponse.json({ error: 'You are not Owner' }, { status: 401 });
        }

        let restaurant = await db
            .collection('restaurants')
            .findOne({ ownerId: new ObjectId(user.userId) })

        if (!restaurant) {
            return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
        }

        return NextResponse.json(restaurant);

    } catch (err) {
        console.error(err);
        const status = err.status || 500;
        return NextResponse.json({ error: err.error || 'Server error' }, { status });
    }
}

// === POST: Create restaurant (same as before) ===
export async function POST(req) {
    try {
        const user = await authenticate(req);
        const body = await req.json();
        const { name, institute, location, banner, logo, openingHours } = body;

        if (!name || !banner || !location || !institute || !logo || !openingHours) {
            return NextResponse.json(
                { error: 'Name, location, institute, logo, and opening hours are required' },
                { status: 400 }
            );
        }

        const db = (await clientPromise).db();

        const existing = await db.collection('restaurants').findOne({
            ownerId: new ObjectId(user.userId)
        });

        if (existing) {
            return NextResponse.json({ error: 'You already have a restaurant' }, { status: 403 });
        }

        const restaurant = {
            name: name.trim(),
            location: location.trim(),
            institute: institute.trim(),
            banner: banner.trim(),
            logo: logo.trim(),
            openingHours: openingHours,
            ownerId: new ObjectId(user.userId),
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await db.collection('restaurants').insertOne(restaurant);

        const searchAgain = await db.collection('restaurants').findOne({
            ownerId: new ObjectId(user.userId)
        });

        return NextResponse.json(searchAgain, { status: 201 });
    } catch (err) {
        console.error(err);
        const status = err.status || 500;
        return NextResponse.json({ error: err.error || 'Server error' }, { status });
    }
}

// === PUT: Edit restaurant details ===
export async function PUT(req) {
    try {
        const user = await authenticate(req);
        const body = await req.json();
        const { name, institute, location, banner, logo, openingHours } = body;

        if (!name && !institute && !location && !banner && !logo && !openingHours) {
            return NextResponse.json(
                { error: 'At least one field is required to update' },
                { status: 400 }
            );
        }

        const db = (await clientPromise).db();
        const filter = { ownerId: new ObjectId(user.userId) };
        const update = {
            $set: {
                ...(name && { name: name.trim() }),
                ...(location && { location: location.trim() }),
                ...(institute && { institute: institute.trim() }),
                ...(banner && { banner: banner.trim() }),
                ...(logo && { logo: logo.trim() }),
                ...(openingHours && { openingHours }),
                updatedAt: new Date(),
            }
        };

        const result = await db.collection('restaurants').updateOne(
            filter,
            update
        );

        if (result.matchedCount === 0) {
            return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
        }

        const updatedRestaurant = await db.collection('restaurants').findOne(filter);

        return NextResponse.json(updatedRestaurant);
        
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
