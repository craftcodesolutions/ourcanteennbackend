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

    const institutes = await db.collection('institutes').find({}).toArray();

    let restaurants = await db
      .collection('restaurants')
      .find({ institute: userRecord.institute })
      .sort({ createdAt: -1 })
      .toArray();

    restaurants = restaurants.map((restaurant) => {
      restaurant.institute = institutes.find((institute) => institute.id.toString() === restaurant.institute).name;
      return restaurant;
    });

    return NextResponse.json(restaurants);
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
    const { name, banner, location, institute } = body;

    if (!name || !banner || !location || !institute) {
      return NextResponse.json(
        { error: 'Name, location, and institute are required' },
        { status: 400 }
      );
    }

    const db = (await clientPromise).db();

    const existing = await db.collection('restaurants').findOne({
      ownerId: new ObjectId(user.userId)
    });

    if (existing) {
      return NextResponse.json({ error: 'You already have a restaurant' }, { status: 400 });
    }

    const restaurant = {
      name: name.trim(),
      location: location.trim(),
      institute: institute.trim(),
      banner: banner.trim(),
      ownerId: new ObjectId(user.userId),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('restaurants').insertOne(restaurant);

    await db.collection('users').updateOne(
      { _id: new ObjectId(user.userId) },
      { $set: { isOwner: true, updatedAt: new Date() } }
    );

    return NextResponse.json({ id: result.insertedId, ...restaurant }, { status: 201 });
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
