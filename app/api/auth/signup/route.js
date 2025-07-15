import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import clientPromise from '@/lib/mongodb';

const JWT_SECRET = process.env.JWT_SECRET;

// === Validate Input (like middleware) ===
function validate(data) {
  const { name, email, password, institute, studentId, phoneNumber } = data;

  if (!name || !email || !password || !institute || !studentId || !phoneNumber) {
    return 'All fields are required';
  }

  if (password.length < 6) {
    return 'Password must be at least 6 characters long';
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

    const { name, email, password, institute, studentId, phoneNumber } = body;
    const db = (await clientPromise).db();
    const users = db.collection('users');

    const existingUserEmail = await users.findOne({ email: email.toLowerCase() });
    const existingUserPhone = await users.findOne({ phoneNumber: phoneNumber });

    if (existingUserEmail) {
      return NextResponse.json({ error: 'User with this email already exists. Try Again with another Email.' }, { status: 409 });
    }

    if (existingUserPhone) {
      return NextResponse.json({ error: 'User with this phone number already exists. Try again with another Phone Number' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      institute: institute.trim(),
      studentId: studentId.trim(),
      phoneNumber: phoneNumber.trim(),
      credit: 0,
      isOwner: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await users.insertOne(user);

    const token = jwt.sign(
      { userId: result.insertedId, email: user.email, isOwner: false, staff: null },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return NextResponse.json({
      token,
      user: {
        id: result.insertedId,
        name: user.name,
        email: user.email,
        institute: user.institute,
        studentId: user.studentId,
        phoneNumber: user.phoneNumber,
        isOwner: false,
        stuff: null
      }
    }, { status: 201 });

  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}