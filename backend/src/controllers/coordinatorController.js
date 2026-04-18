const path = require('path');
const StreamsService = require('../services/coordinator/streamsService');
const ProfileService = require('../services/coordinator/profileService');
const NotificationsService = require('../services/coordinator/notificationsService');
const TournamentsService = require('../services/coordinator/tournamentsService');
const MeetingsService = require('../services/coordinator/meetingsService');
const ComplaintsService = require('../services/coordinator/complaintsService');
const CalendarService = require('../services/coordinator/calendarService');
const StoreService = require('../services/coordinator/storeService');
const BlogsService = require('../services/coordinator/blogsService');
const PlayerStatsService = require('../services/coordinator/playerStatsService');
const PairingsService = require('../services/coordinator/pairingsService');
const FeedbackService = require('../services/coordinator/feedbackService');
const AnnouncementsService = require('../services/coordinator/announcementsService');
const ChessEventsService = require('../services/coordinator/chessEventsService');
const Cache = require('../utils/cache');

let multer;
try { multer = require('multer'); } catch (e) { multer = null; }

const getStatusCode = (error, fallback = 500) => error?.statusCode || error?.status || fallback;
const getErrorMessage = (error, fallback) => error?.message || fallback;

const sendError = (res, error, fallbackMessage) => {
  const status = getStatusCode(error, 500);
  const message = status >= 500 ? fallbackMessage : getErrorMessage(error, fallbackMessage);
  const payload = { error: message };
  if (error?.allowedNextStatuses) {
    payload.allowedNextStatuses = error.allowedNextStatuses;
  }
  return res.status(status).json(payload);
};

const buildSessionUser = (req) => {
  if (!req.session?.userEmail) return null;
  return {
    email: req.session.userEmail,
    username: req.session.username,
    userId: req.session.userID,
    college: req.session.userCollege || req.session.collegeName,
    role: req.session.userRole
  };
};

const getSessionUser = (req, res) => {
  const user = buildSessionUser(req);
  if (!user) {
    res.status(401).json({ error: 'Please log in' });
    return null;
  }
  return user;
};

const getOptionalSessionUser = (req) => buildSessionUser(req);

const getRequestUserId = (req, res) => {
  const userId = req.user?.userId || req.user?.id || req.session?.userID;
  if (!userId) {
    res.status(401).json({ error: 'Please log in' });
    return null;
  }
  return userId;
};

// Multer setup for file uploads
const upload = multer ? multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif',
      'application/pdf'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and PDF files are allowed.'), false);
    }
  }
}) : null;

const blogImageUpload = multer ? multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 6 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp'
    ];
    if (allowedTypes.includes((file.mimetype || '').toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WEBP images are allowed.'), false);
    }
  }
}) : null;

// Middleware for tournament file uploads
const uploadTournamentFileMiddleware = (req, res, next) => {
  if (!multer || !upload) {
    return res.status(500).json({ error: 'Upload support is not available (multer not installed).' });
  }
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'File upload failed' });
    }
    next();
  });
};

const uploadBlogImagesMiddleware = (req, res, next) => {
  if (!multer || !blogImageUpload) {
    return res.status(500).json({ error: 'Upload support is not available (multer not installed).' });
  }
  blogImageUpload.array('images', 10)(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Image upload failed' });
    }
    next();
  });
};

// Streams
const getStreams = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await StreamsService.getStreams(null, user);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching coordinator streams:', error);
    return sendError(res, error, 'Failed to fetch streams');
  }
};

const createStream = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await StreamsService.createStream(null, user, { body: req.body });
    return res.status(201).json(data);
  } catch (error) {
    console.error('Error creating stream:', error);
    return sendError(res, error, 'Failed to create stream');
  }
};

const updateStream = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await StreamsService.updateStream(null, user, { id: req.params.id, body: req.body });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error updating stream:', error);
    return sendError(res, error, 'Failed to update stream');
  }
};

const deleteStream = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await StreamsService.deleteStream(null, user, { id: req.params.id });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error deleting stream:', error);
    return sendError(res, error, 'Failed to delete stream');
  }
};

