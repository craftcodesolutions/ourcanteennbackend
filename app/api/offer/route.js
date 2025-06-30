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

// === GET: Return all offers ===
export async function GET(req) {
  try {
    const user = await authenticate(req);
    const db = (await clientPromise).db();

    // Fetch all offers
    const offers = await db
      .collection('offers')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json(offers);
  } catch (err) {
    console.error(err);
    const status = err.status || 500;
    return NextResponse.json({ error: err.error || 'Server error' }, { status });
  }
}

// === POST: Create offer ===
export async function POST(req) {
  try {
    const user = await authenticate(req);

    console.log(user);

    const body = await req.json();
    const { title, image, discount, restaurant_id } = body;

    if (!title || !restaurant_id) {
      return NextResponse.json(
        { error: 'Required fields: title and restaurant_id' },
        { status: 400 }
      );
    }

    // Validate title length (VARCHAR(150))
    if (title.length > 150) {
      return NextResponse.json(
        { error: 'Title must be 150 characters or less' },
        { status: 400 }
      );
    }

    // Validate image URL length (VARCHAR(255))
    if (image && image.length > 255) {
      return NextResponse.json(
        { error: 'Image URL must be 255 characters or less' },
        { status: 400 }
      );
    }

    // Validate discount (NUMERIC(5,2))
    if (discount !== undefined && discount !== null) {
      const discountNum = parseFloat(discount);
      if (isNaN(discountNum) || discountNum < 0 || discountNum > 999.99) {
        return NextResponse.json(
          { error: 'Discount must be a number between 0 and 999.99' },
          { status: 400 }
        );
      }
    }

    const db = (await clientPromise).db();

    const offer = {
      title: title.trim(),
      image: image ? image.trim() : null,
      discount: discount !== undefined && discount !== null ? parseFloat(discount) : null,
      restaurant_id: parseInt(restaurant_id),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('offers').insertOne(offer);

    return NextResponse.json({ id: result.insertedId, ...offer }, { status: 201 });
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
