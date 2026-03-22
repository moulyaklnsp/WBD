const express = require('express');
const router = express.Router();
const { connectDB } = require('./routes/databasecongi');
const moment = require('moment');
const utils = require('./utils');
const path = require('path'); 
const { ObjectId } = require('mongodb');

router.use(express.json());

// ==================== API ROUTES ====================

// Admin dashboard API
router.get('/api/dashboard', async (req, res) => {
  try {
    const db = await connectDB();
    const adminName = req.session.username || 'Admin';
    const threeDaysLater = moment().add(3, 'days').toDate();

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
      meetings: meetings || [],
      contactMessages: contactMessages || []
    });
  } catch (error) {
    console.error('Error fetching admin dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Tournaments API (for admin to view all)
router.get('/api/tournaments', async (req, res) => {
  try {
    const db = await connectDB();
    const tournaments = await db.collection('tournaments')
      .find({ status: { $ne: 'Removed' } })  // Exclude removed
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
        approved: 1  // Only count approved teams
      } },
      { $group: { _id: '$tournament_id', count: { $sum: 1 } } },
      { $project: { count: { $multiply: ['$count', 3] } } }  // Each team has 3 players
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
});

// Remove Tournament API (for admin)
router.delete('/api/tournaments/:id', async (req, res) => {
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
});

// Coordinators API
router.get('/api/coordinators', async (req, res) => {
  try {
    const db = await connectDB();
    const coordinators = await db.collection('users')
      .find({ role: 'coordinator' })
      .project({ name: 1, email: 1, college: 1, isDeleted: 1 })
      .toArray();

    res.json(coordinators);
  } catch (error) {
    console.error('Error fetching coordinators:', error);
    res.status(500).json({ error: 'Failed to fetch coordinators' });
  }
});

// Remove Coordinator API
router.delete('/api/coordinators/:email', async (req, res) => {
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
});

// Restore Coordinator API
router.patch('/api/coordinators/restore/:email', async (req, res) => {
  try {
    const { email } = req.params;

    // Auth check
    if (!req.session.userEmail || req.session.userRole !== 'admin') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await connectDB();
    const result = await db.collection('users').updateOne(
      { email: email, role: 'coordinator', isDeleted: 1 },
      { $set: { isDeleted: 0, restored_date: new Date(), restored_by: req.session.userEmail } }
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
});

// Organizers API
router.get('/api/organizers', async (req, res) => {
  try {
    const db = await connectDB();
    const organizers = await db.collection('users')
      .find({ role: 'organizer' })
      .project({ name: 1, email: 1, college: 1, isDeleted: 1 })
      .toArray();

    res.json(organizers);
  } catch (error) {
    console.error('Error fetching organizers:', error);
    res.status(500).json({ error: 'Failed to fetch organizers' });
  }
});

// Remove Organizer API
router.delete('/api/organizers/:email', async (req, res) => {
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
});

// Restore Organizer API
router.patch('/api/organizers/restore/:email', async (req, res) => {
  try {
    const { email } = req.params;

    // Auth check
    if (!req.session.userEmail || req.session.userRole !== 'admin') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await connectDB();
    const result = await db.collection('users').updateOne(
      { email: email, role: 'organizer', isDeleted: 1 },
      { $set: { isDeleted: 0, restored_date: new Date(), restored_by: req.session.userEmail } }
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
});

// Players API
router.get('/api/players', async (req, res) => {
  try {
    const db = await connectDB();
    const players = await db.collection('users')
      .find({ role: 'player' })
      .project({ name: 1, email: 1, college: 1, isDeleted: 1 })
      .toArray();

    res.json(players);
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

// Remove Player API
router.delete('/api/players/:email', async (req, res) => {
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
});

// Restore Player API
router.patch('/api/players/restore/:email', async (req, res) => {
  try {
    const { email } = req.params;

    // Auth check
    if (!req.session.userEmail || req.session.userRole !== 'admin') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await connectDB();
    const result = await db.collection('users').updateOne(
      { email: email, role: 'player', isDeleted: 1 },
      { $set: { isDeleted: 0, restored_date: new Date(), restored_by: req.session.userEmail } }
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
});

// Payments API
router.get('/api/payments', async (req, res) => {
  try {
    const db = await connectDB();

    const players = await db.collection('subscriptionstable').aggregate([
      { $lookup: { from: 'users', localField: 'username', foreignField: 'email', as: 'user' } },
      { $unwind: '$user' },
      { $match: { 'user.isDeleted': 0 } },
      { $project: { name: '$user.name', plan: 1, start_date: 1 } }
    ]).toArray();

    const sales = await db.collection('sales').aggregate([
      { $lookup: { from: 'products', localField: 'product_id', foreignField: '_id', as: 'product' } },
      { $unwind: '$product' },
      { $project: { product: '$product.name', price: 1, coordinator: '$product.coordinator', college: 1, buyer: 1, purchase_date: 1 } }
    ]).toArray();

    const tournamentSales = await db.collection('tournaments').aggregate([
      {
        $lookup: { from: 'tournament_players', localField: '_id', foreignField: 'tournament_id', as: 'individual_enrollments' }
      },
      {
        $lookup: { from: 'enrolledtournaments_team', localField: '_id', foreignField: 'tournament_id', as: 'team_enrollments' }
      },
      {
        $project: {
          name: 1,
          entry_fee: 1,
          type: 1,
          date: 1,
          individual_enrollments: { $size: '$individual_enrollments' },
          team_enrollments: { $size: { $filter: { input: '$team_enrollments', as: 'team', cond: { $eq: ['$$team.approved', 1] } } } }
        }
      },
      {
        $facet: {
          individual: [
            { $match: { type: 'Individual', individual_enrollments: { $gt: 0 } } },
            { $project: { name: 1, entry_fee: 1, type: 1, total_enrollments: '$individual_enrollments', revenue: { $multiply: ['$entry_fee', '$individual_enrollments'] }, enrollment_date: '$date' } }
          ],
          team: [
            { $match: { type: 'Team', team_enrollments: { $gt: 0 } } },
            { $unwind: '$team_enrollments' },
            { $match: { 'team_enrollments.approved': 1 } },
            {
              $group: {
                _id: '$_id',
                name: { $first: '$name' },
                entry_fee: { $first: '$entry_fee' },
                type: { $first: '$type' },
                total_enrollments: { $sum: 1 },
                enrollment_dates: { $push: '$team_enrollments.enrollment_date' }
              }
            },
            { $project: { name: 1, entry_fee: 1, type: 1, total_enrollments: 1, revenue: { $multiply: ['$entry_fee', '$total_enrollments'] }, enrollment_date: { $arrayElemAt: ['$enrollment_dates', 0] } } }
          ]
        }
      },
      { $project: { combined: { $concatArrays: ['$individual', '$team'] } } },
      { $unwind: '$combined' },
      { $replaceRoot: { newRoot: '$combined' } },
      { $sort: { enrollment_date: -1 } }
    ]).toArray();

    res.json({ players, sales, tournamentSales });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments data' });
  }
});

// ==================== PAGE RENDERING ROUTES ====================
// Helper function to safely send HTML files from /views/admin
function sendAdminPage(res, filename) {
  // FIX: include ChessHive.v1.0.2 folder in the path
  const filePath = path.join(__dirname, '..', 'ChessHive.v1.0.2', 'views', 'admin', `${filename}.html`);

  res.sendFile(filePath, (err) => {
    if (err) {
      console.error(`Error sending file: ${filename}.html`, err);
      res.status(err.status || 500).send('Error loading page');
    }
  });
}

router.get('/:subpage?', async (req, res) => {
  const subpage = req.params.subpage || 'admin_dashboard';

  if (!req.session.userEmail || req.session.userRole !== 'admin') {
    console.log('Access denied: User not logged in or not an admin');
    return res.redirect("/?error-message=Please log in as an admin");
  }

  try {
    switch (subpage) {
      case 'admin_dashboard':
        sendAdminPage(res, 'admin_dashboard');
        break;
      case 'admin_tournament_management':
        sendAdminPage(res, 'admin_tournament_management');
        break;
      case 'organizer_management':
        sendAdminPage(res, 'organizer_management');
        break;
      case 'coordinator_management':
        sendAdminPage(res, 'coordinator_management');
        break;
      case 'payments':
        sendAdminPage(res, 'payments');
        break;
      case 'player_management':
        sendAdminPage(res, 'player_management');
        break;
      default:
        console.log('Invalid subpage:', subpage);
        return res.redirect('/admin_dashboard?error-message=Page not found');
    }
  } catch (error) {
    console.error('Error rendering admin page:', error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;