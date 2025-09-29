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

export async function GET(request) {
  try {
    // Authenticate user
    const user = await authenticate(request);
    const userId = user.userId;
    
    console.log('Authenticated user:', { userId, userObject: user });
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'ALL'; // ALL, LOANS, TOPUPS
    const status = searchParams.get('status') || ''; // For loans: ACTIVE, PAID, CANCELLED
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 20;
    const skip = (page - 1) * limit;

    const db = (await clientPromise).db();

    let loans = [];
    let topups = [];
    let loanStats = null;
    let topupStats = null;

    // Fetch loans if type is ALL or LOANS
    if (type === 'ALL' || type === 'LOANS') {
      // Build loan query - userId is stored as string in loans collection
      const loanQuery = { userId: userId };
      if (status && status !== 'ALL') {
        loanQuery.status = status;
      }

      console.log('Loan query:', loanQuery);

      // Get loans with pagination
      const loansData = await db.collection('loans')
        .find(loanQuery)
        .sort({ createdAt: -1 })
        .skip(type === 'LOANS' ? skip : 0)
        .limit(type === 'LOANS' ? limit : limit / 2)
        .toArray();

      console.log('Found loans:', loansData.length, loansData);

      // Get restaurant info for each loan
      for (let loan of loansData) {
        const restaurant = await db.collection('restaurants').findOne({ _id: new ObjectId(loan.restaurantId) });
        loan.restaurantName = restaurant?.name || 'Unknown Restaurant';
      }

      loans = loansData;

      // Calculate loan statistics - userId is string
      const loanPipeline = [
        { $match: { userId: userId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$loanAmount' }
          }
        }
      ];

      const loanStatsData = await db.collection('loans').aggregate(loanPipeline).toArray();
      console.log('Loan stats data:', loanStatsData);
      
      loanStats = {
        active: { count: 0, totalAmount: 0 },
        paid: { count: 0, totalAmount: 0 },
        cancelled: { count: 0, totalAmount: 0 },
        total: { count: 0, totalAmount: 0 }
      };

      loanStatsData.forEach(stat => {
        const status = stat._id?.toLowerCase() || 'unknown';
        if (loanStats[status]) {
          loanStats[status] = { count: stat.count, totalAmount: stat.totalAmount };
        }
        loanStats.total.count += stat.count;
        loanStats.total.totalAmount += stat.totalAmount;
      });
    }

    // Fetch topups if type is ALL or TOPUPS
    if (type === 'ALL' || type === 'TOPUPS') {
      // Build topup query - note: topup collection uses userId as string, not ObjectId
      const topupQuery = { userId: userId };

      // Get topups with pagination
      const topupsData = await db.collection('topup')
        .find(topupQuery)
        .sort({ createdAt: -1 })
        .skip(type === 'TOPUPS' ? skip : 0)
        .limit(type === 'TOPUPS' ? limit : limit / 2)
        .toArray();

      // Transform topup data to match expected structure
      topups = topupsData.map(topup => ({
        ...topup,
        status: 'approved', // All topups in this collection are already approved
        updatedAt: topup.createdAt, // Use createdAt as updatedAt if not present
        approvedAt: topup.createdAt,
        notes: `Topup by ${topup.name || 'Staff'}`
      }));

      // Calculate topup statistics - since all topups are approved
      const totalTopups = await db.collection('topup').countDocuments({ userId: userId });
      const totalAmount = await db.collection('topup').aggregate([
        { $match: { userId: userId } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).toArray();

      const totalAmountValue = totalAmount.length > 0 ? totalAmount[0].total : 0;
      
      topupStats = {
        pending: { count: 0, totalAmount: 0 },
        approved: { count: totalTopups, totalAmount: totalAmountValue },
        rejected: { count: 0, totalAmount: 0 },
        total: { count: totalTopups, totalAmount: totalAmountValue }
      };
    }

    // Calculate pagination info
    let totalItems = 0;
    if (type === 'LOANS') {
      const loanQuery = { userId: userId }; // Use string, not ObjectId
      if (status && status !== 'ALL') {
        loanQuery.status = status;
      }
      totalItems = await db.collection('loans').countDocuments(loanQuery);
    } else if (type === 'TOPUPS') {
      totalItems = await db.collection('topup').countDocuments({ userId: userId });
    } else {
      // For ALL, we combine both but limit pagination complexity
      totalItems = loans.length + topups.length;
    }

    const totalPages = Math.ceil(totalItems / limit);

    console.log('Returning history data:', {
      loansCount: loans.length,
      topupsCount: topups.length,
      loanStats,
      topupStats,
      pagination: { currentPage: page, totalPages, totalItems }
    });

    return NextResponse.json({
      success: true,
      data: {
        loans,
        topups,
        statistics: {
          loans: loanStats,
          topups: topupStats
        },
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          limit,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });

  } catch (err) {
    console.error('Error fetching user history:', err);
    const status = err.status || 500;
    return NextResponse.json(
      { success: false, error: err.error || 'Internal server error' },
      { status }
    );
  }
}

// === CORS ===
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
