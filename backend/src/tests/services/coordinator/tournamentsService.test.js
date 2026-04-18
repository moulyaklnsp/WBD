const { ObjectId } = require('mongodb');

function loadCoordinatorTournamentsServiceWithMocks(overrides = {}) {
  jest.resetModules();

  const modelsByName = {
    users: {
      findOne: jest.fn(async () => null),
      ...overrides.users
    },
    tournaments: {
      findMany: jest.fn(async () => []),
      findOne: jest.fn(async () => null),
      insertOne: jest.fn(async () => ({ insertedId: new ObjectId() })),
      updateOne: jest.fn(async () => ({ matchedCount: 1, modifiedCount: 1 })),
      ...overrides.tournaments
    },
    tournament_players: {
      countDocuments: jest.fn(async () => 0),
      ...overrides.tournament_players
    },
    enrolledtournaments_team: {
      countDocuments: jest.fn(async () => 0),
      ...overrides.enrolledtournaments_team
    },
    feedbacks: {
      countDocuments: jest.fn(async () => 0),
      ...overrides.feedbacks
    },
    tournament_complaints: {
      countDocuments: jest.fn(async () => 0),
      ...overrides.tournament_complaints
    },
    tournament_files: {
      insertOne: jest.fn(async () => ({})),
      findMany: jest.fn(async () => []),
      findOne: jest.fn(async () => null),
      deleteOne: jest.fn(async () => ({})),
      ...overrides.tournament_files
    }
  };

  const StorageModel = {
    uploadImageBuffer: jest.fn(async () => ({ secure_url: 'https://file.local/f.png', public_id: 'pid1' })),
    destroyCloudinaryAsset: jest.fn(async () => null),
    ...overrides.storage
  };

  const Cache = {
    invalidateTags: jest.fn(async () => ({ deleted: 0 })),
    ...overrides.cache
  };

  const coordinatorUtils = {
    safeTrim: (v) => String(v == null ? '' : v).trim(),
    parseDateValue: (raw) => {
      if (!raw) return null;
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? null : d;
    },
    toStartOfDay: (d) => {
      if (!d) return null;
      const dd = new Date(d);
      dd.setHours(0, 0, 0, 0);
      return dd;
    },
    isAtLeastDaysFromToday: (date, days) => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const diffDays = (new Date(date).getTime() - start.getTime()) / (1000 * 3600 * 24);
      return diffDays >= days;
    },
    requireCoordinator: (user) => {
      if (!user?.email) throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
      if (user.role !== 'coordinator') throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
    },
    ...overrides.coordinatorUtils
  };

  jest.doMock('../../../models', () => ({
    getModel: (name) => {
      const model = modelsByName[name];
      if (!model) throw new Error(`Unexpected model: ${name}`);
      return model;
    }
  }));
  jest.doMock('../../../models/StorageModel', () => StorageModel);
  jest.doMock('../../../utils/cache', () => Cache);
  jest.doMock('../../../services/coordinator/coordinatorUtils', () => coordinatorUtils);

  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});

  // eslint-disable-next-line global-require
  const TournamentsService = require('../../../services/coordinator/tournamentsService');
  return { TournamentsService, modelsByName, Cache, StorageModel };
}

