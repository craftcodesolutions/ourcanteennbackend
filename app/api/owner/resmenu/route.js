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

// === GET: Return all menu items for the owner's restaurant ===
export async function GET(req) {
    try {
        const user = await authenticate(req);
        const db = (await clientPromise).db();
        // Find the owner's restaurant
        const restaurant = await db.collection('restaurants').findOne({ ownerId: new ObjectId(user.userId) });
        if (!restaurant) {
            return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
        }
        // Get menu items for this restaurant
        const menuItems = await db.collection('menuitems').find({ restaurantId: restaurant._id }).toArray();
        return NextResponse.json(menuItems);
    } catch (err) {
        console.error(err);
        const status = err.status || 500;
        return NextResponse.json({ error: err.error || 'Server error' }, { status });
    }
}

// === POST: Add a new menu item ===
export async function POST(req) {
    try {
        const user = await authenticate(req);
        const db = (await clientPromise).db();
        const restaurant = await db.collection('restaurants').findOne({ ownerId: new ObjectId(user.userId) });
        if (!restaurant) {
            return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
        }
        const body = await req.json();
        const { name, description, price, image, cuisine, available } = body;
        if (!name || !price) {
            return NextResponse.json({ error: 'Name and price are required' }, { status: 400 });
        }
        const menuItem = {
            name: name.trim(),
            description: description ? description.trim() : '',
            price: Number(price),
            image: image ? image.trim() : '',
            cuisine: cuisine ? cuisine.trim() : '',
            available: available !== undefined ? !!available : true,
            restaurantId: restaurant._id,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await db.collection('menuitems').insertOne(menuItem);

        const updatedMenuItem = await db.collection('menuitems').find({ restaurantId: restaurant._id }).toArray();

        return NextResponse.json(updatedMenuItem, { status: 201 });
    } catch (err) {
        console.error(err);
        const status = err.status || 500;
        return NextResponse.json({ error: err.error || 'Server error' }, { status });
    }
}

// === PUT: Edit a menu item ===
export async function PUT(req) {
    try {
        const user = await authenticate(req);
        const db = (await clientPromise).db();
        const restaurant = await db.collection('restaurants').findOne({ ownerId: new ObjectId(user.userId) });
        if (!restaurant) {
            return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
        }
        const body = await req.json();
        const { _id, name, description, price, image, cuisine, available } = body;
        if (!_id) {
            return NextResponse.json({ error: 'Menu item _id is required' }, { status: 400 });
        }
        const filter = { _id: new ObjectId(_id), restaurantId: restaurant._id };
        const update = {
            $set: {
                ...(name && { name: name.trim() }),
                ...(description && { description: description.trim() }),
                ...(price !== undefined && { price: Number(price) }),
                ...(image && { image: image.trim() }),
                ...(cuisine && { cuisine: cuisine.trim() }),
                ...(available !== undefined && { available: !!available }),
                updatedAt: new Date(),
            }
        };
        const result = await db.collection('menuitems').updateOne(filter, update);
        if (result.matchedCount === 0) {
            return NextResponse.json({ error: 'Menu item not found' }, { status: 404 });
        }
        const updatedMenuItem = await db.collection('menuitems').find({ restaurantId: restaurant._id }).toArray();
        return NextResponse.json(updatedMenuItem);
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
