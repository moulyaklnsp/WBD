const { connectDB } = require('../../config/database');
const moment = require('moment');
const { safeTrim, parseDateValue, isPastDate, isAllowedMeetingLink, requireCoordinator } = require('./coordinatorUtils');
const { getModel } = require('../../models');
const MeetingsModel = getModel('meetingsdb');
const { normalizeKey } = require('../../utils/mongo');

const createError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const resolveDb = async (db) => (db ? db : connectDB());

const MeetingsService = {
  async scheduleMeeting(db, user, { body }) {
    requireCoordinator(user);
    const meetingTitle = safeTrim(body?.title);
    const meetingTime = safeTrim(body?.time);
    const meetingLink = safeTrim(body?.link);
    const meetingDate = parseDateValue(body?.date);

    const userName = user?.username || user?.email;

    if (!meetingTitle || !body?.date || !meetingTime || !meetingLink) {
      throw createError('Title, date, time, and meeting link are required', 400);
    }
    if (!meetingDate) throw createError('Invalid meeting date', 400);
    if (!/^\d{2}:\d{2}$/.test(meetingTime)) {
      throw createError('Invalid meeting time format (use HH:MM)', 400);
    }
    if (isPastDate(meetingDate)) {
      throw createError('Date cannot be in the past', 400);
    }
    if (!isAllowedMeetingLink(meetingLink)) {
      throw createError('Only Google Meet or Zoom links are allowed', 400);
    }

    const meeting = {
      title: meetingTitle,
      date: meetingDate,
      time: meetingTime,
      link: meetingLink,
      type: 'meeting',
      source: 'meeting',
      role: 'coordinator',
      name: userName.toString(),
      name_key: normalizeKey(userName),
      created_by: user?.email || userName.toString(),
      created_by_key: normalizeKey(user?.email || userName)
    };

    const database = await resolveDb(db);
    const result = await MeetingsModel.insertOne(database, meeting);

    if (result.insertedId) {
      return { success: true, message: 'Meeting scheduled successfully' };
    }

    throw createError('Failed to schedule meeting', 500);
  },

  async getOrganizedMeetings(db, user) {
    requireCoordinator(user);
    const database = await resolveDb(db);
    const username = user?.username || user?.email;
    const meetingTypeFilter = {
      $or: [
        { type: { $exists: false } },
        { type: null },
        { type: '' },
        { type: 'meeting' }
      ]
    };
    const sourceFilter = {
      $or: [
        { source: { $exists: false } },
        { source: { $ne: 'calendar' } }
      ]
    };

    return MeetingsModel.findMany(
      database,
      {
        role: 'coordinator',
        name: username,
        $and: [meetingTypeFilter, sourceFilter]
      },
      { sort: { date: 1, time: 1 } }
    );
  },

  async getUpcomingMeetings(db, user) {
    requireCoordinator(user);
    const database = await resolveDb(db);
    const username = user?.username || user?.email;
    const today = new Date();
    const threeDaysLater = moment().add(3, 'days').toDate();
    const meetingTypeFilter = {
      $or: [
        { type: { $exists: false } },
        { type: null },
        { type: '' },
        { type: 'meeting' }
      ]
    };
    const sourceFilter = {
      $or: [
        { source: { $exists: false } },
        { source: { $ne: 'calendar' } }
      ]
    };

    return MeetingsModel.findMany(
      database,
      {
        date: { $gte: today, $lte: threeDaysLater },
        name: { $ne: username },
        $and: [meetingTypeFilter, sourceFilter]
      },
      { sort: { date: 1, time: 1 } }
    );
  },

  async getReceivedMeetings(db, user) {
    requireCoordinator(user);
    const database = await resolveDb(db);
    const userEmail = user?.email;
    const meetings = await MeetingsModel.findMany(
      database,
      {
        name: userEmail,
        role: 'coordinator'
      },
      { sort: { date: -1, time: -1 } }
    );

    return { meetings };
  }
};

module.exports = MeetingsService;
