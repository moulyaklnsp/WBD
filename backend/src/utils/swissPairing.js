const Player = require('../models/Player');
const Team = require('../models/Team');

function swissPairing(players, totalRounds) {
  let allRounds = [];
  for (let round = 1; round <= totalRounds; round++) {
    console.log(`Round ${round}: Starting with ${players.length} players`);
    players.sort((a, b) => b.score - a.score);
    let pairings = [];
    let byePlayer = null;
    let paired = new Set();
    if (players.length % 2 !== 0) {
      byePlayer = players.pop();
      byePlayer.score += 1;
      console.log(`Round ${round}: Bye player is ${byePlayer.username}`);
    }
    console.log(`Round ${round}: Players to pair: ${players.map(p => p.username).join(", ")}`);
    for (let i = 0; i < players.length; i++) {
      if (paired.has(players[i].id)) continue;
      let player1 = players[i];
      let player2 = null;
      for (let j = i + 1; j < players.length; j++) {
        if (!paired.has(players[j].id) && !player1.opponents.has(players[j].id)) {
          player2 = players[j];
          break;
        }
      }
      if (!player2) {
        for (let j = i + 1; j < players.length; j++) {
          if (!paired.has(players[j].id)) {
            player2 = players[j];
            break;
          }
        }
      }
      if (player2) {
        paired.add(player1.id);
        paired.add(player2.id);
        player1.opponents.add(player2.id);
        player2.opponents.add(player1.id);
        let result = Math.random();
        let matchResult, resultCode;
        if (result < 0.4) {
          player1.score += 1;
          matchResult = `${player1.username} Wins`;
          resultCode = '1-0';
        } else if (result < 0.75) {
          player2.score += 1;
          matchResult = `${player2.username} Wins`;
          resultCode = '0-1';
        } else {
          player1.score += 0.5;
          player2.score += 0.5;
          matchResult = "Draw";
          resultCode = '0.5-0.5';
        }
        pairings.push({ player1, player2, result: matchResult, resultCode });
        console.log(`Round ${round}: Paired ${player1.username} vs ${player2.username} - ${matchResult}`);
      } else {
        console.log(`Round ${round}: Could not find a match for ${player1.username}`);
      }
    }
    if (byePlayer) players.push(byePlayer);
    allRounds.push({ round, pairings, byePlayer });
    console.log(`Round ${round}: Pairings created: ${pairings.length}`);
  }
  return allRounds;
}

function swissTeamPairing(teams, totalRounds) {
  let allRounds = [];
  for (let round = 1; round <= totalRounds; round++) {
    console.log(`Team Round ${round}: Starting with ${teams.length} teams`);
    teams.sort((a, b) => b.score - a.score);
    let pairings = [];
    let byeTeam = null;
    let paired = new Set();
    if (teams.length % 2 !== 0) {
      byeTeam = teams.pop();
      byeTeam.score += 1;
      console.log(`Team Round ${round}: Bye team is ${byeTeam.teamName}`);
    }
    console.log(`Team Round ${round}: Teams to pair: ${teams.map(t => t.teamName).join(", ")}`);
    for (let i = 0; i < teams.length; i++) {
      if (paired.has(teams[i].id)) continue;
      let team1 = teams[i];
      let team2 = null;
      for (let j = i + 1; j < teams.length; j++) {
        if (!paired.has(teams[j].id) && !team1.opponents.has(teams[j].id)) {
          team2 = teams[j];
          break;
        }
      }
      if (!team2) {
        for (let j = i + 1; j < teams.length; j++) {
          if (!paired.has(teams[j].id)) {
            team2 = teams[j];
            break;
          }
        }
      }
      if (team2) {
        paired.add(team1.id);
        paired.add(team2.id);
        team1.opponents.add(team2.id);
        team2.opponents.add(team1.id);
        let result = Math.random();
        let matchResult, resultCode;
        if (result < 0.4) {
          team1.score += 1;
          matchResult = `${team1.teamName} Wins`;
          resultCode = '1-0';
        } else if (result < 0.75) {
          team2.score += 1;
          matchResult = `${team2.teamName} Wins`;
          resultCode = '0-1';
        } else {
          team1.score += 0.5;
          team2.score += 0.5;
          matchResult = "Draw";
          resultCode = '0.5-0.5';
        }
        pairings.push({ team1, team2, result: matchResult, resultCode });
        console.log(`Team Round ${round}: Paired ${team1.teamName} vs ${team2.teamName} - ${matchResult}`);
      } else {
        console.log(`Team Round ${round}: Could not find a match for ${team1.teamName}`);
      }
    }
    if (byeTeam) teams.push(byeTeam);
    allRounds.push({ round, pairings, byeTeam });
    console.log(`Team Round ${round}: Pairings created: ${pairings.length}`);
  }
  return allRounds;
}

module.exports = { swissPairing, swissTeamPairing };
