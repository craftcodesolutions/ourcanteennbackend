import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { ObjectId } from 'mongodb';

export async function GET(request) {
  try {
    // Verify token
    const authResult = await verifyToken(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: 401 }
      );
    }

    const userId = authResult.payload.userId;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'ALL'; // ALL, LOANS, TOPUPS
    const status = searchParams.get('status') || ''; // For loans: ACTIVE, PAID, CANCELLED
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 20;
    const skip = (page - 1) * limit;

    const { db } = await connectDB();

    let loans = [];
    let topups = [];
    let loanStats = null;
    let topupStats = null;

    // Fetch loans if type is ALL or LOANS
    if (type === 'ALL' || type === 'LOANS') {
      // Build loan query
      const loanQuery = { userId: new ObjectId(userId) };
      if (status && status !== 'ALL') {
        loanQuery.status = status;
      }

      // Get loans with pagination
      const loansData = await db.collection('loans')
        .find(loanQuery)
        .sort({ createdAt: -1 })
        .skip(type === 'LOANS' ? skip : 0)
        .limit(type === 'LOANS' ? limit : limit / 2)
        .toArray();

      // Get restaurant info for each loan
      for (let loan of loansData) {
        const restaurant = await db.collection('restaurants').findOne({ _id: new ObjectId(loan.restaurantId) });
        loan.restaurantName = restaurant?.name || 'Unknown Restaurant';
      }

      loans = loansData;

      // Calculate loan statistics
      const loanPipeline = [
        { $match: { userId: new ObjectId(userId) } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$loanAmount' }
          }
        }
      ];

      const loanStatsData = await db.collection('loans').aggregate(loanPipeline).toArray();
      
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
      // Build topup query
      const topupQuery = { userId: new ObjectId(userId) };

      // Get topups with pagination
      const topupsData = await db.collection('topups')
        .find(topupQuery)
        .sort({ createdAt: -1 })
        .skip(type === 'TOPUPS' ? skip : 0)
        .limit(type === 'TOPUPS' ? limit : limit / 2)
        .toArray();

      topups = topupsData;

      // Calculate topup statistics
      const topupPipeline = [
        { $match: { userId: new ObjectId(userId) } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        }
      ];

      const topupStatsData = await db.collection('topups').aggregate(topupPipeline).toArray();
      
      topupStats = {
        pending: { count: 0, totalAmount: 0 },
        approved: { count: 0, totalAmount: 0 },
        rejected: { count: 0, totalAmount: 0 },
        total: { count: 0, totalAmount: 0 }
      };

      topupStatsData.forEach(stat => {
        const status = stat._id?.toLowerCase() || 'unknown';
        if (topupStats[status]) {
          topupStats[status] = { count: stat.count, totalAmount: stat.totalAmount };
        }
        topupStats.total.count += stat.count;
        topupStats.total.totalAmount += stat.totalAmount;
      });
    }

    // Calculate pagination info
    let totalItems = 0;
    if (type === 'LOANS') {
      const loanQuery = { userId: new ObjectId(userId) };
      if (status && status !== 'ALL') {
        loanQuery.status = status;
      }
      totalItems = await db.collection('loans').countDocuments(loanQuery);
    } else if (type === 'TOPUPS') {
      totalItems = await db.collection('topups').countDocuments({ userId: new ObjectId(userId) });
    } else {
      // For ALL, we combine both but limit pagination complexity
      totalItems = loans.length + topups.length;
    }

    const totalPages = Math.ceil(totalItems / limit);

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

  } catch (error) {
    console.error('Error fetching user history:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