describe('coordinator/tournamentsService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('getTournamentById validates id and enforces ownership', async () => {
    const { TournamentsService } = loadCoordinatorTournamentsServiceWithMocks();
    await expect(TournamentsService.getTournamentById({}, { email: 'c@example.com', role: 'coordinator' }, { id: 'bad' }))
      .rejects
      .toMatchObject({ statusCode: 400 });
  });

  test('getTournamentById returns stats and total amount received', async () => {
    const tid = new ObjectId();
    const { TournamentsService } = loadCoordinatorTournamentsServiceWithMocks({
      users: { findOne: jest.fn(async () => ({ name: 'Coord', email: 'c@example.com', role: 'coordinator' })) },
      tournaments: { findOne: jest.fn(async () => ({ _id: tid, coordinator: 'coord', entry_fee: 10, type: 'Individual', status: 'Approved' })) },
      tournament_players: { countDocuments: jest.fn(async () => 3) },
      enrolledtournaments_team: { countDocuments: jest.fn(async () => 1) },
      feedbacks: { countDocuments: jest.fn(async () => 2) },
      tournament_complaints: { countDocuments: jest.fn(async () => 1) }
    });

    const result = await TournamentsService.getTournamentById({}, { email: 'c@example.com', role: 'coordinator', username: 'coord' }, { id: tid.toString() });
    expect(result.stats).toMatchObject({
      individualCount: 3,
      approvedTeamCount: 1,
      totalEnrollments: 3,
      feedbackCount: 2,
      complaintsCount: 1,
      totalAmountReceived: 30
    });
  });

  test('createTournament validates date format and minimum lead time', async () => {
    const { TournamentsService } = loadCoordinatorTournamentsServiceWithMocks({
      users: { findOne: jest.fn(async () => ({ name: 'Coord', email: 'c@example.com', role: 'coordinator' })) }
    });

    await expect(TournamentsService.createTournament({}, { email: 'c@example.com', role: 'coordinator', username: 'coord' }, {
      body: { tournamentName: 'T', tournamentDate: 'bad-date', time: '10', location: 'L', entryFee: 10, type: 'Individual', noOfRounds: 5 }
    })).rejects.toMatchObject({ statusCode: 400, message: 'Invalid date format.' });

    const today = new Date();
    const near = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    await expect(TournamentsService.createTournament({}, { email: 'c@example.com', role: 'coordinator', username: 'coord' }, {
      body: { tournamentName: 'T', tournamentDate: near, time: '10', location: 'L', entryFee: 10, type: 'Individual', noOfRounds: 5 }
    })).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('at least 3 days') });
  });

  test('updateTournament blocks completed tournaments and invalidates cache for approved tournaments', async () => {
    const id = new ObjectId();
    const { TournamentsService, Cache, modelsByName } = loadCoordinatorTournamentsServiceWithMocks({
      users: { findOne: jest.fn(async () => ({ name: 'Coord', email: 'c@example.com', role: 'coordinator' })) },
      tournaments: {
        findOne: jest.fn()
          .mockResolvedValueOnce({ _id: id, coordinator: 'coord', status: 'Completed', date: new Date('2025-01-01') })
          .mockResolvedValueOnce({ _id: id, coordinator: 'coord', status: 'Approved', date: new Date('2025-01-01') }),
        updateOne: jest.fn(async () => ({ matchedCount: 1, modifiedCount: 1 }))
      }
    });

    await expect(TournamentsService.updateTournament({}, { email: 'c@example.com', role: 'coordinator', username: 'coord' }, { id: id.toString(), body: { tournamentName: 'New' } }))
      .rejects
      .toMatchObject({ statusCode: 403, message: 'Completed tournaments are read-only.' });

    const result = await TournamentsService.updateTournament({}, { email: 'c@example.com', role: 'coordinator', username: 'coord' }, { id: id.toString(), body: { tournamentName: 'New' } });
    expect(result).toMatchObject({ success: true });
    expect(modelsByName.tournaments.updateOne).toHaveBeenCalledTimes(1);
    expect(Cache.invalidateTags).toHaveBeenCalledWith(['tournaments'], expect.any(Object));
  });

  test('deleteTournament invalidates cache when removing approved tournament', async () => {
    const id = new ObjectId();
    const { TournamentsService, Cache, modelsByName } = loadCoordinatorTournamentsServiceWithMocks({
      tournaments: {
        findOne: jest.fn(async () => ({ _id: id, coordinator: 'coord', status: 'Approved' })),
        updateOne: jest.fn(async () => ({ modifiedCount: 1 }))
      }
    });

    const result = await TournamentsService.deleteTournament({}, { email: 'c@example.com', role: 'coordinator', username: 'coord' }, { id: id.toString() });
    expect(result).toMatchObject({ success: true });
    expect(modelsByName.tournaments.updateOne).toHaveBeenCalledTimes(1);
    expect(Cache.invalidateTags).toHaveBeenCalledWith(['tournaments'], expect.any(Object));
  });
});

