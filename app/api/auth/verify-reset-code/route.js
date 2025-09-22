import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

// === POST: /api/auth/verify-reset-code ===
export async function POST(req) {
  try {
    const body = await req.json();
    const { email, code } = body;

    if (!email || !code) {
      return NextResponse.json({ error: 'Email and code are required' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }

    // Validate code format (4 digits)
    if (!/^\d{4}$/.test(code)) {
      return NextResponse.json({ error: 'Code must be 4 digits' }, { status: 400 });
    }

    const db = (await clientPromise).db();
    
    // Find the reset code
    const resetRequest = await db.collection('password_resets').findOne({
      email: email.toLowerCase().trim(),
      code: code,
      used: false
    });

    if (!resetRequest) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
    }

    // Check if code has expired
    if (new Date() > resetRequest.expiresAt) {
      // Remove expired code
      await db.collection('password_resets').deleteOne({ _id: resetRequest._id });
      return NextResponse.json({ error: 'Code has expired. Please request a new one.' }, { status: 400 });
    }

    // Mark code as verified (but not used yet - will be used when password is reset)
    await db.collection('password_resets').updateOne(
      { _id: resetRequest._id },
      { 
        $set: { 
          verified: true,
          verifiedAt: new Date()
        }
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Code verified successfully. You can now reset your password.',
      resetToken: resetRequest._id.toString() // Send this to identify the reset request
    });

  } catch (error) {
    console.error('Verify reset code error:', error);
    return NextResponse.json({ error: 'Failed to verify code. Please try again.' }, { status: 500 });
  }
}
