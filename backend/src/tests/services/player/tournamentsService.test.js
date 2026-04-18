const { ObjectId } = require('mongodb');

function loadTournamentsServiceWithMocks(overrides = {}) {
  jest.resetModules();

  const modelsByName = {
    users: {
      findOne: jest.fn(async () => null),
      ...overrides.users
    },
    user_balances: {
      findOne: jest.fn(async () => ({ wallet_balance: 0 })),
      updateOne: jest.fn(async () => ({})),
      ...overrides.user_balances
    },
    tournaments: {
      findOne: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
      ...overrides.tournaments
    },
    tournament_players: {
      aggregate: jest.fn(async () => []),
      findOne: jest.fn(async () => null),
      insertOne: jest.fn(async () => ({})),
      ...overrides.tournament_players
    },
    enrolledtournaments_team: {
      aggregate: jest.fn(async () => []),
      findOne: jest.fn(async () => null),
      updateOne: jest.fn(async () => ({})),
      ...overrides.enrolledtournaments_team
    },
    subscriptionstable: {
      findOne: jest.fn(async () => null),
      ...overrides.subscriptionstable
    },
    feedbacks: {
      findOne: jest.fn(async () => null),
      insertOne: jest.fn(async () => ({})),
      ...overrides.feedbacks
    },
    tournament_pairings: {
      findMany: jest.fn(async () => []),
      ...overrides.tournament_pairings
    }
  };

  jest.doMock('../../../models', () => ({
    getModel: (name) => {
      const model = modelsByName[name];
      if (!model) throw new Error(`Unexpected model: ${name}`);
      return model;
    }
  }));

  const Cache = {
    keys: { tournamentsApproved: jest.fn(() => 'tournaments:approved') },
    config: { ttl: { longSeconds: 300, defaultSeconds: 120 } },
    cacheAsideJson: jest.fn(async ({ fetcher }) => ({ value: await fetcher() })),
    ...overrides.cache
  };
  jest.doMock('../../../utils/cache', () => Cache);

  const playerUtils = {
    requirePlayer: jest.fn((user) => {
      if (!user?.email) throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
      if (user.role !== 'player') throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
    }),
    insertWalletTransaction: jest.fn(async () => ({})),
    ...overrides.playerUtils
  };
  jest.doMock('../../../services/player/playerUtils', () => playerUtils);

  // eslint-disable-next-line global-require
  const TournamentsService = require('../../../services/player/tournamentsService');

  return { TournamentsService, modelsByName, Cache, playerUtils };
}

describe('player/tournamentsService', () => {
  test('getTournaments throws 404 when player not found', async () => {
    const { TournamentsService } = loadTournamentsServiceWithMocks({
      users: { findOne: jest.fn(async () => null) }
    });
    const db = {};
    const user = { email: 'p@example.com', role: 'player', _id: new ObjectId() };

    await expect(TournamentsService.getTournaments(db, user))
      .rejects
      .toMatchObject({ statusCode: 404, message: 'Player not found' });
  });

  test('getTournaments returns approved tournaments and derived username + wallet balance', async () => {
    const tid = new ObjectId();
    const { TournamentsService, Cache, modelsByName } = loadTournamentsServiceWithMocks({
      users: {
        findOne: jest.fn(async () => ({ _id: new ObjectId(), name: 'Player One' }))
      },
      user_balances: {
        findOne: jest.fn(async () => ({ wallet_balance: 42 }))
      },
      tournaments: {
        findMany: jest.fn(async () => [{ _id: tid, name: 'T1', status: 'Approved' }])
      },
      subscriptionstable: {
        findOne: jest.fn(async () => ({ plan: 'Basic' }))
      }
    });
    const db = {};
    const user = { email: 'p@example.com', role: 'player', _id: new ObjectId() };

    const result = await TournamentsService.getTournaments(db, user);
    expect(Cache.cacheAsideJson).toHaveBeenCalledWith(expect.objectContaining({ key: 'tournaments:approved' }));
    expect(modelsByName.tournaments.findMany).toHaveBeenCalled();

    expect(result).toMatchObject({
      username: 'Player One',
      walletBalance: 42,
      currentSubscription: { plan: 'Basic' }
    });
    expect(result.tournaments[0]).toMatchObject({ _id: tid.toString(), name: 'T1' });
  });

  test('joinIndividual validates tournamentId', async () => {
    const { TournamentsService } = loadTournamentsServiceWithMocks();
    const db = {};
    const user = { email: 'p@example.com', role: 'player', _id: new ObjectId() };

    await expect(TournamentsService.joinIndividual(db, user, null))
      .rejects
      .toMatchObject({ statusCode: 400, message: 'Tournament ID is required' });

    await expect(TournamentsService.joinIndividual(db, user, 'not-an-id'))
      .rejects
      .toMatchObject({ statusCode: 400, message: 'Invalid tournament ID' });
  });

  test('getTournamentCalendar builds match list from pairings', async () => {
    const t1 = new ObjectId();
    const t2 = new ObjectId();

    const { TournamentsService } = loadTournamentsServiceWithMocks({
      tournaments: {
        findMany: jest.fn(async () => [
          { _id: t1, name: 'T1', date: '2025-01-01', location: 'L1', entry_fee: 0, rounds: 2 },
          { _id: t2, name: 'T2', date: '2025-01-02', location: 'L2', entry_fee: 10, rounds: 1 }
        ])
      },
      tournament_pairings: {
        findMany: jest.fn(async () => [
          {
            tournament_id: t1,
            rounds: [
              {
                round: 1,
                pairings: [
                  { player1: { username: 'A' }, player2: { username: 'B' }, result: '1-0' }
                ]
              }
            ]
          }
        ])
      }
    });
    const db = {};
    const user = { email: 'p@example.com', role: 'player', _id: new ObjectId() };

    const result = await TournamentsService.getTournamentCalendar(db, user);
    expect(result.calendar).toHaveLength(2);
    const t1Cal = result.calendar.find((t) => t._id === t1.toString());
    expect(t1Cal.matches).toHaveLength(1);
    expect(t1Cal.matches[0]).toMatchObject({ round: 1, player1: 'A', player2: 'B' });
    const t2Cal = result.calendar.find((t) => t._id === t2.toString());
    expect(t2Cal.matches).toEqual([]);
  });
});

