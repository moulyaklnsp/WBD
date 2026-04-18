const { connectDB } = require('../../config/database');
const { ObjectId } = require('mongodb');
const { safeTrim, getCoordinatorOwnerIdentifiers, requireCoordinator } = require('./coordinatorUtils');
const { getModel } = require('../../models');
const { normalizeKey } = require('../../utils/mongo');
const TournamentModel = getModel('tournaments');
const TournamentComplaintsModel = getModel('tournament_complaints');
const ComplaintsModel = getModel('complaints');

const createError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const resolveDb = async (db) => (db ? db : connectDB());

function parseMaybeDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeComplaintRecord(rawComplaint, tournamentsById = new Map()) {
  const c = rawComplaint || {};
  const id = c._id ? c._id.toString() : undefined;
  const tournamentId = c.tournament_id ? c.tournament_id.toString() : '';
  const tournament = tournamentsById.get(tournamentId) || c.tournament || null;
  const createdAt =
    parseMaybeDate(c.created_at) ||
    parseMaybeDate(c.submitted_date) ||
    parseMaybeDate(c.createdAt);
  const resolvedAt =
    parseMaybeDate(c.resolved_date) ||
    parseMaybeDate(c.resolved_at) ||
    parseMaybeDate(c.resolvedAt);

  return {
    _id: id,
    tournament_id: tournamentId,
    tournament,
    status: c.status || 'pending',
    complaint: c.complaint || c.message || '',
    coordinator_response: c.coordinator_response || c.response || c.reply || '',
    submitted_by: c.player_email || c.submitted_by || c.user_email || c.email || '',
    createdAt: createdAt || null,
    resolvedAt: resolvedAt || null
  };
}

const complaintModels = {
  tournament_complaints: TournamentComplaintsModel,
  complaints: ComplaintsModel
};

async function findCoordinatorComplaint(db, user, complaintId) {
  const ownerIdentifiers = await getCoordinatorOwnerIdentifiers(db, user);
  const ownerKeys = ownerIdentifiers.map(normalizeKey).filter(Boolean);
  const objectId = new ObjectId(complaintId);

  const [row] = await db.collection('tournament_complaints').aggregate([
    { $match: { _id: objectId } },
    { $addFields: { collectionName: { $literal: 'tournament_complaints' } } },
    {
      $unionWith: {
        coll: 'complaints',
        pipeline: [
          { $match: { _id: objectId } },
          { $addFields: { collectionName: { $literal: 'complaints' } } }
        ]
      }
    },
    { $limit: 1 },
    {
      $addFields: {
        tournament_oid: {
          $convert: { input: '$tournament_id', to: 'objectId', onError: null, onNull: null }
        }
      }
    },
    { $lookup: { from: 'tournaments', localField: 'tournament_oid', foreignField: '_id', as: 'tournament' } },
    { $unwind: { path: '$tournament', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        coordinatorKey: { $ifNull: ['$tournament.coordinator_key', { $toLower: { $ifNull: ['$tournament.coordinator', ''] } }] }
      }
    },
    { $match: { coordinatorKey: { $in: ownerKeys } } }
  ]).toArray();

  if (!row) return { error: 'Complaint not found or access denied', status: 404 };
  if (!row.tournament_oid) return { error: 'Complaint tournament is missing', status: 404 };
  if (!row.tournament) return { error: 'Complaint tournament not found', status: 404 };

  return {
    collectionName: row.collectionName,
    complaint: row,
    tournament: row.tournament
  };
}

