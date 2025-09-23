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

// === GET: Get penalty settings for restaurant ===
export async function GET(req) {
    try {
        const user = await authenticate(req);
        const db = (await clientPromise).db();

        // Verify user is owner
        const userRecord = await db.collection('users').findOne({
            _id: new ObjectId(user.userId),
            isOwner: true
        });

        if (!userRecord) {
            return NextResponse.json({ error: 'Only restaurant owners can access penalty settings' }, { status: 403 });
        }

        // Find restaurant owned by this user
        const restaurant = await db.collection('restaurants').findOne({
            ownerId: new ObjectId(user.userId)
        });

        if (!restaurant) {
            return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
        }

        // Return penalty settings (with defaults if not set)
        const penaltySettings = restaurant.penaltySettings || {
            enabled: true,
            penaltyRate: 10, // 10% default
            timeThreshold: 6, // 6 hours default
            allowNegativeBalance: true
        };

        return NextResponse.json({ 
            success: true, 
            penaltySettings,
            restaurantId: restaurant._id,
            restaurantName: restaurant.name
        });

    } catch (err) {
        console.error(err);
        const status = err.status || 500;
        return NextResponse.json({ error: err.error || 'Server error' }, { status });
    }
}

// === PUT: Update penalty settings for restaurant ===
export async function PUT(req) {
    try {
        const user = await authenticate(req);
        const db = (await clientPromise).db();
        const body = await req.json();

        const { penaltyRate, timeThreshold, enabled, allowNegativeBalance } = body;

        // Validate input
        if (typeof enabled !== 'boolean') {
            return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 });
        }

        if (typeof allowNegativeBalance !== 'boolean') {
            return NextResponse.json({ error: 'allowNegativeBalance must be a boolean' }, { status: 400 });
        }

        if (penaltyRate !== undefined) {
            if (typeof penaltyRate !== 'number' || penaltyRate < 0 || penaltyRate > 100) {
                return NextResponse.json({ error: 'penaltyRate must be a number between 0 and 100' }, { status: 400 });
            }
        }

        if (timeThreshold !== undefined) {
            if (typeof timeThreshold !== 'number' || timeThreshold < 0 || timeThreshold > 48) {
                return NextResponse.json({ error: 'timeThreshold must be a number between 0 and 48 hours' }, { status: 400 });
            }
        }

        // Verify user is owner
        const userRecord = await db.collection('users').findOne({
            _id: new ObjectId(user.userId),
            isOwner: true
        });

        if (!userRecord) {
            return NextResponse.json({ error: 'Only restaurant owners can update penalty settings' }, { status: 403 });
        }

        // Find restaurant owned by this user
        const restaurant = await db.collection('restaurants').findOne({
            ownerId: new ObjectId(user.userId)
        });

        if (!restaurant) {
            return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
        }

        // Prepare settings update
        const penaltySettings = {
            enabled,
            penaltyRate: penaltyRate !== undefined ? penaltyRate : (restaurant.penaltySettings?.penaltyRate || 10),
            timeThreshold: timeThreshold !== undefined ? timeThreshold : (restaurant.penaltySettings?.timeThreshold || 6),
            allowNegativeBalance,
            updatedAt: new Date(),
            updatedBy: user.userId
        };

        // Update restaurant with penalty settings
        const result = await db.collection('restaurants').updateOne(
            { _id: restaurant._id },
            { 
                $set: { 
                    penaltySettings,
                    updatedAt: new Date()
                }
            }
        );

        if (result.modifiedCount !== 1) {
            return NextResponse.json({ error: 'Failed to update penalty settings' }, { status: 500 });
        }

        return NextResponse.json({ 
            success: true, 
            message: 'Penalty settings updated successfully',
            penaltySettings
        });

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
            'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
