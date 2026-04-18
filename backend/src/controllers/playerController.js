const DashboardService = require('../services/player/dashboardService');
const TournamentsService = require('../services/player/tournamentsService');
const PairingsService = require('../services/player/pairingsService');
const StoreService = require('../services/player/storeService');
const OrdersService = require('../services/player/ordersService');
const SubscriptionService = require('../services/player/subscriptionService');
const GrowthService = require('../services/player/growthService');
const ProfileService = require('../services/player/profileService');
const NotificationsService = require('../services/player/notificationsService');
const StreamsService = require('../services/player/streamsService');
const WalletService = require('../services/player/walletService');
const ComplaintsService = require('../services/player/complaintsService');
const Cache = require('../utils/cache');
const { isSolrEnabled } = require('../solr/solrEnabled');

let multer;
try { multer = require('multer'); } catch (e) { multer = null; }

let photoUploader;
if (multer) {
  photoUploader = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes((file.mimetype || '').toLowerCase());
      if (!ok) return cb(new Error('Only image files (jpg, png, webp, gif) are allowed.'));
      cb(null, true);
    }
  }).single('photo');
}

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

// Multer middleware for photo upload
const uploadPhotoMiddleware = (req, res, next) => {
  if (!multer || !photoUploader) {
    return res.status(500).json({ error: 'Upload support is not available (multer not installed).' });
  }
  if (!req.session?.userEmail) {
    return res.status(401).json({ error: 'Please log in' });
  }

  photoUploader(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({ error: 'File upload error: ' + (err.message || 'Unknown error') });
    }
    return next();
  });
};

const uploadWallpaperMiddleware = (req, res, next) => {
  if (!multer) {
    return res.status(500).json({ error: 'Upload support is not available (multer not installed).' });
  }
  if (!req.session?.userEmail) {
    return res.status(401).json({ error: 'Please log in' });
  }

  const uploader = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (r, file, cb) => {
      const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes((file.mimetype || '').toLowerCase());
      if (!ok) return cb(new Error('Only image files (jpg, png, webp, gif) are allowed.'));
      cb(null, true);
    }
  }).single('wallpaper');

  uploader(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed' });
    return next();
  });
};

// Dashboard
const getDashboard = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await DashboardService.getDashboard(null, user);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    return sendError(res, error, 'Failed to fetch dashboard');
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
    return sendError(res, error, 'Internal server error');
  }
};

const joinIndividual = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await TournamentsService.joinIndividual(null, user, req.body?.tournamentId);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error joining individual tournament:', error);
    return sendError(res, error, 'Internal server error');
  }
};

const joinTeam = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await TournamentsService.joinTeam(null, user, req.body);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error joining team tournament:', error);
    return sendError(res, error, 'Internal server error');
  }
};

const approveTeamRequest = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await TournamentsService.approveTeamRequest(null, user, req.body?.requestId);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error approving team request:', error);
    return sendError(res, error, 'Failed to approve team request');
  }
};

const rejectTeamRequest = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await TournamentsService.rejectTeamRequest(null, user, req.body?.requestId);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error rejecting team request:', error);
    return sendError(res, error, 'Failed to reject team request');
  }
};

const cancelTeamRequest = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await TournamentsService.cancelTeamRequest(null, user, req.body?.requestId);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error cancelling team request:', error);
    return sendError(res, error, 'Failed to cancel team request');
  }
};

const getTournamentCalendar = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await TournamentsService.getTournamentCalendar(null, user);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching tournament calendar:', error);
    return sendError(res, error, 'Failed to fetch calendar');
  }
};

const submitFeedback = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await TournamentsService.submitFeedback(null, user, req.body);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error submitting feedback:', error);
    return sendError(res, error, 'Failed to submit feedback');
  }
};

// Store
const getStore = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;

    const q = (req.query.q || req.query.search || '').toString().trim();
    const facets = (req.query.facets || '').toString().trim();
    const sort = (req.query.sort || req.query.sortBy || '').toString().trim();
    const page = req.query.page != null ? parseInt(String(req.query.page), 10) : undefined;
    const pageSize = req.query.pageSize != null ? parseInt(String(req.query.pageSize), 10) : undefined;

    const query = {
      ...req.query,
      q,
      facets: facets || undefined,
      sort: sort || undefined,
      page: Number.isFinite(page) && page > 0 ? page : undefined,
      pageSize: Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 200) : undefined
    };

    const data = await StoreService.getStore(null, user, query);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching store:', error);
    return sendError(res, error, 'Failed to fetch store');
  }
};