// Profile
const getName = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await ProfileService.getName(null, user);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching name:', error);
    return sendError(res, error, 'Failed to fetch name');
  }
};

const getDashboard = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await ProfileService.getDashboard(null, user);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return sendError(res, error, 'Failed to fetch dashboard data');
  }
};

const getProfile = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await ProfileService.getProfile(null, user);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching profile:', error);
    return sendError(res, error, 'Failed to fetch profile');
  }
};

const updateProfile = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await ProfileService.updateProfile(null, user, { body: req.body });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error updating profile:', error);
    return sendError(res, error, 'Failed to update profile');
  }
};

const uploadPhoto = async (req, res) => {
  if (!multer) {
    return res.status(500).json({ error: 'Upload support is not available (multer not installed).' });
  }

  const user = getSessionUser(req, res);
  if (!user) return;

  const uploader = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (r, file, cb) => {
      const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes((file.mimetype || '').toLowerCase());
      if (!ok) return cb(new Error('Only image files (jpg, png, webp, gif) are allowed.'));
      cb(null, true);
    }
  }).single('photo');

  try {
    await new Promise((resolve, reject) => {
      uploader(req, res, (err) => (err ? reject(err) : resolve()));
    });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Upload failed' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No photo uploaded. Use field name "photo".' });
  }

  try {
    const data = await ProfileService.updatePhoto(null, user, { fileBuffer: req.file.buffer });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error updating profile photo:', error);
    return sendError(res, error, 'Failed to update profile photo');
  }
};

const deleteProfile = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await ProfileService.deleteProfile(null, user);
    if (req.session) {
      req.session.destroy((err) => {
        if (err) console.error('Error destroying session:', err);
      });
    }
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error deleting account:', error);
    return sendError(res, error, 'Failed to delete account');
  }
};

// Notifications
const getNotifications = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await NotificationsService.getNotifications(null, user);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return sendError(res, error, 'Failed to fetch notifications');
  }
};

const markNotificationsRead = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await NotificationsService.markNotificationsRead(null, user, {
      notificationIds: req.body?.notificationIds
    });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error marking notifications:', error);
    return sendError(res, error, 'Failed to mark notifications');
  }
};

// Tournaments
const getTournaments = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await TournamentsService.getTournaments(null, user);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching tournaments:', error);
    return sendError(res, error, 'Failed to fetch tournaments');
  }
};

const getTournamentById = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await TournamentsService.getTournamentById(null, user, { id: req.params.id });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching tournament details:', error);
    return sendError(res, error, 'Failed to fetch tournament details');
  }
};

const createTournament = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await TournamentsService.createTournament(null, user, { body: req.body });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error creating tournament:', error);
    return sendError(res, error, 'Failed to add tournament');
  }
};

const updateTournament = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await TournamentsService.updateTournament(null, user, {
      id: req.params.id,
      body: req.body
    });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error updating tournament:', error);
    return sendError(res, error, 'Failed to update tournament');
  }
};

const deleteTournament = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await TournamentsService.deleteTournament(null, user, { id: req.params.id });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error removing tournament:', error);
    return sendError(res, error, 'Failed to remove tournament');
  }
};

const uploadTournamentFile = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await TournamentsService.uploadTournamentFile(null, user, {
      tournamentId: req.params.id,
      file: req.file,
      description: req.body?.description
    });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error uploading tournament file:', error);
    return sendError(res, error, 'Failed to upload file');
  }
};

const getTournamentFiles = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await TournamentsService.getTournamentFiles(null, user, {
      tournamentId: req.params.id
    });
    if (data?.headers) {
      Object.entries(data.headers).forEach(([key, value]) => res.set(key, value));
    }
    return res.status(200).json({ files: data.files });
  } catch (error) {
    console.error('Error fetching tournament files:', error);
    return sendError(res, error, 'Failed to fetch files');
  }
};

const deleteTournamentFile = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await TournamentsService.deleteTournamentFile(null, user, {
      tournamentId: req.params.tournamentId,
      fileId: req.params.fileId
    });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error deleting tournament file:', error);
    return sendError(res, error, 'Failed to delete file');
  }
};

