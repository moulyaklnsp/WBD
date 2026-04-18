const { connectDB } = require('../../config/database');
const { ObjectId } = require('mongodb');
const { normalizeKey, parsePagination } = require('../../utils/mongo');

const createError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const resolveDb = async (db) => (db ? db : connectDB());

function requireAdmin(session) {
  if (!session?.userEmail || session?.userRole !== 'admin') {
    throw createError('Unauthorized', 401);
  }
}

function identityKeysFromUser(userDoc) {
  const keys = new Set();
  const add = (v) => {
    const key = normalizeKey(v);
    if (key) keys.add(key);
  };
  add(userDoc?.email);
  add(userDoc?.name);
  add(userDoc?.username);
  return Array.from(keys);
}

function getRangeConfig(rangeRaw) {
  const range = String(rangeRaw || '30d').toLowerCase();
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  let granularity = 'day';
  switch (range) {
    case '7d':
      start.setDate(start.getDate() - 6);
      granularity = 'day';
      break;
    case '30d':
      start.setDate(start.getDate() - 29);
      granularity = 'day';
      break;
    case '6m':
      start.setMonth(start.getMonth() - 5);
      start.setDate(1);
      granularity = 'month';
      break;
    case '1y':
      start.setMonth(start.getMonth() - 11);
      start.setDate(1);
      granularity = 'month';
      break;
    default:
      start.setDate(start.getDate() - 29);
      granularity = 'day';
      break;
  }
  start.setHours(0, 0, 0, 0);
  return { range, start, end, granularity };
}

