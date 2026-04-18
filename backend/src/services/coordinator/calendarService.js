const { connectDB } = require('../../config/database');
const { ObjectId } = require('mongodb');
const { safeTrim, parseDateValue, isPastDate, isAllowedMeetingLink, getCoordinatorOwnerIdentifiers, requireCoordinator } = require('./coordinatorUtils');
const { getModel } = require('../../models');
const TournamentModel = getModel('tournaments');
const MeetingsModel = getModel('meetingsdb');
const AnnouncementsModel = getModel('announcements');
const ChessEventsModel = getModel('chess_events');
const CalendarEventsModel = getModel('calendar_events');

const createError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const resolveDb = async (db) => (db ? db : connectDB());

const CalendarService = {
  async getCalendarEvents(db, user, { query }) {
    requireCoordinator(user);
    const database = await resolveDb(db);
    const { all, year, month } = query || {};
    const ownerIdentifiers = await getCoordinatorOwnerIdentifiers(database, user);
    const ownerIdentifiersLower = ownerIdentifiers.map((v) => v.toLowerCase());
    const includeAll = all === 'true';

    const yearNum = Number.parseInt(year, 10);
    const monthNum = Number.parseInt(month, 10);
    let rangeStart = null;
    let rangeEnd = null;
    if (!Number.isNaN(yearNum) && !Number.isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
      rangeStart = new Date(yearNum, monthNum - 1, 1);
      rangeEnd = new Date(yearNum, monthNum, 1);
    }

    const tournamentQuery = {
      status: { $nin: ['Removed', 'Rejected'] }
    };
    if (rangeStart && rangeEnd) {
      tournamentQuery.date = { $gte: rangeStart, $lt: rangeEnd };
    }
    if (!includeAll) {
      tournamentQuery.coordinator = { $in: ownerIdentifiers };
    }

    const meetingQuery = { role: 'coordinator' };
    if (rangeStart && rangeEnd) {
      meetingQuery.date = { $gte: rangeStart, $lt: rangeEnd };
    }
    if (!includeAll) {
      meetingQuery.$or = [
        { name: { $in: ownerIdentifiers } },
        { created_by: { $in: ownerIdentifiers } }
      ];
    }

    const announcementQuery = { is_active: { $ne: false } };
    if (rangeStart && rangeEnd) {
      announcementQuery.posted_date = { $gte: rangeStart, $lt: rangeEnd };
    }
    if (!includeAll) {
      announcementQuery.posted_by = { $in: ownerIdentifiers };
    }

    const calendarQuery = { role: 'coordinator' };
    if (rangeStart && rangeEnd) {
      calendarQuery.date = { $gte: rangeStart, $lt: rangeEnd };
    }
    if (!includeAll) {
      calendarQuery.created_by = { $in: ownerIdentifiers };
    }

    const [tournaments, meetings, announcements, chessEvents, calendarEvents] = await Promise.all([
      TournamentModel.findMany(
        database,
        tournamentQuery,
        {
          projection: {
            name: 1,
            date: 1,
            time: 1,
            location: 1,
            description: 1,
            status: 1,
            type: 1,
            coordinator: 1
          }
        }
      ),
      MeetingsModel.findMany(
        database,
        meetingQuery,
        {
          projection: {
            title: 1,
            description: 1,
            date: 1,
            time: 1,
            link: 1,
            type: 1,
            name: 1,
            created_by: 1
          }
        }
      ),
      AnnouncementsModel.findMany(
        database,
        announcementQuery,
        {
          projection: {
            title: 1,
            message: 1,
            posted_date: 1,
            posted_by: 1,
            target_role: 1,
            is_active: 1
          }
        }
      ),
      ChessEventsModel.findMany(
        database,
        rangeStart && rangeEnd ? { date: { $gte: rangeStart, $lt: rangeEnd } } : {},
        {
          projection: {
            title: 1,
            description: 1,
            date: 1,
            category: 1,
            location: 1,
            link: 1,
            coordinatorName: 1,
            coordinatorId: 1,
            active: 1
          }
        }
      ),
      CalendarEventsModel.findMany(
        database,
        calendarQuery,
        {
          projection: {
            title: 1,
            description: 1,
            date: 1,
            time: 1,
            link: 1,
            type: 1,
            name: 1,
            created_by: 1,
            created_date: 1
          }
        }
      )
    ]);

    const mappedTournaments = tournaments.map((t) => ({
      ...t,
      _id: t._id.toString(),
      title: t.name || 'Tournament',
      description: t.description || (t.location ? `Location: ${t.location}` : ''),
      type: 'tournament',
      source: 'tournament',
      isMine: ownerIdentifiersLower.includes(String(t.coordinator || '').trim().toLowerCase())
    }));

    const mappedMeetings = meetings.map((m) => ({
      ...m,
      _id: m._id.toString(),
      type: safeTrim(m.type || 'meeting').toLowerCase() || 'meeting',
      source: 'meeting',
      isMine: ownerIdentifiersLower.includes(String(m.name || m.created_by || '').trim().toLowerCase())
    }));

    const mappedAnnouncements = (announcements || []).map((a) => ({
      ...a,
      _id: a._id.toString(),
      title: safeTrim(a.title) || 'Announcement',
      description: safeTrim(a.message),
      date: a.posted_date || new Date(),
      type: 'announcement',
      source: 'announcement',
      isMine: ownerIdentifiersLower.includes(String(a.posted_by || '').trim().toLowerCase())
    }));

    const mappedChessEvents = (chessEvents || [])
      .filter((ev) => ev?.active !== false)
      .map((ev) => {
        const ownerKey = String(ev.coordinatorName || ev.coordinatorId || '').trim().toLowerCase();
        return {
          ...ev,
          _id: ev._id.toString(),
          date: ev.date || new Date(),
          time: ev.time || '',
          type: 'chess event',
          source: 'chess_event',
          isMine: ownerIdentifiersLower.includes(ownerKey)
        };
      });

    const mappedCalendarEvents = (calendarEvents || []).map((ev) => {
      const ownerKey = String(ev.created_by || ev.name || '').trim().toLowerCase();
      return {
        ...ev,
        _id: ev._id.toString(),
        title: safeTrim(ev.title) || 'Event',
        description: safeTrim(ev.description),
        date: ev.date || new Date(),
        time: ev.time || '',
        type: safeTrim(ev.type || 'other').toLowerCase() || 'other',
        source: 'calendar',
        isMine: ownerIdentifiersLower.includes(ownerKey)
      };
    });

    const events = [
      ...mappedTournaments,
      ...mappedMeetings,
      ...mappedAnnouncements,
      ...mappedChessEvents,
      ...mappedCalendarEvents
    ]
      .filter((event) => includeAll || event.isMine)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return {
      events,
      tournaments: mappedTournaments,
      meetings: mappedMeetings,
      announcements: mappedAnnouncements,
      chessEvents: mappedChessEvents,
      calendarEvents: mappedCalendarEvents
    };
  },

  async createCalendarEvent(db, user, { body }) {
    requireCoordinator(user);
    const { title, description, date, time, type, link } = body || {};
    const eventTitle = safeTrim(title);
    const eventDescription = safeTrim(description);
    const eventTime = safeTrim(time);
    const eventType = safeTrim(type).toLowerCase() || 'meeting';
    const eventLink = safeTrim(link);

    if (!eventTitle || !date || !eventTime) {
      throw createError('Title, date, and time are required', 400);
    }
    if (!/^\d{2}:\d{2}$/.test(eventTime)) {
      throw createError('Invalid time format (use HH:MM)', 400);
    }

    const eventDate = parseDateValue(date);
    if (!eventDate) throw createError('Invalid event date', 400);
    if (isPastDate(eventDate)) throw createError('Date cannot be in the past', 400);

    const allowedTypes = new Set(['meeting', 'tournament', 'announcement', 'deadline', 'reminder', 'other']);
    const normalizedType = allowedTypes.has(eventType) ? eventType : 'meeting';

    if (eventLink && normalizedType === 'meeting' && !isAllowedMeetingLink(eventLink)) {
      throw createError('Only Google Meet or Zoom links are allowed for meetings', 400);
    }

    const coordinatorEmail = safeTrim(user?.email);
    const coordinatorName = safeTrim(user?.username || user?.email);

    const eventDoc = {
      title: eventTitle,
      description: eventDescription,
      date: eventDate,
      time: eventTime,
      link: eventLink || '',
      type: normalizedType,
      source: 'calendar',
      role: 'coordinator',
      name: coordinatorName,
      created_by: coordinatorEmail,
      created_date: new Date()
    };

    const database = await resolveDb(db);
    const result = await CalendarEventsModel.insertOne(database, eventDoc);

    return {
      success: true,
      message: 'Event created successfully',
      event: {
        ...eventDoc,
        _id: result.insertedId.toString()
      }
    };
  },

  async deleteCalendarEvent(db, user, { id }) {
    requireCoordinator(user);
    if (!ObjectId.isValid(id)) throw createError('Invalid event ID', 400);
    const database = await resolveDb(db);
    const ownerIdentifiers = await getCoordinatorOwnerIdentifiers(database, user);

    const calendarDelete = await CalendarEventsModel.deleteOne(database, {
      _id: new ObjectId(id),
      role: 'coordinator',
      created_by: { $in: ownerIdentifiers }
    });

    if (calendarDelete.deletedCount > 0) {
      return { success: true, message: 'Event deleted successfully' };
    }

    const meetingDelete = await MeetingsModel.deleteOne(database, {
      _id: new ObjectId(id),
      role: 'coordinator',
      $or: [
        { name: { $in: ownerIdentifiers } },
        { created_by: { $in: ownerIdentifiers } }
      ]
    });

    if (meetingDelete.deletedCount > 0) {
      return { success: true, message: 'Event deleted successfully' };
    }

    const tournament = await TournamentModel.findOne(database, {
      _id: new ObjectId(id),
      coordinator: { $in: ownerIdentifiers }
    });
    if (tournament) {
      throw createError('Tournament events cannot be deleted from calendar. Use Tournament Management.', 400);
    }

    throw createError('Event not found or access denied', 404);
  },

  async checkDateConflict(db, user, { payload }) {
    requireCoordinator(user);
    const { date, excludeTournamentId } = payload || {};
    if (!date) throw createError('Date is required', 400);

    const targetDate = parseDateValue(date);
    if (!targetDate) throw createError('Invalid date format', 400);

    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const database = await resolveDb(db);
    const ownerIdentifiers = await getCoordinatorOwnerIdentifiers(database, user);

    const query = {
      coordinator: { $in: ownerIdentifiers },
      date: { $gte: dayStart, $lt: dayEnd },
      status: { $nin: ['Removed', 'Rejected', 'Completed'] }
    };

    if (excludeTournamentId && ObjectId.isValid(excludeTournamentId)) {
      query._id = { $ne: new ObjectId(excludeTournamentId) };
    }

    const conflictingTournament = await TournamentModel.findOne(database, query);

    let conflict = false;
    let conflictDetails = null;
    if (conflictingTournament) {
      conflict = true;
      conflictDetails = {
        type: 'tournament',
        name: conflictingTournament.name,
        time: conflictingTournament.time
      };
    }

    return { conflict, conflictDetails };
  }
};

module.exports = CalendarService;
