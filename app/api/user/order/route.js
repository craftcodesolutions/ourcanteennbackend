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

// === GET: Get all orders for the authenticated user ===
export async function GET(req) {
    try {
        const user = await authenticate(req);
        const db = (await clientPromise).db();
        const orders = await db.collection('orders').find({ userId: user.userId }).sort({ createdAt: -1 }).toArray();
        return NextResponse.json({ orders });
    } catch (err) {
        console.error(err);
        const status = err.status || 500;
        return NextResponse.json({ error: err.error || 'Server error' }, { status });
    }
}

// === POST: Create a new order for the authenticated user ===
export async function POST(req) {
    try {
        const user = await authenticate(req);
        const db = (await clientPromise).db();
        const body = await req.json();
        const {cart, collectionTime} = body;
        if (!Array.isArray(cart) || cart.length === 0) {
            return NextResponse.json({ error: 'Cart is empty or invalid' }, { status: 400 });
        }

        console.log('Creating order for user:', cart);

        const restaurantId = cart[0].restaurantId;

        // Calculate total price
        const total = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
        const order = {
            userId: user.userId,
            restaurantId: restaurantId,
            items: cart,
            total,
            status: 'PENDING',
            collectionTime,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await db.collection('orders').insertOne(order);
        return NextResponse.json({ orderId: result.insertedId, order });
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


// === PATCH: Cancel an order for the authenticated user ===
export async function PATCH(req) {
    try {
        const user = await authenticate(req);
        const db = (await clientPromise).db();
        const body = await req.json();
        const { orderId, confirmPenalty } = body;
        if (!orderId) {
            return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
        }
        const orderObjectId = new ObjectId(orderId);
        
        // First, check if the order exists and belongs to the user
        const order = await db.collection('orders').findOne({ _id: orderObjectId, userId: user.userId });
        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }
        
        // If already cancelled, return regular response (not error)
        if (order.status === 'CANCELLED') {
            const orders = await db.collection('orders').find({ userId: user.userId }).sort({ createdAt: -1 }).toArray();
            return NextResponse.json({ message: 'Order already cancelled', order, orders });
        }
        
        // Cannot cancel SUCCESS orders (food already taken)
        if (order.status === 'SUCCESS') {
            return NextResponse.json({ error: 'Cannot cancel completed orders. Food has already been received.' }, { status: 400 });
        }

        // Get restaurant penalty settings
        const restaurant = await db.collection('restaurants').findOne({ 
            _id: new ObjectId(order.restaurantId) 
        });
        
        if (!restaurant) {
            return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
        }

        // Use restaurant-specific penalty settings or defaults
        const penaltySettings = restaurant.penaltySettings || {
            enabled: true,
            penaltyRate: 10, // 10% default
            timeThreshold: 6, // 6 hours default
            allowNegativeBalance: true
        };

        // Calculate penalty based on restaurant settings
        const now = new Date();
        const collectionTime = new Date(order.collectionTime);
        const hoursUntilCollection = (collectionTime.getTime() - now.getTime()) / (1000 * 60 * 60);
        
        const penaltyRateDecimal = penaltySettings.penaltyRate / 100;
        const rawPenaltyAmount = order.total * penaltyRateDecimal;
        // Apply penalty if cancelling within the threshold time before collection
        const penaltyAmount = hoursUntilCollection < penaltySettings.timeThreshold && hoursUntilCollection > 0 && penaltySettings.enabled ? 
            Math.round(rawPenaltyAmount * 10) / 10 : 0; // Round to 1 decimal place
        const requiresPenalty = hoursUntilCollection < penaltySettings.timeThreshold && hoursUntilCollection > 0 && penaltySettings.enabled;
        
        // If penalty is required but not confirmed, return penalty information
        if (requiresPenalty && !confirmPenalty) {
            return NextResponse.json({ 
                requiresPenalty: true,
                penaltyAmount,
                penaltyRate: penaltySettings.penaltyRate,
                timeThreshold: penaltySettings.timeThreshold,
                hoursUntilCollection: Math.round(hoursUntilCollection * 10) / 10,
                order: {
                    _id: order._id,
                    total: order.total,
                    collectionTime: order.collectionTime,
                    createdAt: order.createdAt
                }
            }, { status: 200 });
        }

        // Get user's current credit for penalty deduction
        let finalPenalty = 0;
        if (requiresPenalty) {
            const customer = await db.collection('users').findOne({ _id: new ObjectId(user.userId) });
            if (!customer) {
                return NextResponse.json({ error: 'User not found' }, { status: 404 });
            }
            
            // Apply full penalty amount (can go negative if restaurant allows)
            if (penaltySettings.allowNegativeBalance) {
                finalPenalty = penaltyAmount;
            } else {
                // Only deduct penalty if user has sufficient credit
                finalPenalty = Math.min(penaltyAmount, customer.credit || 0);
            }
        }

        // Use transaction for penalty and cancellation
        const session = (await clientPromise).startSession();
        let result;
        
        try {
            result = await session.withTransaction(async () => {
                // Update order status with penalty information
                const orderUpdate = await db.collection('orders').findOneAndUpdate(
                    { _id: orderObjectId },
                    { 
                        $set: { 
                            status: 'CANCELLED', 
                            updatedAt: new Date(),
                            penaltyApplied: finalPenalty,
                            penaltyRate: requiresPenalty ? penaltySettings.penaltyRate : 0,
                            cancelledAt: new Date(),
                            hoursElapsedAtCancel: hoursElapsed
                        } 
                    },
                    { returnDocument: 'after', session }
                );

                // Deduct penalty from user credit if applicable
                if (finalPenalty > 0) {
                    const creditUpdate = await db.collection('users').updateOne(
                        { _id: new ObjectId(user.userId) },
                        { $inc: { credit: -finalPenalty } },
                        { session }
                    );
                    
                    if (creditUpdate.modifiedCount !== 1) {
                        throw { status: 500, error: 'Failed to apply penalty' };
                    }

                    // Create penalty record for tracking
                    await db.collection('penalties').insertOne({
                        userId: user.userId,
                        orderId: orderId,
                        amount: finalPenalty,
                        reason: 'EARLY_CANCELLATION',
                        hoursElapsed: hoursElapsed,
                        orderTotal: order.total,
                        penaltyRate: penaltySettings.penaltyRate,
                        createdAt: new Date()
                    }, { session });
                }

                return orderUpdate.value;
            });
        } finally {
            await session.endSession();
        }

        // After cancelling, return all orders for the user (like GET)
        const orders = await db.collection('orders').find({ userId: user.userId }).sort({ createdAt: -1 }).toArray();
        
        return NextResponse.json({ 
            message: 'Order cancelled successfully', 
            order: result, 
            orders,
            penaltyApplied: finalPenalty,
            penaltyMessage: finalPenalty > 0 ? `A penalty of ৳${finalPenalty} has been deducted from your account.` : null
        });
        
    } catch (err) {
        console.error(err);
        const status = err.status || 500;
        return NextResponse.json({ error: err.error || 'Server error' }, { status });
    }
}