const buyProduct = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await StoreService.buyProduct(null, user, req.body);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error buying product:', error);
    return sendError(res, error, 'Server error');
  }
};

const getStoreSuggestions = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const cacheKey = Cache.keys.storeSuggestionsByUser(user.email);
    const { value } = await Cache.cacheAsideJson({
      key: cacheKey,
      ttlSeconds: 60,
      tags: ['store'],
      res,
      label: 'GET /player/api/store/suggestions',
      fetcher: async () => StoreService.getStoreSuggestions(null, user)
    });
    return res.status(200).json(value);
  } catch (error) {
    console.error('Error fetching store suggestions:', error);
    return sendError(res, error, 'Failed to fetch suggestions');
  }
};

const submitReview = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await StoreService.submitReview(null, user, req.body);
    const status = data?.created ? 201 : 200;
    const payload = { ...data };
    delete payload.created;
    return res.status(status).json(payload);
  } catch (error) {
    console.error('Error submitting review:', error);
    return sendError(res, error, 'Failed to submit review');
  }
};

const getProductReviews = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await StoreService.getProductReviews(null, { productId: req.params.productId });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return sendError(res, error, 'Failed to fetch reviews');
  }
};

// Subscription
const getSubscription = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await SubscriptionService.getSubscription(null, user);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return sendError(res, error, 'Internal server error');
  }
};

const subscribePlan = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await SubscriptionService.subscribePlan(null, user, req.body);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error subscribing:', error);
    return sendError(res, error, 'Server error');
  }
};

const getSubscriptionHistory = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await SubscriptionService.getSubscriptionHistory(null, user);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching subscription history:', error);
    return sendError(res, error, 'Failed to fetch subscription history');
  }
};

const changeSubscriptionPlan = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await SubscriptionService.changeSubscriptionPlan(null, user, req.body);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error changing subscription plan:', error);
    return sendError(res, error, 'Failed to change plan');
  }
};

// Growth
const getGrowth = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await GrowthService.getGrowth(null, user);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching growth:', error);
    return sendError(res, error, 'Failed to fetch growth');
  }
};

const getGrowthAnalytics = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await GrowthService.getGrowthAnalytics(null, user);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error loading growth analytics:', error);
    return sendError(res, error, 'Failed to fetch analytics');
  }
};

const comparePlayer = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await GrowthService.comparePlayer(
      null,
      user,
      req.query?.opponent || req.query?.query || ''
    );
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error comparing players:', error);
    return sendError(res, error, 'Failed to compare players.');
  }
};

// Profile
const getProfile = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await ProfileService.getProfile(null, { userEmail: user.email });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching profile:', error);
    return sendError(res, error, 'Failed to fetch profile');
  }
};

const uploadPhoto = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No photo uploaded. Use field name "photo".' });
  }

  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await ProfileService.uploadPhoto(null, {
      userEmail: user.email,
      fileBuffer: req.file.buffer
    });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error updating profile photo:', error);
    return sendError(res, error, 'Failed to update profile photo');
  }
};

const updateProfile = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await ProfileService.updateProfile(null, {
      userEmail: user.email,
      body: req.body
    });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error updating profile:', error);
    return sendError(res, error, 'Failed to update profile');
  }
};

const deleteAccount = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await ProfileService.deleteAccount(null, user);
    if (data?.shouldDestroySession && req.session) {
      req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.status(200).json({ message: data.message });
      });
      return;
    }
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error deleting account:', error);
    return sendError(res, error, 'Failed to delete account');
  }
};

const restorePlayer = async (req, res) => {
  try {
    const data = await ProfileService.restorePlayer(null, {
      playerId: req.params.id,
      email: req.body?.email,
      password: req.body?.password
    });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error restoring player:', error);
    return sendError(res, error, 'Failed to restore player account.');
  }
};

const getSettings = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await ProfileService.getSettings(null, { userEmail: user.email });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return sendError(res, error, 'Failed to fetch settings');
  }
};

const updateSettings = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await ProfileService.updateSettings(null, { userEmail: user.email, body: req.body });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error updating settings:', error);
    return sendError(res, error, 'Failed to update settings');
  }
};