const ComplaintsService = {
  async getComplaints(db, user) {
    requireCoordinator(user);
    const database = await resolveDb(db);
    const ownerIdentifiers = await getCoordinatorOwnerIdentifiers(database, user);
    const ownerKeys = ownerIdentifiers.map(normalizeKey).filter(Boolean);

    const tournaments = await TournamentModel.findMany(
      database,
      {
        $or: [
          { coordinator: { $in: ownerIdentifiers } },
          { coordinator_key: { $in: ownerKeys } }
        ]
      },
      { projection: { _id: 1, name: 1, coordinator: 1 } }
    );

    const tournamentIds = tournaments.map((t) => t._id);
    const tournamentIdStrings = tournamentIds.map((t) => t.toString());
    if (tournamentIds.length === 0) {
      return { complaints: [] };
    }

    const matchByTournamentIds = {
      $or: [
        { tournament_id: { $in: tournamentIds } },
        { tournament_id: { $in: tournamentIdStrings } }
      ]
    };

    const normalizePipeline = [
      { $match: matchByTournamentIds },
      {
        $addFields: {
          tidObj: {
            $cond: [
              { $eq: [{ $type: '$tournament_id' }, 'objectId'] },
              '$tournament_id',
              { $convert: { input: '$tournament_id', to: 'objectId', onError: null, onNull: null } }
            ]
          },
          createdAt: {
            $ifNull: [
              '$created_at',
              { $ifNull: ['$submitted_date', { $ifNull: ['$createdAt', { $toDate: '$_id' }] }] }
            ]
          },
          resolvedAt: {
            $ifNull: ['$resolved_date', { $ifNull: ['$resolved_at', '$resolvedAt'] }]
          },
          statusVal: { $ifNull: ['$status', 'pending'] },
          complaintVal: { $ifNull: ['$complaint', { $ifNull: ['$message', ''] }] },
          responseVal: { $ifNull: ['$coordinator_response', { $ifNull: ['$response', { $ifNull: ['$reply', ''] }] }] },
          submittedByVal: { $ifNull: ['$player_email', { $ifNull: ['$submitted_by', { $ifNull: ['$user_email', { $ifNull: ['$email', ''] }] }] }] }
        }
      },
      {
        $lookup: {
          from: 'tournaments',
          localField: 'tidObj',
          foreignField: '_id',
          pipeline: [{ $project: { name: 1, coordinator: 1, date: 1, status: 1, type: 1 } }, { $limit: 1 }],
          as: 'tournament'
        }
      },
      { $addFields: { tournament: { $first: '$tournament' } } },
      {
        $project: {
          _id: { $toString: '$_id' },
          tournament_id: { $toString: '$tournament_id' },
          tournament: 1,
          status: '$statusVal',
          complaint: '$complaintVal',
          coordinator_response: '$responseVal',
          submitted_by: '$submittedByVal',
          createdAt: 1,
          resolvedAt: 1
        }
      }
    ];

    const complaints = await database.collection('tournament_complaints').aggregate([
      ...normalizePipeline,
      {
        $unionWith: {
          coll: 'complaints',
          pipeline: normalizePipeline
        }
      },
      { $sort: { createdAt: -1 } }
    ]).toArray();

    return { complaints: complaints || [] };
  },

  async resolveComplaint(db, user, { complaintId, responseText }) {
    requireCoordinator(user);
    if (!ObjectId.isValid(complaintId)) throw createError('Invalid complaint ID', 400);

    const database = await resolveDb(db);
    const complaintContext = await findCoordinatorComplaint(database, user, complaintId);
    if (complaintContext.error) {
      throw createError(complaintContext.error, complaintContext.status || 404);
    }

    const now = new Date();
    const setFields = {
      status: 'resolved',
      resolved_date: now,
      resolved_at: now
    };
    if (responseText) {
      setFields.coordinator_response = responseText;
      setFields.response = responseText;
      setFields.reply = responseText;
      setFields.respondedAt = now;
      setFields.responded_at = now;
    }

    const model = complaintModels[complaintContext.collectionName];
    await model.updateOne(
      database,
      { _id: new ObjectId(complaintId) },
      { $set: setFields }
    );

    return { success: true };
  },

  async respondComplaint(db, user, { complaintId, responseText }) {
    requireCoordinator(user);
    if (!ObjectId.isValid(complaintId)) throw createError('Invalid complaint ID', 400);
    if (!responseText) throw createError('Response is required', 400);

    const database = await resolveDb(db);
    const complaintContext = await findCoordinatorComplaint(database, user, complaintId);
    if (complaintContext.error) {
      throw createError(complaintContext.error, complaintContext.status || 404);
    }

    const now = new Date();
    const setFields = {
      coordinator_response: responseText,
      response: responseText,
      reply: responseText,
      respondedAt: now,
      responded_at: now
    };

    const model = complaintModels[complaintContext.collectionName];
    await model.updateOne(
      database,
      { _id: new ObjectId(complaintId) },
      { $set: setFields }
    );

    return { success: true };
  }
};

module.exports = ComplaintsService;
