import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

// React conversion of views/coordinator/coordinator_meetings.html

function CoordinatorMeetings() {
  const [form, setForm] = useState({ title: '', date: '', time: '', link: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null); // {type: 'success'|'error', text}

  const [organized, setOrganized] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [orgVisible, setOrgVisible] = useState(5);
  const [upcVisible, setUpcVisible] = useState(5);
  const rowsPerPage = 5;

  // Search states (mimic /js/searchbar.js behavior)
  const [orgSearch, setOrgSearch] = useState({ attr: 0, q: '' });
  const [upcSearch, setUpcSearch] = useState({ attr: 0, q: '' });

  const fetchOrganized = async () => {
    try {
      const res = await fetch('/coordinator/api/meetings/organized', { credentials: 'include' });
      const data = await res.json();
      setOrganized(Array.isArray(data) ? data : []);
      setOrgVisible(rowsPerPage);
    } catch (e) {
      console.error(e);
      setOrganized([]);
    }
  };

  const fetchUpcoming = async () => {
    try {
      const res = await fetch('/coordinator/api/meetings/upcoming', { credentials: 'include' });
      const data = await res.json();
      setUpcoming(Array.isArray(data) ? data : []);
      setUpcVisible(rowsPerPage);
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
    if (!form.link.trim()) newErrors.link = 'Meeting link is required.';
    else if (!(form.link.startsWith('http://') || form.link.startsWith('https://'))) newErrors.link = 'Meeting link must be a valid http or https URL.';

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
      const res = await fetch('/coordinator/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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

  const styles = {
    root: { fontFamily: 'Playfair Display, serif', backgroundColor: '#FFFDD0', color: '#2E8B57', minHeight: '100vh', padding: '2rem' },
    container: { maxWidth: 1200, margin: '0 auto' },
    h2: { fontFamily: 'Cinzel, serif', fontSize: '2.5rem', marginBottom: '2rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' },
    h3: { fontFamily: 'Cinzel, serif', fontSize: '1.8rem', margin: '2rem 0', textAlign: 'center' },
    card: { background: '#fff', padding: '2rem', borderRadius: 15, boxShadow: '0 4px 15px rgba(0,0,0,0.1)', marginBottom: '2rem' },
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' },
    inputGroup: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
    input: (err) => ({ padding: '1rem', border: `2px solid ${err ? '#c62828' : '#2E8B57'}`, borderRadius: 8, fontSize: '1rem' }),
    errorText: { color: '#c62828', fontSize: '0.9rem', marginTop: '0.2rem' },
    button: { backgroundColor: '#2E8B57', color: '#FFFDD0', border: 'none', padding: '1rem', borderRadius: 8, fontSize: '1.1rem', cursor: 'pointer', fontFamily: 'Cinzel, serif', fontWeight: 'bold', gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' },
    tableCard: { background: '#fff', padding: '2rem', borderRadius: 15, boxShadow: '0 4px 15px rgba(0,0,0,0.1)' },
    table: { width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' },
    th: { backgroundColor: '#2E8B57', color: '#FFFDD0', padding: '1.2rem', textAlign: 'left', fontFamily: 'Cinzel, serif' },
    td: { padding: '1rem', borderBottom: '1px solid rgba(46,139,87,0.2)' },
    trHover: { backgroundColor: 'rgba(135,206,235,0.1)' },
    joinLink: { backgroundColor: '#87CEEB', color: '#2E8B57', padding: '0.5rem 1rem', borderRadius: 20, textDecoration: 'none', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' },
    moreRow: { textAlign: 'center', margin: '1rem 0', display: 'flex', justifyContent: 'center', gap: '1rem' },
    moreBtn: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#87CEEB', color: '#2E8B57', textDecoration: 'none', padding: '0.8rem 1.5rem', borderRadius: 8, fontFamily: 'Cinzel, serif', fontWeight: 'bold', cursor: 'pointer', border: 'none' },
    emptyRow: { textAlign: 'center', padding: '2rem', color: '#2E8B57', fontStyle: 'italic' },
    backRow: { textAlign: 'right' },
    backLink: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#2E8B57', color: '#FFFDD0', textDecoration: 'none', padding: '0.8rem 1.5rem', borderRadius: 8, fontFamily: 'Cinzel, serif', fontWeight: 'bold' },
    searchRow: { marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' },
    searchInput: { padding: '0.6rem 1rem', maxWidth: 300, width: '100%', border: '2px solid #2E8B57', borderRadius: 8, fontFamily: 'Playfair Display, serif' },
    searchSelect: { padding: '0.6rem 1rem', maxWidth: 300, width: '100%', border: '2px solid #2E8B57', borderRadius: 8, fontFamily: 'Cinzel, serif', backgroundColor: '#fff', color: '#2E8B57' },
    alert: (type) => ({ padding: '1rem', borderRadius: 8, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: type === 'success' ? 'rgba(46,139,87,0.1)' : '#ffebee', color: type === 'success' ? '#2E8B57' : '#c62828' }),
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

  const renderTable = (rows, visible, setVisible) => {
    if (!rows || rows.length === 0) {
      return (
        <tbody>
          <tr>
            <td colSpan={4} style={styles.emptyRow}><i className="fas fa-info-circle" /> No meetings found.</td>
          </tr>
        </tbody>
      );
    }
    const slice = rows.slice(0, visible);
    return (
      <tbody>
        {slice.map((m, idx) => (
          <tr key={`${m.title}-${m.date}-${idx}`}>
            <td style={styles.td}>{m.title}</td>
            <td style={styles.td}>{new Date(m.date).toLocaleDateString()}</td>
            <td style={styles.td}>{m.time}</td>
            <td style={styles.td}><a href={m.link} target="_blank" rel="noreferrer" style={styles.joinLink}><i className="fas fa-video" /> Join</a></td>
          </tr>
        ))}
      </tbody>
    );
  };

  return (
    <div style={styles.root}>
      <div style={styles.container}>
        <h2 style={styles.h2}><span role="img" aria-label="calendar">📅</span> Schedule a Meeting</h2>

        <div style={styles.card}>
          {message ? (
            <div style={styles.alert(message.type)}>
              <i className={`fas ${message.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`} /> {message.text}
            </div>
          ) : null}

          <form onSubmit={onSubmit} style={styles.formGrid}>
            <div style={styles.inputGroup}>
              <label><i className="fas fa-heading" /> Meeting Title</label>
              <input type="text" name="title" placeholder="Enter meeting title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} style={styles.input(errors.title)} />
              {errors.title ? <div style={styles.errorText}>{errors.title}</div> : null}
            </div>
            <div style={styles.inputGroup}>
              <label><i className="fas fa-calendar" /> Date</label>
              <input type="date" name="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} style={styles.input(errors.date)} />
              {errors.date ? <div style={styles.errorText}>{errors.date}</div> : null}
            </div>
            <div style={styles.inputGroup}>
              <label><i className="fas fa-clock" /> Time</label>
              <input type="time" name="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} style={styles.input(errors.time)} />
              {errors.time ? <div style={styles.errorText}>{errors.time}</div> : null}
            </div>
            <div style={styles.inputGroup}>
              <label><i className="fas fa-link" /> Meeting Link</label>
              <input type="text" name="link" placeholder="Zoom/Google Meet link" value={form.link} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} style={styles.input(errors.link)} />
              {errors.link ? <div style={styles.errorText}>{errors.link}</div> : null}
            </div>
            <button type="submit" style={styles.button}><i className="fas fa-calendar-plus" /> Schedule Meeting</button>
          </form>
        </div>

        <div style={styles.tableCard}>
          <h3 style={styles.h3}>Organized Meetings</h3>
          <div style={styles.searchRow}>
            <select value={orgSearch.attr} onChange={(e) => setOrgSearch((s) => ({ ...s, attr: parseInt(e.target.value, 10) }))} style={styles.searchSelect}>
              <option value={0}>Title</option>
              <option value={1}>Date</option>
              <option value={2}>Time</option>
              <option value={3}>Link</option>
            </select>
            <input placeholder="Search..." value={orgSearch.q} onChange={(e) => setOrgSearch((s) => ({ ...s, q: e.target.value }))} style={styles.searchInput} />
          </div>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}><i className="fas fa-heading" /> Title</th>
                <th style={styles.th}><i className="fas fa-calendar" /> Date</th>
                <th style={styles.th}><i className="fas fa-clock" /> Time</th>
                <th style={styles.th}><i className="fas fa-link" /> Link</th>
              </tr>
            </thead>
            {renderTable(orgFiltered, orgVisible, setOrgVisible)}
          </table>
          <div style={styles.moreRow}>
            {orgVisible < orgFiltered.length ? (
              <button type="button" style={styles.moreBtn} onClick={() => setOrgVisible((v) => Math.min(v + rowsPerPage, orgFiltered.length))}><i className="fas fa-chevron-down" /> More</button>
            ) : null}
            {orgVisible > rowsPerPage ? (
              <button type="button" style={styles.moreBtn} onClick={() => setOrgVisible(rowsPerPage)}><i className="fas fa-chevron-up" /> Hide</button>
            ) : null}
          </div>

          <h3 style={styles.h3}>Upcoming Meetings</h3>
          <div style={styles.searchRow}>
            <select value={upcSearch.attr} onChange={(e) => setUpcSearch((s) => ({ ...s, attr: parseInt(e.target.value, 10) }))} style={styles.searchSelect}>
              <option value={0}>Title</option>
              <option value={1}>Date</option>
              <option value={2}>Time</option>
              <option value={3}>Link</option>
            </select>
            <input placeholder="Search..." value={upcSearch.q} onChange={(e) => setUpcSearch((s) => ({ ...s, q: e.target.value }))} style={styles.searchInput} />
          </div>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}><i className="fas fa-heading" /> Title</th>
                <th style={styles.th}><i className="fas fa-calendar" /> Date</th>
                <th style={styles.th}><i className="fas fa-clock" /> Time</th>
                <th style={styles.th}><i className="fas fa-link" /> Link</th>
              </tr>
            </thead>
            {renderTable(upcFiltered, upcVisible, setUpcVisible)}
          </table>
          <div style={styles.moreRow}>
            {upcVisible < upcFiltered.length ? (
              <button type="button" style={styles.moreBtn} onClick={() => setUpcVisible((v) => Math.min(v + rowsPerPage, upcFiltered.length))}><i className="fas fa-chevron-down" /> More</button>
            ) : null}
            {upcVisible > rowsPerPage ? (
              <button type="button" style={styles.moreBtn} onClick={() => setUpcVisible(rowsPerPage)}><i className="fas fa-chevron-up" /> Hide</button>
            ) : null}
          </div>

          <div style={styles.backRow}>
            <Link to="/coordinator/coordinator_dashboard" style={styles.backLink}><i className="fas fa-arrow-left" /> Back to Dashboard</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CoordinatorMeetings;
