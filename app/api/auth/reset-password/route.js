import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';

// === POST: /api/auth/reset-password ===
export async function POST(req) {
  try {
    const body = await req.json();
    const { email, resetToken, newPassword, confirmPassword } = body;

    // Validation
    if (!email || !resetToken || !newPassword || !confirmPassword) {
      return NextResponse.json({ 
        error: 'Email, reset token, new password, and confirm password are required' 
      }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long' }, { status: 400 });
    }

    const db = (await clientPromise).db();
    
    // Verify the reset token
    let resetObjectId;
    try {
      resetObjectId = new ObjectId(resetToken);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid reset token' }, { status: 400 });
    }

    const resetRequest = await db.collection('password_resets').findOne({
      _id: resetObjectId,
      email: email.toLowerCase().trim(),
      used: false,
      verified: true // Must be verified first
    });

    if (!resetRequest) {
      return NextResponse.json({ error: 'Invalid or expired reset request' }, { status: 400 });
    }

    // Check if reset request has expired
    if (new Date() > resetRequest.expiresAt) {
      // Remove expired reset request
      await db.collection('password_resets').deleteOne({ _id: resetObjectId });
      return NextResponse.json({ error: 'Reset request has expired. Please start over.' }, { status: 400 });
    }

    // Verify user exists
    const user = await db.collection('users').findOne({
      email: email.toLowerCase().trim()
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Hash the new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update user's password
    await db.collection('users').updateOne(
      { _id: user._id },
      { 
        $set: { 
          password: hashedPassword,
          passwordUpdatedAt: new Date()
        }
      }
    );

    // Mark reset request as used and remove it
    await db.collection('password_resets').deleteOne({ _id: resetObjectId });

    // Also remove any other pending reset requests for this email
    await db.collection('password_resets').deleteMany({ 
      email: email.toLowerCase().trim() 
    });

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully. You can now sign in with your new password.'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Failed to reset password. Please try again.' }, { status: 500 });
  }
}
