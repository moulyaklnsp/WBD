import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import '../../styles/playerNeoNoir.css';
import { motion } from 'framer-motion';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import AnimatedSidebar from '../../components/AnimatedSidebar';
import { coordinatorLinks } from '../../constants/coordinatorLinks';
import { fetchAsCoordinator } from '../../utils/fetchWithRole';

const sectionVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.97 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: i * 0.12,
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1]
    }
  })
};

function EventCalendar() {
  const [isDark, toggleTheme] = usePlayerTheme();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [showEventForm, setShowEventForm] = useState(false);
  const [scopeFilter, setScopeFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    type: 'meeting',
    customType: ''
  });
  const [searchParams] = useSearchParams();
  const tournamentId = searchParams.get('tournament_id');

  const showMessage = (text, type = 'success') => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };
  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const res = await fetchAsCoordinator(`/coordinator/api/calendar?year=${year}&month=${month}&all=true`);
      const data = await res.json();
      if (res.ok) {
        const combined = Array.isArray(data.events)
          ? data.events
          : [
              ...(data.tournaments || []),
              ...(data.meetings || []),
              ...(data.announcements || []),
              ...(data.chessEvents || [])
            ];

        const normalized = combined.map((event, idx) => ({
          ...event,
          _id: event._id || event.id || `${event.source || 'event'}-${idx}`,
          date: event.date || event.posted_date || event.created_date,
          time: event.time || '',
          title: event.title || event.name || event.tournament_name || 'Event',
          description: event.description || event.message || '',
          type: (event.type || event.category || event.source || 'other').toString().toLowerCase(),
          source: (event.source || 'event').toString().toLowerCase(),
          isMine: event.isMine !== false
        }));

        // Deduplicate events by _id in case they appear multiple times
        const uniqueNormalized = Array.from(
          new Map(normalized.map(e => [e._id, e])).values()
        );

        const filteredEvents = tournamentId
          ? uniqueNormalized.filter((event) => event._id === tournamentId || event.type !== 'tournament')
          : uniqueNormalized;
        setEvents(filteredEvents);
        setError('');
      } else {
        setError(data.message || 'Failed to fetch events');
      }
    } catch (err) {
      console.error('Error fetching events:', err);
      setError('Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [currentDate, tournamentId]);

  useEffect(() => {
    fetchEvents();
  }, [currentDate, fetchEvents]);

  const createEvent = async () => {
    if (!eventForm.title.trim() || !eventForm.date || !eventForm.time) {
      showMessage('Please fill in all required fields', 'error');
      return;
    }
    const eventDate = new Date(eventForm.date);
    if (Number.isNaN(eventDate.getTime())) {
      showMessage('Invalid event date', 'error');
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    eventDate.setHours(0, 0, 0, 0);
    if (eventDate < today) {
      showMessage('Date cannot be in the past', 'error');
      return;
    }
    const maxDate = new Date();
    maxDate.setHours(0, 0, 0, 0);
    maxDate.setFullYear(maxDate.getFullYear() + 1);
    if (eventDate > maxDate) {
      showMessage('Date must be within 1 year from today', 'error');
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(eventForm.time.trim())) {
      showMessage('Invalid time format (use HH:MM)', 'error');
      return;
    }

    try {
      const payload = {
        title: eventForm.title.trim(),
        description: eventForm.description.trim(),
        date: eventForm.date,
        time: eventForm.time.trim(),
        type: eventForm.type === 'other' && eventForm.customType.trim() ? eventForm.customType.trim().toLowerCase() : (eventForm.type || 'meeting')
      };
      const res = await fetchAsCoordinator('/coordinator/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        showMessage('Event created successfully', 'success');
        setShowEventForm(false);
        setEventForm({ title: '', description: '', date: '', time: '', type: 'meeting', customType: '' });
        await fetchEvents();
      } else {
        showMessage(data.message || 'Failed to create event', 'error');
      }
    } catch (err) {
      console.error('Error creating event:', err);
      showMessage('Failed to create event', 'error');
    }
  };

  const deleteEvent = async (eventId) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;

    try {
      const res = await fetchAsCoordinator(`/coordinator/api/calendar/${eventId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        showMessage('Event deleted successfully', 'success');
        await fetchEvents();
      } else {
        showMessage(data.message || 'Failed to delete event', 'error');
      }
    } catch (err) {
      console.error('Error deleting event:', err);
      showMessage('Failed to delete event', 'error');
    }
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const visibleEvents = useMemo(() => {
    return events.filter((event) => {
      const scopeOk = scopeFilter === 'all' || !!event.isMine;
      const typeOk = typeFilter === 'all' || event.type === typeFilter || event.source === typeFilter;
      return scopeOk && typeOk;
    });
  }, [events, scopeFilter, typeFilter]);

  const availableTypeOptions = useMemo(() => {
    const keys = new Set(['tournament', 'meeting', 'announcement', 'deadline', 'reminder', 'chess event', 'other']);
    events.forEach((event) => {
      if (event.type) keys.add(event.type);
      if (event.source) keys.add(event.source);
    });
    return Array.from(keys)
      .map((value) => value.toString().trim().toLowerCase())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [events]);

  const getEventsForDate = (date) => {
    if (!date) return [];
    return visibleEvents.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  const navigateMonth = (direction) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + direction);
      return newDate;
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayForInput = new Date();
  const minDateInput = `${todayForInput.getFullYear()}-${String(todayForInput.getMonth() + 1).padStart(2, '0')}-${String(todayForInput.getDate()).padStart(2, '0')}`;
  const maxDateInputDate = new Date(todayForInput);
  maxDateInputDate.setFullYear(maxDateInputDate.getFullYear() + 1);
  const maxDateInput = `${maxDateInputDate.getFullYear()}-${String(maxDateInputDate.getMonth() + 1).padStart(2, '0')}-${String(maxDateInputDate.getDate()).padStart(2, '0')}`;

  const getEventClass = (event) => {
    const key = `${event?.type || ''} ${event?.source || ''}`.toLowerCase();
    if (key.includes('tournament')) return 'event-tournament';
    if (key.includes('meeting')) return 'event-meeting';
    if (key.includes('announcement') || key.includes('chess_event') || key.includes('chess event')) return 'event-announcement';
    if (key.includes('deadline')) return 'event-deadline';
    if (key.includes('reminder')) return 'event-reminder';
    return 'event-other';
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; }
        body, #root { min-height: 100vh; }
        .page { font-family: 'Playfair Display', serif; background-color: var(--page-bg); min-height: 100vh; display:flex; color: var(--text-color); }
        .content { flex-grow:1; margin-left:0; padding:2rem; }
        h1 { font-family:'Cinzel', serif; color:var(--sea-green); margin-bottom:2rem; font-size:2.5rem; display:flex; align-items:center; gap:1rem; }
        .calendar-container { background:var(--card-bg); border-radius:15px; padding:2rem; margin-bottom:2rem; box-shadow:none; border:1px solid var(--card-border); }
        .calendar-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
        .calendar-nav { display: flex; align-items: center; gap: 1rem; }
        .nav-btn { background: var(--sea-green); color: var(--on-accent); border: none; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; }
        .calendar-title { font-family: 'Cinzel', serif; font-size: 2rem; color: var(--sea-green); }
        .calendar-filters { display:flex; gap:0.75rem; flex-wrap:wrap; margin-bottom:1rem; }
        .filter-select { min-width: 180px; padding: 0.65rem 0.75rem; border-radius: 8px; border: 1px solid var(--card-border); background: var(--card-bg); color: var(--text-color); font-family: 'Playfair Display', serif; }
        .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; background: var(--card-border); border-radius: 8px; overflow: hidden; }
        .calendar-day-header { background: var(--sea-green); color: var(--on-accent); padding: 1rem; text-align: center; font-family: 'Cinzel', serif; font-weight: bold; }
        .calendar-day { background: var(--card-bg); min-height: 120px; padding: 0.5rem; position: relative; cursor: pointer; transition: background-color 0.3s ease; }
        .calendar-day:hover { background: rgba(var(--sea-green-rgb, 27, 94, 63), 0.05); }
        .calendar-day.today { background: rgba(var(--sea-green-rgb, 27, 94, 63), 0.1); border: 2px solid var(--sea-green); }
        .calendar-day-number { font-size: 1.2rem; font-weight: bold; margin-bottom: 0.5rem; color: var(--text-color); }
        .event-item { background: var(--sky-blue); color: var(--on-accent); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem; margin-bottom: 0.2rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .event-tournament { background: var(--sea-green); }
        .event-meeting { background: #ff9800; }
        .event-announcement { background: #1d7ea8; }
        .event-deadline { background: #c62828; }
        .event-reminder { background: #6b7f93; }
        .event-other { background: #607d8b; }
        .event-form { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 8px; padding: 1.5rem; margin-top: 1rem; }
        .form-group { margin-bottom: 1rem; }
        .form-label { font-family:'Cinzel', serif; color:var(--sea-green); margin-bottom:8px; display:block; }
        .form-input { width:100%; padding:0.8rem; border:2px solid var(--sea-green); border-radius:8px; font-family:'Playfair Display', serif; background:var(--card-bg); color:var(--text-color); }
        .form-textarea { width:100%; padding:0.8rem; border:2px solid var(--sea-green); border-radius:8px; font-family:'Playfair Display', serif; background:var(--card-bg); color:var(--text-color); min-height: 100px; resize: vertical; }
        .btn-primary { background:var(--sea-green); color:var(--on-accent); border:none; padding:1rem; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; display:flex; align-items:center; gap:0.5rem; width:fit-content; }
        .btn-secondary { background:var(--sky-blue); color:var(--on-accent); border:none; padding:1rem; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; display:flex; align-items:center; gap:0.5rem; width:fit-content; }
        .message { margin-bottom:1rem; padding:0.75rem 1rem; border-radius:8px; }
        .message.success { color:#1b5e20; background:rgba(76,175,80,0.15); }
        .message.error { color:#c62828; background:rgba(198,40,40,0.15); }
        .event-details { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 8px; padding: 1rem; margin-top: 1rem; }
        .event-actions { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
        .delete-btn { background: #c62828; color: white; border: none; padding: 0.3rem 0.6rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem; }
        @media (max-width: 768px) {
          .calendar-header { flex-direction: column; align-items: flex-start; gap: 1rem; }
        }
      `}</style>

      <div className="page player-neo">
        <motion.div
          className="chess-knight-float"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 0.14, scale: 1 }}
          transition={{ delay: 0.9, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 0, fontSize: '2.5rem', color: 'var(--sea-green)' }}
          aria-hidden="true"
        >
          <i className="fas fa-chess-rook" />
        </motion.div>

        <AnimatedSidebar links={coordinatorLinks} logo={<i className="fas fa-chess" />} title={`ChessHive`} />

        <div className="coordinator-dash-header" style={{ position: 'fixed', top: 18, right: 18, zIndex: 1001, display: 'flex', gap: '12px', alignItems: 'center' }}>
          <motion.button
            type="button"
            onClick={toggleTheme}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              color: 'var(--text-color)',
              width: 40,
              height: 40,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1.1rem'
            }}
          >
            <i className={isDark ? 'fas fa-sun' : 'fas fa-moon'} />
          </motion.button>
        </div>

        <div className="content">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <i className="fas fa-calendar" /> Unified Event Calendar
          </motion.h1>

          <motion.div
            className="calendar-container"
            custom={0}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
          >
            {message && (
              <div className={`message ${message.type}`}>
                <i className={`fas ${message.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`} /> {message.text}
              </div>
            )}

            <div className="calendar-header">
              <div className="calendar-nav">
                <button className="nav-btn" onClick={() => navigateMonth(-1)}>
                  <i className="fas fa-chevron-left" />
                </button>
                <h2 className="calendar-title">
                  {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h2>
                <button className="nav-btn" onClick={() => navigateMonth(1)}>
                  <i className="fas fa-chevron-right" />
                </button>
              </div>
              <button className="btn-primary" onClick={() => setShowEventForm(!showEventForm)}>
                <i className="fas fa-plus" /> Add Event
              </button>
            </div>

            <div className="calendar-filters">
              <select
                className="filter-select"
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e.target.value)}
              >
                <option value="all">All Coordinators</option>
                <option value="mine">My Events</option>
              </select>
              <select
                className="filter-select"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="all">All Event Types</option>
                {availableTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type.split('_').join(' ').replace(/\b\w/g, (ch) => ch.toUpperCase())}
                  </option>
                ))}
              </select>
              <div style={{ display: 'flex', alignItems: 'center', opacity: 0.75, fontSize: '0.9rem' }}>
                Showing {visibleEvents.length} event{visibleEvents.length === 1 ? '' : 's'}
              </div>
            </div>

            {showEventForm && (
              <motion.div
                className="event-form"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <h3 style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', marginBottom: '1rem' }}>Create New Event</h3>
                <div className="form-group">
                  <label className="form-label">Title:</label>
                  <input
                    type="text"
                    className="form-input"
                    value={eventForm.title}
                    onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                    placeholder="Event title"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Description:</label>
                  <textarea
                    className="form-textarea"
                    value={eventForm.description}
                    onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                    placeholder="Event description"
                  />
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Date:</label>
                    <input
                      type="date"
                      className="form-input"
                      value={eventForm.date}
                      min={minDateInput}
                      max={maxDateInput}
                      onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Time:</label>
                    <input
                      type="time"
                      className="form-input"
                      value={eventForm.time}
                      onChange={(e) => setEventForm({ ...eventForm, time: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Type:</label>
                  <select
                    className="form-input"
                    value={eventForm.type}
                    onChange={(e) => setEventForm({ ...eventForm, type: e.target.value })}
                  >
                    <option value="meeting">Meeting</option>
                    <option value="tournament">Tournament</option>
                    <option value="announcement">Announcement</option>
                    <option value="deadline">Deadline</option>
                    <option value="reminder">Reminder</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                {eventForm.type === 'other' && (
                  <div className="form-group">
                    <label className="form-label">Specify Event Type:</label>
                    <input
                      type="text"
                      className="form-input"
                      value={eventForm.customType}
                      onChange={(e) => setEventForm({ ...eventForm, customType: e.target.value })}
                      placeholder="E.g. Workshop"
                    />
                  </div>
                )}
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button className="btn-primary" onClick={createEvent}>
                    <i className="fas fa-save" /> Create Event
                  </button>
                  <button className="btn-secondary" onClick={() => setShowEventForm(false)}>
                    <i className="fas fa-times" /> Cancel
                  </button>
                </div>
              </motion.div>
            )}

            {loading && <div>Loading calendar...</div>}
            {!loading && error && (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--sea-green)', fontStyle: 'italic' }}>
                <i className="fas fa-info-circle" /> {error}
              </div>
            )}
            {!loading && !error && (
              <div className="calendar-grid">
                {dayNames.map(day => (
                  <div key={day} className="calendar-day-header">{day}</div>
                ))}
                {getDaysInMonth(currentDate).map((date, index) => (
                  <div
                    key={index}
                    className={`calendar-day ${date && date.toDateString() === new Date().toDateString() ? 'today' : ''}`}
                    onClick={() => date && setSelectedDate(date)}
                  >
                    {date && (
                      <>
                        <div className="calendar-day-number">{date.getDate()}</div>
                        <div>
                          {getEventsForDate(date).map(event => (
                            <div
                              key={event._id}
                              className={`event-item ${getEventClass(event)}`}
                              title={`${event.title || event.name || 'Event'} - ${event.description || ''}`}
                            >
                              {event.title || event.name || 'Event'}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {selectedDate && (
              <motion.div
                className="event-details"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <h3 style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', marginBottom: '1rem' }}>
                  Events for {formatDate(selectedDate)}
                </h3>
                {getEventsForDate(selectedDate).length === 0 ? (
                  <p>No events scheduled for this date.</p>
                ) : (
                  getEventsForDate(selectedDate).map(event => (
                    <div key={event._id} style={{ marginBottom: '1rem', padding: '1rem', background: 'rgba(var(--sea-green-rgb, 27, 94, 63), 0.05)', borderRadius: '8px' }}>
                      <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--sea-green)' }}>{event.title || event.name || 'Event'}</h4>
                      <p style={{ margin: '0 0 0.5rem 0' }}>{event.description}</p>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-color)', opacity: 0.7 }}>
                        <div><strong>Time:</strong> {event.time || 'N/A'}</div>
                        <div><strong>Type:</strong> {event.type || 'event'}</div>
                        <div><strong>Source:</strong> {event.source || 'event'}</div>
                      </div>
                      {(event.source === 'meeting' || event.source === 'calendar') && event.isMine && (
                        <div className="event-actions">
                          <button className="delete-btn" onClick={() => deleteEvent(event._id)}>
                            <i className="fas fa-trash" /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
                <button
                  className="btn-secondary"
                  onClick={() => setSelectedDate(null)}
                  style={{ marginTop: '1rem' }}
                >
                  <i className="fas fa-times" /> Close
                </button>
              </motion.div>
            )}
          </motion.div>

          <div style={{ textAlign: 'right', marginTop: '2rem' }}>
            <Link to="/coordinator/coordinator_dashboard" className="back-to-dashboard">
              <i className="fas fa-arrow-left" /> Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EventCalendar;


