import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import '../../styles/playerNeoNoir.css';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchAsCoordinator } from '../../utils/fetchWithRole';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import AnimatedSidebar from '../../components/AnimatedSidebar';
import { coordinatorLinks } from '../../constants/coordinatorLinks';

const PAGE_SIZE = 10;

const CATEGORIES = [
  'Chess Talk',
  'Tournament Alert',
  'Live Announcement',
  'Workshop',
  'Webinar',
  'Exhibition Match',
  'Other'
];

const CATEGORY_ICONS = {
  'Chess Talk': 'fa-comments',
  'Tournament Alert': 'fa-trophy',
  'Live Announcement': 'fa-bullhorn',
  'Workshop': 'fa-chalkboard-teacher',
  'Webinar': 'fa-video',
  'Exhibition Match': 'fa-chess-board',
  'Other': 'fa-calendar-alt'
};

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

const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.12 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] }
  }
};

const emptyForm = { title: '', description: '', date: '', category: 'Chess Talk', location: '', link: '' };

function CoordinatorChessEvents() {
  const [isDark, toggleTheme] = usePlayerTheme();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(null);

  // Form state
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Filter
  const [filterCategory, setFilterCategory] = useState('All');

  // Pagination
  const [page, setPage] = useState(1);

  const showMessage = (text, type = 'success') => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetchAsCoordinator('/coordinator/api/chess-events');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load events');
      setEvents(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Event load error:', e);
      setError('Error loading events.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const filteredEvents = useMemo(() => {
    if (filterCategory === 'All') return events;
    return events.filter(e => e.category === filterCategory);
  }, [events, filterCategory]);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE));
  const paginatedEvents = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredEvents.slice(start, start + PAGE_SIZE);
  }, [filteredEvents, page]);

  useEffect(() => { setPage(1); }, [filterCategory]);

  const resetForm = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
  };

  const handleEdit = (ev) => {
    setForm({
      title: ev.title || '',
      description: ev.description || '',
      date: ev.date ? new Date(ev.date).toISOString().slice(0, 16) : '',
      category: ev.category || 'Chess Talk',
      location: ev.location || '',
      link: ev.link || ''
    });
    setEditingId(ev._id || ev.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (eventId) => {
    const ok = window.confirm('Are you sure you want to delete this event?');
    if (!ok) return;
    try {
      const res = await fetchAsCoordinator(`/coordinator/api/chess-events/${eventId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete event');
      showMessage('Event deleted successfully.');
      setEvents((prev) => prev.filter((e) => (e._id || e.id) !== eventId));
      if (editingId === eventId) resetForm();
    } catch (e) {
      console.error('Delete error:', e);
      showMessage(e.message || 'Error deleting event.', 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const title = form.title.trim();
    if (!title) { showMessage('Title is required.', 'error'); return; }
    if (!form.date) { showMessage('Date is required.', 'error'); return; }
    if (!form.category) { showMessage('Category is required.', 'error'); return; }

    setSubmitting(true);
    try {
      const payload = {
        title,
        description: form.description.trim(),
        date: new Date(form.date).toISOString(),
        category: form.category,
        location: form.location.trim(),
        link: form.link.trim()
      };
      let res;
      if (editingId) {
        res = await fetchAsCoordinator(`/coordinator/api/chess-events/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetchAsCoordinator('/coordinator/api/chess-events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save event');
      showMessage(editingId ? 'Event updated successfully.' : 'Event created successfully! It will now appear in players\' Upcoming Events.');
      resetForm();
      loadEvents();
    } catch (e) {
      console.error('Submit error:', e);
      showMessage(e.message || 'Error saving event.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const isUpcoming = (date) => new Date(date) >= new Date();

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
        .updates-section h3 { font-family:'Cinzel', serif; color:var(--sea-green); margin-bottom:1.5rem; display:flex; align-items:center; gap:0.8rem; font-size:1.5rem; }
        .form-group { margin-bottom:1.2rem; }
        .form-group label { display:block; font-family:'Cinzel', serif; font-weight:bold; color:var(--sea-green); margin-bottom:0.4rem; }
        .form-group input, .form-group textarea, .form-group select { width:100%; padding:0.8rem 1rem; border-radius:8px; border:1px solid var(--card-border); background:var(--page-bg); color:var(--text-color); font-family:'Playfair Display', serif; font-size:1rem; resize:vertical; }
        .form-group input:focus, .form-group textarea:focus, .form-group select:focus { outline:none; border-color:var(--sea-green); box-shadow:0 0 0 2px rgba(46,139,87,0.2); }
        .form-row { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
        @media (max-width: 700px) { .form-row { grid-template-columns:1fr; } }
        .btn-primary { background:var(--sea-green); color:var(--on-accent); border:none; padding:0.8rem 1.5rem; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; display:inline-flex; align-items:center; gap:0.5rem; transition:all 0.3s ease; }
        .btn-primary:hover { transform:translateY(-2px); }
        .btn-primary:disabled { opacity:0.6; cursor:not-allowed; transform:none; }
        .btn-secondary { background:var(--card-bg); color:var(--text-color); border:1px solid var(--card-border); padding:0.6rem 1.2rem; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; display:inline-flex; align-items:center; gap:0.5rem; transition:all 0.3s ease; }
        .btn-secondary:hover { border-color:var(--sea-green); color:var(--sea-green); }
        .btn-danger { background:#d32f2f; color:#fff; border:none; padding:0.6rem 1.2rem; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; display:inline-flex; align-items:center; gap:0.5rem; transition:all 0.3s ease; }
        .btn-danger:hover { background:#b71c1c; transform:translateY(-2px); }
        .event-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(340px, 1fr)); gap:1.5rem; }
        .event-card { background:var(--card-bg); border-radius:15px; overflow:hidden; border:1px solid var(--card-border); transition:all 0.3s ease; position:relative; }
        .event-card:hover { transform:translateY(-5px); border-color:var(--sea-green); }
        .event-card-header { background:linear-gradient(135deg, var(--sea-green), #1b5e20); padding:1rem 1.5rem; color:#fff; display:flex; justify-content:space-between; align-items:center; }
        .event-card-header .cat-label { font-family:'Cinzel', serif; font-size:0.85rem; font-weight:bold; display:flex; align-items:center; gap:0.4rem; }
        .event-card-header .status-badge { font-size:0.75rem; padding:0.2rem 0.6rem; border-radius:12px; font-weight:bold; }
        .status-upcoming { background:rgba(255,255,255,0.2); color:#fff; }
        .status-past { background:rgba(255,255,255,0.1); color:rgba(255,255,255,0.6); }
        .event-card-body { padding:1.5rem; }
        .event-card-title { font-family:'Cinzel', serif; color:var(--sea-green); font-size:1.2rem; margin-bottom:0.5rem; }
        .event-card-desc { font-size:0.95rem; line-height:1.5; margin-bottom:1rem; opacity:0.85; }
        .event-meta { display:flex; flex-wrap:wrap; gap:0.8rem; margin-bottom:1rem; font-size:0.9rem; opacity:0.8; }
        .event-meta span { display:flex; align-items:center; gap:0.3rem; }
        .event-card-actions { display:flex; gap:0.5rem; flex-wrap:wrap; }
        .filter-bar { display:flex; flex-wrap:wrap; gap:0.5rem; margin-bottom:1.5rem; }
        .filter-btn { padding:0.5rem 1rem; border-radius:20px; cursor:pointer; font-family:'Cinzel', serif; font-size:0.85rem; font-weight:bold; transition:all 0.2s ease; border:1px solid var(--card-border); background:var(--card-bg); color:var(--text-color); }
        .filter-btn:hover { border-color:var(--sea-green); color:var(--sea-green); }
        .filter-btn.active { background:var(--sea-green); color:var(--on-accent); border-color:var(--sea-green); }
        .pagination { display:flex; justify-content:center; align-items:center; gap:0.5rem; margin-top:1.5rem; }
        .page-btn { background:var(--card-bg); color:var(--text-color); border:1px solid var(--card-border); padding:0.5rem 1rem; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; transition:all 0.2s ease; }
        .page-btn.active { background:var(--sea-green); color:var(--on-accent); border-color:var(--sea-green); }
        .page-btn:hover:not(.active) { border-color:var(--sea-green); color:var(--sea-green); }
        .message-bar { padding:0.8rem 1.2rem; border-radius:8px; margin-bottom:1.5rem; font-weight:600; display:flex; align-items:center; gap:0.5rem; }
        .message-success { background:rgba(46,139,87,0.15); color:#2e7d32; border:1px solid rgba(46,139,87,0.3); }
        .message-error { background:rgba(211,47,47,0.1); color:#c62828; border:1px solid rgba(211,47,47,0.3); }
        .info-banner { background:linear-gradient(135deg, rgba(46,139,87,0.1), rgba(46,139,87,0.05)); border:1px solid rgba(46,139,87,0.2); border-radius:12px; padding:1rem 1.5rem; margin-bottom:1.5rem; display:flex; align-items:flex-start; gap:0.8rem; font-size:0.95rem; line-height:1.5; }
        .info-banner i { color:var(--sea-green); margin-top:0.2rem; font-size:1.2rem; }
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
          <i className="fas fa-chess-knight" />
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
            <i className="fas fa-chess-knight" /> Chess Events
          </motion.h1>

          <div className="info-banner">
            <i className="fas fa-info-circle" />
            <div>
              <strong>Manage Chess Events</strong> &mdash; Create and update chess-related events such as Chess Talks, 
              Tournament Alerts, Live Announcements, Workshops, Webinars, and Exhibition Matches. 
              Active upcoming events will automatically appear in the <strong>Upcoming Events</strong> section 
              on every player's dashboard.
            </div>
          </div>

          <AnimatePresence>
            {message && (
              <motion.div
                className={`message-bar ${message.type === 'success' ? 'message-success' : 'message-error'}`}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <i className={`fas fa-${message.type === 'success' ? 'check-circle' : 'exclamation-circle'}`} />
                {message.text}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Create / Edit Form */}
          <motion.div
            className="updates-section"
            custom={0}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
          >
            <h3>
              <i className={editingId ? 'fas fa-edit' : 'fas fa-plus-circle'} />
              {editingId ? 'Edit Event' : 'Create New Event'}
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="event-title"><i className="fas fa-heading" /> Title *</label>
                <input
                  id="event-title"
                  type="text"
                  placeholder="e.g. Friday Chess Talk: Mastering the Sicilian Defense"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  maxLength={200}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="event-date"><i className="fas fa-calendar-alt" /> Date & Time *</label>
                  <input
                    id="event-date"
                    type="datetime-local"
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="event-category"><i className="fas fa-tag" /> Category *</label>
                  <select
                    id="event-category"
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    required
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="event-description"><i className="fas fa-align-left" /> Description</label>
                <textarea
                  id="event-description"
                  placeholder="Describe the event - what players can expect, topics covered, etc."
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={4}
                  style={{ minHeight: '100px' }}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="event-location"><i className="fas fa-map-marker-alt" /> Location</label>
                  <input
                    id="event-location"
                    type="text"
                    placeholder="e.g. Online (Zoom) / Chess Hall Room 3"
                    value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="event-link"><i className="fas fa-link" /> Event Link</label>
                  <input
                    id="event-link"
                    type="text"
                    placeholder="https://zoom.us/j/... or event URL"
                    value={form.link}
                    onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
                <motion.button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <i className={`fas fa-${submitting ? 'spinner fa-spin' : (editingId ? 'save' : 'paper-plane')}`} />
                  {submitting ? 'Saving...' : (editingId ? 'Update Event' : 'Create Event')}
                </motion.button>
                {editingId && (
                  <motion.button
                    type="button"
                    className="btn-secondary"
                    onClick={resetForm}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <i className="fas fa-times" /> Cancel Edit
                  </motion.button>
                )}
              </div>
            </form>
          </motion.div>

          {/* Events List */}
          <motion.div
            className="updates-section"
            custom={1}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
          >
            <h3><i className="fas fa-list" /> Your Events ({events.length})</h3>

            {/* Category Filter */}
            <div className="filter-bar">
              <button
                type="button"
                className={`filter-btn ${filterCategory === 'All' ? 'active' : ''}`}
                onClick={() => setFilterCategory('All')}
              >
                All
              </button>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  className={`filter-btn ${filterCategory === cat ? 'active' : ''}`}
                  onClick={() => setFilterCategory(cat)}
                >
                  <i className={`fas ${CATEGORY_ICONS[cat]}`} /> {cat}
                </button>
              ))}
            </div>

            {loading ? (
              <p style={{ textAlign: 'center', padding: '2rem' }}><i className="fas fa-spinner fa-spin" /> Loading events...</p>
            ) : error ? (
              <p style={{ textAlign: 'center', color: '#c62828', padding: '1rem' }}><i className="fas fa-exclamation-triangle" /> {error}</p>
            ) : filteredEvents.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '2rem', opacity: 0.6 }}>
                <i className="fas fa-info-circle" /> {filterCategory === 'All' ? 'No events yet. Create your first chess event above!' : `No events in "${filterCategory}" category.`}
              </p>
            ) : (
              <>
                <motion.div className="event-grid" variants={listVariants} initial="hidden" animate="visible">
                  {paginatedEvents.map((ev) => {
                    const evId = ev._id || ev.id;
                    const upcoming = isUpcoming(ev.date);
                    return (
                      <motion.div key={evId} className="event-card" variants={itemVariants}>
                        <div className="event-card-header">
                          <span className="cat-label">
                            <i className={`fas ${CATEGORY_ICONS[ev.category] || 'fa-calendar-alt'}`} />
                            {ev.category}
                          </span>
                          <span className={`status-badge ${upcoming ? 'status-upcoming' : 'status-past'}`}>
                            {upcoming ? 'Upcoming' : 'Past'}
                          </span>
                        </div>
                        <div className="event-card-body">
                          <div className="event-card-title">{ev.title}</div>
                          {ev.description && (
                            <div className="event-card-desc">
                              {ev.description.length > 120 ? ev.description.substring(0, 120) + '...' : ev.description}
                            </div>
                          )}
                          <div className="event-meta">
                            {ev.date && (
                              <span>
                                <i className="fas fa-calendar-alt" />
                                {new Date(ev.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                              </span>
                            )}
                            {ev.location && (
                              <span>
                                <i className="fas fa-map-marker-alt" />
                                {ev.location}
                              </span>
                            )}
                            {ev.link && (
                              <span>
                                <a href={ev.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--sea-green)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                  <i className="fas fa-external-link-alt" /> Event Link
                                </a>
                              </span>
                            )}
                          </div>
                          {ev.coordinatorName && (
                            <div style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '0.8rem' }}>
                              <i className="fas fa-user" /> Created by {ev.coordinatorName}
                            </div>
                          )}
                          <div className="event-card-actions">
                            <motion.button
                              type="button"
                              className="btn-secondary"
                              onClick={() => handleEdit(ev)}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <i className="fas fa-edit" /> Edit
                            </motion.button>
                            <motion.button
                              type="button"
                              className="btn-danger"
                              onClick={() => handleDelete(evId)}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <i className="fas fa-trash" /> Delete
                            </motion.button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="pagination">
                    <button
                      type="button"
                      className="page-btn"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <i className="fas fa-chevron-left" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`page-btn ${p === page ? 'active' : ''}`}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="page-btn"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      <i className="fas fa-chevron-right" />
                    </button>
                  </div>
                )}
              </>
            )}
          </motion.div>

          <div style={{ textAlign: 'right', marginTop: '1rem' }}>
            <Link to="/coordinator/coordinator_dashboard" className="back-to-dashboard">
              <i className="fas fa-arrow-left" /> Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CoordinatorChessEvents;
