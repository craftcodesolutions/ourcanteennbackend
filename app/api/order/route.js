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

// === POST: Create order ===
export async function POST(req) {
  try {
    const user = await authenticate(req);

    console.log(user);

    const body = await req.json();
    const { productId, price, quantity, userId, image, restaurant_id, restaurant_name, email, studentId } = body;

    if (!productId || !price || !quantity || !userId || !image || !restaurant_id || !restaurant_name || !email || !studentId) {
      return NextResponse.json(
        { error: 'All fields are required: productId, price, quantity, userId, image, restaurant_id, restaurant_name, email, studentId' },
        { status: 400 }
      );
    }

    const db = (await clientPromise).db();

    const order = {
      productId: new ObjectId(productId),
      price: parseFloat(price),
      amount: Number(price) * Number(quantity),
      quantity: parseInt(quantity),
      userId: userId,
      image: image.trim(),
      restaurant_id: restaurant_id,
      restaurant_name: restaurant_name,
      email: email.trim(),
      studentId: studentId.trim(),
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('orders').insertOne(order);

    return NextResponse.json({ id: result.insertedId, ...order }, { status: 201 });
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
