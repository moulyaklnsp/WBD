const { buildCollectionModel } = require('./collectionBase');
const UserModel = require('./UserModel');
const TournamentModel = require('./TournamentModel');
const TokenModel = require('./TokenModel');

const cache = new Map();

// Collection-specific models can be registered here.
// Example: users -> UserModel (adds helpers like verifyPassword)
const overrides = {
  users: UserModel,
  tournaments: TournamentModel,
  refresh_tokens: TokenModel
};

const getModel = (collectionName) => {
  if (!collectionName || typeof collectionName !== 'string') {
    throw new Error('collectionName is required');
  }
  const key = collectionName.trim();
  if (!key) {
    throw new Error('collectionName is required');
  }

  if (overrides[key]) return overrides[key];

  if (!cache.has(key)) {
    cache.set(key, buildCollectionModel(key));
  }
  return cache.get(key);
};

module.exports = {
  getModel,
  buildCollectionModel,
  UserModel,
  TournamentModel,
  TokenModel
};
