const { connectDB } = require('../../config/database');
const StorageModel = require('../../models/StorageModel');
const { safeTrim, isValidName, isSelfDeletedUser, requireOrganizer } = require('./organizerUtils');
const { getModel } = require('../../models');
const UserModel = getModel('users');

const createError = (message, statusCode) => Object.assign(new Error(message), { statusCode });

const resolveDb = async (db) => (db ? db : connectDB());

const UsersService = {
  async getOrganizerProfile(db, user) {
    requireOrganizer(user);
    const email = user?.email;
    const database = await resolveDb(db);

    const organizer = await UserModel.findOne(database, {
      email,
      role: 'organizer'
    });

    if (!organizer) throw createError('Organizer not found', 404);

    return {
      name: organizer.name,
      email: organizer.email,
      phone: organizer.phone || '',
      college: organizer.college || '',
      dob: organizer.dob || null,
      gender: organizer.gender || '',
      AICF_ID: organizer.AICF_ID || '',
      FIDE_ID: organizer.FIDE_ID || '',
      profile_photo_url: organizer.profile_photo_url || null
    };
  },

  async updateOrganizerProfile(db, user, body) {
    requireOrganizer(user);
    const email = user?.email;
    const database = await resolveDb(db);

    const organizer = await UserModel.findOne(database, {
      email,
      role: 'organizer'
    });
    if (!organizer) throw createError('Organizer not found', 404);

    const payload = body || {};
    const allowedFields = ['name', 'phone', 'college', 'dob', 'gender', 'AICF_ID', 'FIDE_ID'];
    const set = {};
    const unset = {};

    for (const field of allowedFields) {
      if (payload[field] === undefined) continue;

      if (field === 'dob') {
        const rawDob = safeTrim(payload[field]);
        if (!rawDob) {
          unset.dob = '';
          continue;
        }
        const parsed = new Date(rawDob);
        if (Number.isNaN(parsed.getTime())) {
          throw createError('Invalid date format for dob', 400);
        }
        set.dob = parsed;
        continue;
      }

      if (field === 'gender') {
        const gender = safeTrim(payload[field]).toLowerCase();
        if (!gender) {
          unset.gender = '';
          continue;
        }
        if (!['male', 'female', 'other'].includes(gender)) {
          throw createError('Invalid gender value', 400);
        }
        set.gender = gender;
        continue;
      }

      if (field === 'name') {
        const name = safeTrim(payload[field]);
        if (!isValidName(name)) {
          throw createError('Valid full name is required', 400);
        }
        set.name = name;
        continue;
      }

      const value = safeTrim(payload[field]);
      if (!value) {
        unset[field] = '';
      } else {
        set[field] = value;
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

    await UserModel.updateOne(database, { _id: organizer._id }, updateDoc);
    return { success: true, message: 'Profile updated successfully' };
  },

  async updateOrganizerPhoto(db, user, fileBuffer) {
    requireOrganizer(user);
    const email = user?.email;
    if (!fileBuffer) throw createError('No file uploaded', 400);

    const database = await resolveDb(db);

    const result = await StorageModel.uploadImageBuffer(fileBuffer, {
      folder: 'chesshive/organizer-photos',
      public_id: `organizer_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      overwrite: false
    });

    if (!result || !result.secure_url) {
      throw createError('Failed to upload image to cloud', 500);
    }

    const updateResult = await UserModel.updateOne(
      database,
      { email, role: 'organizer' },
      { $set: { profile_photo_url: result.secure_url, profile_photo_public_id: result.public_id } }
    );

    if (updateResult.modifiedCount === 0) {
      throw createError('Organizer not found', 404);
    }

    return { success: true, profile_photo_url: result.secure_url };
  },

  async listCoordinators(db) {
    const database = await resolveDb(db);
    return UserModel.findMany(
      database,
      { role: 'coordinator' },
      { projection: { name: 1, email: 1, college: 1, isDeleted: 1, deleted_by: 1 } }
    );
  },

  async listPendingCoordinators(db) {
    const database = await resolveDb(db);
    return database.collection('pending_coordinators')
      .find({ status: 'pending' })
      .project({ email: 1, data: 1, created_at: 1, status: 1 })
      .sort({ created_at: -1 })
      .limit(200)
      .toArray();
  },

  async approvePendingCoordinator(email, approved) {
    const database = await resolveDb();
    const pending = await database.collection('pending_coordinators').findOne({ email, status: 'pending' });
    if (!pending) throw createError('Pending coordinator not found', 404);

    if (approved) {
      // Approve: Copy to signup_otps and otps, send emit
      await database.collection('signup_otps').insertOne({
        email: pending.email,
        data: pending.data,
        created_at: new Date()
      });

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      await database.collection('otps').insertOne({
        email: pending.email,
        otp,
        type: 'signup',
        expires_at: expiresAt,
        used: false
      });

      const { sendOtpEmail } = require('../emailService');
      const mailResult = await sendOtpEmail(pending.email, otp);
      const emailSent = Boolean(mailResult?.sent);
      
      const io = require('../socketService').getIO();
      if (io) {
        io.to(`signup_${pending.email}`).emit('coordinator_approved', { email: pending.email });
      }

      await database.collection('pending_coordinators').updateOne(
        { _id: pending._id },
        { $set: { status: 'approved', approvedAt: new Date() } }
      );
      return {
        success: true,
        message: emailSent ? 'Coordinator approved. OTP sent.' : 'Coordinator approved. OTP generated but email failed.',
        emailSent
      };
    } else {
      // Reject
      await database.collection('pending_coordinators').updateOne(
        { _id: pending._id },
        { $set: { status: 'rejected', rejectedAt: new Date() } }
      );
      
      const io = require('../socketService').getIO();
      if (io) {
        io.to(`signup_${pending.email}`).emit('coordinator_rejected', { email: pending.email });
      }

      return { success: true, message: 'Coordinator rejected.' };
    }
  },

  async softDeleteCoordinator(db, user, email) {
    requireOrganizer(user);
    const deletedBy = user?.email;
    if (!email) throw createError('Coordinator email required', 400);

    const database = await resolveDb(db);
    const result = await UserModel.updateOne(
      database,
      { email, role: 'coordinator', isDeleted: { $ne: 1 } },
      { $set: { isDeleted: 1, deleted_date: new Date(), deleted_by: deletedBy } }
    );

    if (result.modifiedCount > 0) {
      return { success: true, message: 'Coordinator removed successfully' };
    }
    throw createError('Coordinator not found', 404);
  },

  async restoreCoordinator(db, user, email) {
    requireOrganizer(user);
    const restoredBy = user?.email;
    if (!email) throw createError('Coordinator email required', 400);

    const database = await resolveDb(db);
    const coordinator = await UserModel.findOne(database, {
      email,
      role: 'coordinator',
      isDeleted: 1
    });

    if (!coordinator) {
      throw createError('Coordinator not found or already restored', 404);
    }

    if (isSelfDeletedUser(coordinator)) {
      throw createError('Self-deleted accounts cannot be restored by others', 403);
    }

    const result = await UserModel.updateOne(
      database,
      { _id: coordinator._id },
      {
        $set: { isDeleted: 0, restored_date: new Date(), restored_by: restoredBy },
        $unset: { deleted_date: '', deleted_by: '' }
      }
    );

    if (result.modifiedCount > 0) {
      return { success: true, message: 'Coordinator restored successfully' };
    }

    throw createError('Coordinator not found or already restored', 404);
  },

  async softDeleteOrganizer(db, user, email) {
    requireOrganizer(user);
    const deletedBy = user?.email;
    if (!email) throw createError('Organizer email required', 400);

    const database = await resolveDb(db);
    const result = await UserModel.updateOne(
      database,
      { email, role: 'organizer', isDeleted: { $ne: 1 } },
      { $set: { isDeleted: 1, deleted_date: new Date(), deleted_by: deletedBy } }
    );

    if (result.modifiedCount > 0) {
      return {
        success: true,
        message: 'Organizer removed successfully',
        selfDeleted: email === deletedBy
      };
    }

    throw createError('Organizer not found', 404);
  }
};

module.exports = UsersService;
