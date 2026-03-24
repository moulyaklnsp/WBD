import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

// React conversion of views/organizer/meetings.html

const INITIAL_VISIBLE = 5;

function Meetings() {
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
        fetch('/organizer/api/meetings/organized', { credentials: 'include' }),
        fetch('/organizer/api/meetings/upcoming', { credentials: 'include' })
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
      const res = await fetch('/organizer/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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

  const styles = {
    root: { fontFamily: 'Playfair Display, serif', backgroundColor: '#FFFDD0', color: '#2E8B57', minHeight: '100vh', padding: '2rem' },
    container: { maxWidth: 1200, margin: '0 auto' },
    h2: { fontFamily: 'Cinzel, serif', fontSize: '2.5rem', color: '#2E8B57', marginBottom: '2rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' },
    card: { background: 'var(--card-bg)', padding: '2rem', borderRadius: 15, boxShadow: 'none', marginBottom: '2rem', border: '1px solid var(--card-border)' },
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' },
    label: { color: '#2E8B57', fontWeight: 'bold' },
    input: (hasError) => ({ padding: '1rem', border: `2px solid ${hasError ? '#c62828' : '#2E8B57'}`, borderRadius: 8, fontSize: '1rem' }),
    error: { color: '#c62828', fontSize: '0.9rem', marginTop: 4 },
    btn: { backgroundColor: '#2E8B57', color: '#FFFDD0', border: 'none', padding: '1rem', borderRadius: 8, fontSize: '1.1rem', cursor: 'pointer', fontFamily: 'Cinzel, serif', fontWeight: 'bold', gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' },
    tableCard: { background: 'var(--card-bg)', padding: '2rem', borderRadius: 15, boxShadow: 'none', border: '1px solid var(--card-border)' },
    table: { width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' },
    th: { background: '#2E8B57', color: '#FFFDD0', padding: '1.2rem', textAlign: 'left', fontFamily: 'Cinzel, serif' },
    td: { padding: '1rem', borderBottom: '1px solid rgba(46, 139, 87, 0.2)' },
    join: { backgroundColor: '#87CEEB', color: '#2E8B57', padding: '0.5rem 1rem', borderRadius: 20, textDecoration: 'none', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' },
    moreWrap: { textAlign: 'center', margin: '1rem 0', display: 'flex', justifyContent: 'center', gap: '1rem' },
    moreBtn: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#87CEEB', color: '#2E8B57', textDecoration: 'none', padding: '0.8rem 1.5rem', borderRadius: 8, fontFamily: 'Cinzel, serif', fontWeight: 'bold', cursor: 'pointer', border: 'none' },
    backRow: { textAlign: 'right', marginTop: '2rem' },
    backLink: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#2E8B57', color: '#fff', textDecoration: 'none', padding: '0.8rem 1.5rem', borderRadius: 8, fontFamily: 'Cinzel, serif', fontWeight: 'bold' },
    msg: (type) => ({ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: 8, color: type === 'success' ? '#1b5e20' : '#c62828', background: type === 'success' ? 'rgba(76,175,80,0.15)' : 'rgba(198,40,40,0.15)' })
  };

  const renderRows = (rows, visible) =>
    rows.slice(0, visible).map((m, idx) => {
      const dateStr = m.date ? new Date(m.date).toLocaleDateString() : '';
      return (
        <tr key={(m._id || m.title || idx) + ''}>
          <td style={styles.td}>{m.title}</td>
          <td style={styles.td}>{dateStr}</td>
          <td style={styles.td}>{m.time}</td>
          <td style={styles.td}>
            {m.link ? (
              <a href={m.link} target="_blank" rel="noreferrer" style={styles.join}>
                <i className="fas fa-video" aria-hidden="true"></i> Join
              </a>
            ) : (
              '-'
            )}
          </td>
        </tr>
      );
    });

  return (
    <div style={styles.root}>
      <div style={styles.container}>
        <h2 style={styles.h2}><span role="img" aria-label="calendar">📅</span> Schedule a Meeting</h2>

        <div style={styles.card}>
          {message && <div style={styles.msg(message.type)}><i className={`fas ${message.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`} aria-hidden="true" /> {message.text}</div>}
          <form onSubmit={onSubmit} style={styles.formGrid}>
            <div>
              <label style={styles.label}><i className="fas fa-heading" aria-hidden="true"></i> Meeting Title</label>
              <input style={styles.input(!!fieldErrors.title)} type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Enter meeting title" required />
              {fieldErrors.title && <div style={styles.error}>{fieldErrors.title}</div>}
            </div>
            <div>
              <label style={styles.label}><i className="fas fa-calendar" aria-hidden="true"></i> Date</label>
              <input style={styles.input(!!fieldErrors.date)} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
              {fieldErrors.date && <div style={styles.error}>{fieldErrors.date}</div>}
            </div>
            <div>
              <label style={styles.label}><i className="fas fa-clock" aria-hidden="true"></i> Time</label>
              <input style={styles.input(!!fieldErrors.time)} type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required />
              {fieldErrors.time && <div style={styles.error}>{fieldErrors.time}</div>}
            </div>
            <div>
              <label style={styles.label}><i className="fas fa-link" aria-hidden="true"></i> Meeting Link</label>
              <input style={styles.input(!!fieldErrors.link)} type="text" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="Zoom/Google Meet link" required />
              {fieldErrors.link && <div style={styles.error}>{fieldErrors.link}</div>}
            </div>
            <button type="submit" style={styles.btn}>
              <i className="fas fa-calendar-plus" aria-hidden="true"></i> Schedule Meeting
            </button>
          </form>
        </div>

        <div style={styles.tableCard}>
          <h3 style={{ ...styles.h2, fontSize: '1.8rem', textAlign: 'center' }}>Organized Meetings</h3>
          {loading ? (
            <div>Loading meetings…</div>
          ) : organized.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#2E8B57', fontStyle: 'italic' }}><i className="fas fa-info-circle" aria-hidden="true"></i> No meetings available.</div>
          ) : (
            <>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}><i className="fas fa-heading" aria-hidden="true"></i> Title</th>
                    <th style={styles.th}><i className="fas fa-calendar" aria-hidden="true"></i> Date</th>
                    <th style={styles.th}><i className="fas fa-clock" aria-hidden="true"></i> Time</th>
                    <th style={styles.th}><i className="fas fa-link" aria-hidden="true"></i> Link</th>
                  </tr>
                </thead>
                <tbody>{renderRows(organized, visibleOrg)}</tbody>
              </table>
              <div style={styles.moreWrap}>
                {visibleOrg < organized.length && (
                  <button style={styles.moreBtn} onClick={() => setVisibleOrg((v) => Math.min(v + INITIAL_VISIBLE, organized.length))}>
                    <i className="fas fa-chevron-down" aria-hidden="true"></i> More
                  </button>
                )}
                {visibleOrg > INITIAL_VISIBLE && (
                  <button style={styles.moreBtn} onClick={() => setVisibleOrg(INITIAL_VISIBLE)}>
                    <i className="fas fa-chevron-up" aria-hidden="true"></i> Hide
                  </button>
                )}
              </div>
            </>
          )}

          <h3 style={{ ...styles.h2, fontSize: '1.8rem', textAlign: 'center', marginTop: '1.5rem' }}>Upcoming Meetings</h3>
          {loading ? (
            <div>Loading meetings…</div>
          ) : upcoming.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#2E8B57', fontStyle: 'italic' }}><i className="fas fa-info-circle" aria-hidden="true"></i> No meetings available.</div>
          ) : (
            <>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}><i className="fas fa-heading" aria-hidden="true"></i> Title</th>
                    <th style={styles.th}><i className="fas fa-calendar" aria-hidden="true"></i> Date</th>
                    <th style={styles.th}><i className="fas fa-clock" aria-hidden="true"></i> Time</th>
                    <th style={styles.th}><i className="fas fa-link" aria-hidden="true"></i> Link</th>
                  </tr>
                </thead>
                <tbody>{renderRows(upcoming, visibleUpc)}</tbody>
              </table>
              <div style={styles.moreWrap}>
                {visibleUpc < upcoming.length && (
                  <button style={styles.moreBtn} onClick={() => setVisibleUpc((v) => Math.min(v + INITIAL_VISIBLE, upcoming.length))}>
                    <i className="fas fa-chevron-down" aria-hidden="true"></i> More
                  </button>
                )}
                {visibleUpc > INITIAL_VISIBLE && (
                  <button style={styles.moreBtn} onClick={() => setVisibleUpc(INITIAL_VISIBLE)}>
                    <i className="fas fa-chevron-up" aria-hidden="true"></i> Hide
                  </button>
                )}
              </div>
            </>
          )}

          <div style={styles.backRow}>
            <Link to="/organizer/organizer_dashboard" style={styles.backLink}>
              <i className="fas fa-arrow-left" aria-hidden="true"></i> Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Meetings;
