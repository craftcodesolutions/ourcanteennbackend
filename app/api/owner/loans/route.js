import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { authenticate } from '@/lib/auth';

// === CRITICAL BUSINESS RULE ENFORCEMENT ===
// This function ensures that ALL loans marked as PAID must have a settledBy field
// This is mandatory for financial audit and staff accountability
function validatePaidLoanUpdate(updateData, userId) {
    if (updateData.status === 'PAID') {
        if (!updateData.settledBy || !userId) {
            throw { 
                status: 400, 
                error: 'BUSINESS RULE VIOLATION: All PAID loans must have a valid settledBy field identifying the staff member who processed the settlement' 
            };
        }
    }
    return true;
}

// === Authentication helper ===
async function authenticateOwnerOrStaff(req) {
    const user = await authenticate(req);
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
        throw { status: 401, error: 'You are not Owner or Staff' };
    }

    // Find the restaurant
    const restaurant = await db.collection('restaurants').findOne({
        $or: [
            { ownerId: new ObjectId(user.userId) },
            { 'staff.sid': new ObjectId(user.userId) }
        ]
    });

    if (!restaurant) {
        throw { status: 404, error: 'Restaurant not found' };
    }

    return { user, userRecord, restaurant, db };
}

// === GET: Fetch loans with filtering and pagination ===
export async function GET(req) {
    try {
        const { user, userRecord, restaurant, db } = await authenticateOwnerOrStaff(req);
        
        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status') || '';
        const page = parseInt(searchParams.get('page')) || 1;
        const limit = parseInt(searchParams.get('limit')) || 20;
        const skip = (page - 1) * limit;

        // Build filter query
        const filter = { restaurantId: restaurant._id.toString() };
        if (status && status !== 'ALL' && status !== '') {
            filter.status = status;
        }

        // Fetch loans with pagination
        const loans = await db.collection('loans')
            .find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();

        // Get total count for pagination
        const totalCount = await db.collection('loans').countDocuments(filter);
        const totalPages = Math.ceil(totalCount / limit);

        // Calculate statistics
        const statsQuery = { restaurantId: restaurant._id.toString() };
        const allLoans = await db.collection('loans').find(statsQuery).toArray();
        
        const stats = {
            total: { count: 0, totalAmount: 0 },
            active: { count: 0, totalAmount: 0 },
            paid: { count: 0, totalAmount: 0 },
            cancelled: { count: 0, totalAmount: 0 }
        };

        allLoans.forEach(loan => {
            const amount = loan.loanAmount || 0;
            stats.total.count++;
            stats.total.totalAmount += amount;
            
            switch (loan.status) {
                case 'ACTIVE':
                    stats.active.count++;
                    stats.active.totalAmount += amount;
                    break;
                case 'PAID':
                    stats.paid.count++;
                    stats.paid.totalAmount += amount;
                    break;
                case 'CANCELLED':
                    stats.cancelled.count++;
                    stats.cancelled.totalAmount += amount;
                    break;
            }
        });

        return NextResponse.json({
            success: true,
            loans: loans,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalCount: totalCount,
                hasMore: page < totalPages
            },
            statistics: stats
        }, { status: 200 });

    } catch (err) {
        console.error('Error fetching loans:', err);
        const status = err.status || 500;
        return NextResponse.json({ 
            success: false,
            error: err.error || 'Failed to fetch loans' 
        }, { status });
    }
}

