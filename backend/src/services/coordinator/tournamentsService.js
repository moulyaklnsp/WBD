const { connectDB } = require('../../config/database');
const { ObjectId } = require('mongodb');
const path = require('path');
const StorageModel = require('../../models/StorageModel');
const {
  safeTrim,
  parseDateValue,
  isAtLeastDaysFromToday,
  toStartOfDay,
  requireCoordinator
} = require('./coordinatorUtils');
const { getModel } = require('../../models');
const UserModel = getModel('users');
const TournamentModel = getModel('tournaments');
const TournamentPlayersModel = getModel('tournament_players');
const TeamEnrollmentsModel = getModel('enrolledtournaments_team');
const FeedbacksModel = getModel('feedbacks');
const TournamentComplaintsModel = getModel('tournament_complaints');
const TournamentFilesModel = getModel('tournament_files');

const createError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const resolveDb = async (db) => (db ? db : connectDB());

const TournamentsService = {
  async getTournaments(db, user) {
    requireCoordinator(user);
    const userEmail = user?.email;
    const username = user?.username;
    const database = await resolveDb(db);
    const coordinator = await UserModel.findOne(database, {
      email: userEmail,
      role: 'coordinator'
    });
    if (!coordinator) throw createError('User not logged in', 401);

    const coordinatorName = username || coordinator?.name || userEmail;
    const tournaments = await TournamentModel.findMany(
      database,
      { coordinator: coordinatorName },
      { sort: { date: -1 } }
    );

    return { tournaments: tournaments || [] };
  },

  async getTournamentById(db, user, { id }) {
    requireCoordinator(user);
    if (!ObjectId.isValid(id)) throw createError('Invalid tournament ID', 400);

    const database = await resolveDb(db);
    const userEmail = user?.email;
    const username = user?.username;
    const coordinator = await UserModel.findOne(database, {
      email: userEmail,
      role: 'coordinator'
    });
    if (!coordinator) throw createError('User not logged in', 401);

    const tournament = await TournamentModel.findOne(database, { _id: new ObjectId(id) });
    if (!tournament) throw createError('Tournament not found', 404);

    const ownerCandidates = [username, coordinator?.name, userEmail]
      .filter(Boolean)
      .map((v) => v.toString().trim().toLowerCase());
    const tournamentCoordinator = (tournament.coordinator || '').toString().trim().toLowerCase();
    if (!ownerCandidates.includes(tournamentCoordinator)) {
      throw createError('Access denied', 403);
    }

    const tid = new ObjectId(id);
    const individualCount = await TournamentPlayersModel.countDocuments(database, { tournament_id: tid });
    const approvedTeamCount = await TeamEnrollmentsModel.countDocuments(database, {
      tournament_id: tid,
      approved: 1
    });
    const feedbackCount = await FeedbacksModel.countDocuments(database, { tournament_id: tid });
    const complaintsCount = await TournamentComplaintsModel.countDocuments(database, { tournament_id: tid });
    const entryFee = Number(tournament.entry_fee || 0);
    const totalEnrollments = (tournament.type || '').toLowerCase() === 'team' ? approvedTeamCount : individualCount;
    const totalAmountReceived = entryFee * totalEnrollments;

    return {
      tournament,
      stats: {
        individualCount,
        approvedTeamCount,
        totalEnrollments,
        feedbackCount,
        complaintsCount,
        totalAmountReceived
      }
    };
  },

  async createTournament(db, user, { body }) {
    requireCoordinator(user);
    const database = await resolveDb(db);

    const userEmail = user?.email;
    const username = user?.username;
    const coordinator = await UserModel.findOne(database, {
      email: userEmail,
      role: 'coordinator'
    });
    if (!coordinator) throw createError('User not logged in', 401);

    const coordinatorName = username || coordinator?.name || userEmail;

    const { tournamentName, tournamentDate, time, location, entryFee, type, noOfRounds } = body || {};

    const parsedDate = parseDateValue(tournamentDate);
    if (!parsedDate) throw createError('Invalid date format.', 400);
    if (!isAtLeastDaysFromToday(parsedDate, 3)) {
      throw createError('Tournament must be created at least 3 days before the event date.', 400);
    }

    const roundsNum = Number.parseInt(noOfRounds, 10);
    const tournament = {
      name: tournamentName.toString().trim(),
      date: parsedDate,
      time: time.toString().trim(),
      location: location.toString().trim(),
      entry_fee: parseFloat(entryFee),
      type: type.toString().trim(),
      coordinator: coordinatorName.toString(),
      status: 'Pending',
      added_by: coordinatorName.toString(),
      submitted_date: new Date()
    };
    if (!Number.isNaN(roundsNum)) {
      tournament.no_of_rounds = roundsNum;
    }

    const result = await TournamentModel.insertOne(database, tournament);
    if (result.insertedId) {
      return { success: true, message: 'Tournament added successfully', tournamentId: result.insertedId.toString() };
    }

    throw createError('Failed to add tournament', 500);
  },

  async updateTournament(db, user, { id, body }) {
    requireCoordinator(user);
    if (!ObjectId.isValid(id)) throw createError('Invalid tournament ID', 400);

    const database = await resolveDb(db);
    const userEmail = user?.email;
    const username = user?.username;
    const coordinator = await UserModel.findOne(database, {
      email: userEmail,
      role: 'coordinator'
    });
    if (!coordinator) throw createError('User not logged in', 401);

    const coordinatorName = username || coordinator?.name || userEmail;

    const existing = await TournamentModel.findOne(database, { _id: new ObjectId(id), coordinator: coordinatorName });
    if (!existing) throw createError('Tournament not found or not owned by you', 404);
    if (String(existing.status || '').toLowerCase() === 'completed') {
      throw createError('Completed tournaments are read-only.', 403);
    }

    const payload = body || {};
    const name = (payload.tournamentName ?? payload.name);
    const date = (payload.tournamentDate ?? payload.date);
    const time = (payload.time ?? payload.tournamentTime);
    const location = (payload.location ?? payload.tournamentLocation);
    const entryFee = (payload.entryFee ?? payload.entry_fee);
    const type = payload.type;
    const rounds = (payload.noOfRounds ?? payload.no_of_rounds);

    const $set = {};
    if (typeof name === 'string' && name.trim()) $set.name = name.trim();
    if (date) {
      const parsedDate = parseDateValue(date);
      if (!parsedDate) throw createError('Invalid date format.', 400);

      const existingDate = toStartOfDay(existing.date);
      const incomingDate = toStartOfDay(parsedDate);
      const isSameDate = existingDate && incomingDate && existingDate.getTime() === incomingDate.getTime();
      if (!isSameDate && !isAtLeastDaysFromToday(parsedDate, 3)) {
        throw createError('Tournament must be created at least 3 days before the event date.', 400);
      }
      $set.date = parsedDate;
    }
    if (typeof time === 'string' && time.trim()) $set.time = time.trim();
    if (typeof location === 'string' && location.trim()) $set.location = location.trim();
    if (entryFee !== undefined && entryFee !== null && !Number.isNaN(parseFloat(entryFee))) $set.entry_fee = parseFloat(entryFee);
    if (typeof type === 'string' && type.trim()) $set.type = type.trim();
    if (rounds !== undefined && rounds !== null && !Number.isNaN(parseInt(rounds, 10))) {
      $set.no_of_rounds = parseInt(rounds, 10);
    }

    if (Object.keys($set).length === 0) {
      throw createError('No valid fields provided to update', 400);
    }

    const result = await TournamentModel.updateOne(
      database,
      { _id: new ObjectId(id), coordinator: coordinatorName },
      { $set }
    );

    if (result.matchedCount === 0) {
      throw createError('Tournament not found or not owned by you', 404);
    }

    if (result.modifiedCount === 0) {
      return { success: true, message: 'No changes detected' };
    }

    return { success: true, message: 'Tournament updated successfully' };
  },

  async deleteTournament(db, user, { id }) {
    requireCoordinator(user);
    if (!ObjectId.isValid(id)) throw createError('Invalid tournament ID', 400);

    const database = await resolveDb(db);
    const coordinatorName = user?.username || user?.email;

    const existing = await TournamentModel.findOne(database, { _id: new ObjectId(id), coordinator: coordinatorName });
    if (!existing) throw createError('Tournament not found', 404);
    if (String(existing.status || '').toLowerCase() === 'completed') {
      throw createError('Completed tournaments are read-only.', 403);
    }

    const result = await TournamentModel.updateOne(
      database,
      { _id: new ObjectId(id), coordinator: coordinatorName },
      { $set: { status: 'Removed', removed_date: new Date(), removed_by: coordinatorName } }
    );

    if (result.modifiedCount > 0) {
      return { success: true, message: 'Tournament removed successfully' };
    }

    throw createError('Tournament not found', 404);
  },

  async uploadTournamentFile(db, user, { tournamentId, file, description }) {
    requireCoordinator(user);
    if (!file) throw createError('No file uploaded', 400);
    if (!ObjectId.isValid(tournamentId)) throw createError('Invalid tournament ID', 400);

    const database = await resolveDb(db);
    const userEmail = user?.email;
    const username = user?.username;
    const coordinator = await UserModel.findOne(database, {
      email: userEmail,
      role: 'coordinator'
    });
    if (!coordinator) throw createError('User not logged in', 401);
    const coordinatorEmail = username || coordinator?.name || userEmail;

    const tournament = await TournamentModel.findOne(database, {
      _id: new ObjectId(tournamentId),
      coordinator: coordinatorEmail
    });
    if (!tournament) throw createError('Tournament not found or access denied', 404);

    const fileExtension = path.extname(file.originalname).toLowerCase();
    let fileType = 'document';
    if (['.jpg', '.jpeg', '.png', '.gif'].includes(fileExtension)) {
      fileType = 'image';
    } else if (fileExtension === '.pdf') {
      fileType = 'pdf';
    }

    const result = await StorageModel.uploadImageBuffer(file.buffer, {
      folder: `tournaments/${tournamentId}`,
      resource_type: fileType === 'pdf' ? 'raw' : 'image',
      public_id: `${Date.now()}_${file.originalname}`,
      format: fileType === 'pdf' ? 'pdf' : undefined
    });

    const fileDoc = {
      tournament_id: new ObjectId(tournamentId),
      file_name: file.originalname,
      file_url: result.secure_url,
      file_public_id: result.public_id,
      file_type: fileType,
      uploaded_by: coordinatorEmail,
      description: safeTrim(description || ''),
      upload_date: new Date()
    };

    await TournamentFilesModel.insertOne(database, fileDoc);
    return { success: true, file: fileDoc };
  },

  async getTournamentFiles(db, user, { tournamentId }) {
    requireCoordinator(user);
    if (!ObjectId.isValid(tournamentId)) throw createError('Invalid tournament ID', 400);
    const database = await resolveDb(db);

    const userEmail = user?.email;
    const username = user?.username;
    const coordinator = await UserModel.findOne(database, {
      email: userEmail,
      role: 'coordinator'
    });
    if (!coordinator) throw createError('User not logged in', 401);
    const coordinatorEmail = username || coordinator?.name || userEmail;

    const tournament = await TournamentModel.findOne(database, {
      _id: new ObjectId(tournamentId),
      coordinator: coordinatorEmail
    });
    if (!tournament) throw createError('Tournament not found or access denied', 404);

    const files = await TournamentFilesModel.findMany(
      database,
      { tournament_id: new ObjectId(tournamentId) },
      { sort: { upload_date: -1 } }
    );

    const mappedFiles = files.map(file => ({
      _id: file._id.toString(),
      filename: file.file_name,
      url: file.file_url,
      description: file.description || '',
      upload_date: file.upload_date
    }));

    return {
      files: mappedFiles,
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' }
    };
  },

  async deleteTournamentFile(db, user, { tournamentId, fileId }) {
    requireCoordinator(user);
    if (!ObjectId.isValid(tournamentId) || !ObjectId.isValid(fileId)) {
      throw createError('Invalid tournament or file ID', 400);
    }

    const database = await resolveDb(db);
    const userEmail = user?.email;
    const username = user?.username;
    const coordinator = await UserModel.findOne(database, {
      email: userEmail,
      role: 'coordinator'
    });
    if (!coordinator) throw createError('User not logged in', 401);
    const coordinatorEmail = username || coordinator?.name || userEmail;

    const tournament = await TournamentModel.findOne(database, {
      _id: new ObjectId(tournamentId),
      coordinator: coordinatorEmail
    });
    if (!tournament) throw createError('Tournament not found or access denied', 404);

    const file = await TournamentFilesModel.findOne(database, {
      _id: new ObjectId(fileId),
      tournament_id: new ObjectId(tournamentId)
    });
    if (!file) throw createError('File not found', 404);

    if (file.file_public_id) {
      try {
        const resourceType = file.file_type === 'pdf' ? 'raw' : 'image';
        await StorageModel.destroyCloudinaryAsset(file.file_public_id, { resource_type: resourceType });
      } catch (cloudinaryError) {
        console.warn('Failed to delete from Cloudinary:', cloudinaryError);
      }
    }

    await TournamentFilesModel.deleteOne(database, { _id: new ObjectId(fileId) });
    return { success: true, message: 'File deleted successfully' };
  }
};

module.exports = TournamentsService;
