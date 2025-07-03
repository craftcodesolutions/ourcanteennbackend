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

// === GET: Return details of a single restaurant and its menu ===
export async function GET(req, { params }) {
    try {
        const user = await authenticate(req);
        const db = (await clientPromise).db();

        // Fetch user's full record to get their institute
        const userRecord = await db.collection('users').findOne({ _id: new ObjectId(user.userId) });
        if (!userRecord) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Get restaurantId from params
        const { restaurentId } = await params;
        if (!restaurentId) {
            return NextResponse.json({ error: 'Restaurant ID required' }, { status: 400 });
        }

        // Fetch all institutes for mapping
        const institutes = await db.collection('institutes').find({}).toArray();
        // Fetch all cuisines for mapping
        const cuisines = await db.collection('cuisines').find({}).toArray();

        // Find the restaurant with the given _id and user's institute
        let restaurant = await db
            .collection('restaurants')
            .findOne({ _id: new ObjectId(restaurentId), institute: userRecord.institute });
        if (!restaurant) {
            return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
        }

        // Map institute and cuisine fields
        restaurant.institute = institutes.find((institute) => institute._id.toString() === restaurant.institute)?.name || null;
        restaurant.cuisine = (restaurant.cuisine || []).map(cid => {
            const c = cuisines.find(cu => cu._id.toString() === cid.toString());
            return c ? { _id: c._id.toString(), name: c.name } : { _id: cid.toString(), name: null };
        });

        // Fetch all menuitems for this restaurant
        let menuitems = await db.collection('menuitems').find({ restaurantId: new ObjectId(restaurentId) }).sort({ cuisine: -1 }).toArray();
        // Add cuisine object to each menuitem
        menuitems = menuitems.map(item => {
            let cuisineObj = null;
            if (item.cuisine) {
                const c = cuisines.find(cu => cu._id.toString() === item.cuisine.toString());
                cuisineObj = c ? { _id: c._id.toString(), name: c.name } : { _id: item.cuisine.toString(), name: null };
            }
            return { ...item, cuisine: cuisineObj };
        });

        // Categorize menuitems by cuisine
        const menuByCuisine = {};
        menuitems.forEach(item => {
            const cuisineKey = item.cuisine && item.cuisine.name ? `${item.cuisine._id}:${item.cuisine.name}` : 'Uncategorized';
            if (!menuByCuisine[cuisineKey]) menuByCuisine[cuisineKey] = [];
            menuByCuisine[cuisineKey].push(item);
        });

        return NextResponse.json({ restaurant, menuByCuisine });
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
