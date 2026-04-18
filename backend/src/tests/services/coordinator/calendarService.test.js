const { ObjectId } = require('mongodb');

function loadCoordinatorCalendarServiceWithMocks(overrides = {}) {
  jest.resetModules();

  const modelsByName = {
    tournaments: {
      findOne: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
      ...overrides.tournaments
    },
    meetingsdb: {
      findMany: jest.fn(async () => []),
      deleteOne: jest.fn(async () => ({ deletedCount: 0 })),
      ...overrides.meetingsdb
    },
    announcements: {
      findMany: jest.fn(async () => []),
      ...overrides.announcements
    },
    chess_events: {
      findMany: jest.fn(async () => []),
      ...overrides.chess_events
    },
    calendar_events: {
      findMany: jest.fn(async () => []),
      insertOne: jest.fn(async () => ({ insertedId: new ObjectId() })),
      deleteOne: jest.fn(async () => ({ deletedCount: 0 })),
      ...overrides.calendar_events
    }
  };

  const coordinatorUtils = {
    safeTrim: (v) => String(v == null ? '' : v).trim(),
    parseDateValue: (raw) => {
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? null : d;
    },
    isPastDate: (d) => new Date(d).getTime() < Date.now(),
    isAllowedMeetingLink: (link) => /meet\.google\.com|zoom\.us/i.test(String(link || '')),
    getCoordinatorOwnerIdentifiers: jest.fn(async (_db, user) => [user?.username || user?.email].filter(Boolean)),
    requireCoordinator: (user) => {
      if (!user?.email) throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
      if (user.role !== 'coordinator') throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
    },
    ...overrides.coordinatorUtils
  };

  jest.doMock('../../../models', () => ({
    getModel: (name) => {
      const model = modelsByName[name];
      if (!model) throw new Error(`Unexpected model: ${name}`);
      return model;
    }
  }));
  jest.doMock('../../../services/coordinator/coordinatorUtils', () => coordinatorUtils);

  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});

  // eslint-disable-next-line global-require
  const CalendarService = require('../../../services/coordinator/calendarService');
  return { CalendarService, modelsByName, coordinatorUtils };
}

describe('coordinator/calendarService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('createCalendarEvent validates required fields and formats', async () => {
    const { CalendarService } = loadCoordinatorCalendarServiceWithMocks();
    const user = { email: 'c@example.com', role: 'coordinator', username: 'coord' };

    await expect(CalendarService.createCalendarEvent({}, user, { body: {} }))
      .rejects
      .toMatchObject({ statusCode: 400 });

    await expect(CalendarService.createCalendarEvent({}, user, { body: { title: 'T', date: '2025-01-01', time: 'bad' } }))
      .rejects
      .toMatchObject({ statusCode: 400, message: 'Invalid time format (use HH:MM)' });
  });

  test('createCalendarEvent rejects disallowed meeting links and inserts on success', async () => {
    const insertedId = new ObjectId();
    const { CalendarService, modelsByName } = loadCoordinatorCalendarServiceWithMocks({
      calendar_events: { insertOne: jest.fn(async () => ({ insertedId })) },
      coordinatorUtils: {
        isPastDate: () => false
      }
    });
    const user = { email: 'c@example.com', role: 'coordinator', username: 'coord' };

    await expect(CalendarService.createCalendarEvent({}, user, {
      body: { title: 'T', description: 'D', date: '2026-12-01', time: '10:00', type: 'meeting', link: 'https://evil.com' }
    })).rejects.toMatchObject({ statusCode: 400 });

    const ok = await CalendarService.createCalendarEvent({}, user, {
      body: { title: 'T', description: 'D', date: '2026-12-01', time: '10:00', type: 'meeting', link: 'https://meet.google.com/abc' }
    });
    expect(modelsByName.calendar_events.insertOne).toHaveBeenCalledTimes(1);
    expect(ok).toMatchObject({ success: true, event: { _id: insertedId.toString(), title: 'T' } });
  });

  test('deleteCalendarEvent deletes calendar event or meeting, blocks tournament deletes', async () => {
    const id = new ObjectId();
    const user = { email: 'c@example.com', role: 'coordinator', username: 'coord' };

    const { CalendarService } = loadCoordinatorCalendarServiceWithMocks();
    await expect(CalendarService.deleteCalendarEvent({}, user, { id: 'bad' }))
      .rejects
      .toMatchObject({ statusCode: 400 });

    // Calendar delete succeeds
    const { CalendarService: S1 } = loadCoordinatorCalendarServiceWithMocks({
      calendar_events: { deleteOne: jest.fn(async () => ({ deletedCount: 1 })) }
    });
    const r1 = await S1.deleteCalendarEvent({}, user, { id: id.toString() });
    expect(r1).toMatchObject({ success: true });

    // Meeting delete succeeds
    const { CalendarService: S2 } = loadCoordinatorCalendarServiceWithMocks({
      calendar_events: { deleteOne: jest.fn(async () => ({ deletedCount: 0 })) },
      meetingsdb: { deleteOne: jest.fn(async () => ({ deletedCount: 1 })) }
    });
    const r2 = await S2.deleteCalendarEvent({}, user, { id: id.toString() });
    expect(r2).toMatchObject({ success: true });

    // Tournament found => 400
    const { CalendarService: S3 } = loadCoordinatorCalendarServiceWithMocks({
      calendar_events: { deleteOne: jest.fn(async () => ({ deletedCount: 0 })) },
      meetingsdb: { deleteOne: jest.fn(async () => ({ deletedCount: 0 })) },
      tournaments: { findOne: jest.fn(async () => ({ _id: id })) }
    });
    await expect(S3.deleteCalendarEvent({}, user, { id: id.toString() }))
      .rejects
      .toMatchObject({ statusCode: 400 });
  });

  test('checkDateConflict reports conflicts and supports exclusion', async () => {
    const tid = new ObjectId();
    const user = { email: 'c@example.com', role: 'coordinator', username: 'coord' };

    const { CalendarService } = loadCoordinatorCalendarServiceWithMocks();
    await expect(CalendarService.checkDateConflict({}, user, { payload: {} }))
      .rejects
      .toMatchObject({ statusCode: 400 });

    const { CalendarService: S1 } = loadCoordinatorCalendarServiceWithMocks({
      tournaments: { findOne: jest.fn(async () => null) }
    });
    const no = await S1.checkDateConflict({}, user, { payload: { date: '2026-12-01' } });
    expect(no).toEqual({ conflict: false, conflictDetails: null });

    const { CalendarService: S2, modelsByName } = loadCoordinatorCalendarServiceWithMocks({
      tournaments: { findOne: jest.fn(async () => ({ _id: tid, name: 'T1', time: '10:00' })) }
    });
    const yes = await S2.checkDateConflict({}, user, { payload: { date: '2026-12-01', excludeTournamentId: tid.toString() } });
    expect(modelsByName.tournaments.findOne).toHaveBeenCalled();
    expect(yes.conflict).toBe(true);
    expect(yes.conflictDetails).toMatchObject({ type: 'tournament', name: 'T1' });
  });
});

