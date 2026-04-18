const { connectDB } = require('../../config/database');
const { getModel } = require('../../models');
const SalesModel = getModel('sales');

const resolveDb = async (db) => (db ? db : connectDB());

const SalesService = {
  async getMonthlySales(db, month) {
    const database = await resolveDb(db);
    const now = new Date();
    const year = now.getFullYear();
    const monthValue = parseInt(month, 10) || now.getMonth() + 1;

    const startOfMonth = new Date(year, monthValue - 1, 1);
    const endOfMonth = new Date(year, monthValue, 0, 23, 59, 59, 999);

    return SalesModel.aggregate(database, [
      { $match: { purchase_date: { $gte: startOfMonth, $lte: endOfMonth } } },
      {
        $group: {
          _id: { $dayOfMonth: '$purchase_date' },
          totalSales: { $sum: '$price' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
  },

  async getYearlySales(db) {
    const database = await resolveDb(db);
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

    const salesData = await SalesModel.aggregate(database, [
      { $match: { purchase_date: { $gte: startOfYear, $lte: endOfYear } } },
      {
        $group: {
          _id: { $month: '$purchase_date' },
          totalSales: { $sum: '$price' },
          count: { $sum: 1 }
        }
      }
    ]);

    const fullYear = [];
    for (let m = 1; m <= 12; m++) {
      const found = salesData.find(r => r._id === m);
      fullYear.push({
        _id: m,
        totalSales: found ? found.totalSales : 0,
        count: found ? found.count : 0
      });
    }

    return fullYear;
  },

  async getStoreRevenue(db) {
    const database = await resolveDb(db);

    const [row] = await database.collection('sales').aggregate([
      {
        $facet: {
          totals: [
            { $group: { _id: null, totalRevenue: { $sum: { $ifNull: ['$price', 0] } }, totalSales: { $sum: 1 } } }
          ],
          monthly: [
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m', date: '$purchase_date' } },
                revenue: { $sum: { $ifNull: ['$price', 0] } }
              }
            },
            { $sort: { _id: 1 } }
          ],
          yearly: [
            {
              $group: {
                _id: { $toString: { $year: '$purchase_date' } },
                revenue: { $sum: { $ifNull: ['$price', 0] } }
              }
            },
            { $sort: { _id: 1 } }
          ],
          product: [
            {
              $group: {
                _id: '$product_id',
                revenue: { $sum: { $ifNull: ['$price', 0] } }
              }
            },
            { $sort: { revenue: -1 } },
            { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
            { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
            { $project: { _id: 0, name: { $ifNull: ['$product.name', 'Unknown'] }, revenue: 1 } }
          ]
        }
      },
      {
        $project: {
          totals: { $ifNull: [{ $first: '$totals' }, { totalRevenue: 0, totalSales: 0 }] },
          monthly: 1,
          yearly: 1,
          product: 1
        }
      }
    ]).toArray();

    const totals = row?.totals || { totalRevenue: 0, totalSales: 0 };
    const monthlyRevenue = Object.fromEntries((row?.monthly || []).map((m) => [m._id, m.revenue]));
    const yearlyRevenue = Object.fromEntries((row?.yearly || []).map((y) => [y._id, y.revenue]));
    const productRevenue = Object.fromEntries((row?.product || []).map((p) => [p.name, p.revenue]));

    return {
      totalRevenue: totals.totalRevenue || 0,
      monthlyRevenue,
      yearlyRevenue,
      productRevenue,
      totalSales: totals.totalSales || 0
    };
  },

  async getRevenueInsights(db) {
    const database = await resolveDb(db);

    const monthlyRows = await SalesModel.aggregate(database, [
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$purchase_date' } },
          revenue: { $sum: { $ifNull: ['$price', 0] } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    let peakMonth = null;
    let lowestMonth = null;
    const months = [];
    const monthlyStats = {};
    for (const row of monthlyRows || []) {
      months.push(row._id);
      monthlyStats[row._id] = { revenue: row.revenue || 0, count: row.count || 0 };
      if (!peakMonth || (row.revenue || 0) > peakMonth.revenue) peakMonth = { month: row._id, revenue: row.revenue || 0, count: row.count || 0 };
      if (!lowestMonth || (row.revenue || 0) < lowestMonth.revenue) lowestMonth = { month: row._id, revenue: row.revenue || 0, count: row.count || 0 };
    }

    let growthPercentage = 0;
    const insights = [];

    if (months.length >= 2) {
      const currentMonthKey = months[months.length - 1];
      const prevMonthKey = months[months.length - 2];
      const current = monthlyStats[currentMonthKey];
      const prev = monthlyStats[prevMonthKey];

      growthPercentage = prev.revenue > 0 ? Math.round(((current.revenue - prev.revenue) / prev.revenue) * 100) : 100;

      if (growthPercentage > 0) {
        insights.push(`Revenue grew by ${growthPercentage}% compared to the previous month.`);
        if (current.count > prev.count) insights.push('Transaction volume increased, contributing to revenue growth.');
        else insights.push('Average order value increased despite lower or stable transaction volume.');
      } else if (growthPercentage < 0) {
        insights.push(`Revenue dropped by ${Math.abs(growthPercentage)}% compared to the previous month.`);
        if (current.count < prev.count) insights.push('Lower transaction volume was a primary factor.');
        else insights.push('Average order value decreased despite stable transaction volume.');
      } else {
        insights.push('Revenue remained stable compared to the previous month.');
      }
    } else {
      insights.push('Not enough data to calculate growth trends.');
    }

    const demandTrend = months.map(m => ({ month: m, revenue: monthlyStats[m].revenue }));

    return {
      peakMonth,
      lowestMonth,
      growthPercentage,
      demandTrend,
      insights,
      totalMonths: months.length
    };
  }
};

module.exports = SalesService;
