function createRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.redirect = jest.fn(() => res);
  res.send = jest.fn(() => res);
  res.sendFile = jest.fn((_file, cb) => {
    if (typeof cb === 'function') cb(null);
    return res;
  });
  return res;
}

function createReq({ session, body, params, query, method, user, appLocals } = {}) {
  return {
    session,
    body: body || {},
    params: params || {},
    query: query || {},
    method: method || 'GET',
    user,
    headers: {},
    app: { locals: appLocals || {} }
  };
}

function createServiceProxy(defaultValue) {
  const calls = new Map();
  const proxy = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === '__calls') return calls;
        if (!calls.has(prop)) calls.set(prop, jest.fn(async () => defaultValue));
        return calls.get(prop);
      }
    }
  );
  return proxy;
}

function loadCoordinatorControllerWithMocks({ serviceDefault = { ok: true } } = {}) {
  jest.resetModules();

  const services = {
    StreamsService: createServiceProxy(serviceDefault),
    ProfileService: createServiceProxy(serviceDefault),
    NotificationsService: createServiceProxy(serviceDefault),
    TournamentsService: createServiceProxy(serviceDefault),
    MeetingsService: createServiceProxy(serviceDefault),
    ComplaintsService: createServiceProxy(serviceDefault),
    CalendarService: createServiceProxy(serviceDefault),
    StoreService: createServiceProxy(serviceDefault),
    BlogsService: createServiceProxy(serviceDefault),
    PlayerStatsService: createServiceProxy(serviceDefault),
    PairingsService: createServiceProxy(serviceDefault),
    FeedbackService: createServiceProxy(serviceDefault),
    AnnouncementsService: createServiceProxy(serviceDefault),
    ChessEventsService: createServiceProxy(serviceDefault)
  };

  const Cache = {
    keys: {
      blogsPublished: jest.fn(() => 'blogs:published'),
      blogPublic: jest.fn((id) => `blog:${id}`),
      blogReviews: jest.fn((id) => `blog:${id}:reviews`)
    },
    config: { ttl: { longSeconds: 300, defaultSeconds: 120 } },
    cacheAsideJson: jest.fn(async ({ fetcher }) => ({ value: await fetcher() }))
  };

  jest.doMock('../../services/coordinator/streamsService', () => services.StreamsService);
  jest.doMock('../../services/coordinator/profileService', () => services.ProfileService);
  jest.doMock('../../services/coordinator/notificationsService', () => services.NotificationsService);
  jest.doMock('../../services/coordinator/tournamentsService', () => services.TournamentsService);
  jest.doMock('../../services/coordinator/meetingsService', () => services.MeetingsService);
  jest.doMock('../../services/coordinator/complaintsService', () => services.ComplaintsService);
  jest.doMock('../../services/coordinator/calendarService', () => services.CalendarService);
  jest.doMock('../../services/coordinator/storeService', () => services.StoreService);
  jest.doMock('../../services/coordinator/blogsService', () => services.BlogsService);
  jest.doMock('../../services/coordinator/playerStatsService', () => services.PlayerStatsService);
  jest.doMock('../../services/coordinator/pairingsService', () => services.PairingsService);
  jest.doMock('../../services/coordinator/feedbackService', () => services.FeedbackService);
  jest.doMock('../../services/coordinator/announcementsService', () => services.AnnouncementsService);
  jest.doMock('../../services/coordinator/chessEventsService', () => services.ChessEventsService);
  jest.doMock('../../utils/cache', () => Cache);

  // eslint-disable-next-line global-require
  const coordinatorController = require('../../controllers/coordinatorController');
  return { coordinatorController, services, Cache };
}