// === PUT: Update loan status ===
export async function PUT(req) {
    try {
        const { user, userRecord, restaurant, db } = await authenticateOwnerOrStaff(req);
        
        const body = await req.json();
        const { loanId, status: newStatus, notes } = body;

        if (!loanId || !newStatus) {
            return NextResponse.json({ 
                success: false,
                error: 'Loan ID and status are required' 
            }, { status: 400 });
        }

        // Validate status
        if (!['PAID', 'CANCELLED'].includes(newStatus)) {
            return NextResponse.json({ 
                success: false,
                error: 'Invalid status. Only PAID or CANCELLED are allowed' 
            }, { status: 400 });
        }

        // Find the loan
        const loan = await db.collection('loans').findOne({
            _id: new ObjectId(loanId),
            restaurantId: restaurant._id.toString()
        });

        if (!loan) {
            return NextResponse.json({ 
                success: false,
                error: 'Loan not found' 
            }, { status: 404 });
        }

        // Check if loan is already in final state
        if (loan.status === 'PAID' || loan.status === 'CANCELLED') {
            return NextResponse.json({ 
                success: false,
                error: `Loan is already ${loan.status.toLowerCase()}` 
            }, { status: 400 });
        }

        // Prevent cancellation within 1 hour of loan creation
        if (newStatus === 'CANCELLED') {
            const loanCreatedTime = new Date(loan.createdAt).getTime();
            const currentTime = new Date().getTime();
            const timeDifferenceHours = (currentTime - loanCreatedTime) / (1000 * 60 * 60);
            
            if (timeDifferenceHours < 1) {
                return NextResponse.json({ 
                    success: false,
                    error: `Loans cannot be cancelled within 1 hour of being issued. This loan was created ${Math.round(timeDifferenceHours * 60)} minutes ago.` 
                }, { status: 400 });
            }
        }

        // Start transaction for loan update
        const session = db.client.startSession();
        let transactionResult;

        try {
            transactionResult = await session.withTransaction(async () => {
                // Prepare update data
                const updateData = {
                    status: newStatus,
                    updatedAt: new Date()
                };

                // Add timestamp and notes based on status
                if (newStatus === 'PAID') {
                    updateData.paidAt = new Date();
                    updateData.settledBy = user.userId; // MANDATORY: Staff attribution for settlement
                    if (notes) updateData.notes = notes;
                    
                    // ENFORCE BUSINESS RULE: Validate PAID loan requirements
                    validatePaidLoanUpdate(updateData, user.userId);
                } else if (newStatus === 'CANCELLED') {
                    updateData.cancelledAt = new Date();
                    if (notes) updateData.notes = notes;
                }

                // Update loan record
                const loanUpdate = await db.collection('loans').updateOne(
                    { _id: new ObjectId(loanId) },
                    { $set: updateData },
                    { session }
                );

                if (loanUpdate.modifiedCount !== 1) {
                    throw { status: 500, error: 'Failed to update loan' };
                }

                // VALIDATION: Ensure settledBy field is set for PAID loans
                if (newStatus === 'PAID') {
                    const updatedLoan = await db.collection('loans').findOne(
                        { _id: new ObjectId(loanId) },
                        { session }
                    );
                    
                    if (!updatedLoan.settledBy) {
                        throw { status: 500, error: 'CRITICAL ERROR: Loan marked as PAID without settledBy field' };
                    }
                }

                // If loan is marked as PAID, update customer's credit
                if (newStatus === 'PAID') {
                    const creditUpdate = await db.collection('users').updateOne(
                        { _id: new ObjectId(loan.userId) },
                        { $inc: { credit: loan.loanAmount } },
                        { session }
                    );

                    if (creditUpdate.modifiedCount !== 1) {
                        throw { status: 500, error: 'Failed to update customer credit' };
                    }
                }

                return true;
            });
        } finally {
            await session.endSession();
        }

        if (transactionResult === undefined || transactionResult === false) {
            return NextResponse.json({ 
                success: false,
                error: 'Loan update transaction failed' 
            }, { status: 500 });
        }

        // Fetch updated loan for response
        const updatedLoan = await db.collection('loans').findOne({
            _id: new ObjectId(loanId)
        });

        return NextResponse.json({
            success: true,
            message: `Loan marked as ${newStatus.toLowerCase()}`,
            loan: updatedLoan
        }, { status: 200 });

    } catch (err) {
        console.error('Error updating loan:', err);
        const status = err.status || 500;
        return NextResponse.json({ 
            success: false,
            error: err.error || 'Failed to update loan' 
        }, { status });
    }
}

// === CORS ===
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
