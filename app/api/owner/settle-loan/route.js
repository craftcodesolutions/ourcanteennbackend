import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_in_production';

// === CRITICAL BUSINESS RULE ENFORCEMENT ===
// This function ensures that ALL loans marked as PAID must have a settledBy field
// This is mandatory for financial audit and staff accountability
function validateSettlementData(settledBy, loanIds) {
    if (!settledBy) {
        throw { 
            status: 400, 
            error: 'BUSINESS RULE VIOLATION: All loan settlements must have a valid settledBy field identifying the staff member who processed the settlement' 
        };
    }
    
    if (!loanIds || loanIds.length === 0) {
        throw { 
            status: 400, 
            error: 'BUSINESS RULE VIOLATION: Loan settlement requires valid loan IDs' 
        };
    }
    
    return true;
}

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

export async function POST(request) {
    try {
        // Authenticate user as owner or staff
        const user = await authenticate(request);
        const db = (await clientPromise).db();
        
        // Verify user is owner or staff
        const userRecord = await db.collection('users').findOne({
            _id: new ObjectId(user.userId),
            $or: [
                { isOwner: true },
                { 'staff.isStaff': true }
            ]
        });

        if (!userRecord) {
            return NextResponse.json({ 
                success: false, 
                error: 'Unauthorized access' 
            }, { status: 403 });
        }

        const body = await request.json();
        const { loanIds, userId, notes } = body;

        // Validate required fields
        if (!loanIds || !Array.isArray(loanIds) || loanIds.length === 0) {
            return NextResponse.json({ 
                success: false,
                error: 'Loan IDs array is required' 
            }, { status: 400 });
        }

        if (!userId) {
            return NextResponse.json({ 
                success: false,
                error: 'User ID is required' 
            }, { status: 400 });
        }

        // Convert loan IDs to ObjectIds
        const loanObjectIds = loanIds.map(id => new ObjectId(id));

        // Fetch all loans to validate and calculate total
        const loans = await db.collection('loans').find({
            _id: { $in: loanObjectIds },
            userId: userId,
            status: 'ACTIVE'
        }).toArray();

        if (loans.length === 0) {
            return NextResponse.json({ 
                success: false,
                error: 'No active loans found for the specified IDs' 
            }, { status: 404 });
        }

        if (loans.length !== loanIds.length) {
            return NextResponse.json({ 
                success: false,
                error: 'Some loan IDs are invalid or not active' 
            }, { status: 400 });
        }

        // Note: No time restriction for settlement - customers can pay loans immediately
        // The 1-hour rule only applies to loan cancellation, not settlement

        // Calculate total settlement amount
        const totalSettlementAmount = loans.reduce((sum, loan) => sum + loan.loanAmount, 0);

        // Start transaction
        const session = (await clientPromise).startSession();
        let transactionResult;

        try {
            transactionResult = await session.withTransaction(async () => {
                const currentTime = new Date();
                
                // ENFORCE BUSINESS RULE: Validate settlement requirements
                validateSettlementData(user.userId, loanIds);
                
                const settlementNotes = `Payment Method: Cash at Restaurant${notes ? ` - ${notes}` : ''} - Settled via Scanner by ${user.name || 'Staff'} - ${loans.length} loan(s) settled`;

                // Update all loans to PAID status
                const loanUpdateResult = await db.collection('loans').updateMany(
                    { _id: { $in: loanObjectIds } },
                    { 
                        $set: {
                            status: 'PAID',
                            paidAt: currentTime,
                            updatedAt: currentTime,
                            settledBy: user.userId, // MANDATORY: Staff attribution for settlement
                            notes: settlementNotes
                        }
                    },
                    { session }
                );

                if (loanUpdateResult.modifiedCount !== loans.length) {
                    throw { status: 500, error: 'Failed to update all loans' };
                }

                // VALIDATION: Ensure all loans have settledBy field set
                const verificationLoans = await db.collection('loans').find(
                    { _id: { $in: loanObjectIds } },
                    { session }
                ).toArray();
                
                const loansWithoutSettler = verificationLoans.filter(loan => !loan.settledBy);
                if (loansWithoutSettler.length > 0) {
                    throw { status: 500, error: 'CRITICAL ERROR: Some loans marked as PAID without settledBy field' };
                }

                // Restore customer credit (add total loan amount back)
                const creditUpdateResult = await db.collection('users').updateOne(
                    { _id: new ObjectId(userId) },
                    { $inc: { credit: totalSettlementAmount } },
                    { session }
                );

                if (creditUpdateResult.modifiedCount !== 1) {
                    throw { status: 500, error: 'Failed to update customer credit' };
                }

                return {
                    settledLoans: loans.length,
                    totalAmount: totalSettlementAmount,
                    loanIds: loanIds
                };
            });
        } finally {
            await session.endSession();
        }

        if (!transactionResult) {
            return NextResponse.json({ 
                success: false,
                error: 'Transaction failed, no changes applied' 
            }, { status: 500 });
        }

        // Fetch updated customer info
        const updatedCustomer = await db.collection('users').findOne(
            { _id: new ObjectId(userId) },
            { projection: { credit: 1, name: 1, email: 1, phoneNumber: 1 } }
        );

        return NextResponse.json({
            success: true,
            message: `Successfully settled ${transactionResult.settledLoans} loan(s)`,
            data: {
                settledLoans: transactionResult.settledLoans,
                totalAmount: transactionResult.totalAmount,
                loanIds: transactionResult.loanIds,
                customer: {
                    userId: userId,
                    name: updatedCustomer?.name,
                    email: updatedCustomer?.email,
                    phoneNumber: updatedCustomer?.phoneNumber,
                    newCreditBalance: updatedCustomer?.credit
                }
            }
        });

    } catch (err) {
        console.error('Error settling loans:', err);
        return NextResponse.json({ 
            success: false, 
            error: err.error || 'Internal server error',
        }, { status: err.status || 500 });
    }
}

// CORS handler
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