// Meetings
const scheduleMeeting = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await MeetingsService.scheduleMeeting(null, user, { body: req.body });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error scheduling meeting:', error);
    return sendError(res, error, 'Failed to schedule meeting');
  }
};

const getOrganizedMeetings = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await MeetingsService.getOrganizedMeetings(null, user);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching organized meetings:', error);
    return sendError(res, error, 'Failed to fetch organized meetings');
  }
};

const getUpcomingMeetings = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await MeetingsService.getUpcomingMeetings(null, user);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching upcoming meetings:', error);
    return sendError(res, error, 'Failed to fetch upcoming meetings');
  }
};

const getReceivedMeetings = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await MeetingsService.getReceivedMeetings(null, user);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching received meetings:', error);
    return sendError(res, error, 'Failed to fetch meetings');
  }
};

// Complaints
const getComplaints = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await ComplaintsService.getComplaints(null, user);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching complaints:', error);
    return sendError(res, error, 'Failed to fetch complaints');
  }
};

const resolveComplaint = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await ComplaintsService.resolveComplaint(null, user, {
      complaintId: req.params.complaintId || req.params.id,
      responseText: req.body?.response || req.body?.reply
    });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error resolving complaint:', error);
    return sendError(res, error, 'Failed to resolve complaint');
  }
};

const respondComplaint = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await ComplaintsService.respondComplaint(null, user, {
      complaintId: req.params.complaintId || req.params.id,
      responseText: req.body?.response || req.body?.reply
    });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error responding to complaint:', error);
    return sendError(res, error, 'Failed to respond to complaint');
  }
};

// Calendar
const getCalendarEvents = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await CalendarService.getCalendarEvents(null, user, { query: req.query });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return sendError(res, error, 'Failed to fetch calendar events');
  }
};

const createCalendarEvent = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await CalendarService.createCalendarEvent(null, user, { body: req.body });
    return res.status(201).json(data);
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return sendError(res, error, 'Failed to create event');
  }
};

const deleteCalendarEvent = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await CalendarService.deleteCalendarEvent(null, user, { id: req.params.id });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    return sendError(res, error, 'Failed to delete event');
  }
};

const checkDateConflict = async (req, res) => {
  try {
    const payload = (req.method === 'GET' ? req.query : req.body) || {};
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await CalendarService.checkDateConflict(null, user, { payload });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error checking date conflict:', error);
    return sendError(res, error, 'Failed to check date conflict');
  }
};

// Store / Products
const getProducts = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await StoreService.getProducts(null, user);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching products:', error);
    return sendError(res, error, 'Failed to fetch products');
  }
};

const addProduct = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    if (multer && (req.headers['content-type'] || '').includes('multipart/form-data')) {
      const uploader = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 2 * 1024 * 1024, files: 8 },
        fileFilter: (r, file, cb) => {
          const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes((file.mimetype || '').toLowerCase());
          if (!ok) return cb(new Error('Only image files (jpg, png, webp, gif) are allowed.'));
          cb(null, true);
        }
      }).any();

      await new Promise((resolve, reject) => {
        uploader(req, res, (err) => (err ? reject(err) : resolve()));
      });
    }

    const files = Array.isArray(req.files) ? req.files : [];
    const data = await StoreService.addProduct(null, user, { body: req.body || {}, files });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error adding product:', error);
    return sendError(res, error, 'Failed to add product');
  }
};

const updateProduct = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    if (multer && (req.headers['content-type'] || '').includes('multipart/form-data')) {
      const uploader = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024, files: 8 } }).any();
      await new Promise((resolve, reject) => {
        uploader(req, res, (err) => (err ? reject(err) : resolve()));
      });
    }

    const files = Array.isArray(req.files) ? req.files : [];
    const data = await StoreService.updateProduct(null, user, {
      productId: req.params.productId || req.params.id,
      body: req.body || {},
      files
    });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error updating product:', error);
    return sendError(res, error, 'Failed to update product');
  }
};

