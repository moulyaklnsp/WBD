const UsersService = require('../services/organizer/usersService');
const TournamentsService = require('../services/organizer/tournamentsService');
const MeetingsService = require('../services/organizer/meetingsService');
const SalesService = require('../services/organizer/salesService');
const AnalyticsService = require('../services/organizer/analyticsService');

let multer;
try { multer = require('multer'); } catch (e) { multer = null; }

const getStatusCode = (error, fallback = 500) => error?.statusCode || error?.status || fallback;
const getErrorMessage = (error, fallback) => error?.message || fallback;

const sendError = (res, error, fallbackMessage) => {
  const status = getStatusCode(error, 500);
  const message = status >= 500 ? fallbackMessage : getErrorMessage(error, fallbackMessage);
  return res.status(status).json({ error: message });
};

const getSessionUser = (req, res) => {
  if (!req.session?.userEmail) {
    res.status(401).json({ error: 'Please log in' });
    return null;
  }

  return {
    email: req.session.userEmail,
    username: req.session.username,
    userId: req.session.userID,
    college: req.session.userCollege,
    role: req.session.userRole
  };
};

// GET /api/dashboard
const getDashboard = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await AnalyticsService.getDashboard(null, user);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return sendError(res, error, 'Failed to fetch dashboard data');
  }
};

// GET /api/profile
const getProfile = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const profile = await UsersService.getOrganizerProfile(null, user);
    return res.status(200).json(profile);
  } catch (error) {
    console.error('Error fetching profile:', error);
    return sendError(res, error, 'Failed to fetch profile');
  }
};

// PUT /api/profile
const updateProfile = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const result = await UsersService.updateOrganizerProfile(null, user, req.body);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error updating organizer profile:', error);
    return sendError(res, error, 'Failed to update profile');
  }
};

// POST /api/upload-photo
const uploadPhoto = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
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

    const result = await UsersService.updateOrganizerPhoto(null, user, req.file.buffer);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error uploading photo:', error);
    return sendError(res, error, 'Failed to upload photo');
  }
};

// GET /api/coordinators
const getCoordinators = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const coordinators = await UsersService.listCoordinators();
    return res.status(200).json(coordinators);
  } catch (error) {
    console.error('Error fetching coordinators:', error);
    return sendError(res, error, 'Failed to fetch coordinators');
  }
};

// GET /api/coordinators/pending
const getPendingCoordinators = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    if (user.role !== 'organizer') return res.status(403).json({ error: 'Unauthorized' });
    const pending = await UsersService.listPendingCoordinators();
    return res.status(200).json(pending);
  } catch (error) {
    console.error('Error fetching pending coordinators:', error);
    return sendError(res, error, 'Failed to fetch pending coordinators');
  }
};

// POST /api/coordinators/approve
const approveCoordinator = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    if (user.role !== 'organizer') return res.status(403).json({ error: 'Unauthorized' });
    
    const { email, approved } = req.body;
    const result = await UsersService.approvePendingCoordinator(email, approved);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error approving/rejecting coordinator:', error);
    return sendError(res, error, 'Failed to approve/reject coordinator');
  }
};

// DELETE /api/coordinators/:email
const removeCoordinator = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    if (user.role !== 'organizer') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await UsersService.softDeleteCoordinator(null, user, req.params.email);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error removing coordinator:', error);
    return sendError(res, error, 'Failed to remove coordinator');
  }
};

// PATCH /api/coordinators/restore/:email
const restoreCoordinator = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    if (user.role !== 'organizer') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await UsersService.restoreCoordinator(null, user, req.params.email);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error restoring coordinator:', error);
    return sendError(res, error, 'Failed to restore coordinator');
  }
};

// GET /api/tournaments
const getTournaments = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const result = await TournamentsService.listTournaments();
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching tournaments:', error);
    return sendError(res, error, 'Failed to fetch tournaments');
  }
};

// POST /api/tournaments/approve
const approveTournament = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const result = await TournamentsService.approveTournament(
      null,
      req.body?.tournamentId,
      user.username || user.email
    );
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error approving tournament:', error);
    const status = getStatusCode(error, 500);
    if (status === 404) {
      return res.status(status).json({ success: false, message: getErrorMessage(error, 'Tournament not found') });
    }
    const message = status >= 500 ? 'Failed to approve tournament' : getErrorMessage(error, 'Failed to approve tournament');
    return res.status(status).json({ success: false, error: message });
  }
};

