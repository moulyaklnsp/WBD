import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import '../../styles/playerNeoNoir.css';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchAsCoordinator } from '../../utils/fetchWithRole';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import AnimatedSidebar from '../../components/AnimatedSidebar';
import { coordinatorLinks } from '../../constants/coordinatorLinks';

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

const modalVariants = {
    hidden: { opacity: 0, scale: 0.85, y: 30 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
    exit: { opacity: 0, scale: 0.85, y: 30, transition: { duration: 0.25 } }
};

const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } },
    exit: { opacity: 0, transition: { duration: 0.25 } }
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const STATUS_COLORS = {
    pending: '#f0c040',
    approved: '#2e7d32',
    ongoing: '#1976d2',
    completed: '#888'
};

function getCalendarDays(year, month) {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days = [];

    // Previous month trailing days
    for (let i = firstDay - 1; i >= 0; i--) {
        days.push({ day: daysInPrevMonth - i, currentMonth: false });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
        days.push({ day: d, currentMonth: true });
    }

    // Next month leading days to fill grid
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
        for (let d = 1; d <= remaining; d++) {
            days.push({ day: d, currentMonth: false });
        }
    }

    return days;
}

function formatDateKey(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function GlobalEventCalendar() {
    const [isDark, toggleTheme] = usePlayerTheme();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [events, setEvents] = useState([]);
    const [conflicts, setConflicts] = useState({});

    const today = new Date();
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [currentMonth, setCurrentMonth] = useState(today.getMonth());

    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedEvents, setSelectedEvents] = useState([]);

    const loadEvents = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            // Pass all=true to fetch events from ALL coordinators
            const res = await fetchAsCoordinator(`/coordinator/api/calendar?year=${currentYear}&month=${currentMonth + 1}&all=true`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to load calendar events');
            setEvents(data.tournaments || []); // The backend change returns { tournaments: [], meetings: [] }
        } catch (e) {
            console.error(e);
            setError('Error loading global calendar events');
        } finally {
            setLoading(false);
        }
    }, [currentYear, currentMonth]);

    useEffect(() => { loadEvents(); }, [loadEvents]);

    // Build a map from date key to events for fast lookup
    const eventsByDate = useMemo(() => {
        const map = {};
        (events || []).forEach(ev => {
            // Support event_date or start_date field
            const dateStr = ev.event_date || ev.start_date || ev.date || '';
            if (!dateStr) return;
            const d = new Date(dateStr);
            const key = formatDateKey(d.getFullYear(), d.getMonth(), d.getDate());
            if (!map[key]) map[key] = [];
            map[key].push(ev);
        });
        return map;
    }, [events]);

    const calendarDays = useMemo(() => getCalendarDays(currentYear, currentMonth), [currentYear, currentMonth]);

    const handlePrevMonth = () => {
        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear(y => y - 1);
        } else {
            setCurrentMonth(m => m - 1);
        }
    };

    const handleNextMonth = () => {
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear(y => y + 1);
        } else {
            setCurrentMonth(m => m + 1);
        }
    };

    const handleDateClick = (day) => {
        if (!day.currentMonth) return;
        const dateKey = formatDateKey(currentYear, currentMonth, day.day);
        setSelectedDate(dateKey);
        setSelectedEvents(eventsByDate[dateKey] || []);
    };

    const closeModal = () => {
        setSelectedDate(null);
        setSelectedEvents([]);
    };

    const todayKey = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());

    return (
        <div style={{ minHeight: '100vh' }}>
            <style>{`
        * { margin:0; padding:0; box-sizing:border-box; }
        body, #root { min-height: 100vh; }
        .page { font-family: 'Playfair Display', serif; background-color: var(--page-bg); min-height: 100vh; display:flex; color: var(--text-color); }
        .content { flex-grow:1; margin-left:0; padding:2rem; }
        h1 { font-family:'Cinzel', serif; color:var(--sea-green); margin-bottom:2rem; font-size:2.5rem; display:flex; align-items:center; gap:1rem; }
        .updates-section { background:var(--card-bg); border-radius:15px; padding:2rem; margin-bottom:2rem; box-shadow:none; border:1px solid var(--card-border); transition: transform 0.3s ease; }
        .updates-section:hover { transform: translateY(-5px); }
        .btn-primary { background:var(--sea-green); color:var(--on-accent); border:none; padding:0.8rem 1.5rem; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; display:inline-flex; align-items:center; gap:0.5rem; text-decoration:none; }
        .error-text { color:#b71c1c; margin-bottom:1rem; text-align:center; }

        .calendar-nav { display:flex; align-items:center; justify-content:space-between; margin-bottom:1.5rem; gap:1rem; flex-wrap:wrap; }
        .calendar-nav h2 { font-family:'Cinzel', serif; color:var(--sea-green); font-size:1.6rem; margin:0; min-width:220px; text-align:center; }
        .nav-btn { background:var(--card-bg); border:1px solid var(--card-border); color:var(--sea-green); width:44px; height:44px; border-radius:10px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:1.2rem; transition: all 0.2s ease; }
        .nav-btn:hover { background:var(--sea-green); color:var(--on-accent); }

        .calendar-grid { display:grid; grid-template-columns:repeat(7, 1fr); gap:4px; }
        .calendar-header-cell { text-align:center; font-family:'Cinzel', serif; font-weight:bold; color:var(--sea-green); padding:0.75rem 0.25rem; font-size:0.85rem; }
        .calendar-cell { position:relative; min-height:80px; background:var(--card-bg); border:1px solid var(--card-border); border-radius:8px; padding:0.5rem; cursor:pointer; transition: all 0.2s ease; }
        .calendar-cell:hover { border-color:var(--sea-green); transform:translateY(-2px); }
        .calendar-cell.outside { opacity:0.35; cursor:default; }
        .calendar-cell.outside:hover { border-color:var(--card-border); transform:none; }
        .calendar-cell.today { border-color:var(--sea-green); box-shadow:0 0 0 2px rgba(46,139,87,0.25); }
        .cell-day { font-family:'Cinzel', serif; font-size:0.9rem; font-weight:bold; color:var(--text-color); }
        .cell-dots { display:flex; gap:3px; flex-wrap:wrap; margin-top:6px; }
        .event-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
        
        .modal-backdrop { position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.55); backdrop-filter:blur(6px); z-index:2000; display:flex; align-items:center; justify-content:center; padding:1rem; }
        .modal-panel { background:var(--card-bg); border:1px solid var(--card-border); border-radius:15px; padding:2rem; max-width:520px; width:100%; max-height:80vh; overflow-y:auto; }
        .modal-panel h3 { font-family:'Cinzel', serif; color:var(--sea-green); margin-bottom:1.5rem; font-size:1.3rem; display:flex; align-items:center; gap:0.75rem; }
        .modal-event { background:rgba(46,139,87,0.06); border:1px solid var(--card-border); border-radius:10px; padding:1rem; margin-bottom:0.75rem; }
        .modal-event .event-name { font-family:'Cinzel', serif; font-weight:bold; color:var(--text-color); font-size:1rem; margin-bottom:0.5rem; }
        .modal-event .event-detail { font-size:0.85rem; color:var(--text-muted, var(--text-color)); margin-bottom:0.25rem; display:flex; align-items:center; gap:0.5rem; }
        .status-badge { display:inline-block; padding:0.2rem 0.6rem; border-radius:20px; font-size:0.75rem; font-weight:bold; color:#fff; text-transform:capitalize; }
        .close-btn { background:none; border:1px solid var(--card-border); color:var(--text-color); padding:0.5rem 1.2rem; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; margin-top:1rem; transition:all 0.2s ease; }
        .close-btn:hover { border-color:var(--sea-green); color:var(--sea-green); }

        .legend { display:flex; gap:1.5rem; flex-wrap:wrap; margin-top:1.5rem; }
        .legend-item { display:flex; align-items:center; gap:0.4rem; font-size:0.8rem; color:var(--text-color); }
        .legend-dot { width:12px; height:12px; border-radius:50%; }

        @media (max-width: 768px) {
          h1 { font-size:1.6rem; }
          .calendar-nav h2 { font-size:1.2rem; min-width:auto; }
          .calendar-cell { min-height:55px; padding:0.3rem; }
          .cell-day { font-size:0.75rem; }
          .event-dot { width:7px; height:7px; }
          .content { padding:1rem; }
        }
        @media (max-width: 480px) {
          .calendar-header-cell { font-size:0.7rem; padding:0.5rem 0.1rem; }
          .calendar-cell { min-height:45px; }
        }
      `}</style>

            <div className="page player-neo">
                <AnimatedSidebar links={coordinatorLinks} logo={<i className="fas fa-chess" />} title="ChessHive" />

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
                        <i className="fas fa-globe" /> Global Event Calendar
                    </motion.h1>

                    {error && <div className="error-text">{error}</div>}

                    <motion.div
                        className="updates-section"
                        custom={0}
                        variants={sectionVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        {/* Navigation */}
                        <div className="calendar-nav">
                            <motion.button
                                type="button"
                                className="nav-btn"
                                onClick={handlePrevMonth}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                            >
                                <i className="fas fa-chevron-left" />
                            </motion.button>
                            <h2>{MONTH_NAMES[currentMonth]} {currentYear}</h2>
                            <motion.button
                                type="button"
                                className="nav-btn"
                                onClick={handleNextMonth}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                            >
                                <i className="fas fa-chevron-right" />
                            </motion.button>
                        </div>

                        {loading ? (
                            <p style={{ textAlign: 'center', padding: '2rem 0' }}>Loading calendar...</p>
                        ) : (
                            <>
                                {/* Day headers */}
                                <div className="calendar-grid">
                                    {DAY_NAMES.map(d => (
                                        <div key={d} className="calendar-header-cell">{d}</div>
                                    ))}

                                    {/* Day cells */}
                                    {calendarDays.map((cell, idx) => {
                                        const dateKey = cell.currentMonth ? formatDateKey(currentYear, currentMonth, cell.day) : null;
                                        const dayEvents = dateKey ? (eventsByDate[dateKey] || []) : [];
                                        const isToday = dateKey === todayKey;

                                        return (
                                            <motion.div
                                                key={idx}
                                                className={`calendar-cell${cell.currentMonth ? '' : ' outside'}${isToday ? ' today' : ''}`}
                                                onClick={() => handleDateClick(cell)}
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: idx * 0.008, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                                            >
                                                <div className="cell-day">{cell.day}</div>
                                                {dayEvents.length > 0 && (
                                                    <div className="cell-dots">
                                                        {dayEvents.slice(0, 5).map((ev, i) => (
                                                            <div
                                                                key={i}
                                                                className="event-dot"
                                                                style={{ background: STATUS_COLORS[ev.status] || STATUS_COLORS.pending }}
                                                                title={`${ev.name} ${ev.coordinator ? `(${ev.coordinator})` : ''}`}
                                                            />
                                                        ))}
                                                        {dayEvents.length > 5 && (
                                                            <span style={{ fontSize: '0.6rem', color: 'var(--text-color)' }}>+{dayEvents.length - 5}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </motion.div>
                                        );
                                    })}
                                </div>

                                {/* Legend */}
                                <div className="legend">
                                    {Object.entries(STATUS_COLORS).map(([status, color]) => (
                                        <div key={status} className="legend-item">
                                            <div className="legend-dot" style={{ background: color }} />
                                            <span style={{ textTransform: 'capitalize' }}>{status}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </motion.div>

                    <div style={{ marginTop: '1rem' }}>
                        <Link to="/coordinator/coordinator_dashboard" className="back-to-dashboard">
                            <i className="fas fa-arrow-left" /> Back to Dashboard
                        </Link>
                    </div>
                </div>

                {/* Date Detail Modal */}
                <AnimatePresence>
                    {selectedDate && (
                        <motion.div
                            className="modal-backdrop"
                            variants={backdropVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            onClick={closeModal}
                        >
                            <motion.div
                                className="modal-panel"
                                variants={modalVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                onClick={e => e.stopPropagation()}
                            >
                                <h3>
                                    <i className="fas fa-calendar-day" />
                                    {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                </h3>

                                {selectedEvents.length === 0 ? (
                                    <p style={{ color: 'var(--text-color)', opacity: 0.6, textAlign: 'center', padding: '1.5rem 0' }}>
                                        <i className="fas fa-calendar-times" style={{ marginRight: '0.5rem' }} />
                                        No tournaments scheduled on this date.
                                    </p>
                                ) : (
                                    selectedEvents.map((ev, i) => (
                                        <motion.div
                                            key={i}
                                            className="modal-event"
                                            initial={{ opacity: 0, y: 12 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.08, duration: 0.3 }}
                                        >
                                            <div className="event-name">
                                                <i className="fas fa-trophy" style={{ color: 'var(--sea-green)', marginRight: '0.5rem' }} />
                                                {ev.tournament_name || ev.name || 'Tournament'}
                                            </div>
                                            <div className="event-detail">
                                                <i className="fas fa-user-tie" /> <strong>Coordinator:</strong> {ev.coordinator || 'Unknown'}
                                            </div>
                                            {ev.location && (
                                                <div className="event-detail">
                                                    <i className="fas fa-map-marker-alt" /> {ev.location}
                                                </div>
                                            )}
                                            {(ev.event_date || ev.start_date || ev.date) && (
                                                <div className="event-detail">
                                                    <i className="fas fa-clock" /> {new Date(ev.event_date || ev.start_date || ev.date).toLocaleDateString()}
                                                </div>
                                            )}
                                            <div className="event-detail" style={{ marginTop: '0.5rem' }}>
                                                <span
                                                    className="status-badge"
                                                    style={{ background: STATUS_COLORS[ev.status] || STATUS_COLORS.pending }}
                                                >
                                                    {ev.status || 'pending'}
                                                </span>
                                            </div>
                                        </motion.div>
                                    ))
                                )}

                                <button type="button" className="close-btn" onClick={closeModal}>
                                    <i className="fas fa-times" style={{ marginRight: '0.5rem' }} /> Close
                                </button>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

export default GlobalEventCalendar;






