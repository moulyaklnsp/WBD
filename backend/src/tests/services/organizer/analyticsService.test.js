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
    const db = {
      collection: (name) => {
        if (name !== 'pending_coordinators') throw new Error('unexpected collection');
        return {
          find: () => ({ toArray: async () => pending })
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
    const { AnalyticsService } = loadOrganizerAnalyticsServiceWithMocks({
      users: {
        findMany: jest.fn(async () => [
          { role: 'player', created_at: '2025-01-05' },
          { role: 'coordinator', created_at: '2025-02-01' }
        ])
      },
      sales: {
        findMany: jest.fn(async () => [
          { price: 100, purchase_date: '2025-01-10' },
          { price: 50, purchase_date: '2025-02-10' }
        ])
      },
      tournaments: {
        findMany: jest.fn(async () => [
          { status: 'Approved', submitted_date: '2025-01-01' },
          { status: 'Approved', submitted_date: '2025-02-01' }
        ])
      },
      meetingsdb: {
        findMany: jest.fn(async () => [{ created_at: '2025-01-15' }])
      },
      enrolledtournaments_team: {
        findMany: jest.fn(async () => [{ enrollment_date: '2025-02-05' }])
      },
      tournament_players: {
        findMany: jest.fn(async () => [{ enrollment_date: '2025-02-06' }])
      }
    });

    const result = await AnalyticsService.getGrowthAnalysis({});
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