const deleteProduct = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await StoreService.deleteProduct(null, user, {
      productId: req.params.productId || req.params.id
    });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error deleting product:', error);
    return sendError(res, error, 'Failed to delete product');
  }
};

const toggleComments = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await StoreService.toggleComments(null, user, {
      productId: req.params.productId || req.params.id
    });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error toggling comments:', error);
    return sendError(res, error, 'Failed to toggle comments');
  }
};

// Store / Orders & Analytics
const getOrders = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await StoreService.getOrders(null, user);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching orders:', error);
    return sendError(res, error, 'Failed to fetch orders');
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await StoreService.updateOrderStatus(null, user, {
      orderId: req.params.orderId || req.params.id,
      body: req.body
    });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error updating order status:', error);
    return sendError(res, error, 'Failed to update order status');
  }
};

const getOrderAnalytics = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await StoreService.getOrderAnalytics(null, user);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching order analytics:', error);
    return sendError(res, error, 'Failed to fetch analytics');
  }
};

const sendDeliveryOtp = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await StoreService.sendDeliveryOtp(null, user, {
      orderId: req.params.id || req.params.orderId
    });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error sending delivery OTP:', error);
    return sendError(res, error, 'Failed to send delivery OTP');
  }
};

const getProductAnalyticsDetails = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await StoreService.getProductAnalyticsDetails(null, user, {
      productId: req.params.productId
    });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching product analytics details:', error);
    return sendError(res, error, 'Failed to fetch product analytics details');
  }
};

// Store / Reviews & Complaints
const getProductReviews = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await StoreService.getProductReviews(null, {
      productId: req.query?.productId || req.query?.product_id
    });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching product reviews:', error);
    return sendError(res, error, 'Failed to fetch reviews');
  }
};

const getOrderComplaints = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await StoreService.getOrderComplaints(null, user);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching order complaints:', error);
    return sendError(res, error, 'Failed to fetch order complaints');
  }
};

const resolveOrderComplaint = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await StoreService.resolveOrderComplaint(null, {
      complaintId: req.params.complaintId || req.params.id,
      response: req.body?.response
    });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error resolving order complaint:', error);
    return sendError(res, error, 'Failed to resolve order complaint');
  }
};

// Blogs
const getBlogs = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await BlogsService.getBlogs(null, user);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching blogs:', error);
    return sendError(res, error, 'Failed to fetch blogs');
  }
};

const getPublishedBlogsPublic = async (req, res) => {
  try {
    const cacheKey = Cache.keys.blogsPublished();
    const { value } = await Cache.cacheAsideJson({
      key: cacheKey,
      ttlSeconds: Cache.config.ttl.longSeconds,
      tags: ['blogs'],
      res,
      label: 'GET /api/public/coordinator-blogs',
      fetcher: async () => BlogsService.getPublishedBlogsPublic(null)
    });
    return res.status(200).json(value);
  } catch (error) {
    console.error('Error fetching public blogs:', error);
    return sendError(res, error, 'Failed to fetch blogs');
  }
};

const getBlogById = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await BlogsService.getBlogById(null, user, { id: req.params.id });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching blog:', error);
    return sendError(res, error, 'Failed to fetch blog');
  }
};

const getBlogByIdPublic = async (req, res) => {
  try {
    const user = getOptionalSessionUser(req);
    const cacheKey = Cache.keys.blogPublic(req.params.id);
    const { value } = await Cache.cacheAsideJson({
      key: cacheKey,
      ttlSeconds: Cache.config.ttl.longSeconds,
      tags: ['blogs'],
      res,
      label: 'GET /api/public/coordinator-blogs/:id',
      fetcher: async () => BlogsService.getBlogByIdPublic(null, user, { id: req.params.id }),
      cacheWhen: (result) => {
        const blog = result?.blog;
        return !!(blog && (blog.status === 'published' || blog.published === true));
      }
    });
    return res.status(200).json(value);
  } catch (error) {
    console.error('Error fetching public blog:', error);
    return sendError(res, error, 'Failed to fetch blog');
  }
};