const uploadWallpaper = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No wallpaper image uploaded. Use field name "wallpaper".' });
  }

  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await ProfileService.uploadWallpaper(null, {
      userEmail: user.email,
      fileBuffer: req.file.buffer
    });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error uploading wallpaper:', error);
    return sendError(res, error, 'Failed to upload wallpaper');
  }
};

const deactivateAccount = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await ProfileService.deactivateAccount(null, user);
    if (data?.shouldDestroySession && req.session) {
      req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.status(200).json({ success: true, message: data.message });
      });
      return;
    }
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error deactivating account:', error);
    return sendError(res, error, 'Failed to deactivate account');
  }
};

// Pairings
const getPairings = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await PairingsService.getPairings(null, {
      tournamentId: req.query?.tournament_id,
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
    const data = await PairingsService.getRankings(null, { tournamentId: req.query?.tournament_id });
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
      tournamentId: req.query?.tournament_id,
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
    const data = await PairingsService.getTeamRankings(null, { tournamentId: req.query?.tournament_id });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching team rankings:', error);
    return sendError(res, error, 'Failed to fetch team rankings');
  }
};

// Orders / Cart
const getCart = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await OrdersService.getCart(null, user);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching cart:', error);
    return sendError(res, error, 'Failed to fetch cart');
  }
};

const addToCart = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await OrdersService.addToCart(null, user, req.body);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error adding to cart:', error);
    return sendError(res, error, 'Failed to add to cart');
  }
};

const removeFromCart = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await OrdersService.removeFromCart(null, user, req.body);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error removing from cart:', error);
    return sendError(res, error, 'Failed to remove from cart');
  }
};

const clearCart = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await OrdersService.clearCart(null, user);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error clearing cart:', error);
    return sendError(res, error, 'Failed to clear cart');
  }
};

const createOrder = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await OrdersService.createOrder(null, user);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error creating order:', error);
    return sendError(res, error, 'Failed to create order');
  }
};

const getOrders = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await OrdersService.getOrders(null, user);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching orders:', error);
    return sendError(res, error, 'Failed to fetch orders');
  }
};

const cancelOrder = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await OrdersService.cancelOrder(null, user, req.params.orderId);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error cancelling order:', error);
    return sendError(res, error, 'Failed to cancel order');
  }
};

const getOrderTracking = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await OrdersService.getOrderTracking(null, user, req.params.orderId);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching order tracking:', error);
    return sendError(res, error, 'Failed to fetch tracking');
  }
};

const verifyDeliveryOtp = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await OrdersService.verifyDeliveryOtp(null, user, req.body);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error verifying delivery OTP:', error);
    return sendError(res, error, 'Failed to verify OTP');
  }
};

// Notifications / Streams
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

const markNotificationRead = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await NotificationsService.markNotificationRead(null, user, req.body?.notificationId);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error marking notification read:', error);
    return sendError(res, error, 'Failed to mark as read');
  }
};

const getPlayerStreams = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;

    const q = (req.query.q || '').toString().trim();
    const facets = (req.query.facets || '').toString().trim();
    const sort = (req.query.sort || '').toString().trim();
    const page = req.query.page != null ? parseInt(String(req.query.page), 10) : 1;
    const pageSize = req.query.pageSize != null ? parseInt(String(req.query.pageSize), 10) : 0;

    const engine = isSolrEnabled() ? 'solr' : 'db';

    const cacheKey = Cache.keys.streamsPlayer({
      q: (q || 'none').toLowerCase(),
      page: Number.isFinite(page) && page > 0 ? page : 1,
      pageSize: Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 200) : 0,
      sort: (sort || 'default').toLowerCase(),
      facets: facets || 'none',
      engine
    });

    const { value } = await Cache.cacheAsideJson({
      key: cacheKey,
      ttlSeconds: 60,
      tags: ['streams'],
      res,
      label: 'GET /player/api/streams',
      fetcher: async () => StreamsService.getPlayerStreams(null, user, { q, facets, sort, page, pageSize }),
      cacheWhen: (result) => {
        if (Array.isArray(result)) return engine === 'db';
        return String(result?._meta?.engine || 'db') === engine;
      }
    });

    const list = Array.isArray(value) ? value : (value?.streams || []);
    return res.status(200).json(list);
  } catch (error) {
    console.error('Error fetching streams for player:', error);
    return sendError(res, error, 'Failed to fetch streams');
  }
};

