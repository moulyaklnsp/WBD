const { connectDB } = require('../config/database');
const moment = require('moment');
const helpers = require('../utils/helpers');
const path = require('path');
const crypto = require('crypto');
const { sendContactStatusEmail, sendAdminInviteEmail } = require('../services/emailService');
const { ObjectId } = require('mongodb');
const AdminService = require('../services/admin/adminService');
const { normalizeKey, parsePagination } = require('../utils/mongo');

const normalizeEmail = (value) => (value == null ? '' : String(value).trim().toLowerCase());
const isSelfDeletedUser = (user) => {
  const email = normalizeEmail(user?.email);
  const deletedBy = normalizeEmail(user?.deleted_by);
  return Boolean(email && deletedBy && email === deletedBy);
};
const isSuperAdminRequest = (req) => Boolean(req?.user?.isSuperAdmin ?? req?.session?.isSuperAdmin);
const CONTACT_STATUSES = ['pending', 'new', 'in_progress', 'resolved', 'spam'];
const toDateOrNull = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const normalizeMonthKey = (value) => {
  const date = toDateOrNull(value);
  if (!date) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
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
const getRangeConfig = (rangeRaw) => {
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
};
const toBucketKey = (date, granularity) => {
  const d = new Date(date);
  if (granularity === 'month') {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const toBucketLabel = (date, granularity) => {
  const d = new Date(date);
  if (granularity === 'month') {
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  }
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
};
const buildBuckets = (start, end, granularity) => {
  const buckets = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    buckets.push({
      key: toBucketKey(cursor, granularity),
      label: toBucketLabel(cursor, granularity)
    });
    if (granularity === 'month') cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setDate(cursor.getDate() + 1);
  }
  return buckets;
};

// Admin dashboard API
const getDashboard = async (req, res) => {
  try {
    const db = await connectDB();
    const adminName = req.session.username || 'Admin';
    const threeDaysLater = moment().add(3, 'days').toDate();

    // Calculate Revenue
    // 1. Product Sales
    const productSalesTotal = await db.collection('sales').aggregate([
      { 
        $project: { 
          priceVal: { 
            $cond: [ 
              { $isNumber: '$price' }, 
              '$price', 
              { $toDouble: '$price' } 
            ] 
          } 
        } 
      },
      { $group: { _id: null, total: { $sum: '$priceVal' } } }
    ]).toArray();


    // 2. Individual Tournament Revenue
    const indTournaments = await db.collection('tournaments').aggregate([
      { $match: { type: 'Individual' } },
      { $lookup: { from: 'tournament_players', localField: '_id', foreignField: 'tournament_id', as: 'players' } },
      { $project: { revenue: { $multiply: [{ $ifNull: ['$entry_fee', 0] }, { $size: '$players' }] } } },
      { $group: { _id: null, total: { $sum: '$revenue' } } }
    ]).toArray();


    // 3. Team Tournament Revenue
    const teamTournaments = await db.collection('tournaments').aggregate([
      { $match: { type: 'Team' } },
      { $lookup: { from: 'enrolledtournaments_team', localField: '_id', foreignField: 'tournament_id', as: 'teams' } },
      {
        $project: {
          approved_teams: {
            $filter: {
              input: '$teams',
              as: 'team',
              cond: { $eq: ['$$team.approved', 1] }
            }
          },
          entry_fee: 1
        }
      },
      { $project: { revenue: { $multiply: [{ $ifNull: ['$entry_fee', 0] }, { $size: '$approved_teams' }] } } },
      { $group: { _id: null, total: { $sum: '$revenue' } } }
    ]).toArray();


    // 4. Counts
    const [
      playerCount,
      organizerCount,
      coordinatorCount,
      tournamentCount
    ] = await Promise.all([
      db.collection('users').countDocuments({ role: 'player', isDeleted: { $ne: 1 } }),
      db.collection('users').countDocuments({ role: 'organizer', isDeleted: { $ne: 1 } }),
      db.collection('users').countDocuments({ role: 'coordinator', isDeleted: { $ne: 1 } }),
      db.collection('tournaments').countDocuments({ status: { $ne: 'Removed' } })
    ]);

    // 5. Total Revenue aggregation
    const finalRevenue = (productSalesTotal[0]?.total || 0) + (indTournaments[0]?.total || 0) + (teamTournaments[0]?.total || 0);

    const meetings = await db.collection('meetingsdb')
      .find({ role: 'admin', date: { $lte: threeDaysLater } })
      .sort({ date: 1, time: 1 })
      .toArray();

    const contactMessages = await db.collection('contact')
      .find()
      .sort({ submission_date: -1 })
      .toArray();

    res.json({
      adminName,
      stats: {
        players: playerCount,
        organizers: organizerCount,
        coordinators: coordinatorCount,
        tournaments: tournamentCount,
        revenue: finalRevenue
      },
      meetings: meetings || [],
      contactMessages: contactMessages || []
    });
  } catch (error) {
    console.error('Error fetching admin dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
};

const getContactMessages = async (req, res) => {
  try {
    const { ContactMessagesService } = require('../services/admin/contactMessagesService');

    const status = (req.query.status || '').toString().trim().toLowerCase();
    const q = (req.query.q || req.query.search || '').toString().trim();
    const page = req.query.page != null ? parseInt(String(req.query.page), 10) : 1;
    const pageSize = req.query.pageSize != null ? parseInt(String(req.query.pageSize), 10) : 200;
    const facets = req.query.facets || '';

    const data = await ContactMessagesService.list(null, req.session, {
      status,
      q,
      search: q,
      page,
      pageSize,
      facets
    });

    const payload = { messages: data.messages || [] };
    if (data.facetCounts) payload.facetCounts = data.facetCounts;
    if (data.totalResults != null) payload.totalResults = data.totalResults;
    return res.json(payload);
  } catch (error) {
    console.error('Error fetching contact messages:', error);
    return res.status(500).json({ error: 'Failed to fetch contact messages' });
  }
};

const updateContactMessageStatus = async (req, res) => {
  try {
    const { id } = req.params;
    let incomingStatus = (req.body?.status || '').toString().trim().toLowerCase();
    if (incomingStatus === 'new') incomingStatus = 'pending';
    const internalNote = (req.body?.internal_note || '').toString().trim();

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid message id' });
    }
    if (!CONTACT_STATUSES.includes(incomingStatus)) {
      return res.status(400).json({ error: `Invalid status. Use one of: ${CONTACT_STATUSES.join(', ')}` });
    }

    const db = await connectDB();
    const update = {
      status: incomingStatus,
      internal_note: internalNote,
      status_updated_at: new Date(),
      status_updated_by: req.session.userEmail || 'admin'
    };
    if (incomingStatus === 'resolved') {
      update.resolved_at = new Date();
    }

    const result = await db.collection('contact').updateOne(
      { _id: new ObjectId(id) },
      { $set: update }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const updated = await db.collection('contact').findOne({ _id: new ObjectId(id) });

    if (updated) {
      try {
        const { isSolrEnabled } = require('../solr/solrEnabled');
        if (isSolrEnabled()) {
          const { createSolrService } = require('../solr/SolrService');
          const { mapContactToSolrDoc } = require('../solr/mappers/contactMapper');
          const solr = createSolrService();
          await solr.indexDocument('contact', mapContactToSolrDoc(updated));
        }
      } catch (e) {
        console.error('[solr] Failed to index contact status update:', e?.message || e);
      }
    }
    let emailDelivery = { attempted: false, sent: false };
    if (updated?.email) {
      emailDelivery.attempted = true;
      try {
        const mailResult = await sendContactStatusEmail(updated.email, {
          status: incomingStatus,
          adminMessage: internalNote,
          userMessage: updated.message
        });
        emailDelivery = { ...emailDelivery, ...(mailResult || {}) };
      } catch (mailErr) {
        console.error('Failed to send contact status notification email:', mailErr);
      }
    }
    return res.json({ success: true, message: updated, emailDelivery });
  } catch (error) {
    console.error('Error updating contact message status:', error);
    return res.status(500).json({ error: 'Failed to update message status' });
  }
};

// Tournaments API (for admin to view all)
const getTournaments = async (req, res) => {
  try {
    const db = await connectDB();
    const tournaments = await db.collection('tournaments')
      .find({ status: { $ne: 'Removed' } })
      .sort({ date: -1 })
      .toArray();

    // Get all tournament IDs
    const tournamentIds = tournaments.map(t => t._id);

    // Fetch individual enrollments
    const individualCounts = await db.collection('tournament_players').aggregate([
      { $match: { tournament_id: { $in: tournamentIds } } },
      { $group: { _id: '$tournament_id', count: { $sum: 1 } } }
    ]).toArray();

    // Fetch team enrollments
    const teamCounts = await db.collection('enrolledtournaments_team').aggregate([
      { $match: { 
        tournament_id: { $in: tournamentIds },
        approved: 1
      } },
      { $group: { _id: '$tournament_id', count: { $sum: 1 } } },
      { $project: { count: { $multiply: ['$count', 3] } } }
    ]).toArray();

    // Create maps for quick lookup
    const individualMap = {};
    individualCounts.forEach(item => {
      individualMap[item._id.toString()] = item.count || 0;
    });

    const teamMap = {};
    teamCounts.forEach(item => {
      teamMap[item._id.toString()] = item.count || 0;
    });

    // Add player_count to each tournament
    const tournamentsWithCounts = tournaments.map(tournament => {
      const indCount = individualMap[tournament._id.toString()] || 0;
      const teamCount = teamMap[tournament._id.toString()] || 0;
      return {
        ...tournament,
        player_count: indCount + teamCount
      };
    });

    res.json({ tournaments: tournamentsWithCounts });
  } catch (error) {
    console.error('Error fetching tournaments:', error);
    res.status(500).json({ error: 'Failed to fetch tournaments' });
  }
};

// Remove Tournament API (for admin)
const removeTournament = async (req, res) => {
  try {
    const id = req.params.id;

    // Auth check
    if (!req.session.userEmail || req.session.userRole !== 'admin') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await connectDB();
    const result = await db.collection('tournaments').updateOne(
      { _id: new ObjectId(id), status: { $ne: 'Removed' } },
      { $set: { status: 'Removed', removed_date: new Date(), removed_by: req.session.userEmail } }
    );

    if (result.modifiedCount > 0) {
      res.json({ success: true, message: 'Tournament removed successfully' });
    } else {
      res.status(404).json({ success: false, message: 'Tournament not found' });
    }
  } catch (error) {
    console.error('Error removing tournament:', error);
    res.status(500).json({ success: false, error: 'Failed to remove tournament' });
  }
};

const getTournamentDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const db = await connectDB();
    const result = await AdminService.getTournamentDetails(db, req.session, id);
    return res.json(result);
  } catch (error) {
    console.error('Error fetching tournament details:', error);
    res.status(500).json({ error: 'Failed to fetch tournament details' });
  }
};

// Coordinators API
const getCoordinators = async (req, res) => {
  try {
    const db = await connectDB();
    const result = await AdminService.getCoordinators(db, req.session, req.query);
    return res.json(result.coordinators || []);
  } catch (error) {
    console.error('Error fetching coordinators:', error);
    res.status(500).json({ error: 'Failed to fetch coordinators' });
  }
};

// Remove Coordinator API
const removeCoordinator = async (req, res) => {
  try {
    const { email } = req.params;

    // Auth check
    if (!req.session.userEmail || req.session.userRole !== 'admin') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await connectDB();
    const result = await db.collection('users').updateOne(
      { email: email, role: 'coordinator', isDeleted: { $ne: 1 } },
      { $set: { isDeleted: 1, deleted_date: new Date(), deleted_by: req.session.userEmail } }
    );

    if (result.modifiedCount > 0) {
      res.json({ success: true, message: 'Coordinator removed successfully' });
    } else {
      res.status(404).json({ error: 'Coordinator not found' });
    }
  } catch (error) {
    console.error('Error removing coordinator:', error);
    res.status(500).json({ error: 'Failed to remove coordinator' });
  }
};

// Restore Coordinator API
const restoreCoordinator = async (req, res) => {
  try {
    const { email } = req.params;

    // Auth check
    if (!req.session.userEmail || req.session.userRole !== 'admin') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await connectDB();
    const coordinator = await db.collection('users').findOne({
      email: email,
      role: 'coordinator',
      isDeleted: 1
    });
    if (!coordinator) {
      return res.status(404).json({ error: 'Coordinator not found or already restored' });
    }
    if (isSelfDeletedUser(coordinator)) {
      return res.status(403).json({ error: 'Self-deleted accounts cannot be restored by others' });
    }

    const result = await db.collection('users').updateOne(
      { _id: coordinator._id },
      {
        $set: { isDeleted: 0, restored_date: new Date(), restored_by: req.session.userEmail },
        $unset: { deleted_date: '', deleted_by: '' }
      }
    );

    if (result.modifiedCount > 0) {
      res.json({ success: true, message: 'Coordinator restored successfully' });
    } else {
      res.status(404).json({ error: 'Coordinator not found or already restored' });
    }
  } catch (error) {
    console.error('Error restoring coordinator:', error);
    res.status(500).json({ error: 'Failed to restore coordinator' });
  }
};

// Organizers API
const getOrganizerDetails = async (req, res) => {
  try {
    const { email } = req.params;
    const db = await connectDB();
    
    // Get the organizer
    const organizer = await db.collection('users').findOne({ email: email, role: 'organizer' });
    if (!organizer) {
      return res.status(404).json({ error: 'Organizer not found' });
    }

    const identityKeys = [
      normalizeEmail(organizer.name),
      normalizeEmail(organizer.email)
    ].filter(Boolean);

    const tournamentsApproved = await db.collection('tournaments').find({
      $or: [
        { approved_by_key: { $in: identityKeys } },
        { rejected_by_key: { $in: identityKeys } },
        { approved_by: { $in: [organizer.name, organizer.email].filter(Boolean) } },
        { rejected_by: { $in: [organizer.name, organizer.email].filter(Boolean) } }
      ]
    }).project({
      name: 1,
      title: 1,
      type: 1,
      date: 1,
      start_date: 1,
      end_date: 1,
      entry_fee: 1,
      base_fee: 1,
      location: 1,
      status: 1,
      approved_by: 1,
      rejected_by: 1
    }).sort({ date: -1, start_date: -1 }).limit(500).toArray();

    // Get meetings scheduled/taken by this organizer
    const meetingsScheduled = await db.collection('meetingsdb').find({
      $or: [
        { name_key: { $in: identityKeys } },
        { created_by_key: normalizeEmail(organizer.email) },
        { name: { $in: [organizer.name, organizer.email].filter(Boolean) } },
        { created_by: organizer.email }
      ]
    }).sort({ date: -1, time: -1 }).limit(500).toArray();

    res.json({
      organizer: {
        name: organizer.name,
        email: organizer.email,
        college: organizer.college,
        isDeleted: organizer.isDeleted,
        deleted_by: organizer.deleted_by
      },
      tournamentsApproved,
      meetingsScheduled
    });

  } catch (error) {
    console.error('Error fetching organizer details:', error);
    res.status(500).json({ error: 'Failed to fetch organizer details' });
  }
};

const getOrganizers = async (req, res) => {
  try {
    const db = await connectDB();
    const result = await AdminService.getOrganizers(db, req.session, req.query);
    return res.json(result.organizers || []);
  } catch (error) {
    console.error('Error fetching organizers:', error);
    res.status(500).json({ error: 'Failed to fetch organizers' });
  }
};

// Remove Organizer API
const removeOrganizer = async (req, res) => {
  try {
    const { email } = req.params;

    // Auth check
    if (!req.session.userEmail || req.session.userRole !== 'admin') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await connectDB();
    const result = await db.collection('users').updateOne(
      { email: email, role: 'organizer', isDeleted: { $ne: 1 } },
      { $set: { isDeleted: 1, deleted_date: new Date(), deleted_by: req.session.userEmail } }
    );

    if (result.modifiedCount > 0) {
      res.json({ success: true, message: 'Organizer removed successfully' });
    } else {
      res.status(404).json({ error: 'Organizer not found' });
    }
  } catch (error) {
    console.error('Error removing organizer:', error);
    res.status(500).json({ error: 'Failed to remove organizer' });
  }
};

// Restore Organizer API
const restoreOrganizer = async (req, res) => {
  try {
    const { email } = req.params;

    // Auth check
    if (!req.session.userEmail || req.session.userRole !== 'admin') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await connectDB();
    const organizer = await db.collection('users').findOne({
      email: email,
      role: 'organizer',
      isDeleted: 1
    });
    if (!organizer) {
      return res.status(404).json({ error: 'Organizer not found or already restored' });
    }
    if (isSelfDeletedUser(organizer)) {
      return res.status(403).json({ error: 'Self-deleted accounts cannot be restored by others' });
    }

    const result = await db.collection('users').updateOne(
      { _id: organizer._id },
      {
        $set: { isDeleted: 0, restored_date: new Date(), restored_by: req.session.userEmail },
        $unset: { deleted_date: '', deleted_by: '' }
      }
    );

    if (result.modifiedCount > 0) {
      res.json({ success: true, message: 'Organizer restored successfully' });
    } else {
      res.status(404).json({ error: 'Organizer not found or already restored' });
    }
  } catch (error) {
    console.error('Error restoring organizer:', error);
    res.status(500).json({ error: 'Failed to restore organizer' });
  }
};

// Players API
const getPlayers = async (req, res) => {
  try {
    const db = await connectDB();
    const result = await AdminService.getPlayers(db, req.session, req.query);
    return res.json(result.players || []);
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
};

// Remove Player API
const removePlayer = async (req, res) => {
  try {
    const { email } = req.params;

    // Auth check
    if (!req.session.userEmail || req.session.userRole !== 'admin') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await connectDB();
    const result = await db.collection('users').updateOne(
      { email: email, role: 'player', isDeleted: { $ne: 1 } },
      { $set: { isDeleted: 1, deleted_date: new Date(), deleted_by: req.session.userEmail } }
    );

    if (result.modifiedCount > 0) {
      res.json({ success: true, message: 'Player removed successfully' });
    } else {
      res.status(404).json({ error: 'Player not found' });
    }
  } catch (error) {
    console.error('Error removing player:', error);
    res.status(500).json({ error: 'Failed to remove player' });
  }
};

// Restore Player API
const restorePlayer = async (req, res) => {
  try {
    const { email } = req.params;

    // Auth check
    if (!req.session.userEmail || req.session.userRole !== 'admin') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await connectDB();
    const player = await db.collection('users').findOne({
      email: email,
      role: 'player',
      isDeleted: 1
    });
    if (!player) {
      return res.status(404).json({ error: 'Player not found or already restored' });
    }
    if (isSelfDeletedUser(player)) {
      return res.status(403).json({ error: 'Self-deleted accounts cannot be restored by others' });
    }

    const result = await db.collection('users').updateOne(
      { _id: player._id },
      {
        $set: { isDeleted: 0, restored_date: new Date(), restored_by: req.session.userEmail },
        $unset: { deleted_date: '', deleted_by: '' }
      }
    );

    if (result.modifiedCount > 0) {
      res.json({ success: true, message: 'Player restored successfully' });
    } else {
      res.status(404).json({ error: 'Player not found or already restored' });
    }
  } catch (error) {
    console.error('Error restoring player:', error);
    res.status(500).json({ error: 'Failed to restore player' });
  }
};

// Payments API
const getPayments = async (req, res) => {
  try {
    const db = await connectDB();
    const startDate = toDateOrNull(req.query?.startDate);
    const endDate = toDateOrNull(req.query?.endDate);
    const collegeKey = normalizeKey(req.query?.college);
    const coordinatorKey = normalizeKey(req.query?.coordinator);
    const { limit, skip } = parsePagination(req.query, { defaultLimit: 200, maxLimit: 500 });

    const buildDateMatch = (fieldName) => {
      const range = {};
      if (startDate) range.$gte = startDate;
      if (endDate) range.$lte = endDate;
      return Object.keys(range).length ? { [fieldName]: range } : {};
    };

    // 1. Wallet Recharges
      // We look at the 'payments' collection where purpose='topup', or 'wallet_transactions' where type='credit' and it's not a refund
      // The payments collection seems to better hold topups done via Razorpay:
    const [walletRecharges, subscriptions, tournaments, store] = await Promise.all([
      db.collection('payments').aggregate([
        { $match: { purpose: 'topup', ...buildDateMatch('createdAt') } },
        { $lookup: { from: 'users', localField: 'user_id', foreignField: '_id', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        ...(collegeKey ? [{ $match: { 'user.college_key': collegeKey } }] : []),
        {
          $project: {
            playerName: { $ifNull: ['$user.name', 'Unknown'] },
            playerEmail: '$user.email',
            college: '$user.college',
            amount: 1,
            date: '$createdAt'
          }
        },
        { $sort: { date: -1, _id: -1 } },
        { $skip: skip },
        { $limit: limit }
      ]).toArray(),

      db.collection('subscriptionstable').aggregate([
        ...(Object.keys(buildDateMatch('start_date')).length ? [{ $match: buildDateMatch('start_date') }] : []),
        {
          $lookup: {
            from: 'users',
            let: { email: '$username' },
            pipeline: [
              { $match: { $expr: { $eq: ['$email', '$$email'] } } },
              ...(collegeKey ? [{ $match: { college_key: collegeKey } }] : []),
              { $project: { name: 1, email: 1, college: 1 } }
            ],
            as: 'user'
          }
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: !collegeKey } },
        ...(collegeKey ? [{ $match: { user: { $ne: null } } }] : []),
        {
          $project: {
            playerName: { $ifNull: ['$user.name', 'Unknown'] },
            playerEmail: '$username',
            plan: 1,
            start_date: 1,
            end_date: 1,
            college: '$user.college'
          }
        },
        { $sort: { start_date: -1, _id: -1 } },
        { $skip: skip },
        { $limit: limit }
      ]).toArray(),

      db.collection('tournaments').aggregate([
        {
          $match: {
            status: { $nin: ['Removed', 'Rejected'] },
            ...buildDateMatch('date'),
            ...(collegeKey ? { college_key: collegeKey } : {}),
            ...(coordinatorKey ? { coordinator_key: coordinatorKey } : {})
          }
        },
        {
          $addFields: {
            total_enrollments: {
              $cond: [
                { $eq: ['$type', 'Individual'] },
                { $ifNull: ['$individual_enrollment_count', 0] },
                { $ifNull: ['$team_approved_count', 0] }
              ]
            }
          }
        },
        { $match: { total_enrollments: { $gt: 0 } } },
        {
          $project: {
            conductedBy: '$coordinator',
            name: 1,
            entry_fee: 1,
            type: 1,
            date: 1,
            college: 1,
            total_enrollments: 1,
            totalRevenue: {
              $ifNull: [
                '$revenue_total',
                { $multiply: ['$entry_fee', '$total_enrollments'] }
              ]
            }
          }
        },
        { $sort: { date: -1, _id: -1 } },
        { $skip: skip },
        { $limit: limit }
      ]).toArray(),

      db.collection('sales').aggregate([
        {
          $match: {
            ...buildDateMatch('purchase_date'),
            ...(collegeKey ? { college_key: collegeKey } : {})
          }
        },
        { $lookup: { from: 'products', localField: 'product_id', foreignField: '_id', as: 'product' } },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        ...(coordinatorKey ? [{ $match: { 'product.coordinator_key': coordinatorKey } }] : []),
        {
          $project: {
            item: { $ifNull: ['$product.name', 'Unknown Item'] },
            price: 1,
            soldBy: { $ifNull: ['$product.coordinator', 'Admin'] },
            boughtBy: '$buyer',
            college: 1,
            purchase_date: 1
          }
        },
        { $sort: { purchase_date: -1, _id: -1 } },
        { $skip: skip },
        { $limit: limit }
      ]).toArray()
    ]);

    res.json({
      success: true,
      data: {
        walletRecharges,
        subscriptions,
        tournaments,
        store
      },
      filtersApplied: {
        startDate: startDate || null,
        endDate: endDate || null,
        college: req.query?.college || '',
        coordinator: req.query?.coordinator || ''
      },
      pagination: {
        limit,
        skip
      }
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments data' });
  }
};

const getOrganizerAnalytics = async (req, res) => {
  try {
    const db = await connectDB();
    const result = await AdminService.getOrganizerAnalytics(db, req.session);
    return res.json(result);
  } catch (error) {
    console.error('Error fetching organizer analytics:', error);
    return res.status(500).json({ error: 'Failed to fetch organizer analytics' });
  }
};

const getGrowthAnalytics = async (req, res) => {
  try {
    const db = await connectDB();
    const result = await AdminService.getGrowthAnalytics(db, req.session, req.query?.range);
    return res.json(result);
  } catch (error) {
    console.error('Error fetching admin growth analytics:', error);
    return res.status(500).json({ error: 'Failed to fetch growth analytics' });
  }
};

const getCoordinatorDetails = async (req, res) => {
  try {
    const { email } = req.params;
    const db = await connectDB();
    const result = await AdminService.getCoordinatorDetails(db, req.session, email, req.query);
    return res.json(result);

  } catch (error) {
    console.error('Error fetching coordinator details:', error);
    res.status(500).json({ error: 'Failed to fetch coordinator details' });
  }
};

const getPlayerStatsVisualDetails = async (req, res) => {
  try {
    const PlayerStatsService = require('../services/coordinator/playerStatsService');
    const data = await PlayerStatsService.getPlayerStatsDetails(null, {
      playerId: req.params.playerId
    });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching player stats details:', error);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Failed to fetch player details' });
  }
};

const getPlayerDetails = async (req, res) => {
  try {
    const { email } = req.params;
    const db = await connectDB();
    const result = await AdminService.getPlayerDetails(db, req.session, email);
    return res.json(result);
  } catch(error) {
    console.error('Error fetching player details:', error);
    res.status(500).json({ error: 'Failed to fetch player details' });
  }
};

// ===================== ADMIN INVITES =====================
const createAdminInvite = async (req, res) => {
  try {
    if (!isSuperAdminRequest(req)) {
      return res.status(403).json({ success: false, message: 'Super admin access required' });
    }

    const name = String(req.body?.name || '').trim();
    const emailRaw = String(req.body?.email || '').trim();
    const email = normalizeEmail(emailRaw);

    if (!name || !/^[A-Za-z]+(?: [A-Za-z]+)*$/.test(name)) {
      return res.status(400).json({ success: false, message: 'Valid full name is required' });
    }
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Valid email is required' });
    }

    const db = await connectDB();

    const existing = await db.collection('users').findOne({ email });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const adminCount = await db.collection('users').countDocuments({ role: 'admin', isDeleted: { $ne: 1 } });
    if (adminCount >= 5) {
      return res.status(400).json({ message: 'Admin limit reached (max 5)' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const inviteExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const newAdmin = {
      name,
      email,
      role: 'admin',
      isSuperAdmin: false,
      password: null,
      status: 'pending',
      inviteToken: tokenHash,
      inviteExpires,
      isDeleted: 0,
      createdAt: new Date()
    };

    const result = await db.collection('users').insertOne(newAdmin);
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const inviteUrl = `${baseUrl}/set-password?token=${rawToken}`;

    let emailDelivery = { attempted: false, sent: false };
    try {
      emailDelivery.attempted = true;
      const sent = await sendAdminInviteEmail(email, inviteUrl, req.session?.userEmail || req.user?.email);
      emailDelivery = { ...emailDelivery, ...(sent || {}) };
    } catch (mailErr) {
      console.error('Failed to send admin invite email:', mailErr);
    }

    return res.json({
      success: true,
      adminId: result.insertedId,
      inviteUrl,
      inviteExpires,
      emailDelivery
    });
  } catch (error) {
    console.error('Error creating admin invite:', error);
    return res.status(500).json({ success: false, message: 'Failed to create admin invite' });
  }
};

module.exports = {
  getDashboard,
  getContactMessages,
  updateContactMessageStatus,
  getTournaments,
  getTournamentDetails,
  removeTournament,
  getCoordinators,
  removeCoordinator,
  restoreCoordinator,
  getOrganizers,
  removeOrganizer,
  restoreOrganizer,
  getPlayers,
  removePlayer,
  restorePlayer,
  getPayments,
  getOrganizerAnalytics,
  getGrowthAnalytics,
  getOrganizerDetails,
  getCoordinatorDetails,
  getPlayerDetails,
  getPlayerStatsVisualDetails,
  createAdminInvite
};
