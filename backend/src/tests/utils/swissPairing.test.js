const { swissPairing, swissTeamPairing } = require('../../utils/swissPairing');

function makePlayer(id, username, score = 0) {
  return { id, username, score, opponents: new Set() };
}

function makeTeam(id, teamName, score = 0) {
  return { id, teamName, score, opponents: new Set() };
}

describe('swissPairing utils', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('swissPairing: assigns bye on odd count and creates pairings', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.1); // player1 wins path
    const players = [
      makePlayer('p1', 'A', 0),
      makePlayer('p2', 'B', 0),
      makePlayer('p3', 'C', 0)
    ];

    const rounds = swissPairing(players, 1);
    expect(rounds).toHaveLength(1);
    expect(rounds[0].byePlayer).toBeTruthy();
    expect(rounds[0].pairings).toHaveLength(1);

    const bye = rounds[0].byePlayer;
    expect(bye.username).toBeDefined();
    expect(bye.score).toBe(1);

    const { player1, player2, resultCode } = rounds[0].pairings[0];
    expect(player1).toBeTruthy();
    expect(player2).toBeTruthy();
    expect(['1-0', '0-1', '0.5-0.5']).toContain(resultCode);
    expect(player1.opponents.has(player2.id)).toBe(true);
    expect(player2.opponents.has(player1.id)).toBe(true);
  });

  test('swissPairing: supports win/loss/draw branches across rounds', () => {
    jest.spyOn(Math, 'random')
      .mockReturnValueOnce(0.2)  // match1: player1 wins
      .mockReturnValueOnce(0.6)  // match2: player2 wins
      .mockReturnValueOnce(0.9)  // match3: draw
      .mockReturnValueOnce(0.2); // match4: player1 wins

    const players = [
      makePlayer('p1', 'A', 0),
      makePlayer('p2', 'B', 0),
      makePlayer('p3', 'C', 0),
      makePlayer('p4', 'D', 0)
    ];

    const rounds = swissPairing(players, 2);
    expect(rounds).toHaveLength(2);
    expect(rounds[0].pairings).toHaveLength(2);
    expect(rounds[1].pairings).toHaveLength(2);

    const resultCodes = rounds.flatMap(r => r.pairings.map(p => p.resultCode));
    expect(resultCodes).toEqual(expect.arrayContaining(['1-0', '0-1', '0.5-0.5']));
  });

  test('swissTeamPairing: assigns bye on odd count and creates team pairings', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.8); // draw path
    const teams = [
      makeTeam('t1', 'Tigers', 0),
      makeTeam('t2', 'Lions', 0),
      makeTeam('t3', 'Bears', 0)
    ];

    const rounds = swissTeamPairing(teams, 1);
    expect(rounds).toHaveLength(1);
    expect(rounds[0].byeTeam).toBeTruthy();
    expect(rounds[0].pairings).toHaveLength(1);
    expect(rounds[0].byeTeam.score).toBe(1);

    const { team1, team2, resultCode } = rounds[0].pairings[0];
    expect(team1.opponents.has(team2.id)).toBe(true);
    expect(team2.opponents.has(team1.id)).toBe(true);
    expect(['1-0', '0-1', '0.5-0.5']).toContain(resultCode);
  });
});