const uploadBlogImages = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await BlogsService.uploadBlogImages(null, user, { files: req.files });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error uploading blog images:', error);
    return sendError(res, error, 'Failed to upload images');
  }
};

const getBlogReviews = async (req, res) => {
  try {
    const cacheKey = Cache.keys.blogReviews(req.params.id);
    const { value } = await Cache.cacheAsideJson({
      key: cacheKey,
      ttlSeconds: Cache.config.ttl.defaultSeconds,
      tags: ['blogs'],
      res,
      label: 'GET /api/public/coordinator-blogs/:id/reviews',
      fetcher: async () => BlogsService.getBlogReviews(null, { id: req.params.id })
    });
    return res.status(200).json(value);
  } catch (error) {
    console.error('Error fetching blog reviews:', error);
    return sendError(res, error, 'Failed to fetch blog reviews');
  }
};

const addBlogReview = async (req, res) => {
  try {
    const user = getOptionalSessionUser(req);
    const data = await BlogsService.addBlogReview(null, user, {
      id: req.params.id,
      body: req.body
    });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error adding blog review:', error);
    return sendError(res, error, 'Failed to add review');
  }
};

const createBlog = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await BlogsService.createBlog(null, user, { body: req.body });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error creating blog:', error);
    return sendError(res, error, 'Failed to create blog');
  }
};

const updateBlog = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await BlogsService.updateBlog(null, user, {
      id: req.params.id,
      body: req.body
    });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error updating blog:', error);
    return sendError(res, error, 'Failed to update blog');
  }
};

const deleteBlog = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await BlogsService.deleteBlog(null, user, { id: req.params.id });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error deleting blog:', error);
    return sendError(res, error, 'Failed to delete blog');
  }
};

// Player stats & enrolled players
const getPlayerStats = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await PlayerStatsService.getPlayerStats(null);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching player stats:', error);
    return sendError(res, error, 'Failed to fetch player stats');
  }
};

const getPlayerStatsDetails = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await PlayerStatsService.getPlayerStatsDetails(null, {
      playerId: req.params.playerId
    });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching player details:', error);
    return sendError(res, error, 'Failed to fetch player details');
  }
};

const getEnrolledPlayers = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await PlayerStatsService.getEnrolledPlayers(null, {
      tournamentId: req.query?.tournament_id || req.query?.tournamentId
    });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching enrolled players:', error);
    return sendError(res, error, 'Failed to fetch enrolled players');
  }
};

// Pairings & rankings
const getPairings = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await PairingsService.getPairings(null, {
      tournamentId: req.query?.tournament_id || req.query?.tournamentId,
      totalRounds: parseInt(req.query?.rounds, 10) || 5
    });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching pairings:', error);
    return sendError(res, error, 'Failed to fetch pairings');
  }
};

const getRankings = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await PairingsService.getRankings(null, {
      tournamentId: req.query?.tournament_id || req.query?.tournamentId
    });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching rankings:', error);
    return sendError(res, error, 'Failed to fetch rankings');
  }
};

const getTeamPairings = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await PairingsService.getTeamPairings(null, {
      tournamentId: req.query?.tournament_id || req.query?.tournamentId,
      totalRounds: parseInt(req.query?.rounds, 10) || 5
    });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching team pairings:', error);
    return sendError(res, error, 'Failed to fetch team pairings');
  }
};

const getTeamRankings = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await PairingsService.getTeamRankings(null, {
      tournamentId: req.query?.tournament_id || req.query?.tournamentId
    });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching team rankings:', error);
    return sendError(res, error, 'Failed to fetch team rankings');
  }
};

// Feedback
const requestFeedback = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await FeedbackService.requestFeedback(null, user, { tournamentId: req.params.id });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error requesting feedback:', error);
    return sendError(res, error, 'Failed to request feedback');
  }
};

const getFeedbacks = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await FeedbackService.getFeedbacks(null, {
      tournamentId: req.query?.tournament_id || req.query?.tournamentId
    });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching feedbacks:', error);
    return sendError(res, error, 'Failed to fetch feedbacks');
  }
};

