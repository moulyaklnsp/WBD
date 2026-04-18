class Team {
  constructor(id, teamName, captainName, player1, player2, player3) {
    this.id = id;
    this.teamName = teamName;
    this.captainName = captainName;
    this.player1 = player1;
    this.player2 = player2;
    this.player3 = player3;
    this.score = 0;
    this.opponents = new Set();
  }
}

module.exports = Team;
