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

        let ownCuisine = [];

        if (restaurant.cuisine && restaurant.cuisine.length > 0) {
            const cuisines = await db.collection('cuisines').find({ _id: { $in: restaurant.cuisine.map(id => new ObjectId(id)) } }).toArray();
            ownCuisine = cuisines;            
        }

        // const institutes = await db.collection('institutes').find({}).toArray();
        const cuisines = await db.collection('cuisines').find({}).toArray();

        return NextResponse.json({ cuisines, ownCuisine }, { status: 200 });

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
        const { selectedCuisine, newCuisine } = body;

        if (!selectedCuisine) {
            return NextResponse.json(
                { error: 'Selected cuisine is required' },
                { status: 400 }
            );
        }

        const db = (await clientPromise).db();

        let latestC = selectedCuisine;

        if (newCuisine) {
            let result = await db.collection('cuisines').insertMany(newCuisine);

            if (result.insertedCount > 0) {
                console.log('New cuisines added:', result);
                const newCuisineIds = Object.values(result.insertedIds).map(id => id.toString());
                newCuisineIds.forEach(id => {
                    console.log('New cuisines added:', id);
                    latestC.push(id);
                });
            }
        }

        const insert2restaurant = await db.collection('restaurants').updateOne(
            { ownerId: new ObjectId(user.userId) },
            { $set: { cuisine: latestC } }
        );

        const cuisines = await db.collection('cuisines').find({}).toArray();

        return NextResponse.json({latestC, cuisines}, { status: 200 });
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
