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
    const sales = await SalesModel.aggregate(database, [
      {
        $lookup: {
          from: 'products',
          localField: 'product_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } }
    ]);

    const totalRevenue = sales.reduce((sum, s) => sum + (s.price || 0), 0);

    const monthlyRevenue = {};
    sales.forEach(s => {
      const d = new Date(s.purchase_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyRevenue[key] = (monthlyRevenue[key] || 0) + (s.price || 0);
    });

    const yearlyRevenue = {};
    sales.forEach(s => {
      const year = new Date(s.purchase_date).getFullYear().toString();
      yearlyRevenue[year] = (yearlyRevenue[year] || 0) + (s.price || 0);
    });

    const productRevenue = {};
    sales.forEach(s => {
      const name = s.product?.name || 'Unknown';
      productRevenue[name] = (productRevenue[name] || 0) + (s.price || 0);
    });

    return { totalRevenue, monthlyRevenue, yearlyRevenue, productRevenue, totalSales: sales.length };
  },

  async getRevenueInsights(db) {
    const database = await resolveDb(db);
    const sales = await SalesModel.findMany(database, {});

    const monthlyStats = {};
    sales.forEach(s => {
      const d = new Date(s.purchase_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyStats[key]) monthlyStats[key] = { revenue: 0, count: 0 };
      monthlyStats[key].revenue += (s.price || 0);
      monthlyStats[key].count += 1;
    });

    const sortedMonths = Object.entries(monthlyStats).sort((a, b) => b[1].revenue - a[1].revenue);
    const peakMonth = sortedMonths.length > 0 ? { month: sortedMonths[0][0], ...sortedMonths[0][1] } : null;
    const lowestMonth = sortedMonths.length > 0 ? { month: sortedMonths[sortedMonths.length - 1][0], ...sortedMonths[sortedMonths.length - 1][1] } : null;

    const months = Object.keys(monthlyStats).sort();
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
