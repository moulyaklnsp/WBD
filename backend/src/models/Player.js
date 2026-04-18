class Player {
  constructor(id, username, college, gender) {
    this.id = id;
    this.username = username;
    this.college = college;
    this.gender = gender;
    this.score = 0;
    this.opponents = new Set();
  }
}

module.exports = Player;
