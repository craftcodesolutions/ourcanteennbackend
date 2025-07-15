import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import clientPromise from '@/lib/mongodb';

const JWT_SECRET = process.env.JWT_SECRET;

// === Validate Input (like middleware) ===
function validate(data) {
  const { name, email, institute, studentId, phoneNumber } = data;

  if (!name || !email || !institute || !studentId || !phoneNumber) {
    return 'All fields are required';
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Invalid email format';
  }

  return null;
}

// === Handle POST Request ===
export async function POST(req) {
  try {
    const body = await req.json();
    const error = validate(body);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    const { name, email, institute, studentId, phoneNumber } = body;
    const db = (await clientPromise).db();
    const users = db.collection('users');

    // Find user by email
    const user = await users.findOne({ email: email.toLowerCase() });
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    // Update user (without password)
    const updateResult = await users.updateOne(
      { email: email.toLowerCase() },
      {
        $set: {
          name: name.trim(),
          institute: institute.trim(),
          studentId: studentId.trim(),
          phoneNumber: phoneNumber.trim(),
          updatedAt: new Date(),
        },
      }
    );

    // Get updated user
    const updatedUser = await users.findOne({ email: email.toLowerCase() });

    // Generate new token
    const token = jwt.sign(
      { userId: updatedUser._id, email: updatedUser.email, isOwner: updatedUser.isOwner || false },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return NextResponse.json({
      token,
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        institute: updatedUser.institute,
        studentId: updatedUser.studentId,
        phoneNumber: updatedUser.phoneNumber,
        isOwner: updatedUser.isOwner || false,
        staff: updatedUser.staff || null
      }
    }, { status: 200 });

  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}