function toBucketKey(date, granularity) {
  const d = new Date(date);
  if (granularity === 'month') {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toBucketLabel(date, granularity) {
  const d = new Date(date);
  if (granularity === 'month') {
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  }
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
}

function buildBuckets(start, end, granularity) {
  const buckets = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    buckets.push({ key: toBucketKey(cursor, granularity), label: toBucketLabel(cursor, granularity) });
    if (granularity === 'month') cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setDate(cursor.getDate() + 1);
  }
  return buckets;
}

const AdminService = {
  async getTournamentDetails(db, session, id) {
    requireAdmin(session);
    if (!ObjectId.isValid(id)) throw createError('Invalid tournament ID', 400);
    const database = await resolveDb(db);
    const tid = new ObjectId(id);

    const [row] = await database.collection('tournaments').aggregate([
      { $match: { _id: tid } },
      {
        $facet: {
          tournament: [{ $limit: 1 }],
          individuals: [
            {
              $lookup: {
                from: 'tournament_players',
                let: { tid: '$_id', tidStr: { $toString: '$_id' } },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $or: [
                          { $eq: ['$tournament_id', '$$tid'] },
                          { $eq: [{ $toString: '$tournament_id' }, '$$tidStr'] }
                        ]
                      }
                    }
                  },
                  { $project: { username: 1 } }
                ],
                as: 'rows'
              }
            },
            { $unwind: '$rows' },
            { $replaceRoot: { newRoot: '$rows' } },
            {
              $lookup: {
                from: 'users',
                let: { uname: '$username' },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $or: [
                          { $eq: ['$username', '$$uname'] },
                          { $eq: ['$name', '$$uname'] },
                          { $eq: ['$email', '$$uname'] }
                        ]
                      }
                    }
                  },
                  { $project: { email: 1 } },
                  { $limit: 1 }
                ],
                as: 'user'
              }
            },
            { $addFields: { email: { $ifNull: [{ $first: '$user.email' }, 'N/A'] } } },
            { $project: { _id: 0, username: 1, name: '$username', email: 1, type: { $literal: 'Individual' } } }
          ],
          teams: [
            {
              $lookup: {
                from: 'enrolledtournaments_team',
                let: { tid: '$_id', tidStr: { $toString: '$_id' } },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $or: [
                          { $eq: ['$tournament_id', '$$tid'] },
                          { $eq: [{ $toString: '$tournament_id' }, '$$tidStr'] }
                        ]
                      }
                    }
                  },
                  { $project: { captain_id: 1, captain_name: 1, team_name: 1 } }
                ],
                as: 'rows'
              }
            },
            { $unwind: '$rows' },
            { $replaceRoot: { newRoot: '$rows' } },
            {
              $lookup: {
                from: 'users',
                localField: 'captain_id',
                foreignField: '_id',
                pipeline: [{ $project: { email: 1 } }, { $limit: 1 }],
                as: 'captain'
              }
            },
            {
              $addFields: {
                email: { $ifNull: [{ $first: '$captain.email' }, 'N/A'] },
                name: {
                  $ifNull: [
                    '$team_name',
                    {
                      $cond: [
                        { $and: [{ $ne: ['$captain_name', null] }, { $ne: ['$captain_name', ''] }] },
                        { $concat: ['$captain_name', "'s Team"] },
                        'Team Entry'
                      ]
                    }
                  ]
                }
              }
            },
            { $project: { _id: 0, name: 1, email: 1, type: { $literal: 'Team' } } }
          ]
        }
      },
      {
        $project: {
          tournament: { $first: '$tournament' },
          individuals: 1,
          teams: 1
        }
      },
      {
        $addFields: {
          players: { $concatArrays: ['$individuals', '$teams'] },
          individualCount: { $size: '$individuals' },
          teamCount: { $size: '$teams' }
        }
      },
      {
        $addFields: {
          moneyGenerated: {
            $multiply: [
              { $ifNull: ['$tournament.entry_fee', 0] },
              { $add: ['$individualCount', '$teamCount'] }
            ]
          }
        }
      },
      {
        $project: {
          tournament: 1,
          conductedBy: { $ifNull: ['$tournament.added_by', 'Unknown'] },
          approvedBy: { $ifNull: ['$tournament.approved_by', 'Unknown'] },
          moneyGenerated: 1,
          players: 1
        }
      }
    ]).toArray();

    if (!row?.tournament) throw createError('Tournament not found', 404);

    return row;
  },

  async getCoordinators(db, session, query) {
    requireAdmin(session);
    const database = await resolveDb(db);
    const { limit, skip } = parsePagination(query, { defaultLimit: 50, maxLimit: 200 });

    const [row] = await database.collection('users').aggregate([
      { $match: { role: 'coordinator' } },
      { $sort: { name: 1, email: 1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $addFields: {
          identityKeys: {
            $setDifference: [
              [
                { $toLower: { $trim: { input: { $ifNull: ['$name', ''] } } } },
                { $toLower: { $trim: { input: { $ifNull: ['$email', ''] } } } }
              ],
              ['']
            ]
          }
        }
      },
      {
        $lookup: {
          from: 'tournaments',
          let: { keys: '$identityKeys' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: [
                    {
                      $ifNull: [
                        '$added_by_key',
                        { $toLower: { $trim: { input: { $ifNull: ['$added_by', ''] } } } }
                      ]
                    },
                    '$$keys'
                  ]
                }
              }
            },
            {
              $group: {
                _id: null,
                tournamentsConducted: {
                  $sum: { $cond: [{ $ne: ['$status', 'Rejected'] }, 1, 0] }
                },
                tournamentsRejected: {
                  $sum: { $cond: [{ $eq: ['$status', 'Rejected'] }, 1, 0] }
                }
              }
            }
          ],
          as: 'tournamentStats'
        }
      },
      {
        $addFields: {
          tournamentsConducted: { $ifNull: [{ $first: '$tournamentStats.tournamentsConducted' }, 0] },
          tournamentsRejected: { $ifNull: [{ $first: '$tournamentStats.tournamentsRejected' }, 0] }
        }
      },
      {
        $project: {
          identityKeys: 0,
          tournamentStats: 0,
          password: 0,
          mfaSecret: 0
        }
      },
      {
        $group: {
          _id: null,
          coordinators: { $push: '$$ROOT' }
        }
      },
      { $project: { _id: 0, coordinators: 1, limit: { $literal: limit }, skip: { $literal: skip } } }
    ]).toArray();

    return row || { coordinators: [], limit, skip };
  },

  async getOrganizers(db, session, query) {
    requireAdmin(session);
    const database = await resolveDb(db);
    const { limit, skip } = parsePagination(query, { defaultLimit: 50, maxLimit: 200 });

    const [row] = await database.collection('users').aggregate([
      { $match: { role: 'organizer' } },
      { $sort: { name: 1, email: 1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $addFields: {
          identityKeys: {
            $setDifference: [
              [
                { $toLower: { $trim: { input: { $ifNull: ['$name', ''] } } } },
                { $toLower: { $trim: { input: { $ifNull: ['$email', ''] } } } }
              ],
              ['']
            ]
          }
        }
      },
      {
        $lookup: {
          from: 'tournaments',
          let: { keys: '$identityKeys' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    {
                      $in: [
                        {
                          $ifNull: [
                            '$approved_by_key',
                            { $toLower: { $trim: { input: { $ifNull: ['$approved_by', ''] } } } }
                          ]
                        },
                        '$$keys'
                      ]
                    },
                    {
                      $in: [
                        {
                          $ifNull: [
                            '$rejected_by_key',
                            { $toLower: { $trim: { input: { $ifNull: ['$rejected_by', ''] } } } }
                          ]
                        },
                        '$$keys'
                      ]
                    }
                  ]
                }
              }
            },
            {
              $group: {
                _id: null,
                tournamentsApproved: {
                  $sum: {
                    $cond: [
                      {
                        $in: [
                          {
                            $ifNull: [
                              '$approved_by_key',
                              { $toLower: { $trim: { input: { $ifNull: ['$approved_by', ''] } } } }
                            ]
                          },
                          '$$keys'
                        ]
                      },
                      1,
                      0
                    ]
                  }
                },
                tournamentsRejected: {
                  $sum: {
                    $cond: [
                      {
                        $in: [
                          {
                            $ifNull: [
                              '$rejected_by_key',
                              { $toLower: { $trim: { input: { $ifNull: ['$rejected_by', ''] } } } }
                            ]
                          },
                          '$$keys'
                        ]
                      },
                      1,
                      0
                    ]
                  }
                }
              }
            }
          ],
          as: 'tournamentStats'
        }
      },
      {
        $lookup: {
          from: 'meetingsdb',
          let: { keys: '$identityKeys', emailKey: { $toLower: { $trim: { input: { $ifNull: ['$email', ''] } } } } },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    {
                      $in: [
                        {
                          $ifNull: [
                            '$name_key',
                            { $toLower: { $trim: { input: { $ifNull: ['$name', ''] } } } }
                          ]
                        },
                        '$$keys'
                      ]
                    },
                    {
                      $eq: [
                        {
                          $ifNull: [
                            '$created_by_key',
                            { $toLower: { $trim: { input: { $ifNull: ['$created_by', ''] } } } }
                          ]
                        },
                        '$$emailKey'
                      ]
                    }
                  ]
                }
              }
            },
            { $count: 'count' }
          ],
          as: 'meetingStats'
        }
      },
      {
        $addFields: {
          tournamentsApproved: { $ifNull: [{ $first: '$tournamentStats.tournamentsApproved' }, 0] },
          tournamentsRejected: { $ifNull: [{ $first: '$tournamentStats.tournamentsRejected' }, 0] },
          meetingsScheduled: { $ifNull: [{ $first: '$meetingStats.count' }, 0] }
        }
      },
      {
        $project: {
          identityKeys: 0,
          tournamentStats: 0,
          meetingStats: 0,
          password: 0,
          mfaSecret: 0
        }
      },
      {
        $group: {
          _id: null,
          organizers: { $push: '$$ROOT' }
        }
      },
      { $project: { _id: 0, organizers: 1, limit: { $literal: limit }, skip: { $literal: skip } } }
    ]).toArray();

    return row || { organizers: [], limit, skip };
  },

  async getPlayers(db, session, query) {
    requireAdmin(session);
    const database = await resolveDb(db);
    const { limit, skip } = parsePagination(query, { defaultLimit: 50, maxLimit: 200 });

    const [row] = await database.collection('users').aggregate([
      { $match: { role: 'player' } },
      { $sort: { name: 1, email: 1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $addFields: {
          identityKeys: {
            $setDifference: [
              [
                { $toLower: { $trim: { input: { $ifNull: ['$name', ''] } } } },
                { $toLower: { $trim: { input: { $ifNull: ['$email', ''] } } } }
              ],
              ['']
            ]
          }
        }
      },
      {
        $lookup: {
          from: 'sales',
          let: { uid: '$_id', keys: '$identityKeys' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$buyer_id', '$$uid'] },
                    {
                      $in: [
                        {
                          $ifNull: [
                            '$buyer_key',
                            { $toLower: { $trim: { input: { $ifNull: ['$buyer', ''] } } } }
                          ]
                        },
                        '$$keys'
                      ]
                    }
                  ]
                }
              }
            },
            {
              $lookup: {
                from: 'products',
                localField: 'product_id',
                foreignField: '_id',
                pipeline: [{ $project: { name: 1 } }, { $limit: 1 }],
                as: 'product'
              }
            },
            {
              $addFields: {
                productName: {
                  $ifNull: [
                    { $first: '$product.name' },
                    { $ifNull: ['$product', { $ifNull: ['$product_name', 'Unknown Product'] }] }
                  ]
                },
                quantitySafe: { $max: [1, { $ifNull: ['$quantity', 1] }] },
                priceSafe: { $ifNull: ['$price', 0] }
              }
            },
            {
              $group: {
                _id: '$productName',
                quantity: { $sum: '$quantitySafe' },
                totalPrice: { $sum: '$priceSafe' }
              }
            },
            {
              $addFields: {
                unitPrice: {
                  $cond: [{ $gt: ['$quantity', 0] }, { $round: [{ $divide: ['$totalPrice', '$quantity'] }, 2] }, 0]
                },
                totalPrice: { $round: ['$totalPrice', 2] }
              }
            },
            { $sort: { totalPrice: -1 } }
          ],
          as: 'boughtProductsDetailed'
        }
      },
      {
        $addFields: {
          totalSpent: { $round: [{ $sum: '$boughtProductsDetailed.totalPrice' }, 2] },
          boughtProducts: {
            $map: { input: '$boughtProductsDetailed', as: 'p', in: '$$p._id' }
          }
        }
      },
      {
        $project: {
          identityKeys: 0,
          password: 0,
          mfaSecret: 0
        }
      },
      {
        $group: {
          _id: null,
          players: { $push: '$$ROOT' }
        }
      },
      { $project: { _id: 0, players: 1, limit: { $literal: limit }, skip: { $literal: skip } } }
    ]).toArray();

    return row || { players: [], limit, skip };
  },

  async getOrganizerAnalytics(db, session) {
    requireAdmin(session);
    const database = await resolveDb(db);

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const rows = await database.collection('users').aggregate([
      { $match: { role: 'organizer', isDeleted: { $ne: 1 } } },
      { $project: { name: 1, email: 1, college: 1 } },
      {
        $addFields: {
          identityKeys: {
            $setDifference: [
              [
                { $toLower: { $trim: { input: { $ifNull: ['$name', ''] } } } },
                { $toLower: { $trim: { input: { $ifNull: ['$email', ''] } } } }
              ],
              ['']
            ]
          }
        }
      },
      {
        $lookup: {
          from: 'tournaments',
          let: { keys: '$identityKeys' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    {
                      $in: [
                        {
                          $ifNull: [
                            '$approved_by_key',
                            { $toLower: { $trim: { input: { $ifNull: ['$approved_by', ''] } } } }
                          ]
                        },
                        '$$keys'
                      ]
                    },
                    {
                      $in: [
                        {
                          $ifNull: [
                            '$rejected_by_key',
                            { $toLower: { $trim: { input: { $ifNull: ['$rejected_by', ''] } } } }
                          ]
                        },
                        '$$keys'
                      ]
                    }
                  ]
                }
              }
            },
            {
              $addFields: {
                approvedKey: {
                  $ifNull: [
                    '$approved_by_key',
                    { $toLower: { $trim: { input: { $ifNull: ['$approved_by', ''] } } } }
                  ]
                },
                rejectedKey: {
                  $ifNull: [
                    '$rejected_by_key',
                    { $toLower: { $trim: { input: { $ifNull: ['$rejected_by', ''] } } } }
                  ]
                }
              }
            },
            {
              $group: {
                _id: null,
                approvedCount: {
                  $sum: {
                    $cond: [
                      { $and: [{ $eq: ['$status', 'Approved'] }, { $in: ['$approvedKey', '$$keys'] }] },
                      1,
                      0
                    ]
                  }
                },
                rejectedCount: {
                  $sum: {
                    $cond: [
                      { $and: [{ $eq: ['$status', 'Rejected'] }, { $in: ['$rejectedKey', '$$keys'] }] },
                      1,
                      0
                    ]
                  }
                },
                monthApprovedCurrent: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $gte: ['$approved_date', currentMonthStart] },
                          { $in: ['$approvedKey', '$$keys'] }
                        ]
                      },
                      1,
                      0
                    ]
                  }
                },
                monthApprovedPrev: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $gte: ['$approved_date', prevMonthStart] },
                          { $lte: ['$approved_date', prevMonthEnd] },
                          { $in: ['$approvedKey', '$$keys'] }
                        ]
                      },
                      1,
                      0
                    ]
                  }
                }
              }
            }
          ],
          as: 'tournamentStats'
        }
      },
      {
        $lookup: {
          from: 'meetingsdb',
          let: { keys: '$identityKeys' },
          pipeline: [
            { $match: { role: 'organizer', $expr: { $in: [{ $ifNull: ['$name_key', { $toLower: { $trim: { input: { $ifNull: ['$name', ''] } } } }] }, '$$keys'] } } },
            { $count: 'count' }
          ],
          as: 'meetingStats'
        }
      },
      {
        $addFields: {
          approvedCount: { $ifNull: [{ $first: '$tournamentStats.approvedCount' }, 0] },
          rejectedCount: { $ifNull: [{ $first: '$tournamentStats.rejectedCount' }, 0] },
          meetingsScheduled: { $ifNull: [{ $first: '$meetingStats.count' }, 0] },
          monthApprovedCurrent: { $ifNull: [{ $first: '$tournamentStats.monthApprovedCurrent' }, 0] },
          monthApprovedPrev: { $ifNull: [{ $first: '$tournamentStats.monthApprovedPrev' }, 0] }
        }
      },
      {
        $addFields: {
          growthPercentage: {
            $cond: [
              { $gt: ['$monthApprovedPrev', 0] },
              {
                $round: [
                  {
                    $multiply: [
                      { $divide: [{ $subtract: ['$monthApprovedCurrent', '$monthApprovedPrev'] }, '$monthApprovedPrev'] },
                      100
                    ]
                  },
                  0
                ]
              },
              { $cond: [{ $gt: ['$monthApprovedCurrent', 0] }, 100, 0] }
            ]
          },
          decisions: { $add: ['$approvedCount', '$rejectedCount'] }
        }
      },
      {
        $project: {
          identityKeys: 0,
          tournamentStats: 0,
          meetingStats: 0,
          monthApprovedCurrent: 0,
          monthApprovedPrev: 0
        }
      },
      { $sort: { decisions: -1, approvedCount: -1, name: 1 } }
    ]).toArray();

    const organizers = (rows || []).map((r, idx) => ({ ...r, rank: idx + 1 }));
    const totals = organizers.reduce(
      (acc, row) => ({
        organizers: acc.organizers + 1,
        approvedCount: acc.approvedCount + (row.approvedCount || 0),
        rejectedCount: acc.rejectedCount + (row.rejectedCount || 0),
        meetingsScheduled: acc.meetingsScheduled + (row.meetingsScheduled || 0)
      }),
      { organizers: 0, approvedCount: 0, rejectedCount: 0, meetingsScheduled: 0 }
    );

    return { totals, organizers };
  },

  async getGrowthAnalytics(db, session, rangeRaw) {
    requireAdmin(session);
    const database = await resolveDb(db);
    const { range, start, end, granularity } = getRangeConfig(rangeRaw);

    const buckets = buildBuckets(start, end, granularity);
    const bucketMap = new Map(
      buckets.map((b) => [
        b.key,
        {
          label: b.label,
          tournamentsCreated: 0,
          completedTournaments: 0,
          ongoingTournaments: 0,
          rejectedTournaments: 0,
          revenue: 0,
          transactions: 0
        }
      ])
    );

    const [userCounts, tournamentBuckets, salesBuckets] = await Promise.all([
      database.collection('users').aggregate([
        { $match: { isDeleted: { $ne: 1 }, role: { $in: ['player', 'coordinator', 'organizer'] } } },
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]).toArray(),
      database.collection('tournaments').aggregate([
        { $match: { status: { $ne: 'Removed' } } },
        {
          $addFields: {
            createdAt: {
              $ifNull: [
                '$submitted_date',
                {
                  $ifNull: [
                    '$created_date',
                    {
                      $ifNull: [
                        '$created_at',
                        { $ifNull: ['$added_date', { $toDate: '$_id' }] }
                      ]
                    }
                  ]
                }
              ]
            }
          }
        },
        { $match: { createdAt: { $gte: start, $lte: end } } },
        {
          $addFields: {
            bucket: {
              $dateToString: {
                format: granularity === 'month' ? '%Y-%m' : '%Y-%m-%d',
                date: '$createdAt'
              }
            },
            statusLower: { $toLower: { $ifNull: ['$status', ''] } }
          }
        },
        {
          $group: {
            _id: '$bucket',
            tournamentsCreated: { $sum: 1 },
            completedTournaments: { $sum: { $cond: [{ $eq: ['$statusLower', 'completed'] }, 1, 0] } },
            ongoingTournaments: { $sum: { $cond: [{ $eq: ['$statusLower', 'ongoing'] }, 1, 0] } },
            rejectedTournaments: { $sum: { $cond: [{ $eq: ['$statusLower', 'rejected'] }, 1, 0] } }
          }
        }
      ]).toArray(),
      database.collection('sales').aggregate([
        {
          $addFields: {
            createdAt: {
              $ifNull: [
                '$purchase_date',
                {
                  $ifNull: [
                    '$created_date',
                    { $ifNull: ['$created_at', { $ifNull: ['$createdAt', { $toDate: '$_id' }] }] }
                  ]
                }
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
        { $match: { createdAt: { $gte: start, $lte: end } } },
        {
          $addFields: {
            bucket: {
              $dateToString: {
                format: granularity === 'month' ? '%Y-%m' : '%Y-%m-%d',
                date: '$createdAt'
              }
            }
          }
        },
        {
          $group: {
            _id: '$bucket',
            revenue: { $sum: '$priceVal' },
            transactions: { $sum: 1 }
          }
        }
      ]).toArray()
    ]);

    (tournamentBuckets || []).forEach((b) => {
      const existing = bucketMap.get(b._id);
      if (!existing) return;
      existing.tournamentsCreated = b.tournamentsCreated || 0;
      existing.completedTournaments = b.completedTournaments || 0;
      existing.ongoingTournaments = b.ongoingTournaments || 0;
      existing.rejectedTournaments = b.rejectedTournaments || 0;
    });

    (salesBuckets || []).forEach((b) => {
      const existing = bucketMap.get(b._id);
      if (!existing) return;
      existing.revenue = Number((b.revenue || 0).toFixed(2));
      existing.transactions = b.transactions || 0;
    });

    const tournamentsTimeline = buckets.map((bucket) => {
      const stats = bucketMap.get(bucket.key) || {};
      return {
        label: bucket.label,
        totalCreated: stats.tournamentsCreated || 0,
        completed: stats.completedTournaments || 0,
        ongoing: stats.ongoingTournaments || 0,
        rejected: stats.rejectedTournaments || 0
      };
    });
    const salesTimeline = buckets.map((bucket) => {
      const stats = bucketMap.get(bucket.key) || {};
      return {
        label: bucket.label,
        revenue: Number((stats.revenue || 0).toFixed(2)),
        transactions: stats.transactions || 0
      };
    });

    const counts = new Map((userCounts || []).map((r) => [r._id, r.count]));
    const playersCount = counts.get('player') || 0;
    const coordinatorsCount = counts.get('coordinator') || 0;
    const organizersCount = counts.get('organizer') || 0;
    const totalUsers = playersCount + coordinatorsCount + organizersCount;

    const summary = {
      totalRevenue: Number(salesTimeline.reduce((sum, row) => sum + Number(row.revenue || 0), 0).toFixed(2)),
      totalUsers,
      totalTournaments: tournamentsTimeline.reduce((sum, row) => sum + Number(row.totalCreated || 0), 0)
    };

    return {
      range,
      granularity,
      summary,
      userTotals: {
        players: playersCount,
        coordinators: coordinatorsCount,
        organizers: organizersCount
      },
      tournamentsTimeline,
      salesTimeline
    };
  },

  async getCoordinatorDetails(db, session, email, query) {
    requireAdmin(session);
    const database = await resolveDb(db);

    const coordinator = await database.collection('users').findOne(
      { email, role: 'coordinator' },
      { projection: { name: 1, email: 1, college: 1, isDeleted: 1, deleted_by: 1 } }
    );
    if (!coordinator) throw createError('Coordinator not found', 404);

    const name = coordinator.name;
    const identityKeys = identityKeysFromUser(coordinator).map(normalizeKey).filter(Boolean);
    const emailKey = normalizeKey(coordinator.email);

    const students = coordinator.college
      ? await database.collection('users')
        .find({ role: 'player', college: coordinator.college })
        .project({ name: 1, email: 1, FIDE_ID: 1 })
        .sort({ name: 1 })
        .limit(500)
        .toArray()
      : [];

    const tournaments = await database.collection('tournaments')
      .find({
        $or: [
          { added_by_key: { $in: identityKeys } },
          { added_by: { $in: [name, coordinator.email].filter(Boolean) } }
        ]
      })
      .project({ name: 1, type: 1, date: 1, entry_fee: 1, status: 1 })
      .sort({ date: -1 })
      .limit(500)
      .toArray();

    const { limit: salesLimit } = parsePagination(query, { defaultLimit: 200, maxLimit: 1000 });

    const [productRow] = await database.collection('products').aggregate([
      {
        $match: {
          $or: [
            { coordinator_key: { $in: identityKeys } },
            { coordinator: { $in: [name, coordinator.email].filter(Boolean) } }
          ]
        }
      },
      {
        $facet: {
          productsListed: [{ $count: 'count' }],
          sales: [
            {
              $lookup: {
                from: 'sales',
                localField: '_id',
                foreignField: 'product_id',
                as: 'sale'
              }
            },
            { $unwind: { path: '$sale', preserveNullAndEmptyArrays: false } },
            {
              $addFields: {
                priceVal: {
                  $cond: [
                    { $isNumber: '$sale.price' },
                    '$sale.price',
                    { $convert: { input: '$sale.price', to: 'double', onError: 0, onNull: 0 } }
                  ]
                }
              }
            },
            {
              $project: {
                product_name: '$name',
                buyer: '$sale.buyer',
                college: { $ifNull: ['$sale.college', '$college'] },
                price: '$sale.price',
                purchase_date: '$sale.purchase_date',
                quantity: '$sale.quantity',
                priceVal: 1
              }
            },
            { $sort: { purchase_date: -1 } },
            { $limit: salesLimit }
          ],
          totalEarnings: [
            {
              $lookup: {
                from: 'sales',
                localField: '_id',
                foreignField: 'product_id',
                as: 'sale'
              }
            },
            { $unwind: { path: '$sale', preserveNullAndEmptyArrays: false } },
            {
              $addFields: {
                priceVal: {
                  $cond: [
                    { $isNumber: '$sale.price' },
                    '$sale.price',
                    { $convert: { input: '$sale.price', to: 'double', onError: 0, onNull: 0 } }
                  ]
                }
              }
            },
            { $group: { _id: null, totalEarnings: { $sum: '$priceVal' } } }
          ]
        }
      },
      {
        $project: {
          productsListed: { $ifNull: [{ $first: '$productsListed.count' }, 0] },
          sales: '$sales',
          totalEarnings: { $ifNull: [{ $first: '$totalEarnings.totalEarnings' }, 0] }
        }
      }
    ]).toArray();

    const meetings = await database.collection('meetingsdb')
      .find({
        $or: [
          { name_key: { $in: identityKeys } },
          { created_by_key: emailKey },
          { name: { $in: [name, coordinator.email].filter(Boolean) } },
          { created_by: coordinator.email }
        ]
      })
      .sort({ date: -1, time: -1 })
      .limit(500)
      .toArray();

    const status = coordinator.isDeleted
      ? (normalizeKey(coordinator.deleted_by) === normalizeKey(coordinator.email) ? 'Left Platform' : 'Removed')
      : 'Active';

    return {
      coordinator: {
        name: coordinator.name,
        email: coordinator.email,
        college: coordinator.college,
        isDeleted: coordinator.isDeleted,
        status
      },
      students,
      tournaments,
      productsStats: {
        productsListed: productRow?.productsListed || 0,
        sales: productRow?.sales || [],
        totalEarnings: Number(productRow?.totalEarnings || 0)
      },
      meetings
    };
  },

  async getPlayerDetails(db, session, email) {
    requireAdmin(session);
    const database = await resolveDb(db);

    const player = await database.collection('users').findOne(
      { email, role: 'player' },
      { projection: { name: 1, email: 1, college: 1, dob: 1, gender: 1, isDeleted: 1, deleted_by: 1, FIDE_ID: 1, AICF_ID: 1, username: 1 } }
    );
    if (!player) throw createError('Player not found', 404);

    const status = player.isDeleted
      ? (normalizeKey(player.deleted_by) === normalizeKey(player.email) ? 'Left Platform' : 'Removed')
      : 'Active';

    const walletDoc = await database.collection('user_balances').findOne({ user_id: player._id });
    const topups = await database.collection('payments')
      .find({ user_id: player._id, purpose: 'topup' })
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray();

    const totalRecharged = (topups || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const usernameCandidates = Array.from(
      new Set([player.name, player.email, player.username].filter(Boolean).map((v) => String(v).trim()).filter(Boolean))
    );

    const ptournaments = await database.collection('tournament_players').find({
      username: { $in: usernameCandidates }
    }).project({ tournament_id: 1, username: 1, rank: 1, position: 1 }).toArray();

    const tournamentIds = Array.from(
      new Set((ptournaments || []).map((t) => (t?.tournament_id instanceof ObjectId ? t.tournament_id.toString() : String(t?.tournament_id || ''))).filter(Boolean))
    )
      .map((idStr) => (ObjectId.isValid(idStr) ? new ObjectId(idStr) : null))
      .filter(Boolean);

    let tournaments = [];
    if (tournamentIds.length) {
      const [tData, pairingDocs, allPlayers] = await Promise.all([
        database.collection('tournaments')
          .find({ _id: { $in: tournamentIds } })
          .project({ name: 1, title: 1, type: 1, start_date: 1, date: 1, entry_fee: 1, status: 1 })
          .toArray(),
        database.collection('tournament_pairings')
          .find({ tournament_id: { $in: tournamentIds } })
          .project({ tournament_id: 1, rounds: 1 })
          .toArray(),
        database.collection('tournament_players')
          .find({ tournament_id: { $in: tournamentIds } })
          .project({ _id: 1, tournament_id: 1, username: 1 })
          .toArray()
      ]);

      const ptMap = new Map((ptournaments || []).map((p) => [String(p.tournament_id), p]));
      const pairingMap = new Map((pairingDocs || []).map((p) => [String(p.tournament_id), p]));
      const playersByTournament = new Map();
      (allPlayers || []).forEach((p) => {
        const key = String(p.tournament_id);
        if (!playersByTournament.has(key)) playersByTournament.set(key, []);
        playersByTournament.get(key).push(p);
      });

      const rankForTournament = (tournamentId, pRecord) => {
        const directPosition = pRecord?.rank ?? pRecord?.position;
        if (directPosition != null) return directPosition;

        const pairings = pairingMap.get(String(tournamentId));
        if (!pairings || !Array.isArray(pairings.rounds)) return 'N/A';

        const players = playersByTournament.get(String(tournamentId)) || [];
        if (players.length === 0) return 'N/A';

        const playersMap = new Map(players.map((p) => [String(p._id), { id: String(p._id), username: p.username, score: 0 }]));
        (pairings.rounds || []).forEach((round) => {
          (round?.pairings || []).forEach((pairing) => {
            const p1 = playersMap.get(String(pairing?.player1?.id));
            const p2 = playersMap.get(String(pairing?.player2?.id));
            if (p1) p1.score = Number(pairing?.player1?.score || 0);
            if (p2) p2.score = Number(pairing?.player2?.score || 0);
          });
          if (round?.byePlayer) {
            const byePlayer = playersMap.get(String(round.byePlayer.id));
            if (byePlayer) byePlayer.score = Number(round.byePlayer.score || 0);
          }
        });

        const rankings = Array.from(playersMap.values())
          .sort((a, b) => b.score - a.score)
          .map((p, index) => ({ rank: index + 1, username: p.username }));

        const playerName = normalizeKey(pRecord?.username || player.name || '');
        const rankRow = rankings.find((r) => normalizeKey(r.username) === playerName);
        return rankRow ? rankRow.rank : 'N/A';
      };

      tournaments = (tData || []).map((t) => {
        const pRecord = ptMap.get(String(t._id));
        return { ...t, position: rankForTournament(t._id, pRecord) };
      });
    }

    const subscriptions = await database.collection('subscriptionstable').find({
      $or: [
        { email: player.email },
        { username: player.email },
        { name: player.name },
        { username: player.name }
      ]
    }).sort({ _id: -1 }).limit(500).toArray();

    const sales = await database.collection('sales').aggregate([
      {
        $match: {
          $or: [
            { buyer_id: player._id },
            { buyer: player.name },
            { buyer: player.email }
          ]
        }
      },
      { $lookup: { from: 'products', localField: 'product_id', foreignField: '_id', as: 'product' } },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      { $project: { product_name: '$product.name', coordinator: '$product.coordinator', price: 1, purchase_date: 1, quantity: 1 } },
      { $sort: { purchase_date: -1 } },
      { $limit: 500 }
    ]).toArray();

    const stats = {
      walletBalance: Number(walletDoc?.wallet_balance || 0),
      totalRecharged,
      fideId: player.FIDE_ID || 'N/A',
      aicfId: player.AICF_ID || 'N/A'
    };

    const playerId = String(player._id);

    return {
      player: {
        _id: playerId,
        playerId,
        name: player.name,
        email: player.email,
        college: player.college,
        dob: player.dob,
        isDeleted: player.isDeleted,
        status
      },
      stats,
      topups,
      tournaments,
      subscriptions,
      sales
    };
  }
};

module.exports = AdminService;