describe('coordinatorController', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('getStreams rejects when not logged in', async () => {
    const { coordinatorController } = loadCoordinatorControllerWithMocks();
    const req = createReq({ session: {} });
    const res = createRes();

    await coordinatorController.getStreams(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Please log in' });
  });

  test('getChessEvents rejects when userId missing', async () => {
    const { coordinatorController } = loadCoordinatorControllerWithMocks();
    const req = createReq({ session: {} });
    const res = createRes();

    await coordinatorController.getChessEvents(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Please log in' });
  });

  test('sendError includes allowedNextStatuses when present', async () => {
    const { coordinatorController, services } = loadCoordinatorControllerWithMocks();
    services.StoreService.updateOrderStatus.mockRejectedValueOnce(
      Object.assign(new Error('Invalid transition'), { statusCode: 409, allowedNextStatuses: ['delivered'] })
    );
    const req = createReq({
      session: { userEmail: 'c@example.com', userRole: 'coordinator' },
      params: { orderId: 'o1' },
      body: { status: 'cancelled' }
    });
    const res = createRes();

    await coordinatorController.updateOrderStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid transition', allowedNextStatuses: ['delivered'] });
  });

  test('smoke: coordinator endpoints call services and return expected status', async () => {
    const { coordinatorController, services } = loadCoordinatorControllerWithMocks();
    const session = {
      userEmail: 'c@example.com',
      username: 'c',
      userID: 'u1',
      userCollege: 'ABC',
      userRole: 'coordinator'
    };

    const cases = [
      ['getStreams', 200, createReq({ session })],
      ['createStream', 201, createReq({ session, body: { title: 't' } })],
      ['updateStream', 200, createReq({ session, params: { id: 's1' }, body: { title: 't' } })],
      ['deleteStream', 200, createReq({ session, params: { id: 's1' } })],
      ['getName', 200, createReq({ session })],
      ['getDashboard', 200, createReq({ session })],
      ['getProfile', 200, createReq({ session })],
      ['updateProfile', 200, createReq({ session, body: { name: 'X' } })],
      ['getNotifications', 200, createReq({ session })],
      ['markNotificationsRead', 200, createReq({ session, body: { ids: ['n1'] } })],
      ['getTournaments', 200, createReq({ session })],
      ['getTournamentById', 200, createReq({ session, params: { id: 't1' } })],
      ['createTournament', 200, createReq({ session, body: { name: 'T' } })],
      ['updateTournament', 200, createReq({ session, params: { id: 't1' }, body: { name: 'T' } })],
      ['deleteTournament', 200, createReq({ session, params: { id: 't1' } })],
      ['scheduleMeeting', 200, createReq({ session, body: { date: '2025-01-01' } })],
      ['getOrganizedMeetings', 200, createReq({ session })],
      ['getUpcomingMeetings', 200, createReq({ session })],
      ['getReceivedMeetings', 200, createReq({ session })],
      ['getComplaints', 200, createReq({ session })],
      ['resolveComplaint', 200, createReq({ session, params: { complaintId: 'c1' }, body: { status: 'resolved' } })],
      ['respondComplaint', 200, createReq({ session, params: { complaintId: 'c1' }, body: { response: 'ok' } })],
      ['getCalendarEvents', 200, createReq({ session, query: { month: '2025-01' } })],
      ['createCalendarEvent', 201, createReq({ session, body: { title: 'event' } })],
      ['deleteCalendarEvent', 200, createReq({ session, params: { id: 'e1' } })],
      ['checkDateConflict', 200, createReq({ session, method: 'GET', query: { date: '2025-01-01' } })],
      ['getProducts', 200, createReq({ session })],
      ['addProduct', 200, createReq({ session, body: { name: 'p' } })],
      ['updateProduct', 200, createReq({ session, params: { productId: 'p1' }, body: { name: 'p' } })],
      ['deleteProduct', 200, createReq({ session, params: { productId: 'p1' } })],
      ['toggleComments', 200, createReq({ session, params: { productId: 'p1' }, body: { enabled: true } })],
      ['getOrders', 200, createReq({ session, query: { status: 'pending' } })],
      ['getOrderAnalytics', 200, createReq({ session })],
      ['getProductAnalyticsDetails', 200, createReq({ session, params: { productId: 'p1' } })],
      ['getProductReviews', 200, createReq({ session, query: { productId: 'p1' } })],
      ['getOrderComplaints', 200, createReq({ session })],
      ['resolveOrderComplaint', 200, createReq({ session, body: { complaintId: 'c1', response: 'ok' } })],
      ['getBlogs', 200, createReq({ session })],
      ['getBlogById', 200, createReq({ session, params: { id: 'b1' } })],
      ['getBlogReviews', 200, createReq({ session, params: { id: 'b1' } })],
      ['addBlogReview', 200, createReq({ session, params: { id: 'b1' }, body: { comment: 'hi' } })],
      ['createBlog', 200, createReq({ session, body: { title: 't' } })],
      ['updateBlog', 200, createReq({ session, params: { id: 'b1' }, body: { title: 't' } })],
      ['deleteBlog', 200, createReq({ session, params: { id: 'b1' } })],
      ['postAnnouncement', 200, createReq({ session, body: { title: 'a' }, appLocals: { io: { emit: jest.fn() } } })],
      ['getPlayerStats', 200, createReq({ session })],
      ['getPlayerStatsDetails', 200, createReq({ session, params: { id: 'p1' } })],
      ['getEnrolledPlayers', 200, createReq({ session, query: { tournamentId: 't1' } })],
      ['getPairings', 200, createReq({ session, query: { tournament_id: 't1' } })],
      ['getRankings', 200, createReq({ session, query: { tournament_id: 't1' } })],
      ['getTeamPairings', 200, createReq({ session, query: { tournament_id: 't1' } })],
      ['getTeamRankings', 200, createReq({ session, query: { tournament_id: 't1' } })],
      ['requestFeedback', 200, createReq({ session, params: { id: 't1' } })],
      ['getFeedbacks', 200, createReq({ session, query: { tournament_id: 't1' } })],
      ['getFeedbackView', 200, createReq({ session })],
      ['getChessEvents', 200, createReq({ session, user: { userId: 'u1' } })],
      ['createChessEvent', 201, createReq({ session, user: { userId: 'u1' }, body: { title: 'e' } })],
      ['updateChessEvent', 200, createReq({ session, user: { userId: 'u1' }, params: { id: 'e1' }, body: { title: 'e' } })],
      ['deleteChessEvent', 200, createReq({ session, user: { userId: 'u1' }, params: { id: 'e1' } })]
    ];

    for (const [fnName, expectedStatus, req] of cases) {
      const res = createRes();
      await coordinatorController[fnName](req, res);
      if (fnName === 'getFeedbackView') {
        // feedback view is a legacy HTML response; success path uses sendFile
        expect(res.sendFile).toHaveBeenCalled();
        const filePath = res.sendFile.mock.calls[0][0];
        const normalized = String(filePath).replace(/\\/g, '/');
        expect(normalized).toMatch(/\/views\/coordinator\/feedback_view\.html$/);
      } else {
        const actualStatus = res.status.mock.calls[0]?.[0];
        if (actualStatus !== expectedStatus) {
          throw new Error(`Unexpected status for ${fnName}: expected ${expectedStatus}, got ${actualStatus}`);
        }
        if (res.json.mock.calls.length > 0) {
          expect(res.json).toHaveBeenCalledWith({ ok: true });
        }
      }
    }

    // Spot-check a few service calls to ensure wiring is correct
    expect(services.StreamsService.getStreams).toHaveBeenCalledTimes(1);
    expect(services.ProfileService.getDashboard).toHaveBeenCalledTimes(1);
    expect(services.TournamentsService.getTournaments).toHaveBeenCalledTimes(1);
  });
});
