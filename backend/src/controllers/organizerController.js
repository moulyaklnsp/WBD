const { connectDB } = require('../config/database');
const moment = require('moment');
const helpers = require('../utils/helpers');
const { uploadImageBuffer, destroyImage } = require('../utils/cloudinary');
const { ObjectId } = require('mongodb');
const path = require('path');
let multer;
try { multer = require('multer'); } catch (e) { multer = null; }

function safeTrim(v) {
  return (v == null ? '' : String(v)).trim();
}

function normalizeEmail(v) {
  return safeTrim(v).toLowerCase();
}

function isValidName(name) {
  return !!name && /^[A-Za-z]+(?: [A-Za-z]+)*$/.test(name);
}

function isSelfDeletedUser(user) {
  const email = normalizeEmail(user?.email);
  const deletedBy = normalizeEmail(user?.deleted_by);
  return Boolean(email && deletedBy && email === deletedBy);
}

// GET /api/dashboard
const getDashboard = async (req, res) => {
  try {
    const db = await connectDB();

    // Get organizer name
    const organizer = await db.collection('users').findOne({
      email: req.session.userEmail,
      role: 'organizer'
    });

    // Get upcoming meetings (next 3 days)
    const threeDaysLater = moment().add(3, 'days').toDate();
    const today = new Date();

    const meetings = await db.collection('meetingsdb')
      .find({
        date: {
          $gte: today,
          $lte: threeDaysLater
        }
      })
      .sort({ date: 1, time: 1 })
      .toArray();

    // Get pending tournament approvals (within 3 days)
    const pendingApprovals = await db.collection('tournaments')
      .find({
        status: 'Pending',
        date: { $gte: today, $lte: threeDaysLater }
      })
      .sort({ date: 1 })
      .toArray();

    res.json({
      organizerName: organizer?.name || 'Organizer',
      meetings: meetings || [],
      pendingApprovals: pendingApprovals || []
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
};

// GET /api/profile
const getProfile = async (req, res) => {
  try {
    const db = await connectDB();
    const organizer = await db.collection('users').findOne({
      email: req.session.userEmail,
      role: 'organizer'
    });

    if (!organizer) {
      return res.status(404).json({ error: 'Organizer not found' });
    }

    res.json({
      name: organizer.name,
      email: organizer.email,
      phone: organizer.phone || '',
      college: organizer.college || '',
      dob: organizer.dob || null,
      gender: organizer.gender || '',
      AICF_ID: organizer.AICF_ID || '',
      FIDE_ID: organizer.FIDE_ID || '',
      profile_photo_url: organizer.profile_photo_url || null
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

// PUT /api/profile
const updateProfile = async (req, res) => {
  try {
    const db = await connectDB();
    const userEmail = req.session?.userEmail;
    if (!userEmail) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const organizer = await db.collection('users').findOne({
      email: userEmail,
      role: 'organizer'
    });
    if (!organizer) {
      return res.status(404).json({ error: 'Organizer not found' });
    }

    const body = req.body || {};
    const allowedFields = ['name', 'phone', 'college', 'dob', 'gender', 'AICF_ID', 'FIDE_ID'];
    const set = {};
    const unset = {};

    for (const field of allowedFields) {
      if (body[field] === undefined) continue;

      if (field === 'dob') {
        const rawDob = safeTrim(body[field]);
        if (!rawDob) {
          unset.dob = '';
          continue;
        }
        const parsed = new Date(rawDob);
        if (Number.isNaN(parsed.getTime())) {
          return res.status(400).json({ error: 'Invalid date format for dob' });
        }
        set.dob = parsed;
        continue;
      }

      if (field === 'gender') {
        const gender = safeTrim(body[field]).toLowerCase();
        if (!gender) {
          unset.gender = '';
          continue;
        }
        if (!['male', 'female', 'other'].includes(gender)) {
          return res.status(400).json({ error: 'Invalid gender value' });
        }
        set.gender = gender;
        continue;
      }

      if (field === 'name') {
        const name = safeTrim(body[field]);
        if (!isValidName(name)) {
          return res.status(400).json({ error: 'Valid full name is required' });
        }
        set.name = name;
        continue;
      }

      const value = safeTrim(body[field]);
      if (!value) {
        unset[field] = '';
      } else {
        set[field] = value;
      }
    }

    if (Object.keys(set).length === 0 && Object.keys(unset).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    set.updated_date = new Date();
    const updateDoc = { $set: set };
    if (Object.keys(unset).length > 0) {
      updateDoc.$unset = unset;
    }

    await db.collection('users').updateOne({ _id: organizer._id }, updateDoc);
    return res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating organizer profile:', error);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
};

// POST /api/upload-photo
const uploadPhoto = async (req, res) => {
  try {
    // Handle multipart form data
    if (multer && (req.headers['content-type'] || '').includes('multipart/form-data')) {
      const uploader = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 5 * 1024 * 1024 },
        fileFilter: (r, file, cb) => {
          const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes((file.mimetype || '').toLowerCase());
          if (!ok) return cb(new Error('Only image files (jpg, png, webp, gif) are allowed.'));
          cb(null, true);
        }
      }).single('photo');

      await new Promise((resolve, reject) => {
        uploader(req, res, (err) => (err ? reject(err) : resolve()));
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('Uploading photo for organizer:', req.session.userEmail);

    // Upload to Cloudinary
    const result = await uploadImageBuffer(req.file.buffer, {
      folder: 'chesshive/organizer-photos',
      public_id: `organizer_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      overwrite: false
    });

    if (!result || !result.secure_url) {
      return res.status(500).json({ error: 'Failed to upload image to cloud' });
    }

    console.log('Image uploaded successfully:', result.secure_url);

    // Save URL to database
    const db = await connectDB();
    const updateResult = await db.collection('users').updateOne(
      { email: req.session.userEmail, role: 'organizer' },
      { $set: { profile_photo_url: result.secure_url, profile_photo_public_id: result.public_id } }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(404).json({ error: 'Organizer not found' });
    }

    res.json({ success: true, profile_photo_url: result.secure_url });
  } catch (error) {
    console.error('Error uploading photo:', error);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
};

// GET /api/coordinators
const getCoordinators = async (req, res) => {
  try {
    const db = await connectDB();
    const coordinators = await db.collection('users')
      .find({ role: 'coordinator' })
      .project({ name: 1, email: 1, college: 1, isDeleted: 1, deleted_by: 1 })
      .toArray();

    res.json(coordinators);
  } catch (error) {
    console.error('Error fetching coordinators:', error);
    res.status(500).json({ error: 'Failed to fetch coordinators' });
  }
};

// DELETE /api/coordinators/:email
const removeCoordinator = async (req, res) => {
  try {
    const { email } = req.params;

    // Auth check
    if (!req.session.userEmail || req.session.userRole !== 'organizer') {
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

// PATCH /api/coordinators/restore/:email
const restoreCoordinator = async (req, res) => {
  try {
    const { email } = req.params;

    // Auth check
    if (!req.session.userEmail || req.session.userRole !== 'organizer') {
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

// GET /api/tournaments
const getTournaments = async (req, res) => {
  try {
    const db = await connectDB();
    const tournaments = await db.collection('tournaments')
      .find({})
      .sort({ date: -1 })
      .toArray();

    res.json({ tournaments: tournaments || [] });
  } catch (error) {
    console.error('Error fetching tournaments:', error);
    res.status(500).json({ error: 'Failed to fetch tournaments' });
  }
};

// POST /api/tournaments/approve
const approveTournament = async (req, res) => {
  try {
    const db = await connectDB();
    const { tournamentId } = req.body;

    const result = await db.collection('tournaments').updateOne(
      { _id: new ObjectId(tournamentId) },
      {
        $set: {
          status: 'Approved',
          approved_by: req.session.username || req.session.userEmail,
          approved_date: new Date()
        }
      }
    );

    if (result.modifiedCount > 0) {
      console.log('Tournament approved:', tournamentId);
      res.json({ success: true, message: 'Tournament approved successfully' });
    } else {
      res.status(404).json({ success: false, message: 'Tournament not found' });
    }
  } catch (error) {
    console.error('Error approving tournament:', error);
    res.status(500).json({ success: false, error: 'Failed to approve tournament' });
  }
};

// POST /api/tournaments/reject
const rejectTournament = async (req, res) => {
  try {
    const db = await connectDB();
    const { tournamentId } = req.body;

    const result = await db.collection('tournaments').updateOne(
      { _id: new ObjectId(tournamentId) },
      {
        $set: {
          status: 'Rejected',
          rejected_by: req.session.username || req.session.userEmail,
          rejected_date: new Date()
        }
      }
    );

    if (result.modifiedCount > 0) {
      console.log('Tournament rejected:', tournamentId);
      res.json({ success: true, message: 'Tournament rejected successfully' });
    } else {
      res.status(404).json({ success: false, message: 'Tournament not found' });
    }
  } catch (error) {
    console.error('Error rejecting tournament:', error);
    res.status(500).json({ success: false, error: 'Failed to reject tournament' });
  }
};

// GET /api/store
const getStore = async (req, res) => {
  try {
    const db = await connectDB();

    // Get all products
    const products = await db.collection('products')
      .find({})
      .toArray();

    // Get all sales with product details
    const sales = await db.collection('sales').aggregate([
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
    ]).toArray();

    res.json({
      products: products || [],
      sales: sales || []
    });
  } catch (error) {
    console.error('Error fetching store data:', error);
    res.status(500).json({ error: 'Failed to fetch store data' });
  }
};

// POST /api/meetings
const scheduleMeeting = async (req, res) => {
  try {
    const db = await connectDB();
    const { title, date, time, link } = req.body;
    console.log('Request body:', req.body);

    // Ensure user session exists
    const userName = req.session.username || req.session.userEmail;
    if (!userName) {
      return res.status(401).json({ success: false, message: 'User not logged in' });
    }

    // Construct meeting object
    const meeting = {
      title: title.toString(),
      date: new Date(date),
      time: time.toString(),
      link: link.toString(),
      role: 'organizer',
      name: userName.toString()
    };

    console.log('Meeting to insert:', meeting);

    // Insert into DB
    const result = await db.collection('meetingsdb').insertOne(meeting);

    if (result.insertedId) {
      console.log('Meeting scheduled:', title);
      return res.json({ success: true, message: 'Meeting scheduled successfully' });
    } else {
      return res.status(500).json({ success: false, message: 'Failed to schedule meeting' });
    }
  } catch (error) {
    console.error('Error scheduling meeting:', error);
    return res.status(500).json({ success: false, error: 'Failed to schedule meeting' });
  }
};

// GET /api/meetings/organized
const getOrganizedMeetings = async (req, res) => {
  try {
    const db = await connectDB();
    const meetings = await db.collection('meetingsdb')
      .find({
        role: 'organizer',
        name: req.session.username || req.session.userEmail
      })
      .sort({ date: 1, time: 1 })
      .toArray();

    res.json(meetings);
  } catch (error) {
    console.error('Error fetching organized meetings:', error);
    res.status(500).json({ error: 'Failed to fetch organized meetings' });
  }
};

// GET /api/meetings/upcoming
const getUpcomingMeetings = async (req, res) => {
  try {
    const db = await connectDB();
    const today = new Date();

    const meetings = await db.collection('meetingsdb')
      .find({
        date: { $gte: today },
        name: { $ne: req.session.username || req.session.userEmail }
      })
      .sort({ date: 1, time: 1 })
      .toArray();

    res.json(meetings);
  } catch (error) {
    console.error('Error fetching upcoming meetings:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming meetings' });
  }
};

// DELETE /api/organizers/:email
const removeOrganizer = async (req, res) => {
  try {
    const db = await connectDB();
    const email = decodeURIComponent(req.params.email);

    // Auth check
    if (!req.session.userEmail || req.session.userRole !== 'organizer') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await db.collection('users').updateOne(
      { email: email, role: 'organizer', isDeleted: { $ne: 1 } },
      { $set: { isDeleted: 1, deleted_date: new Date(), deleted_by: req.session.userEmail } }
    );

    if (result.modifiedCount > 0) {
      console.log('Organizer removed:', email);
      // If organizer deleted themself, clear session
      if (email === req.session.userEmail) {
        req.session.destroy(err => {
          if (err) console.error('Error destroying session:', err);
        });
      }
      res.json({ success: true, message: 'Organizer removed successfully' });
    } else {
      res.status(404).json({ success: false, message: 'Organizer not found' });
    }
  } catch (error) {
    console.error('Error removing organizer:', error);
    res.status(500).json({ success: false, error: 'Failed to remove organizer' });
  }
};

// GET /api/sales/monthly
const getMonthlySales = async (req, res) => {
  try {
    const db = await connectDB();
    const now = new Date();
    const year = now.getFullYear();
    const month = parseInt(req.query.month) || now.getMonth() + 1;

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const salesData = await db.collection('sales').aggregate([
      { $match: { purchase_date: { $gte: startOfMonth, $lte: endOfMonth } } },
      {
        $group: {
          _id: { $dayOfMonth: "$purchase_date" },
          totalSales: { $sum: "$price" },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]).toArray();

    res.json(salesData);
  } catch (error) {
    console.error("Error fetching monthly sales:", error);
    res.status(500).json({ error: "Failed to fetch monthly sales" });
  }
};

// GET /api/sales/yearly
const getYearlySales = async (req, res) => {
  try {
    const db = await connectDB();
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

    const salesData = await db.collection('sales').aggregate([
      { $match: { purchase_date: { $gte: startOfYear, $lte: endOfYear } } },
      {
        $group: {
          _id: { $month: "$purchase_date" },
          totalSales: { $sum: "$price" },
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    const fullYear = [];
    for (let m = 1; m <= 12; m++) {
      const found = salesData.find(r => r._id === m);
      fullYear.push({
        _id: m,
        totalSales: found ? found.totalSales : 0,
        count: found ? found.count : 0
      });
    }

    res.json(fullYear);
  } catch (error) {
    console.error("Error fetching yearly sales:", error);
    res.status(500).json({ error: "Failed to fetch yearly sales" });
  }
};

// ── Detailed Sales Analysis ──────────────────────────────────────

// GET /api/sales/tournament-revenue
const getTournamentRevenue = async (req, res) => {
  try {
    const db = await connectDB();

    // Tournament revenue from entry fees
    const tournaments = await db.collection('tournaments')
      .find({ status: { $in: ['Approved', 'Ongoing', 'Completed'] } })
      .toArray();

    // Count enrolled players per tournament
    const revenueData = [];
    for (const t of tournaments) {
      const playerCount = await db.collection('tournament_players').countDocuments({ tournament_id: t._id });
      const teamCount = await db.collection('enrolledtournaments_team').countDocuments({ tournament_id: t._id });
      const totalPlayers = playerCount + (teamCount * 4); // 4 players per team
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

    // Monthly breakdown
    const monthlyRevenue = {};
    revenueData.forEach(t => {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyRevenue[key] = (monthlyRevenue[key] || 0) + t.revenue;
    });

    // Yearly breakdown
    const yearlyRevenue = {};
    revenueData.forEach(t => {
      const year = new Date(t.date).getFullYear().toString();
      yearlyRevenue[year] = (yearlyRevenue[year] || 0) + t.revenue;
    });

    const totalRevenue = revenueData.reduce((sum, t) => sum + t.revenue, 0);

    res.json({ tournaments: revenueData, monthlyRevenue, yearlyRevenue, totalRevenue });
  } catch (error) {
    console.error('Error fetching tournament revenue:', error);
    res.status(500).json({ error: 'Failed to fetch tournament revenue' });
  }
};

// GET /api/sales/store-revenue
const getStoreRevenue = async (req, res) => {
  try {
    const db = await connectDB();
    const sales = await db.collection('sales').aggregate([
      {
        $lookup: {
          from: 'products',
          localField: 'product_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } }
    ]).toArray();

    const totalRevenue = sales.reduce((sum, s) => sum + (s.price || 0), 0);

    // Monthly
    const monthlyRevenue = {};
    sales.forEach(s => {
      const d = new Date(s.purchase_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyRevenue[key] = (monthlyRevenue[key] || 0) + (s.price || 0);
    });

    // Yearly
    const yearlyRevenue = {};
    sales.forEach(s => {
      const year = new Date(s.purchase_date).getFullYear().toString();
      yearlyRevenue[year] = (yearlyRevenue[year] || 0) + (s.price || 0);
    });

    // Product-wise
    const productRevenue = {};
    sales.forEach(s => {
      const name = s.product?.name || 'Unknown';
      productRevenue[name] = (productRevenue[name] || 0) + (s.price || 0);
    });

    res.json({ totalRevenue, monthlyRevenue, yearlyRevenue, productRevenue, totalSales: sales.length });
  } catch (error) {
    console.error('Error fetching store revenue:', error);
    res.status(500).json({ error: 'Failed to fetch store revenue' });
  }
};

// GET /api/sales/insights
const getRevenueInsights = async (req, res) => {
  try {
    const db = await connectDB();
    const sales = await db.collection('sales').find({}).toArray();

    // Monthly totals and counts
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

    // Growth calculation
    const months = Object.keys(monthlyStats).sort();
    let growthPercentage = 0;
    let insights = [];

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

    // Demand trends
    const demandTrend = months.map(m => ({ month: m, revenue: monthlyStats[m].revenue }));

    res.json({
      peakMonth,
      lowestMonth,
      growthPercentage,
      demandTrend,
      insights,
      totalMonths: months.length
    });
  } catch (error) {
    console.error('Error fetching insights:', error);
    res.status(500).json({ error: 'Failed to fetch insights' });
  }
};

// ── Coordinator Performance ─────────────────────────────────────

// GET /api/coordinator-performance
const getCoordinatorPerformance = async (req, res) => {
  try {
    const db = await connectDB();
    const coordinators = await db.collection('users')
      .find({ role: 'coordinator', isDeleted: { $ne: 1 } })
      .project({ name: 1, email: 1, college: 1 })
      .toArray();

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const performanceData = [];
    for (const coord of coordinators) {
      const coordName = coord.name;

      // Tournaments conducted
      const tournaments = await db.collection('tournaments')
        .find({ coordinator: coordName, status: { $nin: ['Removed', 'Rejected'] } })
        .toArray();
      const totalTournaments = tournaments.length;

      // Products & sales
      const products = await db.collection('products').find({ coordinator: coordName }).toArray();
      const productIds = products.map(p => p._id);

      const sales = productIds.length > 0
        ? await db.collection('sales').find({ product_id: { $in: productIds } }).toArray()
        : [];

      const totalProductsSold = sales.length;
      const revenueContribution = sales.reduce((sum, s) => sum + (s.price || 0), 0);

      // Current Month Revenue
      const currentMonthRevenue = sales
        .filter(s => new Date(s.purchase_date) >= currentMonthStart)
        .reduce((sum, s) => sum + (s.price || 0), 0);

      // Previous Month Revenue
      const prevMonthRevenue = sales
        .filter(s => {
          const d = new Date(s.purchase_date);
          return d >= prevMonthStart && d <= prevMonthEnd;
        })
        .reduce((sum, s) => sum + (s.price || 0), 0);

      const growth = prevMonthRevenue > 0
        ? Math.round(((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100)
        : (currentMonthRevenue > 0 ? 100 : 0);

      // Tournament revenue
      let tournamentRevenue = 0;
      for (const t of tournaments) {
        const playerCount = await db.collection('tournament_players').countDocuments({ tournament_id: t._id });
        const teamCount = await db.collection('enrolledtournaments_team').countDocuments({ tournament_id: t._id }); // Add team support
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

    // Rank by total revenue
    performanceData.sort((a, b) => b.totalRevenue - a.totalRevenue);
    performanceData.forEach((p, i) => { p.rank = i + 1; });

    res.json({ coordinators: performanceData });
  } catch (error) {
    console.error('Error fetching coordinator performance:', error);
    res.status(500).json({ error: 'Failed to fetch coordinator performance' });
  }
};

// ── Growth Analysis ─────────────────────────────────────────────

// GET /api/growth-analysis
const getGrowthAnalysis = async (req, res) => {
  try {
    const db = await connectDB();

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
      db.collection('users').find({ isDeleted: { $ne: 1 } }).toArray(),
      db.collection('sales').find({}).toArray(),
      db.collection('tournaments').find({ status: { $nin: ['Removed', 'Rejected'] } }).toArray(),
      db.collection('meetingsdb').find({}).toArray(),
      db.collection('enrolledtournaments_team').find({}).toArray(),
      db.collection('tournament_players').find({}).toArray()
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

    // User growth by actual account creation time (fallback to ObjectId timestamp)
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

    // Revenue growth by purchase time
    sales.forEach((sale) => {
      const purchaseDate = inferCreatedDate(sale, ['purchase_date', 'created_date', 'created_at']);
      const month = toMonthKey(purchaseDate);
      const price = Number(sale?.price || 0);
      increment(revenueGrowthMap, month, price);
      increment(engagementGrowthMap, month, 1); // purchase is also engagement
      addPlatformMetric(month, 'sales', 1);
    });

    // Tournament growth by submission/creation time (not tournament event date)
    tournaments.forEach((tournament) => {
      const created = inferCreatedDate(tournament, ['submitted_date', 'created_date', 'created_at', 'added_date', 'approved_date', 'rejected_date']);
      const month = toMonthKey(created);
      increment(tournamentGrowthMap, month, 1);
      addPlatformMetric(month, 'tournaments', 1);
    });

    // Meetings growth by creation time (not scheduled meeting date)
    meetings.forEach((meeting) => {
      const created = inferCreatedDate(meeting, ['created_date', 'created_at']);
      const month = toMonthKey(created);
      increment(engagementGrowthMap, month, 1);
      addPlatformMetric(month, 'meetings', 1);
    });

    // Team enrollment engagement
    teamEnrollments.forEach((enrollment) => {
      const created = inferCreatedDate(enrollment, ['enrollment_date', 'created_date', 'created_at']);
      const month = toMonthKey(created);
      increment(engagementGrowthMap, month, 1);
      addPlatformMetric(month, 'enrollments', 1);
    });

    // Individual enrollment engagement
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

    res.json({
      userGrowth,
      userRoleBreakdown,
      revenueGrowth,
      tournamentGrowth,
      engagementGrowth,
      platformGrowthTrend,
      platformBreakdown,
      summary
    });
  } catch (error) {
    console.error('Error fetching growth analysis:', error);
    res.status(500).json({ error: 'Failed to fetch growth analysis' });
  }
};

module.exports = {
  getDashboard,
  getProfile,
  updateProfile,
  uploadPhoto,
  getCoordinators,
  removeCoordinator,
  restoreCoordinator,
  getTournaments,
  approveTournament,
  rejectTournament,
  getStore,
  scheduleMeeting,
  getOrganizedMeetings,
  getUpcomingMeetings,
  removeOrganizer,
  getMonthlySales,
  getYearlySales,
  getTournamentRevenue,
  getStoreRevenue,
  getRevenueInsights,
  getCoordinatorPerformance,
  getGrowthAnalysis
};