// POST /api/tournaments/reject
const rejectTournament = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const result = await TournamentsService.rejectTournament(
      null,
      req.body?.tournamentId,
      user.username || user.email
    );
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error rejecting tournament:', error);
    const status = getStatusCode(error, 500);
    if (status === 404) {
      return res.status(status).json({ success: false, message: getErrorMessage(error, 'Tournament not found') });
    }
    const message = status >= 500 ? 'Failed to reject tournament' : getErrorMessage(error, 'Failed to reject tournament');
    return res.status(status).json({ success: false, error: message });
  }
};

// GET /api/store
const getStore = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await AnalyticsService.getStoreSummary(null, req.query);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching store data:', error);
    return sendError(res, error, 'Failed to fetch store data');
  }
};

// POST /api/meetings
const scheduleMeeting = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const { title, date, time, link } = req.body || {};
    const result = await MeetingsService.scheduleMeeting(null, user, {
      title,
      date,
      time,
      link,
      role: 'organizer'
    });
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error scheduling meeting:', error);
    const status = getStatusCode(error, 500);
    if (status === 401) {
      return res.status(status).json({ success: false, message: getErrorMessage(error, 'User not logged in') });
    }
    const message = status >= 500 ? 'Failed to schedule meeting' : getErrorMessage(error, 'Failed to schedule meeting');
    return res.status(status).json({ success: false, error: message });
  }
};

// GET /api/meetings/organized
const getOrganizedMeetings = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const meetings = await MeetingsService.getOrganizedMeetings(null, user);
    return res.status(200).json(meetings);
  } catch (error) {
    console.error('Error fetching organized meetings:', error);
    return sendError(res, error, 'Failed to fetch organized meetings');
  }
};

// GET /api/meetings/upcoming
const getUpcomingMeetings = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const meetings = await MeetingsService.getUpcomingMeetings(null, user);
    return res.status(200).json(meetings);
  } catch (error) {
    console.error('Error fetching upcoming meetings:', error);
    return sendError(res, error, 'Failed to fetch upcoming meetings');
  }
};

// DELETE /api/organizers/:email
const removeOrganizer = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    if (user.role !== 'organizer') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const email = decodeURIComponent(req.params.email);
    const result = await UsersService.softDeleteOrganizer(null, user, email);

    if (result.selfDeleted && req.session) {
      req.session.destroy(err => {
        if (err) console.error('Error destroying session:', err);
      });
    }

    return res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    console.error('Error removing organizer:', error);
    const status = getStatusCode(error, 500);
    if (status === 404) {
      return res.status(status).json({ success: false, message: getErrorMessage(error, 'Organizer not found') });
    }
    const message = status >= 500 ? 'Failed to remove organizer' : getErrorMessage(error, 'Failed to remove organizer');
    return res.status(status).json({ success: false, error: message });
  }
};

// GET /api/sales/monthly
const getMonthlySales = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await SalesService.getMonthlySales(null, req.query?.month);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching monthly sales:', error);
    return sendError(res, error, 'Failed to fetch monthly sales');
  }
};

// GET /api/sales/yearly
const getYearlySales = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await SalesService.getYearlySales();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching yearly sales:', error);
    return sendError(res, error, 'Failed to fetch yearly sales');
  }
};

// GET /api/sales/tournament-revenue
const getTournamentRevenue = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await AnalyticsService.getTournamentRevenue();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching tournament revenue:', error);
    return sendError(res, error, 'Failed to fetch tournament revenue');
  }
};

// GET /api/sales/store-revenue
const getStoreRevenue = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await SalesService.getStoreRevenue();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching store revenue:', error);
    return sendError(res, error, 'Failed to fetch store revenue');
  }
};

// GET /api/sales/insights
const getRevenueInsights = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await SalesService.getRevenueInsights();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching insights:', error);
    return sendError(res, error, 'Failed to fetch insights');
  }
};

// GET /api/coordinator-performance
const getCoordinatorPerformance = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await AnalyticsService.getCoordinatorPerformance();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching coordinator performance:', error);
    return sendError(res, error, 'Failed to fetch coordinator performance');
  }
};

// GET /api/growth-analysis
const getGrowthAnalysis = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await AnalyticsService.getGrowthAnalysis();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching growth analysis:', error);
    return sendError(res, error, 'Failed to fetch growth analysis');
  }
};

module.exports = {
  getDashboard,
  getProfile,
  updateProfile,
  uploadPhoto,
  getCoordinators,
  getPendingCoordinators,
  approveCoordinator,
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
