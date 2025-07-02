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

        return NextResponse.json(latestC, { status: 200 });
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
