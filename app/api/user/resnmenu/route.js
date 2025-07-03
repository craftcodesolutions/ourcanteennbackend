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
        const userRecord = await db.collection('users').findOne({ _id: new ObjectId(user.userId) });
        if (!userRecord) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Fetch all institutes for mapping
        const institutes = await db.collection('institutes').find({}).toArray();
        // Fetch all cuisines for mapping
        const cuisines = await db.collection('cuisines').find({}).toArray();

        let restaurants = await db
            .collection('restaurants')
            .find({ institute: userRecord.institute })
            .sort({ createdAt: -1 })
            .toArray();

        restaurants = restaurants.map((restaurant) => {
            restaurant.institute = institutes.find((institute) => institute._id.toString() === restaurant.institute).name;
            // Replace cuisine ids with objects {_id, name}
            restaurant.cuisine = (restaurant.cuisine || []).map(cid => {
                const c = cuisines.find(cu => cu._id.toString() === cid.toString());
                return c ? { _id: c._id.toString(), name: c.name } : { _id: cid.toString(), name: null };
            });
            return restaurant;
        });

        console.log(restaurants);

        // Fetch all menuitems for these restaurants
        const restaurantIds = restaurants.map(r => new ObjectId(r._id));
        let allmenuitems = await db.collection('menuitems').find({ restaurantId: { $in: restaurantIds } }).sort({ cuisine: -1 }).toArray();
        // Add restaurant name and cuisine object to each menuitem
        allmenuitems = allmenuitems.map(item => {
            const rest = restaurants.find(r => r._id.toString() === item.restaurantId.toString());
            // Replace cuisine id with object {_id, name}
            let cuisineObj = null;
            if (item.cuisine) {
                const c = cuisines.find(cu => cu._id.toString() === item.cuisine.toString());
                cuisineObj = c ? { _id: c._id.toString(), name: c.name } : { _id: item.cuisine.toString(), name: null };
            }
            return { ...item, restaurantName: rest ? rest.name : null, cuisine: cuisineObj };
        });

        return NextResponse.json({restaurants, allmenuitems});
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
