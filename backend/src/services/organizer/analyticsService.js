const { connectDB } = require('../../config/database');
const moment = require('moment');
const { requireOrganizer } = require('./organizerUtils');
const { getModel } = require('../../models');
const { parsePagination, parseSort } = require('../../utils/mongo');
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

    const pendingCoordinators = await database.collection('pending_coordinators')
      .find({ status: 'pending' })
      .project({ email: 1, data: 1, created_at: 1, status: 1 })
      .sort({ created_at: -1 })
      .limit(200)
      .toArray();

    return {
      organizerName: organizer?.name || 'Organizer',
      meetings: meetings || [],
      pendingApprovals: pendingApprovals || [],
      pendingCoordinators: pendingCoordinators || []
    };
  },

  async getStoreSummary(db, query = {}) {
    const database = await resolveDb(db);

    const { limit, skip } = parsePagination(query, { defaultLimit: 100, maxLimit: 300 });
    const productSort = parseSort(query, ['name', 'price', 'availability'], { _id: -1 }) || { _id: -1 };
    const salesSort = { purchase_date: -1, _id: -1 };

    const [[productsResult], [salesResult]] = await Promise.all([
      database.collection('products').aggregate([
        {
          $facet: {
            total: [{ $count: 'count' }],
            items: [
              { $sort: productSort },
              { $skip: skip },
              { $limit: limit },
              {
                $project: {
                  name: 1,
                  price: 1,
                  availability: 1,
                  image_url: 1,
                  coordinator: 1,
                  college: 1
                }
              }
            ]
          }
        },
        { $project: { total: { $ifNull: [{ $first: '$total.count' }, 0] }, items: 1 } }
      ]).toArray(),

      database.collection('sales').aggregate([
        {
          $facet: {
            total: [{ $count: 'count' }],
            items: [
              { $sort: salesSort },
              { $skip: skip },
              { $limit: limit },
              {
                $lookup: {
                  from: 'products',
                  localField: 'product_id',
                  foreignField: '_id',
                  as: 'productInfo'
                }
              },
              { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },
              {
                $project: {
                  product: { $ifNull: ['$productInfo.name', 'Unknown'] },
                  price: 1,
                  coordinator: { $ifNull: ['$productInfo.coordinator', ''] },
                  college: { $ifNull: ['$productInfo.college', ''] },
                  buyer: 1,
                  purchase_date: 1
                }
              }
            ]
          }
        },
        { $project: { total: { $ifNull: [{ $first: '$total.count' }, 0] }, items: 1 } }
      ]).toArray()
    ]);

    return {
      products: productsResult?.items || [],
      sales: salesResult?.items || [],
      totals: {
        products: productsResult?.total || 0,
        sales: salesResult?.total || 0
      },
      pagination: { limit, skip }
    };
  },

  async getTournamentRevenue(db) {
    const database = await resolveDb(db);

    const [row] = await database.collection('tournaments').aggregate([
      { $match: { status: { $in: ['Approved', 'Ongoing', 'Completed'] } } },
      {
        $lookup: {
          from: 'tournament_players',
          let: { tid: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$tournament_id', '$$tid'] } } },
            { $count: 'count' }
          ],
          as: 'individuals'
        }
      },
      {
        $lookup: {
          from: 'enrolledtournaments_team',
          let: { tid: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$tournament_id', '$$tid'] } } },
            { $count: 'count' }
          ],
          as: 'teams'
        }
      },
      {
        $addFields: {
          individualCount: { $ifNull: [{ $first: '$individuals.count' }, 0] },
          teamCount: { $ifNull: [{ $first: '$teams.count' }, 0] }
        }
      },
      {
        $addFields: {
          totalEnrollments: { $add: ['$individualCount', '$teamCount'] },
          revenue: {
            $multiply: [
              { $ifNull: ['$entry_fee', 0] },
              { $add: ['$individualCount', '$teamCount'] }
            ]
          }
        }
      },
      {
        $facet: {
          tournaments: [
            {
              $project: {
                name: 1,
                date: 1,
                status: 1,
                coordinator: 1,
                entryFee: { $ifNull: ['$entry_fee', 0] },
                players: '$totalEnrollments',
                revenue: 1
              }
            },
            { $sort: { date: -1 } }
          ],
          monthly: [
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m', date: '$date' } },
                revenue: { $sum: '$revenue' }
              }
            },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, k: '$_id', v: '$revenue' } }
          ],
          yearly: [
            {
              $group: {
                _id: { $dateToString: { format: '%Y', date: '$date' } },
                revenue: { $sum: '$revenue' }
              }
            },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, k: '$_id', v: '$revenue' } }
          ],
          total: [{ $group: { _id: null, revenue: { $sum: '$revenue' } } }]
        }
      },
      {
        $project: {
          tournaments: 1,
          monthlyRevenue: { $arrayToObject: '$monthly' },
          yearlyRevenue: { $arrayToObject: '$yearly' },
          totalRevenue: { $ifNull: [{ $first: '$total.revenue' }, 0] }
        }
      }
    ]).toArray();

    return row || { tournaments: [], monthlyRevenue: {}, yearlyRevenue: {}, totalRevenue: 0 };
  },

  async getCoordinatorPerformance(db) {
    const database = await resolveDb(db);

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const storeAgg = [
      {
        $lookup: {
          from: 'products',
          localField: 'product_id',
          foreignField: '_id',
          pipeline: [{ $project: { coordinator: 1 } }],
          as: 'product'
        }
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: false } },
      {
        $addFields: {
          coordinatorKey: '$product.coordinator',
          priceVal: {
            $cond: [
              { $isNumber: '$price' },
              '$price',
              { $convert: { input: '$price', to: 'double', onError: 0, onNull: 0 } }
            ]
          }
        }
      },
      {
        $group: {
          _id: '$coordinatorKey',
          totalProductsSold: { $sum: 1 },
          storeRevenue: { $sum: '$priceVal' },
          currentMonthRevenue: {
            $sum: { $cond: [{ $gte: ['$purchase_date', currentMonthStart] }, '$priceVal', 0] }
          },
          prevMonthRevenue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ['$purchase_date', prevMonthStart] },
                    { $lte: ['$purchase_date', prevMonthEnd] }
                  ]
                },
                '$priceVal',
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          _id: 1,
          totalProductsSold: 1,
          storeRevenue: 1,
          currentMonthRevenue: 1,
          prevMonthRevenue: 1,
          totalTournaments: { $literal: 0 },
          tournamentRevenue: { $literal: 0 }
        }
      }
    ];

    const tournamentAgg = [
      { $match: { status: { $nin: ['Removed', 'Rejected'] } } },
      {
        $lookup: {
          from: 'tournament_players',
          let: { tid: '$_id' },
          pipeline: [{ $match: { $expr: { $eq: ['$tournament_id', '$$tid'] } } }, { $count: 'count' }],
          as: 'individuals'
        }
      },
      {
        $lookup: {
          from: 'enrolledtournaments_team',
          let: { tid: '$_id' },
          pipeline: [{ $match: { $expr: { $eq: ['$tournament_id', '$$tid'] } } }, { $count: 'count' }],
          as: 'teams'
        }
      },
      {
        $addFields: {
          individualCount: { $ifNull: [{ $first: '$individuals.count' }, 0] },
          teamCount: { $ifNull: [{ $first: '$teams.count' }, 0] }
        }
      },
      {
        $addFields: {
          totalEnrollments: { $add: ['$individualCount', '$teamCount'] },
          revenue: {
            $multiply: [
              { $ifNull: ['$entry_fee', 0] },
              { $add: ['$individualCount', '$teamCount'] }
            ]
          }
        }
      },
      {
        $group: {
          _id: '$coordinator',
          totalTournaments: { $sum: 1 },
          tournamentRevenue: { $sum: '$revenue' }
        }
      },
      {
        $project: {
          _id: 1,
          totalTournaments: 1,
          tournamentRevenue: 1,
          totalProductsSold: { $literal: 0 },
          storeRevenue: { $literal: 0 },
          currentMonthRevenue: { $literal: 0 },
          prevMonthRevenue: { $literal: 0 }
        }
      }
    ];

    const merged = await database.collection('tournaments').aggregate([
      ...tournamentAgg,
      { $unionWith: { coll: 'sales', pipeline: storeAgg } },
      {
        $group: {
          _id: '$_id',
          totalTournaments: { $sum: '$totalTournaments' },
          tournamentRevenue: { $sum: '$tournamentRevenue' },
          totalProductsSold: { $sum: '$totalProductsSold' },
          storeRevenue: { $sum: '$storeRevenue' },
          currentMonthRevenue: { $sum: '$currentMonthRevenue' },
          prevMonthRevenue: { $sum: '$prevMonthRevenue' }
        }
      },
      {
        $addFields: {
          totalRevenue: { $add: ['$storeRevenue', '$tournamentRevenue'] },
          growthPercentage: {
            $cond: [
              { $gt: ['$prevMonthRevenue', 0] },
              {
                $round: [
                  {
                    $multiply: [
                      { $divide: [{ $subtract: ['$currentMonthRevenue', '$prevMonthRevenue'] }, '$prevMonthRevenue'] },
                      100
                    ]
                  },
                  0
                ]
              },
              { $cond: [{ $gt: ['$currentMonthRevenue', 0] }, 100, 0] }
            ]
          }
        }
      },
      { $sort: { totalRevenue: -1 } },
      {
        $lookup: {
          from: 'users',
          let: { coordName: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$role', 'coordinator'] },
                    { $ne: ['$isDeleted', 1] },
                    { $eq: ['$name', '$$coordName'] }
                  ]
                }
              }
            },
            { $project: { email: 1, college: 1 } },
            { $limit: 1 }
          ],
          as: 'coord'
        }
      },
      {
        $addFields: {
          email: { $first: '$coord.email' },
          college: { $first: '$coord.college' }
        }
      },
      { $project: { coord: 0 } }
    ]).toArray();

    const performanceData = (merged || []).map((row, i) => ({
      name: row._id,
      email: row.email,
      college: row.college,
      totalTournaments: row.totalTournaments || 0,
      totalProductsSold: row.totalProductsSold || 0,
      storeRevenue: Number(row.storeRevenue || 0),
      tournamentRevenue: Number(row.tournamentRevenue || 0),
      totalRevenue: Number(row.totalRevenue || 0),
      growthPercentage: Number(row.growthPercentage || 0),
      rank: i + 1
    }));

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

    const [usersByMonth, userTotals, salesByMonth, tournamentsByMonth, meetingsByMonth, teamEnrollmentsByMonth, individualEnrollmentsByMonth] = await Promise.all([
      database.collection('users').aggregate([
        { $match: { isDeleted: { $ne: 1 }, role: { $in: ['player', 'coordinator', 'organizer'] } } },
        {
          $addFields: {
            createdAt: {
              $ifNull: [
                '$created_date',
                { $ifNull: ['$created_at', { $ifNull: ['$signup_date', { $toDate: '$_id' }] }] }
              ]
            },
            roleLower: { $toLower: { $ifNull: ['$role', ''] } }
          }
        },
        { $addFields: { month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } } } },
        {
          $group: {
            _id: '$month',
            count: { $sum: 1 },
            players: { $sum: { $cond: [{ $eq: ['$roleLower', 'player'] }, 1, 0] } },
            coordinators: { $sum: { $cond: [{ $eq: ['$roleLower', 'coordinator'] }, 1, 0] } },
            organizers: { $sum: { $cond: [{ $eq: ['$roleLower', 'organizer'] }, 1, 0] } }
          }
        },
        { $sort: { _id: 1 } }
      ]).toArray(),
      database.collection('users').aggregate([
        { $match: { isDeleted: { $ne: 1 }, role: { $in: ['player', 'coordinator', 'organizer'] } } },
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]).toArray(),
      database.collection('sales').aggregate([
        {
          $addFields: {
            createdAt: {
              $ifNull: [
                '$purchase_date',
                { $ifNull: ['$created_date', { $ifNull: ['$created_at', { $toDate: '$_id' }] }] }
              ]
            },
            priceVal: {
              $cond: [
                { $isNumber: '$price' },
                '$price',
                { $convert: { input: '$price', to: 'double', onError: 0, onNull: 0 } }
              ]
            }
          }
        },
        { $addFields: { month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } } } },
        { $group: { _id: '$month', revenue: { $sum: '$priceVal' }, transactions: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]).toArray(),
      database.collection('tournaments').aggregate([
        { $match: { status: { $nin: ['Removed', 'Rejected'] } } },
        {
          $addFields: {
            createdAt: {
              $ifNull: [
                '$submitted_date',
                { $ifNull: ['$created_date', { $ifNull: ['$created_at', { $ifNull: ['$added_date', { $toDate: '$_id' }] }] }] }
              ]
            }
          }
        },
        { $addFields: { month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } } } },
        { $group: { _id: '$month', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]).toArray(),
      database.collection('meetingsdb').aggregate([
        {
          $addFields: {
            createdAt: { $ifNull: ['$created_date', { $ifNull: ['$created_at', { $ifNull: ['$date', { $toDate: '$_id' }] }] }] }
          }
        },
        { $addFields: { month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } } } },
        { $group: { _id: '$month', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]).toArray(),
      database.collection('enrolledtournaments_team').aggregate([
        {
          $addFields: {
            createdAt: { $ifNull: ['$enrollment_date', { $ifNull: ['$created_date', { $ifNull: ['$created_at', { $toDate: '$_id' }] }] }] }
          }
        },
        { $addFields: { month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } } } },
        { $group: { _id: '$month', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]).toArray(),
      database.collection('tournament_players').aggregate([
        { $addFields: { createdAt: { $toDate: '$_id' } } },
        { $addFields: { month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } } } },
        { $group: { _id: '$month', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]).toArray()
    ]);

    const userGrowthMap = {};
    const userRoleMonthlyNewMap = {};
    const revenueGrowthMap = {};
    const tournamentGrowthMap = {};
    const engagementGrowthMap = {};
    const platformBreakdownMap = {};

    const ensurePlatformMonth = (month) => {
      if (!month) return null;
      if (!platformBreakdownMap[month]) {
        platformBreakdownMap[month] = { users: 0, tournaments: 0, sales: 0, meetings: 0, enrollments: 0, total: 0 };
      }
      return platformBreakdownMap[month];
    };

    (usersByMonth || []).forEach((row) => {
      if (!row?._id) return;
      userGrowthMap[row._id] = Number(row.count || 0);
      userRoleMonthlyNewMap[row._id] = {
        players: Number(row.players || 0),
        coordinators: Number(row.coordinators || 0),
        organizers: Number(row.organizers || 0)
      };
      const platform = ensurePlatformMonth(row._id);
      platform.users = Number(row.count || 0);
      platform.total += Number(row.count || 0);
    });

    (salesByMonth || []).forEach((row) => {
      if (!row?._id) return;
      revenueGrowthMap[row._id] = Number(row.revenue || 0);
      const platform = ensurePlatformMonth(row._id);
      platform.sales = Number(row.transactions || 0);
      platform.total += Number(row.transactions || 0);
      engagementGrowthMap[row._id] = Number(engagementGrowthMap[row._id] || 0) + Number(row.transactions || 0);
    });

    (tournamentsByMonth || []).forEach((row) => {
      if (!row?._id) return;
      tournamentGrowthMap[row._id] = Number(row.count || 0);
      const platform = ensurePlatformMonth(row._id);
      platform.tournaments = Number(row.count || 0);
      platform.total += Number(row.count || 0);
    });

    (meetingsByMonth || []).forEach((row) => {
      if (!row?._id) return;
      const platform = ensurePlatformMonth(row._id);
      platform.meetings = Number(row.count || 0);
      platform.total += Number(row.count || 0);
      engagementGrowthMap[row._id] = Number(engagementGrowthMap[row._id] || 0) + Number(row.count || 0);
    });

    const enrollmentCounts = new Map();
    (teamEnrollmentsByMonth || []).forEach((row) => {
      if (!row?._id) return;
      enrollmentCounts.set(row._id, Number(row.count || 0) + Number(enrollmentCounts.get(row._id) || 0));
    });
    (individualEnrollmentsByMonth || []).forEach((row) => {
      if (!row?._id) return;
      enrollmentCounts.set(row._id, Number(row.count || 0) + Number(enrollmentCounts.get(row._id) || 0));
    });
    Array.from(enrollmentCounts.entries()).forEach(([month, count]) => {
      const platform = ensurePlatformMonth(month);
      platform.enrollments = Number(count || 0);
      platform.total += Number(count || 0);
      engagementGrowthMap[month] = Number(engagementGrowthMap[month] || 0) + Number(count || 0);
    });

    const totalsMap = new Map((userTotals || []).map((r) => [String(r._id || '').toLowerCase(), Number(r.count || 0)]));
    const totalPlayers = totalsMap.get('player') || 0;
    const totalCoordinators = totalsMap.get('coordinator') || 0;
    const totalOrganizers = totalsMap.get('organizer') || 0;
    const totalUsers = totalPlayers + totalCoordinators + totalOrganizers;
    const totalTournaments = (tournamentsByMonth || []).reduce((sum, r) => sum + Number(r.count || 0), 0);
    const totalRevenue = (salesByMonth || []).reduce((sum, r) => sum + Number(r.revenue || 0), 0);

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
