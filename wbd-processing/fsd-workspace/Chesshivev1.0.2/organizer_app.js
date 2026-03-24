const express = require('express');
const router = express.Router();
const { connectDB } = require('./routes/databasecongi');
const moment = require('moment');
const utils = require('./utils');
const { ObjectId } = require('mongodb');
const path = require('path');

router.use(express.json());

router.get('/api/dashboard', async (req, res) => {
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

    res.json({
      organizerName: organizer?.name || 'Organizer',
      meetings: meetings || []
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

router.get('/api/profile', async (req, res) => {
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
      college: organizer.college || 'N/A'
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
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
});

// Restore Coordinator API
router.patch('/api/coordinators/restore/:email', async (req, res) => {
  try {
    const { email } = req.params;

    // Auth check
    if (!req.session.userEmail || req.session.userRole !== 'organizer') {
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

router.get('/api/tournaments', async (req, res) => {
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
});

router.post('/api/tournaments/approve', async (req, res) => {
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
});

router.post('/api/tournaments/reject', async (req, res) => {
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
});

router.get('/api/store', async (req, res) => {
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
});

router.post('/api/meetings', async (req, res) => {
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
      time: time.toString(),   // ensure string
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
});

router.get('/api/meetings/organized', async (req, res) => {
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
});

router.get('/api/meetings/upcoming', async (req, res) => {
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
});

router.get('/api/college-stats', async (req, res) => {
  try {
    const data = {
      collegePerformance: [
        { college: "IIIT Hyderabad", tournaments: 10, wins: 6, losses: 3, draws: 1 },
        { college: "IIIT Kurnool", tournaments: 8, wins: 5, losses: 2, draws: 1 },
        { college: "IIIT Gwalior", tournaments: 12, wins: 7, losses: 4, draws: 1 }
      ],
      tournamentRecords: [
        { name: "Spring Invitational", college: "IIIT Hyderabad", format: "Classical", position: 1, date: "2025-03-15" },
        { name: "Classic", college: "IIIT Kurnool", format: "Classical", position: 3, date: "2025-03-10" },
        { name: "Chess Blitz", college: "IIIT Kurnool", format: "Rapid", position: 1, date: "2025-04-15" },
        { name: "Chess Champs", college: "IIIT Gwalior", format: "Blitz", position: 1, date: "2025-03-19" },
        { name: "Rapid Challenge", college: "IIIT Hyderabad", format: "Rapid", position: 2, date: "2025-04-10" },
        { name: "Blitz Masters", college: "IIIT Hyderabad", format: "Blitz", position: 3, date: "2025-05-20" }
      ],
      topCollegesByFormat: { 
        classical: ["IIIT Hyderabad", "IIIT Delhi", "IIIT Kurnool"], 
        rapid: ["IIIT Kurnool", "IIIT Hyderabad", "IIIT Kancheepuram"], 
        blitz: ["IIIT Gwalior", "IIIT Kottayam", "IIIT Hyderabad"] 
      }
    };
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching college stats:', error);
    res.status(500).json({ error: 'Failed to fetch college stats' });
  }
});

router.delete('/api/organizers/:email', async (req, res) => {
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
});
// new sales analysis endpoints for organizer
router.get('/api/sales/monthly', async (req, res) => {
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
});
router.get('/api/sales/yearly', async (req, res) => {
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
});

// Helper function to safely send organizer HTML files
function sendOrganizerPage(res, filename) {
  const filePath = path.join(__dirname, 'views', 'organizer', `${filename}.html`);

  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error sending HTML file:', filePath, err);
      res.status(err.status || 500).send('Error loading page');
    }
  });
}

// Organizer page route
router.get('/:subpage?', async (req, res) => {
  const subpage = req.params.subpage || 'organizer_dashboard';

  if (!req.session.userEmail || req.session.userRole !== 'organizer') {
    console.log('Access denied: User not logged in or not an organizer');
    return res.redirect("/?error-message=Please log in as an organizer");
  }

  try {
    switch(subpage) {
      case 'organizer_dashboard':
        sendOrganizerPage(res, 'organizer_dashboard');
        break;

      case 'organizer_tournament':
        sendOrganizerPage(res, 'organizer_tournament');
        break;

      case 'coordinator_management':
        sendOrganizerPage(res, 'coordinator_management');
        break;

      case 'store_monitoring':
        sendOrganizerPage(res, 'store_monitoring');
        break;

      case 'meetings':
        sendOrganizerPage(res, 'meetings');
        break;

      case 'organizer_profile':
        sendOrganizerPage(res, 'organizer_profile');
        break;

      case 'college_stats':
        sendOrganizerPage(res, 'college_stats');
        break;
      case 'sales_analysis':
        sendOrganizerPage(res, 'sales_analysis');
        break; 
      default:
        console.log('Organizer subpage not found:', subpage);
        return res.redirect('/organizer/organizer_dashboard?error-message=Page not found');
    }
  } catch (error) {
    console.error('Error loading organizer page:', error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;