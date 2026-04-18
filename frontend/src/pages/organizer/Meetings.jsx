import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAsOrganizer } from '../../utils/fetchWithRole';
import '../../styles/playerNeoNoir.css';
import { motion } from 'framer-motion';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import AnimatedSidebar from '../../components/AnimatedSidebar';
import { organizerLinks } from '../../constants/organizerLinks';

const INITIAL_VISIBLE = 5;

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

function Meetings() {
  const [isDark, toggleTheme] = usePlayerTheme();
  const [form, setForm] = useState({ title: '', date: '', time: '', link: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [message, setMessage] = useState(null); // { type: 'success'|'error', text }
  const [loading, setLoading] = useState(true);
  const [organized, setOrganized] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [visibleOrg, setVisibleOrg] = useState(INITIAL_VISIBLE);
  const [visibleUpc, setVisibleUpc] = useState(INITIAL_VISIBLE);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const fetchMeetings = useCallback(async () => {
    try {
      setLoading(true);
      const [orgRes, upRes] = await Promise.all([
        fetchAsOrganizer('/organizer/api/meetings/organized'),
        fetchAsOrganizer('/organizer/api/meetings/upcoming')
      ]);
      const [orgData, upData] = await Promise.all([orgRes.json(), upRes.json()]);
      setOrganized(Array.isArray(orgData) ? orgData : []);
      setUpcoming(Array.isArray(upData) ? upData : []);
      setVisibleOrg(INITIAL_VISIBLE);
      setVisibleUpc(INITIAL_VISIBLE);
    } catch (e) {
      console.error('Load meetings error:', e);
      showMessage('Failed to load meetings.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const validate = () => {
    const errors = {};
    const title = form.title.trim();
    if (!title) errors.title = 'Meeting title is required.';
    else if (title.length < 3) errors.title = 'Meeting title must be at least 3 characters long.';
    else if (!/^[a-zA-Z0-9\s\-&]+$/.test(title)) errors.title = 'Only letters, numbers, spaces, hyphens, and & are allowed.';

    if (!form.date) errors.date = 'Date is required.';
    else {
      const d = new Date(form.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (isNaN(d.getTime())) errors.date = 'Invalid date format.';
      else if (d < today) errors.date = 'Date cannot be in the past.';
    }

    const time = form.time.trim();
    if (!time) errors.time = 'Time is required.';
    else if (!/^\d{2}:\d{2}$/.test(time)) errors.time = 'Invalid time format (use HH:MM).';

    const link = form.link.trim();
    if (!link) errors.link = 'Meeting link is required.';
    else if (!(link.startsWith('http://') || link.startsWith('https://'))) errors.link = 'Meeting link must be a valid http or https URL.';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      showMessage('Please correct the errors in the form.', 'error');
      return;
    }
    const payload = { title: form.title.trim(), date: form.date, time: form.time.trim(), link: form.link.trim() };
    try {
      const res = await fetchAsOrganizer('/organizer/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to schedule meeting');
      showMessage(data.message || 'Meeting scheduled successfully!', 'success');
      setForm({ title: '', date: '', time: '', link: '' });
      // Add locally for responsiveness; then refresh
      setOrganized((prev) => [{ ...payload }, ...prev]);
      await fetchMeetings();
    } catch (err) {
      console.error('Schedule error:', err);
      showMessage(`Failed to schedule meeting: ${err.message}`, 'error');
    }
  };

  const renderRows = (rows, visible) =>
    rows.slice(0, visible).map((m, idx) => {
      const dateStr = m.date ? new Date(m.date).toLocaleDateString() : '';
      return (
        <tr key={(m._id || m.title || idx) + ''}>
          <td className="td">{m.title}</td>
          <td className="td">{dateStr}</td>
          <td className="td">{m.time}</td>
          <td className="td">
            {m.link ? (
              <a href={m.link} target="_blank" rel="noreferrer" className="join-link">
                <i className="fas fa-video" /> Join
              </a>
            ) : (
              '-'
            )}
          </td>
        </tr>
      );
    });

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
        .form-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(250px, 1fr)); gap:1.5rem; }
        .form-label { color:var(--sea-green); font-weight:bold; }
        .form-input { padding:1rem; border:2px solid var(--sea-green); border-radius:8px; font-size:1rem; background:var(--page-bg); color:var(--text-color); }
        .form-input.error { border-color:#c62828; }
        .form-error { color:#c62828; font-size:0.9rem; margin-top:4px; }
        .form-btn { background-color:var(--sea-green); color:var(--on-accent); border:none; padding:1rem; border-radius:8px; font-size:1.1rem; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; grid-column:1 / -1; display:flex; align-items:center; justify-content:center; gap:0.5rem; }
        .table { width:100%; border-collapse:collapse; margin-bottom:1rem; }
        .th { background:var(--sea-green); color:var(--on-accent); padding:1.2rem; text-align:left; font-family:'Cinzel', serif; }
        .td { padding:1rem; border-bottom:1px solid rgba(var(--sea-green-rgb, 27, 94, 63), 0.2); }
        .join-link { background: linear-gradient(90deg, rgba(235,87,87,1), rgba(6,56,80,1)); color: var(--on-accent); padding:0.5rem 1rem; border-radius:20px; text-decoration:none; font-weight:bold; display:inline-flex; align-items:center; gap:0.5rem; }
        .more-btn { display:inline-flex; align-items:center; gap:0.5rem; background-color:var(--sea-green); color:var(--on-accent); text-decoration:none; padding:0.8rem 1.5rem; border-radius:8px; font-family:'Cinzel', serif; font-weight:bold; cursor:pointer; border:none; }
        .back-link { display:inline-flex; align-items:center; gap:0.5rem; background:var(--sea-green); color:var(--on-accent); text-decoration:none; padding:0.8rem 1.5rem; border-radius:8px; font-family:'Cinzel', serif; font-weight:bold; }
        .message { margin-bottom:1rem; padding:0.75rem 1rem; border-radius:8px; }
        .message.success { color:#1b5e20; background:rgba(76,175,80,0.15); }
        .message.error { color:#c62828; background:rgba(198,40,40,0.15); }
        .empty { text-align:center; padding:2rem; color:var(--sea-green); font-style:italic; }
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
          <i className="fas fa-calendar" />
        </motion.div>
        
        <AnimatedSidebar links={organizerLinks} logo={<i className="fas fa-chess" />} title={`ChessHive`} />

        <div className="organizer-dash-header" style={{ position: 'fixed', top: 18, right: 18, zIndex: 1001, display: 'flex', gap: '12px', alignItems: 'center' }}>
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
            <i className="fas fa-calendar" /> Schedule a Meeting
          </motion.h1>

          <motion.div
            className="updates-section"
            custom={0}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
          >
            {message && <div className={`message ${message.type}`}><i className={`fas ${message.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`} /> {message.text}</div>}
            <form onSubmit={onSubmit} className="form-grid">
              <div>
                <label className="form-label"><i className="fas fa-heading" /> Meeting Title</label>
                <input className={`form-input ${fieldErrors.title ? 'error' : ''}`} type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Enter meeting title" required />
                {fieldErrors.title && <div className="form-error">{fieldErrors.title}</div>}
              </div>
              <div>
                <label className="form-label"><i className="fas fa-calendar" /> Date</label>
                <input className={`form-input ${fieldErrors.date ? 'error' : ''}`} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                {fieldErrors.date && <div className="form-error">{fieldErrors.date}</div>}
              </div>
              <div>
                <label className="form-label"><i className="fas fa-clock" /> Time</label>
                <input className={`form-input ${fieldErrors.time ? 'error' : ''}`} type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required />
                {fieldErrors.time && <div className="form-error">{fieldErrors.time}</div>}
              </div>
              <div>
                <label className="form-label"><i className="fas fa-link" /> Meeting Link</label>
                <input className={`form-input ${fieldErrors.link ? 'error' : ''}`} type="text" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="Zoom/Google Meet link" required />
                {fieldErrors.link && <div className="form-error">{fieldErrors.link}</div>}
              </div>
              <button type="submit" className="form-btn">
                <i className="fas fa-calendar-plus" /> Schedule Meeting
              </button>
            </form>
          </motion.div>

          <motion.div
            className="updates-section"
            custom={1}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
          >
            <h3 style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', fontSize: '1.8rem', textAlign: 'center', marginBottom: '1.5rem' }}>Organized Meetings</h3>
            {loading ? (
              <div>Loading meetings…</div>
            ) : organized.length === 0 ? (
              <div className="empty"><i className="fas fa-info-circle" /> No meetings available.</div>
            ) : (
              <>
                <table className="table">
                  <thead>
                    <tr>
                      <th className="th"><i className="fas fa-heading" /> Title</th>
                      <th className="th"><i className="fas fa-calendar" /> Date</th>
                      <th className="th"><i className="fas fa-clock" /> Time</th>
                      <th className="th"><i className="fas fa-link" /> Link</th>
                    </tr>
                  </thead>
                  <tbody>{renderRows(organized, visibleOrg)}</tbody>
                </table>
                <div style={{ textAlign: 'center', margin: '1rem 0', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                  {visibleOrg < organized.length && (
                    <button className="more-btn" onClick={() => setVisibleOrg((v) => Math.min(v + INITIAL_VISIBLE, organized.length))}>
                      <i className="fas fa-chevron-down" /> More
                    </button>
                  )}
                  {visibleOrg > INITIAL_VISIBLE && (
                    <button className="more-btn" onClick={() => setVisibleOrg(INITIAL_VISIBLE)}>
                      <i className="fas fa-chevron-up" /> Hide
                    </button>
                  )}
                </div>
              </>
            )}

            <h3 style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', fontSize: '1.8rem', textAlign: 'center', marginTop: '1.5rem', marginBottom: '1.5rem' }}>Upcoming Meetings</h3>
            {loading ? (
              <div>Loading meetings…</div>
            ) : upcoming.length === 0 ? (
              <div className="empty"><i className="fas fa-info-circle" /> No meetings available.</div>
            ) : (
              <>
                <table className="table">
                  <thead>
                    <tr>
                      <th className="th"><i className="fas fa-heading" /> Title</th>
                      <th className="th"><i className="fas fa-calendar" /> Date</th>
                      <th className="th"><i className="fas fa-clock" /> Time</th>
                      <th className="th"><i className="fas fa-link" /> Link</th>
                    </tr>
                  </thead>
                  <tbody>{renderRows(upcoming, visibleUpc)}</tbody>
                </table>
                <div style={{ textAlign: 'center', margin: '1rem 0', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                  {visibleUpc < upcoming.length && (
                    <button className="more-btn" onClick={() => setVisibleUpc((v) => Math.min(v + INITIAL_VISIBLE, upcoming.length))}>
                      <i className="fas fa-chevron-down" /> More
                    </button>
                  )}
                  {visibleUpc > INITIAL_VISIBLE && (
                    <button className="more-btn" onClick={() => setVisibleUpc(INITIAL_VISIBLE)}>
                      <i className="fas fa-chevron-up" /> Hide
                    </button>
                  )}
                </div>
              </>
            )}

            <div style={{ textAlign: 'right', marginTop: '2rem' }}>
              <Link to="/organizer/organizer_dashboard" className="back-to-dashboard">
                <i className="fas fa-arrow-left" /> Back to Dashboard
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default Meetings;
