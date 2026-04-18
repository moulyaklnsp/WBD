const { ObjectId } = require('mongodb');

function loadGrowthServiceWithMocks(overrides = {}) {
  jest.resetModules();

  const modelsByName = {
    player_stats: {
      aggregate: jest.fn(async () => []),
      findOne: jest.fn(async () => null),
      insertOne: jest.fn(async () => ({})),
      updateOne: jest.fn(async () => ({})),
      ...overrides.player_stats
    },
    rating_history: {
      findOne: jest.fn(async () => null),
      updateOne: jest.fn(async () => ({})),
      ...overrides.rating_history
    },
    users: {
      findOne: jest.fn(async () => null),
      ...overrides.users
    },
    tournament_pairings: {
      aggregate: jest.fn(async () => []),
      ...overrides.tournament_pairings
    },
    tournament_team_pairings: {
      aggregate: jest.fn(async () => []),
      ...overrides.tournament_team_pairings
    },
    tournaments: {
      findOne: jest.fn(async () => null),
      ...overrides.tournaments
    }
  };

  jest.doMock('../../../models', () => ({
    getModel: (name) => {
      const model = modelsByName[name];
      if (!model) throw new Error(`Unexpected model: ${name}`);
      return model;
    }
  }));

  const playerUtils = {
    requirePlayer: jest.fn((user) => {
      if (!user?.email) throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
      if (user.role !== 'player') throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
    }),
    ...overrides.playerUtils
  };
  jest.doMock('../../../services/player/playerUtils', () => playerUtils);

  jest.spyOn(console, 'error').mockImplementation(() => {});

  // eslint-disable-next-line global-require
  const GrowthService = require('../../../services/player/growthService');

  return { GrowthService, modelsByName, playerUtils };
}

describe('player/growthService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('getGrowth returns default history when none stored', async () => {
    const playerId = new ObjectId();
    const { GrowthService } = loadGrowthServiceWithMocks({
      player_stats: {
        aggregate: jest.fn(async () => [{
          name: 'Alice',
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          rating: null,
          player_id: playerId
        }])
      },
      rating_history: {
        findOne: jest.fn(async () => null)
      }
    });

    const result = await GrowthService.getGrowth({}, { email: 'a@example.com', role: 'player' });
    expect(result.player).toMatchObject({ name: 'Alice', winRate: 0 });
    expect(result.ratingHistory).toHaveLength(6);
    expect(result.chartLabels).toHaveLength(6);
  });

  test('comparePlayer rejects empty search', async () => {
    const { GrowthService } = loadGrowthServiceWithMocks();
    await expect(GrowthService.comparePlayer({}, { email: 'a@example.com', role: 'player' }, ''))
      .rejects
      .toMatchObject({ statusCode: 400 });
  });

  test('getGrowthAnalytics returns sample data when no games exist', async () => {
    const playerUserId = new ObjectId();
    const { GrowthService, modelsByName } = loadGrowthServiceWithMocks({
      users: {
        findOne: jest.fn(async () => ({ _id: playerUserId, name: 'Alice', email: 'a@example.com', role: 'player', isDeleted: 0 }))
      },
      player_stats: {
        findOne: jest.fn(async () => null),
        insertOne: jest.fn(async () => ({}))
      }
    });

    const result = await GrowthService.getGrowthAnalytics({}, { email: 'a@example.com', role: 'player' });
    expect(modelsByName.player_stats.insertOne).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ isSampleData: true });
    expect(result.ratingHistory.length).toBeGreaterThan(1);
    expect(result.gameHistory.length).toBeGreaterThan(0);
  });

  test('getGrowthAnalytics uses real games when pairings exist', async () => {
    const playerUserId = new ObjectId();

    const { GrowthService, modelsByName } = loadGrowthServiceWithMocks({
      users: {
        findOne: jest.fn(async () => ({ _id: playerUserId, name: 'Alice', email: 'a@example.com', role: 'player', isDeleted: 0 }))
      },
      player_stats: {
        findOne: jest.fn(async () => ({ player_id: playerUserId, rating: 500 })),
        updateOne: jest.fn(async () => ({ modifiedCount: 1 }))
      },
      tournament_pairings: {
        aggregate: jest.fn(async () => [{
          tournamentName: 'T1',
          tournamentDate: '2025-01-01',
          rounds: [
            {
              round: 1,
              pairings: [
                {
                  player1: { username: 'Alice', score: 1 },
                  player2: { username: 'Bob', score: 2 },
                  resultCode: '1-0'
                }
              ]
            }
          ]
        }])
      },
      tournament_team_pairings: { aggregate: jest.fn(async () => []) },
      rating_history: { updateOne: jest.fn(async () => ({})) }
    });

    const result = await GrowthService.getGrowthAnalytics({}, { email: 'a@example.com', role: 'player' });
    expect(result.isSampleData).toBeUndefined();
    expect(result).toMatchObject({ gamesPlayed: 1, wins: 1, losses: 0, draws: 0 });
    expect(modelsByName.player_stats.updateOne).toHaveBeenCalledTimes(1);
    expect(modelsByName.rating_history.updateOne).toHaveBeenCalledTimes(1);
  });
});

