const { connectDB } = require('../../config/database');
const moment = require('moment');
const { safeTrim, isAtLeastDaysFromToday, parseDateValue, requireCoordinator } = require('./coordinatorUtils');
const StorageModel = require('../../models/StorageModel');
const { getModel } = require('../../models');
const UserModel = getModel('users');
const MeetingsModel = getModel('meetingsdb');
const TournamentModel = getModel('tournaments');
const ProductsModel = getModel('products');
const NotificationsModel = getModel('notifications');

const createError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const resolveDb = async (db) => (db ? db : connectDB());

const ProfileService = {
  async getName(db, user) {
    requireCoordinator(user);
    const userEmail = user?.email;
    const database = await resolveDb(db);
    const coordinator = await UserModel.findOne(database, {
      email: userEmail,
      role: 'coordinator'
    });
    return { name: coordinator?.name || 'Coordinator' };
  },

  async getDashboard(db, user) {
    requireCoordinator(user);
    const userEmail = user?.email;
    const username = user?.username || userEmail;
    const database = await resolveDb(db);
    const today = new Date();
    const threeDaysLater = moment().add(3, 'days').toDate();

    const coordinator = await UserModel.findOne(database, {
      email: userEmail,
      role: 'coordinator'
    });

    const meetings = await MeetingsModel.findMany(
      database,
      {
        date: { $gte: today, $lte: threeDaysLater },
        name: { $ne: username }
      },
      { sort: { date: 1, time: 1 } }
    );

    const upcomingTournaments = await TournamentModel.findMany(
      database,
      {
        coordinator: username,
        date: { $gte: today, $lte: threeDaysLater },
        status: { $nin: ['Removed', 'Rejected'] }
      },
      { sort: { date: 1 } }
    );

    const stockAlerts = await ProductsModel.findMany(
      database,
      {
        coordinator: username,
        availability: { $lt: 15, $gte: 0 }
      }
    );

    const unreadNotificationCount = await NotificationsModel.countDocuments(
      database,
      {
        user_id: coordinator?._id,
        read: false
      }
    );

    return {
      coordinatorName: coordinator?.name || 'Coordinator',
      meetings: meetings || [],
      upcomingTournaments: upcomingTournaments || [],
      stockAlerts: stockAlerts || [],
      unreadNotificationCount: unreadNotificationCount || 0
    };
  },

  async getProfile(db, user) {
    requireCoordinator(user);
    const userEmail = user?.email;
    const database = await resolveDb(db);
    const coordinator = await UserModel.findOne(database, {
      email: userEmail,
      role: 'coordinator'
    });

    if (!coordinator) throw createError('Coordinator not found', 404);

    return {
      name: coordinator.name,
      email: coordinator.email,
      phone: coordinator.phone || '',
      college: coordinator.college || '',
      dob: coordinator.dob || null,
      gender: coordinator.gender || '',
      AICF_ID: coordinator.AICF_ID || '',
      FIDE_ID: coordinator.FIDE_ID || '',
      profile_photo_url: coordinator.profile_photo_url || ''
    };
  },

  async updateProfile(db, user, { body }) {
    requireCoordinator(user);
    const userEmail = user?.email;
    const database = await resolveDb(db);

    const coordinator = await UserModel.findOne(database, { email: userEmail, role: 'coordinator' });
    if (!coordinator) throw createError('Coordinator not found', 404);

    const payload = body || {};
    const allowedFields = ['name', 'phone', 'college', 'dob', 'gender', 'AICF_ID', 'FIDE_ID'];
    const set = {};
    const unset = {};

    for (const field of allowedFields) {
      if (payload[field] !== undefined) {
        if (field === 'dob') {
          const rawDob = safeTrim(payload[field]);
          if (!rawDob) {
            unset.dob = '';
            continue;
          }
          const date = new Date(rawDob);
          if (Number.isNaN(date.getTime())) {
            throw createError('Invalid date format for dob', 400);
          }
          set.dob = date;
          continue;
        }

        if (field === 'name') {
          const name = safeTrim(payload[field]);
          if (!name) throw createError('Name is required', 400);
          set.name = name;
        } else {
          const value = safeTrim(payload[field]);
          if (!value) {
            unset[field] = '';
          } else {
            set[field] = value;
          }
        }
      }
    }

    if (Object.keys(set).length === 0 && Object.keys(unset).length === 0) {
      throw createError('No valid fields to update', 400);
    }

    set.updated_date = new Date();

    const updateDoc = { $set: set };
    if (Object.keys(unset).length > 0) {
      updateDoc.$unset = unset;
    }

    const result = await UserModel.updateOne(database, { _id: coordinator._id }, updateDoc);
    if (result.modifiedCount === 0) {
      throw createError('No changes made', 400);
    }

    return { success: true, message: 'Profile updated successfully' };
  },

  async updatePhoto(db, user, { fileBuffer }) {
    requireCoordinator(user);
    const userEmail = user?.email;
    if (!fileBuffer) throw createError('No photo uploaded. Use field name "photo".', 400);

    const database = await resolveDb(db);
    const coordinator = await UserModel.findOne(database, { email: userEmail, role: 'coordinator' });
    if (!coordinator) throw createError('Coordinator not found', 404);

    const existingPublicId = (coordinator.profile_photo_public_id || '').toString();
    const desiredPublicId = existingPublicId || `chesshive/profile-photos/coordinator_${coordinator._id}`;

    const result = await StorageModel.uploadImageBuffer(fileBuffer, {
      folder: 'chesshive/profile-photos',
      public_id: desiredPublicId.split('/').pop(),
      overwrite: true,
      invalidate: true
    });

    const newUrl = result?.secure_url;
    const newPublicId = result?.public_id;
    if (!newUrl || !newPublicId) {
      throw createError('Failed to upload profile photo', 500);
    }

    if (existingPublicId && existingPublicId !== newPublicId) {
      await StorageModel.destroyImage(existingPublicId);
    }

    await UserModel.updateOne(
      database,
      { _id: coordinator._id },
      { $set: { profile_photo_url: newUrl, profile_photo_public_id: newPublicId, updated_date: new Date() } }
    );

    return { success: true, profile_photo_url: newUrl };
  },

  async deleteProfile(db, user) {
    requireCoordinator(user);
    const userEmail = user?.email;
    const database = await resolveDb(db);

    const result = await UserModel.updateOne(
      database,
      { email: userEmail, role: 'coordinator' },
      { $set: { isDeleted: 1, deleted_date: new Date(), deleted_by: userEmail } }
    );

    if (result.modifiedCount > 0) {
      return { success: true, message: 'Account deleted successfully' };
    }

    throw createError('Account not found', 404);
  }
};

module.exports = ProfileService;
