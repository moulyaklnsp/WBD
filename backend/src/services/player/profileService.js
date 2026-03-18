const { connectDB } = require('../../config/database');
const { requirePlayer } = require('./playerUtils');
const { ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const StorageModel = require('../../models/StorageModel');
const { getModel } = require('../../models');
const UserModel = getModel('users');
const PlayerStatsModel = getModel('player_stats');
const SubscriptionsModel = getModel('subscriptionstable');
const UserBalancesModel = getModel('user_balances');
const SalesModel = getModel('sales');
const PlayerSettingsModel = getModel('player_settings');

const createError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const resolveDb = async (db) => (db ? db : connectDB());

const BCRYPT_ROUNDS = 12;
const isBcryptHash = (value) => typeof value === 'string' && /^\$2[aby]\$/.test(value);

const normalizeEmail = (value) => (value == null ? '' : String(value).trim().toLowerCase());
const isSelfDeletedUser = (user) => {
  const email = normalizeEmail(user?.email);
  const deletedBy = normalizeEmail(user?.deleted_by);
  return Boolean(email && deletedBy && email === deletedBy);
};

const verifyPasswordAndMaybeMigrate = async (db, user, plainPassword) => {
  const stored = user?.password;
  if (!stored || typeof stored !== 'string') return false;
  if (typeof plainPassword !== 'string' || plainPassword.length === 0) return false;
  if (isBcryptHash(stored)) {
    return bcrypt.compare(plainPassword, stored);
  }
  if (stored === plainPassword) {
    const hashed = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
    await UserModel.updateOne(db, { _id: user._id }, { $set: { password: hashed } });
    return true;
  }
  return false;
};

const ProfileService = {
  async getProfile(db, { userEmail }) {
    if (!userEmail) throw createError('Please log in', 401);

    const database = await resolveDb(db);
    const row = await UserModel.findOne(database, { email: userEmail, role: 'player' });
    if (!row) throw createError('Player not found', 404);

    const playerId = row._id;
    let playerStats = await PlayerStatsModel.findOne(database, { player_id: playerId });

    if (!playerStats) {
      const gamesPlayed = Math.floor(Math.random() * 11) + 20;
      let wins = Math.floor(Math.random() * (gamesPlayed + 1));
      let losses = Math.floor(Math.random() * (gamesPlayed - wins + 1));
      let draws = gamesPlayed - (wins + losses);
      let rating = 400 + (wins * 10) - (losses * 10);
      let winRate = gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0;

      try {
        await PlayerStatsModel.updateOne(
          database,
          { player_id: playerId },
          { $set: { gamesPlayed, wins, losses, draws, winRate, rating } },
          { upsert: true }
        );
        playerStats = { gamesPlayed, wins, losses, draws, winRate, rating };
      } catch (err) {
        throw createError('Failed to update player stats', 500);
      }
    }

    const subscription = await SubscriptionsModel.findOne(database, { username: userEmail });
    const balance = await UserBalancesModel.findOne(database, { user_id: playerId });
    let walletBalance = balance?.wallet_balance || 0;
    if (walletBalance > 100000) walletBalance = 100000;

    const sales = await SalesModel.aggregate(database, [
      { $match: { $or: [{ buyer_id: playerId }, { buyer: row.name }] } },
      { $lookup: { from: 'products', localField: 'product_id', foreignField: '_id', as: 'product' } },
      { $unwind: '$product' },
      { $project: { name: '$product.name' } }
    ]);

    const subscribed = subscription && new Date(subscription.end_date) > new Date();

    return {
      player: {
        ...row,
        subscription: subscription || { plan: 'None', price: 0, start_date: 'N/A' },
        walletBalance,
        gamesPlayed: playerStats.gamesPlayed,
        wins: playerStats.wins,
        losses: playerStats.losses,
        draws: playerStats.draws,
        winRate: playerStats.winRate,
        rating: playerStats.rating,
        sales: sales.map(sale => sale.name)
      },
      subscribed
    };
  },

  async updateProfile(db, { userEmail, body }) {
    if (!userEmail) throw createError('Please log in', 401);

    const { name, dob, phone, AICF_ID, FIDE_ID } = body || {};

    const set = {};
    const unset = {};

    if (name !== undefined) {
      const v = (name ?? '').toString().trim();
      if (!v) throw createError('Name is required', 400);
      set.name = v;
    }

    if (phone !== undefined) {
      const v = (phone ?? '').toString().trim();
      if (!v) unset.phone = '';
      else set.phone = v;
    }

    if (AICF_ID !== undefined) {
      const v = (AICF_ID ?? '').toString().trim();
      if (!v) unset.AICF_ID = '';
      else set.AICF_ID = v;
    }

    if (FIDE_ID !== undefined) {
      const v = (FIDE_ID ?? '').toString().trim();
      if (!v) unset.FIDE_ID = '';
      else set.FIDE_ID = v;
    }

    if (dob !== undefined) {
      const v = (dob ?? '').toString().trim();
      if (!v) {
        unset.dob = '';
      } else {
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) {
          throw createError('Invalid dob. Use YYYY-MM-DD.', 400);
        }
        set.dob = d;
      }
    }

    if (Object.keys(set).length === 0 && Object.keys(unset).length === 0) {
      throw createError('No fields to update', 400);
    }

    const database = await resolveDb(db);
    const user = await UserModel.findOne(database, { email: userEmail, role: 'player' });
    if (!user) throw createError('Player not found', 404);

    const updateDoc = {};
    if (Object.keys(set).length) updateDoc.$set = { ...set, updated_date: new Date() };
    if (Object.keys(unset).length) updateDoc.$unset = unset;
    await UserModel.updateOne(database, { _id: user._id }, updateDoc);

    return { success: true };
  },

  async uploadPhoto(db, { userEmail, fileBuffer }) {
    if (!fileBuffer) throw createError('No photo uploaded. Use field name "photo".', 400);

    const database = await resolveDb(db);
    const user = await UserModel.findOne(database, { email: userEmail, role: 'player' });
    if (!user) throw createError('Player not found', 404);

    const existingPublicId = (user.profile_photo_public_id || '').toString();
    const desiredPublicId = existingPublicId || `chesshive/profile-photos/player_${user._id}`;

    let result;
    try {
      result = await StorageModel.uploadImageBuffer(fileBuffer, {
        folder: 'chesshive/profile-photos',
        public_id: desiredPublicId.split('/').pop(),
        overwrite: true,
        invalidate: true
      });
    } catch (uploadErr) {
      throw createError('Failed to upload to cloud storage: ' + (uploadErr.message || 'Unknown error'), 500);
    }

    const newUrl = result?.secure_url;
    const newPublicId = result?.public_id;
    if (!newUrl || !newPublicId) {
      throw createError('Cloudinary upload returned incomplete data', 500);
    }

    if (existingPublicId && existingPublicId !== newPublicId) {
      try {
        await StorageModel.destroyImage(existingPublicId);
      } catch (delErr) {
        console.warn('Failed to delete old profile photo:', delErr);
      }
    }

    try {
      await UserModel.updateOne(
        database,
        { _id: user._id },
        { $set: { profile_photo_url: newUrl, profile_photo_public_id: newPublicId, updated_date: new Date() } }
      );
    } catch (dbErr) {
      throw createError('Failed to save photo information: ' + (dbErr.message || 'Unknown error'), 500);
    }

    return { success: true, profile_photo_url: newUrl };
  },

  async deleteAccount(db, user) {
    requirePlayer(user);
    const database = await resolveDb(db);
    const userDoc = await UserModel.findOne(database, {
      email: user?.email,
      role: 'player'
    });

    if (!userDoc) throw createError('Player not found', 404);

    const playerId = userDoc._id;
    await UserModel.updateOne(
      database,
      { _id: playerId },
      { $set: { isDeleted: 1, deleted_date: new Date(), deleted_by: user?.email } }
    );

    return { success: true, message: 'Account deleted successfully (soft delete)', shouldDestroySession: true };
  },

  async restorePlayer(db, { playerId, email, password }) {
    const database = await resolveDb(db);
    const user = await UserModel.findOne(database, {
      _id: new ObjectId(playerId),
      role: 'player'
    });

    if (!user) throw createError('Player account not found.', 404);
    if (user.isDeleted === 0) throw createError('Account is already active.', 400);
    if (user.email !== email) throw createError('Invalid credentials.', 401);

    const passwordOk = await verifyPasswordAndMaybeMigrate(database, user, password);
    if (!passwordOk) throw createError('Invalid credentials.', 401);
    if (!isSelfDeletedUser(user)) {
      throw createError('This account was removed by an administrator and cannot be self-restored.', 403);
    }

    await UserModel.updateOne(
      database,
      { _id: new ObjectId(playerId) },
      {
        $set: { isDeleted: 0, restored_date: new Date(), restored_by: user.email },
        $unset: { deletedAt: '', deleted_date: '', deleted_by: '' }
      }
    );

    await PlayerStatsModel.updateOne(
      database,
      { player_id: new ObjectId(playerId) },
      { $set: { isDeleted: 0 } }
    );

    await UserBalancesModel.updateOne(
      database,
      { user_id: new ObjectId(playerId) },
      { $set: { isDeleted: 0 } }
    );

    await SubscriptionsModel.updateOne(
      database,
      { username: user.email },
      { $set: { isDeleted: 0 } }
    );

    await SalesModel.updateMany(
      database,
      { buyer: user.name },
      { $set: { isDeleted: 0 } }
    );

    return { message: 'Player account restored successfully! You can now log in.' };
  },

  async getSettings(db, { userEmail }) {
    if (!userEmail) throw createError('Please log in', 401);
    const database = await resolveDb(db);
    const settings = await PlayerSettingsModel.findOne(database, { user_email: userEmail });
    return {
      settings: {
        notifications: settings?.notifications ?? true,
        pieceStyle: settings?.pieceStyle || 'classic',
        wallpaper: settings?.wallpaper || '',
        wallpaper_url: settings?.wallpaper_url || '',
        emailNotifications: settings?.emailNotifications ?? true,
        sound: settings?.sound ?? true
      }
    };
  },

  async updateSettings(db, { userEmail, body }) {
    if (!userEmail) throw createError('Please log in', 401);
    const { notifications, pieceStyle, wallpaper, emailNotifications, sound } = body || {};
    const database = await resolveDb(db);
    const updateDoc = { user_email: userEmail };
    if (notifications !== undefined) updateDoc.notifications = !!notifications;
    if (pieceStyle !== undefined) updateDoc.pieceStyle = String(pieceStyle);
    if (wallpaper !== undefined) updateDoc.wallpaper = String(wallpaper);
    if (emailNotifications !== undefined) updateDoc.emailNotifications = !!emailNotifications;
    if (sound !== undefined) updateDoc.sound = !!sound;

    await PlayerSettingsModel.updateOne(
      database,
      { user_email: userEmail },
      { $set: updateDoc },
      { upsert: true }
    );
    return { success: true, message: 'Settings updated' };
  },

  async deactivateAccount(db, user) {
    requirePlayer(user);
    const database = await resolveDb(db);
    const userDoc = await UserModel.findOne(database, { email: user?.email, role: 'player' });
    if (!userDoc) throw createError('Player not found', 404);

    await UserModel.updateOne(
      database,
      { _id: userDoc._id },
      { $set: { isDeleted: 1, deleted_date: new Date(), deleted_by: user?.email } }
    );

    return { success: true, message: 'Account deactivated successfully', shouldDestroySession: true };
  },

  async uploadWallpaper(db, { userEmail, fileBuffer }) {
    if (!fileBuffer) throw createError('No wallpaper image uploaded. Use field name "wallpaper".', 400);

    const database = await resolveDb(db);
    const user = await UserModel.findOne(database, { email: userEmail, role: 'player' });
    if (!user) throw createError('Player not found', 404);

    const settings = await PlayerSettingsModel.findOne(database, { user_email: userEmail });
    const existingPublicId = (settings?.wallpaper_public_id || '').toString();
    const desiredPublicId = `wallpaper_${user._id}`;

    const result = await StorageModel.uploadImageBuffer(fileBuffer, {
      folder: 'chesshive/wallpapers',
      public_id: desiredPublicId,
      overwrite: true,
      invalidate: true
    });

    const newUrl = result?.secure_url;
    const newPublicId = result?.public_id;
    if (!newUrl || !newPublicId) {
      throw createError('Failed to upload wallpaper', 500);
    }

    if (existingPublicId && existingPublicId !== newPublicId) {
      await StorageModel.destroyImage(existingPublicId);
    }

    await PlayerSettingsModel.updateOne(
      database,
      { user_email: userEmail },
      { $set: { wallpaper: 'custom', wallpaper_url: newUrl, wallpaper_public_id: newPublicId } },
      { upsert: true }
    );

    return { success: true, wallpaper_url: newUrl };
  }
};

module.exports = ProfileService;