const getAnnouncements = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;

    const q = (req.query.q || '').toString().trim();
    const facets = (req.query.facets || '').toString().trim();
    const sort = (req.query.sort || '').toString().trim();
    const page = req.query.page != null ? parseInt(String(req.query.page), 10) : 1;
    const pageSize = req.query.pageSize != null ? parseInt(String(req.query.pageSize), 10) : 0;

    const engine = isSolrEnabled() ? 'solr' : 'db';

    const cacheKey = Cache.keys.announcementsPlayer({
      q: (q || 'none').toLowerCase(),
      page: Number.isFinite(page) && page > 0 ? page : 1,
      pageSize: Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 200) : 0,
      sort: (sort || 'default').toLowerCase(),
      facets: facets || 'none',
      engine
    });

    const { value } = await Cache.cacheAsideJson({
      key: cacheKey,
      ttlSeconds: Cache.config.ttl.defaultSeconds,
      tags: ['announcements'],
      res,
      label: 'GET /player/api/announcements',
      fetcher: async () => NotificationsService.getAnnouncements(null, user, { q, facets, sort, page, pageSize }),
      cacheWhen: (result) => {
        if (Array.isArray(result)) return engine === 'db';
        return String(result?._meta?.engine || 'db') === engine;
      }
    });

    const list = Array.isArray(value) ? value : (value?.announcements || []);
    return res.status(200).json(list);
  } catch (error) {
    console.error('Error fetching announcements:', error);
    return sendError(res, error, 'Failed to fetch announcements');
  }
};

const getNews = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const engine = isSolrEnabled() ? 'solr' : 'db';
    const cacheKey = Cache.keys.newsPlayerV2({ engine });
    const { value } = await Cache.cacheAsideJson({
      key: cacheKey,
      ttlSeconds: Cache.config.ttl.defaultSeconds,
      tags: ['news'],
      res,
      label: 'GET /player/api/news',
      fetcher: async () => NotificationsService.getNews(null),
      cacheWhen: (result) => {
        if (!result || typeof result !== 'object') return engine === 'db';
        return String(result?._meta?.engine || 'db') === engine;
      }
    });
    return res.status(200).json(value);
  } catch (error) {
    console.error('Error fetching news:', error);
    return sendError(res, error, 'Failed to fetch news');
  }
};

// Complaints
const submitComplaint = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await ComplaintsService.submitComplaint(null, user, req.body);
    return res.status(201).json(data);
  } catch (error) {
    console.error('Error submitting complaint:', error);
    return sendError(res, error, 'Failed to submit complaint');
  }
};

const getMyComplaints = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await ComplaintsService.getMyComplaints(null, user);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching player complaints:', error);
    return sendError(res, error, 'Failed to fetch complaints');
  }
};

// Wallet
const addFunds = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await WalletService.addFunds(null, user, req.body?.amount);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error adding funds:', error);
    return sendError(res, error, 'Failed to add funds');
  }
};

const getWalletTransactions = async (req, res) => {
  try {
    const user = getSessionUser(req, res);
    if (!user) return;
    const data = await WalletService.getWalletTransactions(null, user);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching wallet transactions:', error);
    return sendError(res, error, 'Failed to fetch transactions');
  }
};

module.exports = {
  getDashboard,
  getTournaments,
  joinIndividual,
  joinTeam,
  getStore,
  getSubscription,
  getGrowth,
  getProfile,
  uploadPhoto,
  uploadPhotoMiddleware,
  updateProfile,
  deleteAccount,
  restorePlayer,
  comparePlayer,
  addFunds,
  getPairings,
  getRankings,
  getTeamPairings,
  getTeamRankings,
  approveTeamRequest,
  rejectTeamRequest,
  cancelTeamRequest,
  buyProduct,
  subscribePlan,
  getGrowthAnalytics,
  getNotifications,
  submitFeedback,
  markNotificationRead,
  getPlayerStreams,
  getTournamentCalendar,
  getSubscriptionHistory,
  changeSubscriptionPlan,
  getCart,
  addToCart,
  removeFromCart,
  clearCart,
  createOrder,
  getOrders,
  cancelOrder,
  getOrderTracking,
  verifyDeliveryOtp,
  getStoreSuggestions,
  getSettings,
  updateSettings,
  deactivateAccount,
  submitComplaint,
  getMyComplaints,
  submitReview,
  getProductReviews,
  getAnnouncements,
  getNews,
  uploadWallpaper,
  uploadWallpaperMiddleware,
  getWalletTransactions,
};
