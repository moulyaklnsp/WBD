const { connectDB } = require('../../config/database');
const { ObjectId } = require('mongodb');
const { requirePlayer } = require('./playerUtils');
const { getModel } = require('../../models');
const TournamentModel = getModel('tournaments');
const TournamentComplaintsModel = getModel('tournament_complaints');
const ComplaintsModel = getModel('complaints');

const createError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const resolveDb = async (db) => (db ? db : connectDB());

function parseComplaintDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const ComplaintsService = {
  async submitComplaint(db, user, body) {
    requirePlayer(user);
    const { tournament_id, subject, message } = body || {};
    if (!tournament_id || !subject || !message) {
      throw createError('Tournament ID, subject, and message are required', 400);
    }
    if (!ObjectId.isValid(tournament_id)) {
      throw createError('Invalid tournament ID', 400);
    }

    const database = await resolveDb(db);
    const tournamentObjectId = new ObjectId(tournament_id);
    const tournament = await TournamentModel.findOne(database, { _id: tournamentObjectId });
    if (!tournament) {
      throw createError('Tournament not found', 404);
    }

    const playerEmail = (user?.email || '').toString().trim();
    const emailCandidates = Array.from(new Set([playerEmail, playerEmail.toLowerCase()])).filter(Boolean);
    const tournamentIdString = tournamentObjectId.toString();

    const complaintMatch = {
      $and: [
        {
          $or: [
            { tournament_id: tournamentObjectId },
            { tournament_id: tournamentIdString }
          ]
        },
        {
          $or: [
            { player_email: { $in: emailCandidates } },
            { user_email: { $in: emailCandidates } }
          ]
        }
      ]
    };

    const [existingNew, existingLegacy] = await Promise.all([
      TournamentComplaintsModel.findOne(database, complaintMatch),
      ComplaintsModel.findOne(database, complaintMatch)
    ]);

    if (existingNew || existingLegacy) {
      throw createError('You have already submitted a complaint for this tournament', 409);
    }

    const now = new Date();
    const complaint = {
      tournament_id: tournamentObjectId,
      player_email: playerEmail,
      player_name: user?.username || user?.email,
      complaint: message.trim(),
      subject: subject.trim(),
      message: message.trim(),
      status: 'pending',
      coordinator_response: '',
      reply: '',
      submitted_date: now,
      created_at: now
    };

    await TournamentComplaintsModel.insertOne(database, complaint);
    return { success: true, message: 'Complaint submitted' };
  },

  async getMyComplaints(db, user) {
    requirePlayer(user);
    const database = await resolveDb(db);
    const email = (user?.email || '').toString();

    const emailCandidates = Array.from(new Set([email, email.toLowerCase()]));

    const [newComplaints, legacyComplaints] = await Promise.all([
      TournamentComplaintsModel.findMany(
        database,
        {
          $or: [
            { player_email: { $in: emailCandidates } },
            { user_email: { $in: emailCandidates } }
          ]
        },
        { sort: { submitted_date: -1, created_at: -1 } }
      ),
      ComplaintsModel.findMany(
        database,
        {
          $or: [
            { player_email: { $in: emailCandidates } },
            { user_email: { $in: emailCandidates } }
          ]
        },
        { sort: { created_at: -1, submitted_date: -1 } }
      )
    ]);

    const allComplaints = [...(newComplaints || []), ...(legacyComplaints || [])];

    const tournamentObjectIds = allComplaints
      .map((c) => {
        const tid = c?.tournament_id;
        if (!tid) return null;
        if (typeof tid === 'string') {
          return ObjectId.isValid(tid) ? new ObjectId(tid) : null;
        }
        return tid;
      })
      .filter(Boolean);

    const tournaments = tournamentObjectIds.length
      ? await TournamentModel.findMany(
        database,
        { _id: { $in: tournamentObjectIds } },
        { projection: { _id: 1, name: 1 } }
      )
      : [];
    const tournamentsById = new Map((tournaments || []).map((t) => [t._id.toString(), t.name]));

    const complaints = allComplaints
      .map((c) => {
        const id = c?._id ? c._id.toString() : '';
        const tournamentId = c?.tournament_id
          ? (typeof c.tournament_id === 'string' ? c.tournament_id : c.tournament_id.toString())
          : '';
        const response = (c?.coordinator_response || c?.response || c?.reply || '').toString().trim();
        const createdAt =
          parseComplaintDate(c?.created_at) ||
          parseComplaintDate(c?.submitted_date) ||
          parseComplaintDate(c?.createdAt);
        const resolvedAt =
          parseComplaintDate(c?.resolved_date) ||
          parseComplaintDate(c?.resolved_at) ||
          parseComplaintDate(c?.responded_at) ||
          parseComplaintDate(c?.respondedAt);
        const message = (c?.complaint || c?.message || c?.description || '').toString().trim();
        let status = (c?.status || '').toString().trim().toLowerCase();
        if (!status) status = response ? 'resolved' : 'pending';
        if (!['pending', 'resolved', 'dismissed'].includes(status)) status = 'pending';

        return {
          _id: id,
          tournament_id: tournamentId,
          tournament_name: tournamentsById.get(tournamentId) || c?.tournament_name || 'N/A',
          subject: (c?.subject || 'Tournament Complaint').toString(),
          message,
          status,
          response,
          created_at: createdAt,
          resolved_at: resolvedAt
        };
      })
      .sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });

    return { complaints };
  }
};

module.exports = ComplaintsService;
