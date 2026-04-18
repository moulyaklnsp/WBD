function createRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

function createReq({ session, body, params, query, headers } = {}) {
  return {
    session,
    body: body || {},
    params: params || {},
    query: query || {},
    headers: headers || {}
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

function loadOrganizerControllerWithMocks({ serviceDefault = { ok: true } } = {}) {
  jest.resetModules();

  const services = {
    UsersService: createServiceProxy(serviceDefault),
    TournamentsService: createServiceProxy(serviceDefault),
    MeetingsService: createServiceProxy(serviceDefault),
    SalesService: createServiceProxy(serviceDefault),
    AnalyticsService: createServiceProxy(serviceDefault)
  };

  jest.doMock('../../services/organizer/usersService', () => services.UsersService);
  jest.doMock('../../services/organizer/tournamentsService', () => services.TournamentsService);
  jest.doMock('../../services/organizer/meetingsService', () => services.MeetingsService);
  jest.doMock('../../services/organizer/salesService', () => services.SalesService);
  jest.doMock('../../services/organizer/analyticsService', () => services.AnalyticsService);

  // eslint-disable-next-line global-require
  const organizerController = require('../../controllers/organizerController');
  return { organizerController, services };
}

describe('organizerController', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('getDashboard rejects when not logged in', async () => {
    const { organizerController } = loadOrganizerControllerWithMocks();
    const req = createReq({ session: {} });
    const res = createRes();

    await organizerController.getDashboard(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Please log in' });
  });

  test('getPendingCoordinators rejects when role is not organizer', async () => {
    const { organizerController } = loadOrganizerControllerWithMocks();
    const req = createReq({ session: { userEmail: 'o@example.com', userRole: 'player' } });
    const res = createRes();

    await organizerController.getPendingCoordinators(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });

  test('removeOrganizer rejects when role not organizer', async () => {
    const { organizerController } = loadOrganizerControllerWithMocks();
    const req = createReq({ session: { userEmail: 'x@example.com', userRole: 'player' }, params: { email: 'a%40b.com' } });
    const res = createRes();

    await organizerController.removeOrganizer(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('smoke: organizer endpoints call services and return expected status', async () => {
    const { organizerController, services } = loadOrganizerControllerWithMocks();
    const session = {
      userEmail: 'o@example.com',
      username: 'org',
      userID: 'u1',
      userCollege: 'ABC',
      userRole: 'organizer'
    };

    const cases = [
      ['getDashboard', services.AnalyticsService, 'getDashboard', 200, createReq({ session })],
      ['getProfile', services.UsersService, 'getOrganizerProfile', 200, createReq({ session })],
      ['updateProfile', services.UsersService, 'updateOrganizerProfile', 200, createReq({ session, body: { name: 'X' } })],
      ['getCoordinators', services.UsersService, 'listCoordinators', 200, createReq({ session })],
      ['getPendingCoordinators', services.UsersService, 'listPendingCoordinators', 200, createReq({ session })],
      ['approveCoordinator', services.UsersService, 'approvePendingCoordinator', 200, createReq({ session, body: { email: 'c@example.com', approved: true } })],
      ['removeCoordinator', services.UsersService, 'softDeleteCoordinator', 200, createReq({ session, params: { email: 'c%40example.com' } })],
      ['restoreCoordinator', services.UsersService, 'restoreCoordinator', 200, createReq({ session, params: { email: 'c%40example.com' } })],
      ['getTournaments', services.TournamentsService, 'listTournaments', 200, createReq({ session })],
      ['approveTournament', services.TournamentsService, 'approveTournament', 200, createReq({ session, body: { tournamentId: 't1' } })],
      ['rejectTournament', services.TournamentsService, 'rejectTournament', 200, createReq({ session, body: { tournamentId: 't1' } })],
      ['getStore', services.AnalyticsService, 'getStoreSummary', 200, createReq({ session })],
      ['scheduleMeeting', services.MeetingsService, 'scheduleMeeting', 200, createReq({ session, body: { title: 't', date: 'd', time: 't', link: 'l' } })],
      ['getOrganizedMeetings', services.MeetingsService, 'getOrganizedMeetings', 200, createReq({ session })],
      ['getUpcomingMeetings', services.MeetingsService, 'getUpcomingMeetings', 200, createReq({ session })],
      ['getMonthlySales', services.SalesService, 'getMonthlySales', 200, createReq({ session, query: { month: '2025-01' } })],
      ['getYearlySales', services.SalesService, 'getYearlySales', 200, createReq({ session })],
      ['getTournamentRevenue', services.AnalyticsService, 'getTournamentRevenue', 200, createReq({ session })],
      ['getStoreRevenue', services.SalesService, 'getStoreRevenue', 200, createReq({ session })],
      ['getRevenueInsights', services.SalesService, 'getRevenueInsights', 200, createReq({ session })],
      ['getCoordinatorPerformance', services.AnalyticsService, 'getCoordinatorPerformance', 200, createReq({ session })],
      ['getGrowthAnalysis', services.AnalyticsService, 'getGrowthAnalysis', 200, createReq({ session })]
    ];

    for (const [fnName, service, method, expectedStatus, req] of cases) {
      const res = createRes();
      await organizerController[fnName](req, res);
      expect(res.status).toHaveBeenCalledWith(expectedStatus);
      expect(res.json).toHaveBeenCalledWith({ ok: true });
      expect(service.__calls.get(method)).toHaveBeenCalledTimes(1);
    }
  });
});
