import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import '../../styles/playerNeoNoir.css';
import { motion } from 'framer-motion';
import { fetchAsCoordinator } from '../../utils/fetchWithRole';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import AnimatedSidebar from '../../components/AnimatedSidebar';
import { coordinatorLinks } from '../../constants/coordinatorLinks';
import SearchFilterRow from '../../components/SearchFilterRow';

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

const isAllowedMeetingLink = (raw) => {
  try {
    const parsed = new URL(String(raw || '').trim());
    const host = parsed.hostname.toLowerCase();
    const isGoogleMeet = host === 'meet.google.com';
    const isZoom = host === 'zoom.us' || host.endsWith('.zoom.us');
    return parsed.protocol === 'https:' && (isGoogleMeet || isZoom);
  } catch {
    return false;
  }
};

function CoordinatorMeetings() {
  const [isDark, toggleTheme] = usePlayerTheme();
  const [form, setForm] = useState({ title: '', date: '', time: '', link: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null); // {type: 'success'|'error', text}

  const [organized, setOrganized] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [orgPage, setOrgPage] = useState(1);
  const [upcPage, setUpcPage] = useState(1);
  const rowsPerPage = 10;

  // Search states (mimic /js/searchbar.js behavior)
  const [orgSearch, setOrgSearch] = useState({ attr: 0, q: '' });
  const [upcSearch, setUpcSearch] = useState({ attr: 0, q: '' });

  const fetchOrganized = async () => {
    try {
      const res = await fetchAsCoordinator('/coordinator/api/meetings/organized');
      const data = await res.json();
      setOrganized(Array.isArray(data) ? data : []);
      setOrgPage(1);
    } catch (e) {
      console.error(e);
      setOrganized([]);
    }
  };

  const fetchUpcoming = async () => {
    try {
      const res = await fetchAsCoordinator('/coordinator/api/meetings/upcoming');
      const data = await res.json();
      setUpcoming(Array.isArray(data) ? data : []);
      setUpcPage(1);
    } catch (e) {
      console.error(e);
      setUpcoming([]);
    }
  };

  useEffect(() => {
    fetchOrganized();
    fetchUpcoming();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const validate = () => {
    const newErrors = {};
    // title
    const title = form.title.trim();
    if (!title) newErrors.title = 'Meeting title is required.';
    else if (title.length < 3) newErrors.title = 'Meeting title must be at least 3 characters long.';
    else if (!/^[a-zA-Z0-9\s\-&]+$/.test(title)) newErrors.title = 'Meeting title can only contain letters, numbers, spaces, hyphens, and &.';
    // date
    if (!form.date) newErrors.date = 'Date is required.';
    else {
      const inputDate = new Date(form.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (Number.isNaN(inputDate.getTime())) newErrors.date = 'Invalid date format.';
      else if (inputDate < today) newErrors.date = 'Date cannot be in the past.';
    }
    // time
    if (!form.time.trim()) newErrors.time = 'Time is required.';
    else if (!/^\d{2}:\d{2}$/.test(form.time.trim())) newErrors.time = 'Invalid time format (use HH:MM).';
    // link
    const meetingLink = form.link.trim();
    if (!meetingLink) newErrors.link = 'Meeting link is required.';
    else if (!isAllowedMeetingLink(meetingLink)) newErrors.link = 'Only Google Meet or Zoom links are allowed (https://meet.google.com/... or https://*.zoom.us/...).';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      showMessage('Please correct the errors in the form.', 'error');
      return;
    }
    try {
      const res = await fetchAsCoordinator('/coordinator/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to schedule meeting');
      setForm({ title: '', date: '', time: '', link: '' });
      showMessage(data.message || 'Meeting scheduled successfully!', 'success');
      // Optimistic add to organized, then refresh both from server
      setOrganized((prev) => [{ ...form }, ...prev]);
      await fetchUpcoming();
      await fetchOrganized();
    } catch (err) {
      console.error(err);
      showMessage(`Failed to schedule meeting: ${err.message}`, 'error');
    }
  };



  const applySearchFilter = (arr, search) => {
    if (!search.q) return arr;
    return arr.filter((m) => {
      const cols = [
        m.title || '',
        new Date(m.date).toLocaleDateString(),
        m.time || '',
        m.link || '',
      ];
      const value = String(cols[search.attr] || '').toLowerCase();
      return value.includes(search.q.toLowerCase());
    });
  };

  const orgFiltered = useMemo(() => applySearchFilter(organized, orgSearch), [organized, orgSearch]);
  const upcFiltered = useMemo(() => applySearchFilter(upcoming, upcSearch), [upcoming, upcSearch]);

  useEffect(() => {
    setOrgPage(1);
  }, [orgSearch]);

  useEffect(() => {
    setUpcPage(1);
  }, [upcSearch]);

  const renderTable = (rows, page) => {
    if (!rows || rows.length === 0) {
      return (
        <tbody>
          <tr>
            <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--sea-green)', fontStyle: 'italic' }}><i className="fas fa-info-circle" /> No meetings found.</td>
          </tr>
        </tbody>
      );
    }
    const start = (page - 1) * rowsPerPage;
    const slice = rows.slice(start, start + rowsPerPage);
    return (
      <tbody>
        {slice.map((m, idx) => (
          <tr key={`${m.title}-${m.date}-${idx}`}>
            <td style={{ padding: '1rem', borderBottom: '1px solid rgba(var(--sea-green-rgb, 27, 94, 63), 0.2)' }}>{m.title}</td>
            <td style={{ padding: '1rem', borderBottom: '1px solid rgba(var(--sea-green-rgb, 27, 94, 63), 0.2)' }}>{new Date(m.date).toLocaleDateString()}</td>
            <td style={{ padding: '1rem', borderBottom: '1px solid rgba(var(--sea-green-rgb, 27, 94, 63), 0.2)' }}>{m.time}</td>
            <td style={{ padding: '1rem', borderBottom: '1px solid rgba(var(--sea-green-rgb, 27, 94, 63), 0.2)' }}><a href={m.link} target="_blank" rel="noreferrer" style={{ background: 'var(--sky-blue)', color: 'var(--sea-green)', padding: '0.5rem 1rem', borderRadius: 20, textDecoration: 'none', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}><i className="fas fa-video" /> Join</a></td>
          </tr>
        ))}
      </tbody>
    );
  };

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
        .input-group { display:flex; flex-direction:column; gap:0.5rem; }
        .form-input { padding:1rem; border:2px solid var(--sea-green); border-radius:8px; font-size:1rem; background:var(--card-bg); color:var(--text-color); }
        .form-input.error { border-color:#c62828; }
        .error-text { color:#c62828; font-size:0.9rem; margin-top:0.2rem; }
        .btn-primary { background:var(--sea-green); color:var(--on-accent); border:none; padding:1rem; border-radius:8px; font-size:1.1rem; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; grid-column:1 / -1; display:flex; align-items:center; justify-content:center; gap:0.5rem; }
        .meetings-table { width:100%; border-collapse:collapse; margin-bottom:2rem; }
        .meetings-table th { background:var(--sea-green); color:var(--on-accent); padding:1.2rem; text-align:left; font-family:'Cinzel', serif; }
        .search-row { margin-bottom:1rem; display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap; }
        .search-input { padding:0.6rem 1rem; max-width:300px; width:100%; border:2px solid var(--sea-green); border-radius:8px; font-family:'Playfair Display', serif; background:var(--card-bg); color:var(--text-color); }
        .search-select { padding:0.6rem 1rem; max-width:300px; width:100%; border:2px solid var(--sea-green); border-radius:8px; font-family:'Cinzel', serif; background:var(--card-bg); color:var(--text-color); }
        .message { padding:1rem; border-radius:8px; margin-bottom:1.5rem; display:flex; align-items:center; gap:0.5rem; }
        .message.success { background:rgba(76,175,80,0.15); color:#1b5e20; }
        .message.error { background:rgba(198,40,40,0.15); color:#c62828; }
        .action-btn { display:inline-flex; align-items:center; gap:0.5rem; background:var(--sky-blue); color:var(--sea-green); text-decoration:none; padding:0.8rem 1.5rem; border-radius:8px; font-family:'Cinzel', serif; font-weight:bold; cursor:pointer; border:none; }
        .pagination { display:flex; justify-content:center; align-items:center; gap:0.5rem; margin:1rem 0; flex-wrap:wrap; }
        .page-btn { background:var(--card-bg); color:var(--text-color); border:1px solid var(--card-border); padding:0.45rem 0.85rem; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; }
        .page-btn.active { background:var(--sea-green); color:var(--on-accent); border-color:var(--sea-green); }
        .page-btn:disabled { opacity:0.6; cursor:not-allowed; }
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
            <i className="fas fa-calendar" /> Schedule a Meeting
          </motion.h1>

          <motion.div
            className="updates-section"
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

            <form onSubmit={onSubmit} className="form-grid">
              <div className="input-group">
                <label><i className="fas fa-heading" /> Meeting Title</label>
                <input type="text" name="title" placeholder="Enter meeting title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={`form-input ${errors.title ? 'error' : ''}`} />
                {errors.title && <div className="error-text">{errors.title}</div>}
              </div>
              <div className="input-group">
                <label><i className="fas fa-calendar" /> Date</label>
                <input type="date" name="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className={`form-input ${errors.date ? 'error' : ''}`} />
                {errors.date && <div className="error-text">{errors.date}</div>}
              </div>
              <div className="input-group">
                <label><i className="fas fa-clock" /> Time</label>
                <input type="time" name="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} className={`form-input ${errors.time ? 'error' : ''}`} />
                {errors.time && <div className="error-text">{errors.time}</div>}
              </div>
              <div className="input-group">
                <label><i className="fas fa-link" /> Meeting Link</label>
                <input type="text" name="link" placeholder="Zoom/Google Meet link" value={form.link} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} className={`form-input ${errors.link ? 'error' : ''}`} />
                {errors.link && <div className="error-text">{errors.link}</div>}
              </div>
              <button type="submit" className="btn-primary"><i className="fas fa-calendar-plus" /> Schedule Meeting</button>
            </form>
          </motion.div>

          <motion.div
            className="updates-section"
            custom={1}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
          >
            <h3 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.8rem', margin: '2rem 0', textAlign: 'center', color: 'var(--sea-green)' }}>Organized Meetings</h3>
            <SearchFilterRow
              value={orgSearch}
              options={[
                { value: 0, label: 'Title' },
                { value: 1, label: 'Date' },
                { value: 2, label: 'Time' },
                { value: 3, label: 'Link' }
              ]}
              onAttrChange={(val) => setOrgSearch((s) => ({ ...s, attr: parseInt(val, 10) }))}
              onQueryChange={(val) => setOrgSearch((s) => ({ ...s, q: val }))}
            />
            <table className="meetings-table">
              <thead>
                <tr>
                  <th><i className="fas fa-heading" /> Title</th>
                  <th><i className="fas fa-calendar" /> Date</th>
                  <th><i className="fas fa-clock" /> Time</th>
                  <th><i className="fas fa-link" /> Link</th>
                </tr>
              </thead>
              {renderTable(orgFiltered, orgPage)}
            </table>
            {Math.ceil(orgFiltered.length / rowsPerPage) > 1 && (
              <div className="pagination">
                <button type="button" className="page-btn" onClick={() => setOrgPage((p) => Math.max(1, p - 1))} disabled={orgPage === 1}>
                  <i className="fas fa-chevron-left" />
                </button>
                {Array.from({ length: Math.ceil(orgFiltered.length / rowsPerPage) }, (_, i) => i + 1).map((p) => (
                  <button key={p} type="button" className={`page-btn ${p === orgPage ? 'active' : ''}`} onClick={() => setOrgPage(p)}>
                    {p}
                  </button>
                ))}
                <button type="button" className="page-btn" onClick={() => setOrgPage((p) => Math.min(Math.ceil(orgFiltered.length / rowsPerPage), p + 1))} disabled={orgPage === Math.ceil(orgFiltered.length / rowsPerPage)}>
                  <i className="fas fa-chevron-right" />
                </button>
              </div>
            )}

            <h3 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.8rem', margin: '2rem 0', textAlign: 'center', color: 'var(--sea-green)' }}>Upcoming Meetings</h3>
            <SearchFilterRow
              value={upcSearch}
              options={[
                { value: 0, label: 'Title' },
                { value: 1, label: 'Date' },
                { value: 2, label: 'Time' },
                { value: 3, label: 'Link' }
              ]}
              onAttrChange={(val) => setUpcSearch((s) => ({ ...s, attr: parseInt(val, 10) }))}
              onQueryChange={(val) => setUpcSearch((s) => ({ ...s, q: val }))}
            />
            <table className="meetings-table">
              <thead>
                <tr>
                  <th><i className="fas fa-heading" /> Title</th>
                  <th><i className="fas fa-calendar" /> Date</th>
                  <th><i className="fas fa-clock" /> Time</th>
                  <th><i className="fas fa-link" /> Link</th>
                </tr>
              </thead>
              {renderTable(upcFiltered, upcPage)}
            </table>
            {Math.ceil(upcFiltered.length / rowsPerPage) > 1 && (
              <div className="pagination">
                <button type="button" className="page-btn" onClick={() => setUpcPage((p) => Math.max(1, p - 1))} disabled={upcPage === 1}>
                  <i className="fas fa-chevron-left" />
                </button>
                {Array.from({ length: Math.ceil(upcFiltered.length / rowsPerPage) }, (_, i) => i + 1).map((p) => (
                  <button key={p} type="button" className={`page-btn ${p === upcPage ? 'active' : ''}`} onClick={() => setUpcPage(p)}>
                    {p}
                  </button>
                ))}
                <button type="button" className="page-btn" onClick={() => setUpcPage((p) => Math.min(Math.ceil(upcFiltered.length / rowsPerPage), p + 1))} disabled={upcPage === Math.ceil(upcFiltered.length / rowsPerPage)}>
                  <i className="fas fa-chevron-right" />
                </button>
              </div>
            )}

            <div style={{ textAlign: 'right' }}>
              <Link to="/coordinator/coordinator_dashboard" className="back-to-dashboard"><i className="fas fa-arrow-left" /> Back to Dashboard</Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default CoordinatorMeetings;


