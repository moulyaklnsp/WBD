function createRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.clearCookie = jest.fn(() => res);
  return res;
}

function createReq({ session, body, params, query, file } = {}) {
  return {
    session,
    body: body || {},
    params: params || {},
    query: query || {},
    file
  };
}

function createServiceProxy(defaultValue) {
  const calls = new Map();
  const proxy = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === '__calls') return calls;
        if (!calls.has(prop)) {
          calls.set(prop, jest.fn(async () => defaultValue));
        }
        return calls.get(prop);
      }
    }
  );
  return proxy;
}

function loadPlayerControllerWithMocks({ serviceDefault = { ok: true }, cacheValue = { ok: 'cached' } } = {}) {
  jest.resetModules();

  const services = {
    DashboardService: createServiceProxy(serviceDefault),
    TournamentsService: createServiceProxy(serviceDefault),
    PairingsService: createServiceProxy(serviceDefault),
    StoreService: createServiceProxy(serviceDefault),
    OrdersService: createServiceProxy(serviceDefault),
    SubscriptionService: createServiceProxy(serviceDefault),
    GrowthService: createServiceProxy(serviceDefault),
    ProfileService: createServiceProxy(serviceDefault),
    NotificationsService: createServiceProxy(serviceDefault),
    StreamsService: createServiceProxy(serviceDefault),
    WalletService: createServiceProxy(serviceDefault),
    ComplaintsService: createServiceProxy(serviceDefault)
  };

  const Cache = {
    keys: {
      streamsPlayer: jest.fn(() => 'streams:player'),
      announcementsPlayer: jest.fn(() => 'announcements:player'),
      newsPlayer: jest.fn(() => 'news:player'),
      storeSuggestions: jest.fn((email) => `store:suggestions:${email}`)
    },
    config: { ttl: { defaultSeconds: 120 } },
    cacheAsideJson: jest.fn(async ({ fetcher }) => ({ value: await fetcher() }))
  };

  jest.doMock('../../services/player/dashboardService', () => services.DashboardService);
  jest.doMock('../../services/player/tournamentsService', () => services.TournamentsService);
  jest.doMock('../../services/player/pairingsService', () => services.PairingsService);
  jest.doMock('../../services/player/storeService', () => services.StoreService);
  jest.doMock('../../services/player/ordersService', () => services.OrdersService);
  jest.doMock('../../services/player/subscriptionService', () => services.SubscriptionService);
  jest.doMock('../../services/player/growthService', () => services.GrowthService);
  jest.doMock('../../services/player/profileService', () => services.ProfileService);
  jest.doMock('../../services/player/notificationsService', () => services.NotificationsService);
  jest.doMock('../../services/player/streamsService', () => services.StreamsService);
  jest.doMock('../../services/player/walletService', () => services.WalletService);
  jest.doMock('../../services/player/complaintsService', () => services.ComplaintsService);
  jest.doMock('../../utils/cache', () => Cache);

  // eslint-disable-next-line global-require
  const playerController = require('../../controllers/playerController');
  return { playerController, services, Cache };
}

