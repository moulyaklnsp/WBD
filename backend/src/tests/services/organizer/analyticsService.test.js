function loadOrganizerAnalyticsServiceWithMocks(overrides = {}) {
  jest.resetModules();

  const modelsByName = {
    users: {
      findOne: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
      ...overrides.users
    },
    tournaments: {
      findMany: jest.fn(async () => []),
      ...overrides.tournaments
    },
    products: {
      findMany: jest.fn(async () => []),
      ...overrides.products
    },
    sales: {
      aggregate: jest.fn(async () => []),
      findMany: jest.fn(async () => []),
      ...overrides.sales
    },
    meetingsdb: {
      findMany: jest.fn(async () => []),
      ...overrides.meetingsdb
    },
    tournament_players: {
      countDocuments: jest.fn(async () => 0),
      findMany: jest.fn(async () => []),
      ...overrides.tournament_players
    },
    enrolledtournaments_team: {
      countDocuments: jest.fn(async () => 0),
      findMany: jest.fn(async () => []),
      ...overrides.enrolledtournaments_team
    }
  };

  const organizerUtils = {
    requireOrganizer: (user) => {
      if (!user?.email) throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
      if (user.role !== 'organizer') throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
    },
    ...overrides.organizerUtils
  };

  jest.doMock('../../../models', () => ({
    getModel: (name) => {
      const model = modelsByName[name];
      if (!model) throw new Error(`Unexpected model: ${name}`);
      return model;
    }
  }));
  jest.doMock('../../../services/organizer/organizerUtils', () => organizerUtils);

  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});

  // eslint-disable-next-line global-require
  const AnalyticsService = require('../../../services/organizer/analyticsService');
  return { AnalyticsService, modelsByName };
}

describe('organizer/analyticsService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('getDashboard returns organizer name and pending coordinator requests', async () => {
    const pending = [{ email: 'c@example.com' }];
    const cursor = {
      project: jest.fn(() => cursor),
      sort: jest.fn(() => cursor),
      limit: jest.fn(() => cursor),
      toArray: jest.fn(async () => pending)
    };
    const db = {
      collection: (name) => {
        if (name !== 'pending_coordinators') throw new Error('unexpected collection');
        return {
          find: () => cursor
        };
      }
    };

    const { AnalyticsService } = loadOrganizerAnalyticsServiceWithMocks({
      users: { findOne: jest.fn(async () => ({ name: 'Org' })) },
      meetingsdb: { findMany: jest.fn(async () => []) },
      tournaments: { findMany: jest.fn(async () => []) }
    });

    const result = await AnalyticsService.getDashboard(db, { email: 'o@example.com', role: 'organizer' });
    expect(result).toMatchObject({ organizerName: 'Org', pendingCoordinators: pending });
  });

  test('getGrowthAnalysis builds month series and summary', async () => {
    const { AnalyticsService } = loadOrganizerAnalyticsServiceWithMocks();

    const usersByMonth = [
      { _id: '2025-01', count: 1, players: 1, coordinators: 0, organizers: 0 },
      { _id: '2025-02', count: 1, players: 0, coordinators: 1, organizers: 0 }
    ];
    const userTotals = [
      { _id: 'player', count: 1 },
      { _id: 'coordinator', count: 1 }
    ];
    const salesByMonth = [
      { _id: '2025-01', revenue: 100, transactions: 1 },
      { _id: '2025-02', revenue: 50, transactions: 1 }
    ];
    const tournamentsByMonth = [
      { _id: '2025-01', count: 1 },
      { _id: '2025-02', count: 1 }
    ];
    const meetingsByMonth = [{ _id: '2025-01', count: 1 }];
    const teamEnrollmentsByMonth = [{ _id: '2025-02', count: 1 }];
    const individualEnrollmentsByMonth = [{ _id: '2025-02', count: 1 }];

    const usersToArray = jest.fn()
      .mockResolvedValueOnce(usersByMonth)
      .mockResolvedValueOnce(userTotals);

    const makeCollection = (toArrayFn) => ({
      aggregate: () => ({ toArray: toArrayFn })
    });

    const db = {
      collection: (name) => {
        if (name === 'users') return makeCollection(usersToArray);
        if (name === 'sales') return makeCollection(jest.fn(async () => salesByMonth));
        if (name === 'tournaments') return makeCollection(jest.fn(async () => tournamentsByMonth));
        if (name === 'meetingsdb') return makeCollection(jest.fn(async () => meetingsByMonth));
        if (name === 'enrolledtournaments_team') return makeCollection(jest.fn(async () => teamEnrollmentsByMonth));
        if (name === 'tournament_players') return makeCollection(jest.fn(async () => individualEnrollmentsByMonth));
        throw new Error(`Unexpected collection: ${name}`);
      }
    };

    const result = await AnalyticsService.getGrowthAnalysis(db);
    expect(result.summary).toMatchObject({
      totalUsers: 2,
      totalPlayers: 1,
      totalCoordinators: 1,
      totalOrganizers: 0,
      totalTournaments: 2,
      totalRevenue: 150
    });
    expect(result.userGrowth).toHaveLength(2);
    expect(result.revenueGrowth).toHaveLength(2);
    expect(result.platformBreakdown).toHaveLength(2);
  });
});