const getFeedbackView = async (req, res) => {
  if (!req.session?.userEmail || req.session?.userRole !== 'coordinator') {
    return res.redirect('/?error-message=Please log in as a coordinator');
  }
  const filePath = path.join(__dirname, '..', 'views', 'coordinator', 'feedback_view.html');
  return res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error sending feedback_view.html:', err);
      res.status(500).send('Error loading page');
    }
  });
};

// Announcements
const postAnnouncement = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await AnnouncementsService.postAnnouncement(null, user, {
      body: req.body,
      io: req.app?.locals?.io
    });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error posting announcement:', error);
    return sendError(res, error, 'Failed to post announcement');
  }
};

// Chess events
const getChessEvents = async (req, res) => {
  try {
    const userId = getRequestUserId(req, res);
    if (!userId) return;
    const data = await ChessEventsService.getChessEvents(null, { userId });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching chess events:', error);
    return sendError(res, error, 'Failed to fetch chess events');
  }
};

const createChessEvent = async (req, res) => {
  try {
    const userId = getRequestUserId(req, res);
    if (!userId) return;
    const data = await ChessEventsService.createChessEvent(null, { userId, body: req.body });
    return res.status(201).json(data);
  } catch (error) {
    console.error('Error creating chess event:', error);
    return sendError(res, error, 'Failed to create chess event');
  }
};

const updateChessEvent = async (req, res) => {
  try {
    const userId = getRequestUserId(req, res);
    if (!userId) return;
    const data = await ChessEventsService.updateChessEvent(null, {
      userId,
      id: req.params.id,
      body: req.body
    });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error updating chess event:', error);
    return sendError(res, error, 'Failed to update chess event');
  }
};

const deleteChessEvent = async (req, res) => {
  try {
    const userId = getRequestUserId(req, res);
    if (!userId) return;
    const data = await ChessEventsService.deleteChessEvent(null, { userId, id: req.params.id });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error deleting chess event:', error);
    return sendError(res, error, 'Failed to delete chess event');
  }
};

module.exports = {
  uploadTournamentFileMiddleware,
  uploadBlogImagesMiddleware,
  // Streams
  getStreams,
  createStream,
  updateStream,
  deleteStream,
  // Profile
  getName,
  getDashboard,
  getProfile,
  updateProfile,
  uploadPhoto,
  deleteProfile,
  // Notifications
  getNotifications,
  markNotificationsRead,
  // Tournaments
  getTournaments,
  getTournamentById,
  createTournament,
  updateTournament,
  deleteTournament,
  uploadTournamentFile,
  getTournamentFiles,
  deleteTournamentFile,
  // Meetings
  scheduleMeeting,
  getOrganizedMeetings,
  getUpcomingMeetings,
  getReceivedMeetings,
  // Complaints
  getComplaints,
  resolveComplaint,
  respondComplaint,
  // Calendar
  getCalendarEvents,
  createCalendarEvent,
  deleteCalendarEvent,
  checkDateConflict,
  // Store / Products
  getProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  toggleComments,
  // Store / Orders & Analytics
  getOrders,
  updateOrderStatus,
  getOrderAnalytics,
  sendDeliveryOtp,
  getProductAnalyticsDetails,
  // Store / Reviews & Complaints
  getProductReviews,
  getOrderComplaints,
  resolveOrderComplaint,
  // Blogs
  getBlogs,
  getPublishedBlogsPublic,
  getBlogById,
  getBlogByIdPublic,
  uploadBlogImages,
  getBlogReviews,
  addBlogReview,
  createBlog,
  updateBlog,
  deleteBlog,
  // Announcements
  postAnnouncement,
  // Player Stats & Enrolled Players
  getPlayerStats,
  getPlayerStatsDetails,
  getEnrolledPlayers,
  // Pairings & Rankings
  getPairings,
  getRankings,
  getTeamPairings,
  getTeamRankings,
  // Feedback
  requestFeedback,
  getFeedbacks,
  getFeedbackView,
  // Chess Events
  getChessEvents,
  createChessEvent,
  updateChessEvent,
  deleteChessEvent
};
