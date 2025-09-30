import { NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import nodemailer from 'nodemailer';

// Create email transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    service: 'gmail', 
    auth: {
      user: process.env.EMAIL_USER, 
      pass: process.env.EMAIL_PASSWORD, 
    },
  });
};

async function authenticate(req) {
  try {
    const user = await verifyJWT(req);
    return user;
  } catch (error) {
    throw { status: 403, error: 'Authentication failed' };
  }
}

// === POST: Apply discount to menu items and send email notifications ===
export async function POST(req) {
  try {
    const user = await authenticate(req);
    const body = await req.json();
    const { menuItemIds, discountPercentage, validUntil } = body;

    // Validation
    if (!menuItemIds || !Array.isArray(menuItemIds) || menuItemIds.length === 0) {
      return NextResponse.json({ error: 'Menu item IDs are required' }, { status: 400 });
    }

    if (!discountPercentage || discountPercentage <= 0 || discountPercentage > 100) {
      return NextResponse.json({ error: 'Discount percentage must be between 1 and 100' }, { status: 400 });
    }

    if (!validUntil || new Date(validUntil) <= new Date()) {
      return NextResponse.json({ error: 'Valid until date must be in the future' }, { status: 400 });
    }

    const db = (await clientPromise).db();

    // Get owner's restaurant
    const restaurant = await db.collection('restaurants').findOne({ 
      ownerId: new ObjectId(user.userId) 
    });
    
    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    // Verify menu items belong to this restaurant
    const menuItemObjectIds = menuItemIds.map(id => new ObjectId(id));
    const menuItems = await db.collection('menuitems').find({
      _id: { $in: menuItemObjectIds },
      restaurantId: restaurant._id
    }).toArray();

    if (menuItems.length !== menuItemIds.length) {
      return NextResponse.json({ error: 'Some menu items not found or do not belong to your restaurant' }, { status: 404 });
    }

    // Update menu items with discount
    const discountData = {
      percentage: discountPercentage,
      validUntil: validUntil,
      createdAt: new Date()
    };

    await db.collection('menuitems').updateMany(
      { _id: { $in: menuItemObjectIds } },
      { 
        $set: { 
          discount: discountData,
          updatedAt: new Date() 
        } 
      }
    );

    // Get all users from the same institute as the restaurant
    const users = await db.collection('users').find({ 
      institute: restaurant.institute,
      role: 'user' // Only send to regular users, not admins or staff
    }).toArray();

    if (users.length > 0) {
      // Prepare email content
      const transporter = createTransporter();
      
      // Create menu items list for email
      const menuItemsList = menuItems.map(item => {
        const originalPrice = item.price;
        const discountedPrice = Math.round(originalPrice * (1 - discountPercentage / 100));
        return `
          <div style="margin: 15px 0; padding: 15px; background-color: #f9f9f9; border-radius: 8px; border-left: 4px solid #ff6b35;">
            <h3 style="margin: 0 0 5px 0; color: #333; font-size: 16px;">${item.name}</h3>
            <p style="margin: 5px 0; color: #666; font-size: 14px;">${item.description || 'Delicious food item'}</p>
            <div style="margin: 10px 0;">
              <span style="text-decoration: line-through; color: #999; margin-right: 10px;">৳${originalPrice}</span>
              <span style="color: #ff6b35; font-weight: bold; font-size: 18px;">৳${discountedPrice}</span>
              <span style="background-color: #ff6b35; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-left: 10px;">${discountPercentage}% OFF</span>
            </div>
          </div>
        `;
      }).join('');

      const validUntilFormatted = new Date(validUntil).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Send emails to all users
      const emailPromises = users.map(async (userRecord) => {
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: userRecord.email,
          subject: `🔥 Special Discount at ${restaurant.name} - Save ${discountPercentage}%!`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #2563eb; margin: 0;">Our Canteen</h1>
                <h2 style="color: #ff6b35; margin: 10px 0;">🔥 Special Discount Alert!</h2>
              </div>
              
              <div style="background-color: #fff3f0; padding: 30px; border-radius: 15px; border: 2px solid #ff6b35;">
                <h2 style="color: #1e293b; margin-top: 0; text-align: center;">
                  ${discountPercentage}% OFF at ${restaurant.name}
                </h2>
                
                <p style="color: #475569; font-size: 16px; line-height: 1.6; text-align: center;">
                  Hi ${userRecord.firstName || 'there'}! 🎉
                  <br><br>
                  Great news! ${restaurant.name} is offering an amazing <strong>${discountPercentage}% discount</strong> on selected food items. Don't miss out on these delicious deals!
                </p>

                <div style="margin: 25px 0;">
                  <h3 style="color: #1e293b; margin-bottom: 15px; text-align: center;">🍽️ Discounted Items:</h3>
                  ${menuItemsList}
                </div>

                <div style="text-align: center; margin: 30px 0; padding: 20px; background-color: #fef7ff; border-radius: 10px; border: 1px solid #ff6b35;">
                  <p style="color: #ef4444; font-size: 16px; font-weight: bold; margin: 0;">
                    ⏰ Hurry! Offer valid until:<br>
                    <span style="color: #ff6b35; font-size: 18px;">${validUntilFormatted}</span>
                  </p>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                  <div style="background-color: #ff6b35; color: white; padding: 15px 30px; border-radius: 25px; display: inline-block; font-weight: bold; font-size: 16px;">
                    Order Now & Save ${discountPercentage}%!
                  </div>
                </div>

                <p style="color: #475569; font-size: 14px; line-height: 1.5; text-align: center; margin-top: 20px;">
                  Open the Our Canteen app and head to ${restaurant.name} to place your order and enjoy these amazing savings!
                </p>
              </div>
              
              <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                  This is an automated promotional message from Our Canteen.
                  <br>Happy eating! 🍽️
                </p>
              </div>
            </div>
          `,
        };

        return transporter.sendMail(mailOptions);
      });

      // Send all emails
      try {
        await Promise.all(emailPromises);
        console.log(`Discount emails sent to ${users.length} users`);
      } catch (emailError) {
        console.error('Error sending discount emails:', emailError);
        // Don't fail the whole request if emails fail, discount is already applied
      }
    }

    return NextResponse.json({
      success: true,
      message: `Discount applied to ${menuItems.length} items and notifications sent to ${users.length} users`,
      appliedItems: menuItems.length,
      notifiedUsers: users.length
    });

  } catch (error) {
    console.error('Discount application error:', error);
    const status = error.status || 500;
    return NextResponse.json({ error: error.error || 'Failed to apply discount' }, { status });
  }
}

// === DELETE: Remove discount from menu items ===
export async function DELETE(req) {
  try {
    const user = await authenticate(req);
    const { searchParams } = new URL(req.url);
    const menuItemIds = searchParams.get('menuItemIds')?.split(',') || [];

    if (menuItemIds.length === 0) {
      return NextResponse.json({ error: 'Menu item IDs are required' }, { status: 400 });
    }

    const db = (await clientPromise).db();

    // Get owner's restaurant
    const restaurant = await db.collection('restaurants').findOne({ 
      ownerId: new ObjectId(user.userId) 
    });
    
    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    // Remove discount from menu items
    const menuItemObjectIds = menuItemIds.map(id => new ObjectId(id));
    const result = await db.collection('menuitems').updateMany(
      { 
        _id: { $in: menuItemObjectIds },
        restaurantId: restaurant._id
      },
      { 
        $unset: { discount: "" },
        $set: { updatedAt: new Date() }
      }
    );

    return NextResponse.json({
      success: true,
      message: `Discount removed from ${result.modifiedCount} items`,
      modifiedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('Remove discount error:', error);
    const status = error.status || 500;
    return NextResponse.json({ error: error.error || 'Failed to remove discount' }, { status });
  }
}

// === OPTIONS ===
export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}
