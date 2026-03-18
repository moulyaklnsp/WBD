const { connectDB } = require('../../config/database');
const { ObjectId } = require('mongodb');
const { safeTrim, getCoordinatorOwnerIdentifiers, requireCoordinator } = require('./coordinatorUtils');
const { getModel } = require('../../models');
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
  const ownerIdentifiersLower = new Set(ownerIdentifiers.map((v) => v.toLowerCase()));

  const objectId = new ObjectId(complaintId);

  for (const collectionName of ['tournament_complaints', 'complaints']) {
    const model = complaintModels[collectionName];
    const complaint = await model.findOne(db, { _id: objectId });
    if (!complaint) continue;

    if (!complaint.tournament_id) {
      return { error: 'Complaint tournament is missing', status: 404 };
    }

    let tournamentId = complaint.tournament_id;
    if (typeof tournamentId === 'string' && ObjectId.isValid(tournamentId)) {
      tournamentId = new ObjectId(tournamentId);
    }

    const tournament = await TournamentModel.findOne(db, { _id: tournamentId });
    if (!tournament) {
      return { error: 'Complaint tournament not found', status: 404 };
    }

    const coordinatorValue = safeTrim(tournament.coordinator).toLowerCase();
    if (!ownerIdentifiersLower.has(coordinatorValue)) {
      return { error: 'Complaint not found or access denied', status: 404 };
    }

    return { collectionName, complaint, tournament };
  }

  return { error: 'Complaint not found or access denied', status: 404 };
}

const ComplaintsService = {
  async getComplaints(db, user) {
    requireCoordinator(user);
    const database = await resolveDb(db);
    const ownerIdentifiers = await getCoordinatorOwnerIdentifiers(database, user);

    let tournaments = await TournamentModel.findMany(
      database,
      { coordinator: { $in: ownerIdentifiers } },
      { projection: { _id: 1, name: 1, coordinator: 1 } }
    );

    if (tournaments.length === 0) {
      const ownerIdentifiersLower = new Set(ownerIdentifiers.map((v) => v.toLowerCase()));
      const allTournaments = await TournamentModel.findMany(
        database,
        {},
        { projection: { _id: 1, name: 1, coordinator: 1 } }
      );
      tournaments = allTournaments.filter((t) =>
        ownerIdentifiersLower.has(safeTrim(t.coordinator).toLowerCase())
      );
    }

    const tournamentIds = tournaments.map((t) => t._id);
    const tournamentIdStrings = tournamentIds.map((t) => t.toString());
    const tournamentsById = new Map(tournaments.map((t) => [t._id.toString(), t]));

    if (tournamentIds.length === 0) {
      return { complaints: [] };
    }

    const [tournamentComplaints, legacyComplaints] = await Promise.all([
      TournamentComplaintsModel.findMany(
        database,
        {
          $or: [
            { tournament_id: { $in: tournamentIds } },
            { tournament_id: { $in: tournamentIdStrings } }
          ]
        },
        { sort: { submitted_date: -1, created_at: -1 } }
      ),
      ComplaintsModel.findMany(
        database,
        {
          $or: [
            { tournament_id: { $in: tournamentIds } },
            { tournament_id: { $in: tournamentIdStrings } }
          ]
        },
        { sort: { created_at: -1, submitted_date: -1 } }
      )
    ]);

    const complaints = [
      ...(tournamentComplaints || []).map((c) => normalizeComplaintRecord(c, tournamentsById)),
      ...(legacyComplaints || []).map((c) => normalizeComplaintRecord(c, tournamentsById))
    ].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    return { complaints };
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
