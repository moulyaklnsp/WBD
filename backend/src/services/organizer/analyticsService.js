const { connectDB } = require('../../config/database');
const moment = require('moment');
const { requireOrganizer } = require('./organizerUtils');
const { getModel } = require('../../models');
const UserModel = getModel('users');
const TournamentModel = getModel('tournaments');
const ProductsModel = getModel('products');
const SalesModel = getModel('sales');
const MeetingsModel = getModel('meetingsdb');
const TournamentPlayersModel = getModel('tournament_players');
const TeamEnrollmentsModel = getModel('enrolledtournaments_team');

const createError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const resolveDb = async (db) => (db ? db : connectDB());

const AnalyticsService = {
  async getDashboard(db, user) {
    requireOrganizer(user);
    const organizerEmail = user?.email;
    const database = await resolveDb(db);

    const organizer = await UserModel.findOne(database, {
      email: organizerEmail,
      role: 'organizer'
    });

    const threeDaysLater = moment().add(3, 'days').toDate();
    const today = new Date();

    const meetings = await MeetingsModel.findMany(
      database,
      {
        date: {
          $gte: today,
          $lte: threeDaysLater
        }
      },
      { sort: { date: 1, time: 1 } }
    );

    const pendingApprovals = await TournamentModel.findMany(
      database,
      {
        status: 'Pending',
        date: { $gte: today, $lte: threeDaysLater }
      },
      { sort: { date: 1 } }
    );

    return {
      organizerName: organizer?.name || 'Organizer',
      meetings: meetings || [],
      pendingApprovals: pendingApprovals || []
    };
  },

  async getStoreSummary(db) {
    const database = await resolveDb(db);

    const products = await ProductsModel.findMany(database, {});

    const sales = await SalesModel.aggregate(database, [
      {
        $lookup: {
          from: 'products',
          localField: 'product_id',
          foreignField: '_id',
          as: 'productInfo'
        }
      },
      { $unwind: '$productInfo' },
      {
        $project: {
          product: '$productInfo.name',
          price: 1,
          coordinator: '$productInfo.coordinator',
          college: '$productInfo.college',
          buyer: 1,
          purchase_date: 1
        }
      },
      { $sort: { purchase_date: -1 } }
    ]);

    return {
      products: products || [],
      sales: sales || []
    };
  },

  async getTournamentRevenue(db) {
    const database = await resolveDb(db);

    const tournaments = await TournamentModel.findMany(database, { status: { $in: ['Approved', 'Ongoing', 'Completed'] } });

    const revenueData = [];
    for (const t of tournaments) {
      const playerCount = await TournamentPlayersModel.countDocuments(database, { tournament_id: t._id });
      const teamCount = await TeamEnrollmentsModel.countDocuments(database, { tournament_id: t._id });
      const totalPlayers = playerCount + (teamCount * 4);
      const revenue = totalPlayers * (t.entry_fee || 0);
      revenueData.push({
        name: t.name,
        date: t.date,
        status: t.status,
        entryFee: t.entry_fee || 0,
        players: totalPlayers,
        revenue,
        coordinator: t.coordinator
      });
    }

    const monthlyRevenue = {};
    revenueData.forEach(t => {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyRevenue[key] = (monthlyRevenue[key] || 0) + t.revenue;
    });

    const yearlyRevenue = {};
    revenueData.forEach(t => {
      const year = new Date(t.date).getFullYear().toString();
      yearlyRevenue[year] = (yearlyRevenue[year] || 0) + t.revenue;
    });

    const totalRevenue = revenueData.reduce((sum, t) => sum + t.revenue, 0);

    return { tournaments: revenueData, monthlyRevenue, yearlyRevenue, totalRevenue };
  },

  async getCoordinatorPerformance(db) {
    const database = await resolveDb(db);
    const coordinators = await UserModel.findMany(
      database,
      { role: 'coordinator', isDeleted: { $ne: 1 } },
      { projection: { name: 1, email: 1, college: 1 } }
    );

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const performanceData = [];
    for (const coord of coordinators) {
      const coordName = coord.name;

      const tournaments = await TournamentModel.findMany(
        database,
        { coordinator: coordName, status: { $nin: ['Removed', 'Rejected'] } }
      );
      const totalTournaments = tournaments.length;

      const products = await ProductsModel.findMany(database, { coordinator: coordName });
      const productIds = products.map(p => p._id);

      const sales = productIds.length > 0
        ? await SalesModel.findMany(database, { product_id: { $in: productIds } })
        : [];

      const totalProductsSold = sales.length;
      const revenueContribution = sales.reduce((sum, s) => sum + (s.price || 0), 0);

      const currentMonthRevenue = sales
        .filter(s => new Date(s.purchase_date) >= currentMonthStart)
        .reduce((sum, s) => sum + (s.price || 0), 0);

      const prevMonthRevenue = sales
        .filter(s => {
          const d = new Date(s.purchase_date);
          return d >= prevMonthStart && d <= prevMonthEnd;
        })
        .reduce((sum, s) => sum + (s.price || 0), 0);

      const growth = prevMonthRevenue > 0
        ? Math.round(((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100)
        : (currentMonthRevenue > 0 ? 100 : 0);

      let tournamentRevenue = 0;
      for (const t of tournaments) {
        const playerCount = await TournamentPlayersModel.countDocuments(database, { tournament_id: t._id });
        const teamCount = await TeamEnrollmentsModel.countDocuments(database, { tournament_id: t._id });
        const totalPlayers = playerCount + (teamCount * 4);
        tournamentRevenue += totalPlayers * (t.entry_fee || 0);
      }

      performanceData.push({
        name: coordName,
        email: coord.email,
        college: coord.college,
        totalTournaments,
        totalProductsSold,
        storeRevenue: revenueContribution,
        tournamentRevenue,
        totalRevenue: revenueContribution + tournamentRevenue,
        growthPercentage: growth
      });
    }

    performanceData.sort((a, b) => b.totalRevenue - a.totalRevenue);
    performanceData.forEach((p, i) => { p.rank = i + 1; });

    return { coordinators: performanceData };
  },

  async getGrowthAnalysis(db) {
    const database = await resolveDb(db);

    const toMonthKey = (dateValue) => {
      if (!dateValue) return null;
      const d = new Date(dateValue);
      if (Number.isNaN(d.getTime())) return null;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    const parseMonthKey = (month) => {
      if (!month || !/^\d{4}-\d{2}$/.test(month)) return null;
      const [year, mon] = month.split('-').map(Number);
      return new Date(year, mon - 1, 1);
    };

    const formatMonthKey = (dateObj) => {
      if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) return null;
      return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
    };

    const inferCreatedDate = (doc, preferredFields = []) => {
      for (const field of preferredFields) {
        const value = doc?.[field];
        if (!value) continue;
        const d = new Date(value);
        if (!Number.isNaN(d.getTime())) return d;
      }
      if (doc?._id && typeof doc._id.getTimestamp === 'function') {
        const d = doc._id.getTimestamp();
        if (!Number.isNaN(new Date(d).getTime())) return d;
      }
      return null;
    };

    const increment = (mapObj, key, by = 1) => {
      if (!key) return;
      mapObj[key] = Number(mapObj[key] || 0) + Number(by || 0);
    };

    const computeGrowthRate = (series, valueKey) => {
      if (!Array.isArray(series) || series.length < 2) return 0;
      const previous = Number(series[series.length - 2]?.[valueKey] || 0);
      const current = Number(series[series.length - 1]?.[valueKey] || 0);
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const buildMonthRange = (monthKeys) => {
      if (!monthKeys.length) return [];
      const sorted = [...monthKeys].sort((a, b) => a.localeCompare(b));
      const start = parseMonthKey(sorted[0]);
      const end = parseMonthKey(sorted[sorted.length - 1]);
      if (!start || !end) return sorted;

      const result = [];
      const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
      const boundary = new Date(end.getFullYear(), end.getMonth(), 1);
      while (cursor <= boundary) {
        const key = formatMonthKey(cursor);
        if (key) result.push(key);
        cursor.setMonth(cursor.getMonth() + 1);
      }
      return result;
    };

    const toSeries = (mapObj, valueKey, monthRange) =>
      monthRange.map((month) => ({ month, [valueKey]: Number(mapObj[month] || 0) }));

    const [users, sales, tournaments, meetings, teamEnrollments, individualEnrollments] = await Promise.all([
      UserModel.findMany(database, { isDeleted: { $ne: 1 } }),
      SalesModel.findMany(database, {}),
      TournamentModel.findMany(database, { status: { $nin: ['Removed', 'Rejected'] } }),
      MeetingsModel.findMany(database, {}),
      TeamEnrollmentsModel.findMany(database, {}),
      TournamentPlayersModel.findMany(database, {})
    ]);

    const userGrowthMap = {};
    const userRoleMonthlyNewMap = {};
    const revenueGrowthMap = {};
    const tournamentGrowthMap = {};
    const engagementGrowthMap = {};
    const platformBreakdownMap = {};

    const addPlatformMetric = (month, field, value = 1) => {
      if (!month) return;
      if (!platformBreakdownMap[month]) {
        platformBreakdownMap[month] = {
          users: 0,
          tournaments: 0,
          sales: 0,
          meetings: 0,
          enrollments: 0,
          total: 0
        };
      }
      platformBreakdownMap[month][field] += Number(value || 0);
      platformBreakdownMap[month].total += Number(value || 0);
    };

    users.forEach((user) => {
      const created = inferCreatedDate(user, ['created_date', 'created_at', 'signup_date']);
      const month = toMonthKey(created);
      increment(userGrowthMap, month, 1);
      if (month) {
        if (!userRoleMonthlyNewMap[month]) {
          userRoleMonthlyNewMap[month] = { players: 0, coordinators: 0, organizers: 0 };
        }
        if (user.role === 'player') userRoleMonthlyNewMap[month].players += 1;
        if (user.role === 'coordinator') userRoleMonthlyNewMap[month].coordinators += 1;
        if (user.role === 'organizer') userRoleMonthlyNewMap[month].organizers += 1;
      }
      addPlatformMetric(month, 'users', 1);
    });

    sales.forEach((sale) => {
      const purchaseDate = inferCreatedDate(sale, ['purchase_date', 'created_date', 'created_at']);
      const month = toMonthKey(purchaseDate);
      const price = Number(sale?.price || 0);
      increment(revenueGrowthMap, month, price);
      increment(engagementGrowthMap, month, 1);
      addPlatformMetric(month, 'sales', 1);
    });

    tournaments.forEach((tournament) => {
      const created = inferCreatedDate(tournament, ['submitted_date', 'created_date', 'created_at', 'added_date', 'approved_date', 'rejected_date']);
      const month = toMonthKey(created);
      increment(tournamentGrowthMap, month, 1);
      addPlatformMetric(month, 'tournaments', 1);
    });

    meetings.forEach((meeting) => {
      const created = inferCreatedDate(meeting, ['created_date', 'created_at']);
      const month = toMonthKey(created);
      increment(engagementGrowthMap, month, 1);
      addPlatformMetric(month, 'meetings', 1);
    });

    teamEnrollments.forEach((enrollment) => {
      const created = inferCreatedDate(enrollment, ['enrollment_date', 'created_date', 'created_at']);
      const month = toMonthKey(created);
      increment(engagementGrowthMap, month, 1);
      addPlatformMetric(month, 'enrollments', 1);
    });

    individualEnrollments.forEach((enrollment) => {
      const created = inferCreatedDate(enrollment, ['enrollment_date', 'created_date', 'created_at']);
      const month = toMonthKey(created);
      increment(engagementGrowthMap, month, 1);
      addPlatformMetric(month, 'enrollments', 1);
    });

    const allMonths = buildMonthRange([
      ...new Set([
        ...Object.keys(userGrowthMap),
        ...Object.keys(revenueGrowthMap),
        ...Object.keys(tournamentGrowthMap),
        ...Object.keys(engagementGrowthMap),
        ...Object.keys(platformBreakdownMap)
      ])
    ]);

    const platformGrowthMap = {};
    allMonths.forEach((month) => {
      platformGrowthMap[month] = Number(platformBreakdownMap[month]?.total || 0);
    });

    let runningPlayers = 0;
    let runningCoordinators = 0;
    let runningOrganizers = 0;
    const userRoleBreakdown = allMonths.map((month) => {
      const monthly = userRoleMonthlyNewMap[month] || { players: 0, coordinators: 0, organizers: 0 };
      runningPlayers += Number(monthly.players || 0);
      runningCoordinators += Number(monthly.coordinators || 0);
      runningOrganizers += Number(monthly.organizers || 0);
      return {
        month,
        players: runningPlayers,
        coordinators: runningCoordinators,
        organizers: runningOrganizers,
        totalUsers: runningPlayers + runningCoordinators + runningOrganizers
      };
    });

    const userGrowth = toSeries(userGrowthMap, 'count', allMonths);
    const revenueGrowth = toSeries(revenueGrowthMap, 'amount', allMonths);
    const tournamentGrowth = toSeries(tournamentGrowthMap, 'count', allMonths);
    const engagementGrowth = toSeries(engagementGrowthMap, 'count', allMonths);
    const platformGrowthTrend = toSeries(platformGrowthMap, 'score', allMonths);
    const platformBreakdown = allMonths.map((month) => ({
      month,
      users: Number(platformBreakdownMap[month]?.users || 0),
      tournaments: Number(platformBreakdownMap[month]?.tournaments || 0),
      sales: Number(platformBreakdownMap[month]?.sales || 0),
      meetings: Number(platformBreakdownMap[month]?.meetings || 0),
      enrollments: Number(platformBreakdownMap[month]?.enrollments || 0),
      total: Number(platformBreakdownMap[month]?.total || 0)
    }));

    const totalUsers = users.length;
    const totalPlayers = users.filter((u) => u.role === 'player').length;
    const totalCoordinators = users.filter((u) => u.role === 'coordinator').length;
    const totalOrganizers = users.filter((u) => u.role === 'organizer').length;
    const totalTournaments = tournaments.length;
    const totalRevenue = sales.reduce((sum, sale) => sum + Number(sale?.price || 0), 0);

    const summary = {
      totalUsers,
      totalPlayers,
      totalCoordinators,
      totalOrganizers,
      totalTournaments,
      totalRevenue,
      platformGrowthRate: computeGrowthRate(platformGrowthTrend, 'score'),
      userGrowthRate: computeGrowthRate(userGrowth, 'count'),
      revenueGrowthRate: computeGrowthRate(revenueGrowth, 'amount'),
      engagementGrowthRate: computeGrowthRate(engagementGrowth, 'count')
    };

    return {
      userGrowth,
      userRoleBreakdown,
      revenueGrowth,
      tournamentGrowth,
      engagementGrowth,
      platformGrowthTrend,
      platformBreakdown,
      summary
    };
  }
};

module.exports = AnalyticsService;
