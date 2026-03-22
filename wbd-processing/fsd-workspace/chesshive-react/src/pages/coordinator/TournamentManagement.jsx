import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

// React conversion of views/coordinator/tournament_management.html

const ROWS_PER_PAGE = 5;

function TournamentManagement() {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(null); // { type: 'success'|'error', text: string }
  const [visibleRows, setVisibleRows] = useState(ROWS_PER_PAGE);

  // Form state
  const [form, setForm] = useState({
    tournamentName: '',
    tournamentDate: '',
    tournamentTime: '',
    tournamentLocation: '',
    entryFee: '',
    type: '',
    noOfRounds: ''
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [, setSearchParams] = useSearchParams();

  const showMessage = (text, type = 'success') => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const fetchTournaments = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/coordinator/api/tournaments', { credentials: 'include' });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data?.tournaments) ? data.tournaments : [];
      setTournaments(list);
      setVisibleRows(ROWS_PER_PAGE);
    } catch (e) {
      console.error('Fetch tournaments error:', e);
      setError('Error fetching tournaments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTournaments();
  }, []);

  // Filter out removed tournaments
  const activeTournaments = useMemo(
    () => tournaments.filter((t) => t.status !== 'Removed'),
    [tournaments]
  );

  // Compute status based on 1-hour duration window using date + time
  const computeStatus = (t) => {
    let status = t.status || 'Pending';
    let statusClass = 'pending';
    const dateOnly = new Date(t.date);
    const timeStr = (t.time || '').toString(); // expected HH:MM (24h)
    // Build start Date from date + time
    const [hh, mm] = (timeStr.match(/^\d{2}:\d{2}$/) ? timeStr.split(':') : ['00', '00']);
    const start = new Date(dateOnly);
    if (!isNaN(parseInt(hh)) && !isNaN(parseInt(mm))) {
      start.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0);
    }
    const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour duration
    const now = new Date();

    if (t.status === 'Approved' || t.status === 'Ongoing') {
      if (now >= end) {
        status = 'Completed';
        statusClass = 'completed';
      } else if (now >= start && now < end) {
        status = 'Ongoing';
        statusClass = 'ongoing';
      } else if (now < start) {
        status = 'Yet to Start';
        statusClass = 'yet-to-start';
      }
    } else if (t.status === 'Completed') {
      status = 'Completed';
      statusClass = 'completed';
    } else if (t.status === 'Removed') {
      status = 'Removed';
      statusClass = 'removed';
    } else {
      status = 'Pending';
      statusClass = 'pending';
    }

    return { status, statusClass, dateObj: dateOnly };
  };

  const validate = () => {
    const errors = {};
    const name = form.tournamentName.trim();
    if (!name) errors.tournamentName = 'Tournament name is required.';
    else if (name.length < 3) errors.tournamentName = 'Tournament name must be at least 3 characters long.';
    else if (!/^[a-zA-Z0-9\s\-&]+$/.test(name)) errors.tournamentName = 'Only letters, numbers, spaces, hyphens, and & are allowed.';

    if (!form.tournamentDate) errors.tournamentDate = 'Date is required.';
    else {
      const inputDate = new Date(form.tournamentDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (isNaN(inputDate.getTime())) errors.tournamentDate = 'Invalid date format.';
      else if (inputDate < today) errors.tournamentDate = 'Date cannot be in the past.';
    }

    const time = form.tournamentTime.trim();
    if (!time) errors.tournamentTime = 'Time is required.';
    else if (!/^\d{2}:\d{2}$/.test(time)) errors.tournamentTime = 'Invalid time format (use HH:MM).';

    const location = form.tournamentLocation.trim();
    if (!location) errors.tournamentLocation = 'Location is required.';
    else if (location.length < 3) errors.tournamentLocation = 'Location must be at least 3 characters long.';

    const entryFee = parseFloat(form.entryFee);
    if (isNaN(entryFee)) errors.entryFee = 'Entry fee is required.';
    else if (entryFee < 0) errors.entryFee = 'Entry fee cannot be negative.';

    if (!form.type) errors.type = 'Please select a tournament type.';

    const noOfRounds = parseInt(form.noOfRounds);
    if (isNaN(noOfRounds)) errors.noOfRounds = 'Number of rounds is required.';
    else if (noOfRounds <= 0) errors.noOfRounds = 'Number of rounds must be a positive integer.';
    else if (noOfRounds > 100) errors.noOfRounds = 'Number of rounds cannot exceed 100.';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const resetForm = () => {
    setForm({
      tournamentName: '',
      tournamentDate: '',
      tournamentTime: '',
      tournamentLocation: '',
      entryFee: '',
      type: '',
      noOfRounds: ''
    });
    setFieldErrors({});
    setEditingId(null);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      showMessage('Please correct the errors in the form.', 'error');
      return;
    }
    const payload = {
      // camelCase fields used by React API
      tournamentName: form.tournamentName.trim(),
      tournamentDate: form.tournamentDate,
      time: form.tournamentTime.trim(),
      location: form.tournamentLocation.trim(),
      entryFee: typeof form.entryFee === 'string' ? parseFloat(form.entryFee) : form.entryFee,
      type: form.type,
      noOfRounds: typeof form.noOfRounds === 'string' ? parseInt(form.noOfRounds, 10) : form.noOfRounds,
      // snake_case fields for legacy API compatibility
      name: form.tournamentName.trim(),
      date: form.tournamentDate,
      entry_fee: typeof form.entryFee === 'string' ? parseFloat(form.entryFee) : form.entryFee,
      no_of_rounds: typeof form.noOfRounds === 'string' ? parseInt(form.noOfRounds, 10) : form.noOfRounds,
      tournamentTime: form.tournamentTime.trim(),
      tournamentLocation: form.tournamentLocation.trim(),
    };
    try {
      const endpoint = editingId ? `/coordinator/api/tournaments/${editingId}` : '/coordinator/api/tournaments';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to submit tournament');
      showMessage(data.message || (editingId ? 'Tournament updated successfully!' : 'Tournament added successfully!'), 'success');
      resetForm();
      await fetchTournaments();
    } catch (err) {
      console.error('Submit error:', err);
      showMessage(`Failed to submit tournament: ${err.message}`, 'error');
    }
  };

  const onEdit = (id) => {
    const t = tournaments.find((x) => x._id === id);
    if (!t) return;
    setEditingId(id);
    setForm({
      tournamentName: t.name || t.tournamentName || '',
      tournamentDate: t.date ? new Date(t.date).toISOString().split('T')[0] : (t.tournamentDate || ''),
      tournamentTime: t.time || t.tournamentTime || '',
      tournamentLocation: t.location || t.tournamentLocation || '',
      entryFee: (typeof t.entry_fee !== 'undefined' ? t.entry_fee : (typeof t.entryFee !== 'undefined' ? t.entryFee : '')),
      type: t.type || '',
      noOfRounds: (typeof t.no_of_rounds !== 'undefined' ? t.no_of_rounds : (typeof t.noOfRounds !== 'undefined' ? t.noOfRounds : ''))
    });
    // preserve current filters in URL if any (optional)
    setSearchParams((prev) => prev);
  };

  const onRemove = async (id) => {
    try {
      const res = await fetch(`/coordinator/api/tournaments/${id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to remove tournament');
      showMessage('Tournament removed', 'success');
      setTournaments((ts) => ts.filter((t) => t._id !== id));
    } catch (err) {
      console.error('Remove error:', err);
      showMessage('Error removing tournament', 'error');
    }
  };

  const requestFeedback = async (id) => {
    try {
      const res = await fetch(`/coordinator/api/tournaments/${id}/request-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to request feedback');
      showMessage('Feedback requested successfully', 'success');
      await fetchTournaments();
    } catch (err) {
      console.error('Request feedback error:', err);
      showMessage('Error requesting feedback', 'error');
    }
  };

  const styles = {
    root: { fontFamily: 'Playfair Display, serif', backgroundColor: '#FFFDD0', minHeight: '100vh', padding: '2rem' },
    container: { maxWidth: 1200, margin: '0 auto' },
    h2: { fontFamily: 'Cinzel, serif', fontSize: '2.5rem', color: '#2E8B57', marginBottom: '2rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' },
    card: { background: 'var(--card-bg)', borderRadius: 15, padding: '2rem', boxShadow: 'none', marginBottom: '2rem', border: '1px solid var(--card-border)' },
    label: { fontFamily: 'Cinzel, serif', color: '#2E8B57', marginBottom: 8, display: 'block' },
    input: (hasError) => ({ width: '100%', padding: '0.8rem', border: `2px solid ${hasError ? '#c62828' : '#2E8B57'}`, borderRadius: 8, fontFamily: 'Playfair Display, serif' }),
    select: (hasError) => ({ width: '100%', padding: '0.8rem', border: `2px solid ${hasError ? '#c62828' : 'var(--sea-green)'}`, borderRadius: 8, fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', background: 'var(--card-bg)' }),
    error: { color: '#c62828', fontSize: '0.9rem', marginTop: 4 },
    btn: { background: '#2E8B57', color: '#fff', border: 'none', padding: '1rem', borderRadius: 8, cursor: 'pointer', fontFamily: 'Cinzel, serif', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', width: '100%' },
    tableCard: { background: 'var(--card-bg)', borderRadius: 15, padding: '2rem', boxShadow: 'none', border: '1px solid var(--card-border)' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { background: '#2E8B57', color: '#fff', padding: '1rem', textAlign: 'left', fontFamily: 'Cinzel, serif' },
    td: { padding: '1rem', borderBottom: '1px solid rgba(46, 139, 87, 0.2)' },
    rowHover: { backgroundColor: 'rgba(135, 206, 235, 0.1)' },
    status: (klass) => ({ fontWeight: 'bold', color: klass === 'completed' ? '#2E8B57' : klass === 'ongoing' ? '#87CEEB' : klass === 'yet-to-start' ? '#666' : '#c62828' }),
    actionBtn: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#87CEEB', color: '#2E8B57', textDecoration: 'none', padding: '0.5rem 1rem', borderRadius: 8, fontFamily: 'Cinzel, serif', fontWeight: 'bold', margin: '0.2rem', border: 'none', cursor: 'pointer' },
    removeBtn: { background: '#c62828', color: '#FFFDD0', border: 'none', padding: '0.5rem 1rem', borderRadius: 8, fontFamily: 'Cinzel, serif', fontWeight: 'bold', margin: '0.2rem', cursor: 'pointer' },
    moreWrap: { textAlign: 'center', margin: '1rem 0', display: 'flex', justifyContent: 'center', gap: '1rem' },
    moreBtn: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#87CEEB', color: '#2E8B57', textDecoration: 'none', padding: '0.8rem 1.5rem', borderRadius: 8, fontFamily: 'Cinzel, serif', fontWeight: 'bold', cursor: 'pointer', border: 'none' },
    backRow: { textAlign: 'right', marginTop: '2rem' },
    backLink: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#2E8B57', color: '#fff', textDecoration: 'none', padding: '0.8rem 1.5rem', borderRadius: 8, fontFamily: 'Cinzel, serif', fontWeight: 'bold' }
  };

  return (
    <div style={styles.root}>
      <div style={styles.container}>
        <h2 style={styles.h2}><span role="img" aria-label="trophy">🏆</span> Tournament Management</h2>

        <div style={styles.card}>
          {message && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: 8, color: message.type === 'success' ? '#1b5e20' : '#c62828', background: message.type === 'success' ? 'rgba(76,175,80,0.15)' : 'rgba(198,40,40,0.15)' }}>
              <i className={`fas ${message.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`} aria-hidden="true" /> {message.text}
            </div>
          )}
          <h3 style={{ fontFamily: 'Cinzel, serif', color: '#2E8B57', marginBottom: '1rem' }}>{editingId ? 'Edit Tournament' : 'Add New Tournament'}</h3>
          <form onSubmit={onSubmit}>
            <div>
              <label style={styles.label}>Tournament Name:</label>
              <input
                style={styles.input(!!fieldErrors.tournamentName)}
                type="text"
                value={form.tournamentName}
                onChange={(e) => setForm({ ...form, tournamentName: e.target.value })}
                required
              />
              {fieldErrors.tournamentName && <div style={styles.error}>{fieldErrors.tournamentName}</div>}
            </div>
            <div>
              <label style={styles.label}>Date:</label>
              <input
                style={styles.input(!!fieldErrors.tournamentDate)}
                type="date"
                value={form.tournamentDate}
                onChange={(e) => setForm({ ...form, tournamentDate: e.target.value })}
                required
              />
              {fieldErrors.tournamentDate && <div style={styles.error}>{fieldErrors.tournamentDate}</div>}
            </div>
            <div>
              <label style={styles.label}>Time:</label>
              <input
                style={styles.input(!!fieldErrors.tournamentTime)}
                type="time"
                value={form.tournamentTime}
                onChange={(e) => setForm({ ...form, tournamentTime: e.target.value })}
                required
              />
              {fieldErrors.tournamentTime && <div style={styles.error}>{fieldErrors.tournamentTime}</div>}
            </div>
            <div>
              <label style={styles.label}>Location:</label>
              <input
                style={styles.input(!!fieldErrors.tournamentLocation)}
                type="text"
                value={form.tournamentLocation}
                onChange={(e) => setForm({ ...form, tournamentLocation: e.target.value })}
                required
              />
              {fieldErrors.tournamentLocation && <div style={styles.error}>{fieldErrors.tournamentLocation}</div>}
            </div>
            <div>
              <label style={styles.label}>Entry Fee (₹):</label>
              <input
                style={styles.input(!!fieldErrors.entryFee)}
                type="number"
                step="0.01"
                value={form.entryFee}
                onChange={(e) => setForm({ ...form, entryFee: e.target.value })}
                required
              />
              {fieldErrors.entryFee && <div style={styles.error}>{fieldErrors.entryFee}</div>}
            </div>
            <div>
              <label style={styles.label}>Type:</label>
              <select
                style={styles.select(!!fieldErrors.type)}
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                required
              >
                <option value="" disabled>Select Type</option>
                <option value="Individual">Individual</option>
                <option value="Team">Team</option>
              </select>
              {fieldErrors.type && <div style={styles.error}>{fieldErrors.type}</div>}
            </div>
            <div>
              <label style={styles.label}>No of Rounds:</label>
              <input
                style={styles.input(!!fieldErrors.noOfRounds)}
                type="number"
                value={form.noOfRounds}
                onChange={(e) => setForm({ ...form, noOfRounds: e.target.value })}
                required
              />
              {fieldErrors.noOfRounds && <div style={styles.error}>{fieldErrors.noOfRounds}</div>}
            </div>
            <button type="submit" style={styles.btn}>{editingId ? 'Update Tournament' : 'Add Tournament'}</button>
          </form>
        </div>

        <div style={styles.tableCard}>
          <h3 style={{ fontFamily: 'Cinzel, serif', color: '#2E8B57', marginBottom: '0.5rem' }}>Your Tournaments</h3>
          <h4 style={{ color: '#666', marginBottom: '1rem' }}>Tournaments you've submitted will appear here with their approval status</h4>

          {loading && <div>Loading tournaments…</div>}
          {!loading && !!error && (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#2E8B57', fontStyle: 'italic' }}>
              <i className="fas fa-info-circle" aria-hidden="true"></i> {error}
            </div>
          )}
          {!loading && !error && activeTournaments.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#2E8B57', fontStyle: 'italic' }}>
              <i className="fas fa-info-circle" aria-hidden="true"></i> No tournaments available.
            </div>
          )}

          {!loading && !error && activeTournaments.length > 0 && (
            <>
              <div className="table-responsive">
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}><i className="fas fa-trophy" aria-hidden="true"></i> Name</th>
                    <th style={styles.th}><i className="fas fa-calendar" aria-hidden="true"></i> Date</th>
                    <th style={styles.th}>Time</th>
                    <th style={styles.th}><i className="fas fa-map-marker-alt" aria-hidden="true"></i> Location</th>
                    <th style={styles.th}><i className="fas fa-rupee-sign" aria-hidden="true"></i> Entry Fee</th>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>No Of Rounds</th>
                    <th style={styles.th}><i className="fas fa-info-circle" aria-hidden="true"></i> Status</th>
                    <th style={styles.th}><i className="fas fa-cogs" aria-hidden="true"></i> Actions</th>
                    <th style={styles.th}><i className="fas fa-cogs" aria-hidden="true"></i> Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTournaments.map((t, idx) => {
                    const { status, statusClass, dateObj } = computeStatus(t);
                    const hidden = idx >= visibleRows;
                    return (
                      <tr key={t._id || idx} style={hidden ? { display: 'none' } : undefined}>
                        <td style={styles.td}>{t.name}</td>
                        <td style={styles.td}>{isNaN(dateObj) ? '' : dateObj.toLocaleDateString()}</td>
                        <td style={styles.td}>{t.time}</td>
                        <td style={styles.td}>{t.location}</td>
                        <td style={styles.td}>₹{typeof t.entry_fee !== 'undefined' ? t.entry_fee : t.entryFee}</td>
                        <td style={styles.td}>{t.type}</td>
                        <td style={styles.td}>{typeof t.no_of_rounds !== 'undefined' ? t.no_of_rounds : t.noOfRounds}</td>
                        <td style={{ ...styles.td, ...styles.status(statusClass) }}><i className="fas fa-circle" aria-hidden="true"></i> {status}</td>
                        <td style={styles.td}>
                          {t.status === 'Approved' && (
                            <>
                              <Link to={`/coordinator/enrolled_players?tournament_id=${t._id}`} style={styles.actionBtn}>
                                <i className="fas fa-users" aria-hidden="true"></i> Players
                              </Link>
                              {t.type === 'Individual' && (
                                <>
                                  <Link to={`/coordinator/pairings?tournament_id=${t._id}&rounds=${typeof t.no_of_rounds !== 'undefined' ? t.no_of_rounds : t.noOfRounds}`} style={styles.actionBtn}>
                                    <i className="fas fa-chess-board" aria-hidden="true"></i> Pairings
                                  </Link>
                                  <Link to={`/coordinator/rankings?tournament_id=${t._id}`} style={styles.actionBtn}>
                                    <i className="fas fa-medal" aria-hidden="true"></i> Rankings
                                  </Link>
                                </>
                              )}
                            </>
                          )}
                          {/* Helpful: Edit button */}
                          <button style={styles.actionBtn} onClick={() => onEdit(t._id)}>
                            <i className="fas fa-edit" aria-hidden="true"></i> Edit
                          </button>
                        </td>
                        <td style={styles.td}>
                          <button style={styles.removeBtn} onClick={() => onRemove(t._id)}>
                            <i className="fas fa-trash" aria-hidden="true"></i> Remove
                          </button>
                          {(['Ongoing', 'Completed'].includes(status)) ? (
                            t.feedback_requested ? (
                              <a href={`/coordinator/feedback_view?tournament_id=${t._id}`} target="_blank" rel="noreferrer" style={styles.actionBtn}>
                                <i className="fas fa-eye" aria-hidden="true"></i> View Feedback
                              </a>
                            ) : (
                              <button style={styles.actionBtn} onClick={() => requestFeedback(t._id)}>
                                <i className="fas fa-paper-plane" aria-hidden="true"></i> Send Feedback Form
                              </button>
                            )
                          ) : (
                            <button style={{ ...styles.actionBtn, opacity: 0.6, cursor: 'not-allowed' }} title="Available when tournament starts" disabled>
                              <i className="fas fa-paper-plane" aria-hidden="true"></i> Send Feedback Form
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>

              <div style={styles.moreWrap}>
                {visibleRows < activeTournaments.length && (
                  <button style={styles.moreBtn} onClick={() => setVisibleRows((v) => Math.min(v + ROWS_PER_PAGE, activeTournaments.length))}>
                    <i className="fas fa-trophy" aria-hidden="true"></i> More
                  </button>
                )}
                {visibleRows > ROWS_PER_PAGE && (
                  <button style={styles.moreBtn} onClick={() => setVisibleRows(ROWS_PER_PAGE)}>
                    <i className="fas fa-chevron-up" aria-hidden="true"></i> Hide
                  </button>
                )}
              </div>
            </>
          )}

          <div style={styles.backRow}>
            <Link to="/coordinator/coordinator_dashboard" style={styles.backLink}>
              <i className="fas fa-arrow-left" aria-hidden="true"></i> Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TournamentManagement;
