const { ObjectId } = require('mongodb');
const { getModel } = require('../../models');
const WalletTransactionsModel = getModel('wallet_transactions');

const createAuthError = (message, statusCode) => Object.assign(new Error(message), { statusCode });

const requireUserRole = (user, role) => {
  if (!user?.email) throw createAuthError('Unauthorized', 401);
  if (role) {
    if (!user?.role) throw createAuthError('Forbidden', 403);
    if (user.role !== role) throw createAuthError('Forbidden', 403);
  }
};

const requirePlayer = (user) => requireUserRole(user, 'player');

async function insertWalletTransaction(db, userId, userEmail, type, amount, description) {
  try {
    await WalletTransactionsModel.insertOne(db, {
      user_id: new ObjectId(userId),
      user_email: userEmail,
      type,
      amount: parseFloat(amount),
      description,
      date: new Date()
    });
  } catch (err) {
    console.error('Error logging wallet transaction:', err);
    // Don't fail the main operation if transaction logging fails
  }
}

function normalizeProductImages(product = {}) {
  const fromArray = Array.isArray(product.image_urls)
    ? product.image_urls
    : (typeof product.image_urls === 'string'
        ? product.image_urls.split(',').map((s) => s.trim())
        : []);

  const urls = Array.from(new Set([
    ...fromArray,
    product.image_url,
    product.imageUrl,
    product.image
  ].filter(Boolean)));

  return urls;
}

module.exports = {
  requireUserRole,
  requirePlayer,
  insertWalletTransaction,
  normalizeProductImages
};