describe('playerController', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('getDashboard rejects when not logged in', async () => {
    const { playerController } = loadPlayerControllerWithMocks();
    const req = createReq({ session: {} });
    const res = createRes();

    await playerController.getDashboard(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Please log in' });
  });

  test('sendError uses client error message for 4xx and fallback for 5xx', async () => {
    const { playerController, services } = loadPlayerControllerWithMocks();

    services.DashboardService.getDashboard.mockRejectedValueOnce(
      Object.assign(new Error('Bad input'), { statusCode: 400 })
    );
    const req1 = createReq({ session: { userEmail: 'p@example.com' } });
    const res1 = createRes();
    await playerController.getDashboard(req1, res1);
    expect(res1.status).toHaveBeenCalledWith(400);
    expect(res1.json).toHaveBeenCalledWith({ error: 'Bad input' });

    services.DashboardService.getDashboard.mockRejectedValueOnce(
      Object.assign(new Error('DB down'), { statusCode: 500 })
    );
    const req2 = createReq({ session: { userEmail: 'p@example.com' } });
    const res2 = createRes();
    await playerController.getDashboard(req2, res2);
    expect(res2.status).toHaveBeenCalledWith(500);
    expect(res2.json).toHaveBeenCalledWith({ error: 'Failed to fetch dashboard' });
  });

  test('deleteAccount destroys session when service asks to', async () => {
    const { playerController, services } = loadPlayerControllerWithMocks();
    services.ProfileService.deleteAccount.mockResolvedValueOnce({
      shouldDestroySession: true,
      message: 'Deleted'
    });

    const req = createReq({
      session: {
        userEmail: 'p@example.com',
        destroy: (cb) => cb && cb()
      }
    });
    const res = createRes();

    await playerController.deleteAccount(req, res);
    expect(res.clearCookie).toHaveBeenCalledWith('connect.sid');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Deleted' });
  });

  test('uploadPhoto validates file presence', async () => {
    const { playerController } = loadPlayerControllerWithMocks();
    const req = createReq({ session: { userEmail: 'p@example.com' } });
    const res = createRes();

    await playerController.uploadPhoto(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('smoke: common endpoints call services and return expected status', async () => {
    const { playerController, services } = loadPlayerControllerWithMocks({ serviceDefault: { ok: true } });
    const session = {
      userEmail: 'p@example.com',
      username: 'p',
      userID: 'u1',
      userCollege: 'ABC',
      userRole: 'player'
    };

    const cases = [
      ['getDashboard', services.DashboardService, 'getDashboard', 200, createReq({ session })],
      ['getTournaments', services.TournamentsService, 'getTournaments', 200, createReq({ session })],
      ['joinIndividual', services.TournamentsService, 'joinIndividual', 200, createReq({ session, body: { tournamentId: 't1' } })],
      ['joinTeam', services.TournamentsService, 'joinTeam', 200, createReq({ session, body: { tournamentId: 't1' } })],
      ['getStore', services.StoreService, 'getStore', 200, createReq({ session })],
      ['getSubscription', services.SubscriptionService, 'getSubscription', 200, createReq({ session })],
      ['getGrowth', services.GrowthService, 'getGrowth', 200, createReq({ session })],
      ['getGrowthAnalytics', services.GrowthService, 'getGrowthAnalytics', 200, createReq({ session })],
      ['getProfile', services.ProfileService, 'getProfile', 200, createReq({ session })],
      ['updateProfile', services.ProfileService, 'updateProfile', 200, createReq({ session, body: { name: 'X' } })],
      ['getSettings', services.ProfileService, 'getSettings', 200, createReq({ session })],
      ['updateSettings', services.ProfileService, 'updateSettings', 200, createReq({ session, body: { sound: false } })],
      ['getPairings', services.PairingsService, 'getPairings', 200, createReq({ session, query: { tournament_id: 't1', rounds: '3' } })],
      ['getRankings', services.PairingsService, 'getRankings', 200, createReq({ session, query: { tournament_id: 't1' } })],
      ['getNotifications', services.NotificationsService, 'getNotifications', 200, createReq({ session })],
      ['markNotificationRead', services.NotificationsService, 'markNotificationRead', 200, createReq({ session, body: { notificationId: 'n1' } })],
      ['addFunds', services.WalletService, 'addFunds', 200, createReq({ session, body: { amount: 10 } })],
      ['getWalletTransactions', services.WalletService, 'getWalletTransactions', 200, createReq({ session })],
      ['submitComplaint', services.ComplaintsService, 'submitComplaint', 201, createReq({ session, body: { complaint: 'x' } })],
      ['getMyComplaints', services.ComplaintsService, 'getMyComplaints', 200, createReq({ session })],
      ['getCart', services.OrdersService, 'getCart', 200, createReq({ session })],
      ['addToCart', services.OrdersService, 'addToCart', 200, createReq({ session, body: { productId: 'p1' } })],
      ['removeFromCart', services.OrdersService, 'removeFromCart', 200, createReq({ session, body: { productId: 'p1' } })],
      ['clearCart', services.OrdersService, 'clearCart', 200, createReq({ session })],
      ['createOrder', services.OrdersService, 'createOrder', 200, createReq({ session })],
      ['getOrders', services.OrdersService, 'getOrders', 200, createReq({ session })],
      ['cancelOrder', services.OrdersService, 'cancelOrder', 200, createReq({ session, params: { orderId: 'o1' } })],
      ['getOrderTracking', services.OrdersService, 'getOrderTracking', 200, createReq({ session, params: { orderId: 'o1' } })],
      ['verifyDeliveryOtp', services.OrdersService, 'verifyDeliveryOtp', 200, createReq({ session, body: { orderId: 'o1', otp: '1234' } })]
    ];

    for (const [fnName, service, method, expectedStatus, req] of cases) {
      const res = createRes();
      await playerController[fnName](req, res);
      expect(res.status).toHaveBeenCalledWith(expectedStatus);
      expect(res.json).toHaveBeenCalledWith({ ok: true });
      expect(service[method]).toHaveBeenCalledTimes(1);
    }
  });
});
