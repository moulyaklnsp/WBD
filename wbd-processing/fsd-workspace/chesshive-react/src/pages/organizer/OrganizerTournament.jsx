import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

const OrganizerTournament = () => {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [visibleCount, setVisibleCount] = useState(5);
  const [searchAttr, setSearchAttr] = useState('name');
  const [query, setQuery] = useState('');
  const timeoutRef = useRef(null);

  const clearMessageLater = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setMessage({ type: '', text: '' });
      timeoutRef.current = null;
    }, 3000);
  }, []);

  const showMessage = useCallback((text, type = 'success') => {
    setMessage({ type, text });
    clearMessageLater();
  }, [clearMessageLater]);

  const fetchTournaments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/organizer/api/tournaments', { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 403) {
          setError('Unauthorized. Please login as an organizer.');
          return;
        }
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${text}`);
      }
      const data = await res.json().catch(() => ({}));
      const raw = Array.isArray(data?.tournaments) ? data.tournaments : [];
      // Normalize fields (accept both snake_case and camelCase or legacy keys)
      const normalized = raw.map((t) => {
        const name = t.name ?? t.tournamentName ?? '';
        const date = t.date ?? t.tournamentDate ?? null;
        const location = t.location ?? t.tournamentLocation ?? '';
        const entry_fee = (t.entry_fee ?? t.entryFee ?? t.fee ?? 0);
        const type = t.type ?? t.format ?? '';
        const added_by = t.added_by ?? t.addedBy ?? t.coordinator ?? '';
        const approved_by = t.approved_by ?? t.approvedBy ?? '';
        const status = t.status ?? 'Pending';
        return {
          _id: t._id || t.id || `${name}-${date}-${location}`,
          name,
          date,
          location,
          entry_fee,
          type,
          added_by,
          approved_by,
          status,
        };
      });
      setTournaments(normalized);
      setVisibleCount(5);
    } catch (e) {
      console.error('Tournaments load error:', e);
      setError('Failed to load tournaments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTournaments();
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [fetchTournaments]);

  const filtered = useMemo(() => {
    if (!query.trim()) return tournaments;
    const q = query.toLowerCase();
    const getVal = (t) => {
      switch (searchAttr) {
        case 'name': return t.name;
        case 'date': return t.date ? new Date(t.date).toLocaleDateString() : '';
        case 'location': return t.location;
        case 'entry_fee': return `${t.entry_fee}`;
        case 'type': return t.type;
        case 'added_by': return t.added_by;
        case 'status': return t.status;
        default: return '';
      }
    };
    return tournaments.filter(t => (getVal(t) || '').toString().toLowerCase().includes(q));
  }, [tournaments, query, searchAttr]);

  const canShowMore = filtered.length > visibleCount;

  const handleMore = () => setVisibleCount(v => Math.min(v + 5, filtered.length));
  const handleHide = () => setVisibleCount(5);

  const updateTournament = async (id, action) => {
    try {
      const res = await fetch(`/organizer/api/tournaments/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tournamentId: id }),
      });
      const data = await res.json();
      if (res.ok && (data?.success ?? false)) {
        showMessage(`Tournament ${action}d successfully.`, 'success');
        fetchTournaments();
      } else {
        showMessage(data?.message || `Failed to ${action} tournament.`, 'error');
      }
    } catch (e) {
      showMessage(`Error: Could not ${action} tournament.`, 'error');
    }
  };

  const styles = {
    page: { fontFamily: 'Playfair Display, serif', backgroundColor: '#FFFDD0', minHeight: '100vh', padding: '2rem' },
    container: { maxWidth: 1200, margin: '0 auto' },
    h2: {
      fontFamily: 'Cinzel, serif', color: '#2E8B57', textAlign: 'center', marginBottom: '1.5rem',
      fontSize: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem'
    },
    h3: { fontFamily: 'Cinzel, serif', color: '#2E8B57', textAlign: 'center', marginBottom: '1.5rem' },
    tableDiv: { background: 'var(--card-bg)', borderRadius: 15, padding: '2rem', boxShadow: 'none', marginBottom: '2rem', overflowX: 'auto', border: '1px solid var(--card-border)' },
    message: (type) => ({ padding: '1rem', borderRadius: 8, marginBottom: '1.5rem', textAlign: 'center',
      backgroundColor: type === 'success' ? 'rgba(46,139,87,0.1)' : '#ffebee', color: type === 'success' ? '#2E8B57' : '#c62828' }),
    table: { width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' },
    th: { backgroundColor: '#2E8B57', color: '#FFFDD0', padding: '1rem', textAlign: 'left', fontFamily: 'Cinzel, serif' },
    td: { padding: '1rem', borderBottom: '1px solid rgba(46,139,87,0.2)' },
    rowHover: { backgroundColor: 'rgba(135,206,235,0.1)' },
    approvedBy: { fontStyle: 'italic', color: '#2E8B57', fontSize: '.9rem' },
    actionBtns: { display: 'flex', gap: '.5rem' },
    approveBtn: { padding: '.6rem 1rem', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'Cinzel, serif', fontWeight: 'bold', backgroundColor: '#2E8B57', color: '#FFFDD0', display: 'flex', alignItems: 'center', gap: '.5rem' },
    rejectBtn: { padding: '.6rem 1rem', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'Cinzel, serif', fontWeight: 'bold', backgroundColor: '#dc3545', color: '#fff', display: 'flex', alignItems: 'center', gap: '.5rem' },
    statusBadge: (variant) => ({ padding: '.5rem 1rem', borderRadius: 20, fontSize: '.9rem', fontWeight: 'bold', textAlign: 'center', display: 'inline-block',
      backgroundColor: variant === 'active' ? 'rgba(46,139,87,0.1)' : 'rgba(255,193,7,0.1)', color: variant === 'active' ? '#2E8B57' : '#ffc107' }),
    moreContainer: { textAlign: 'center', margin: '1rem 0', display: 'flex', justifyContent: 'center', gap: '1rem' },
    moreBtn: { display: 'inline-flex', alignItems: 'center', gap: '.5rem', backgroundColor: '#87CEEB', color: '#2E8B57', textDecoration: 'none', padding: '.8rem 1.5rem', borderRadius: 8, transition: 'all .3s ease', fontFamily: 'Cinzel, serif', fontWeight: 'bold', cursor: 'pointer' },
    backRight: { textAlign: 'right' },
    backLink: { display: 'inline-flex', alignItems: 'center', gap: '.5rem', backgroundColor: '#2E8B57', color: '#FFFDD0', textDecoration: 'none', padding: '.8rem 1.5rem', borderRadius: 8, transition: 'all .3s ease', fontFamily: 'Cinzel, serif', fontWeight: 'bold' },
    searchBarContainer: { display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: '#f5f5f5', borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.1)', maxWidth: 500, margin: '20px auto' },
    select: { padding: '8px 12px', borderRadius: 8, border: '1px solid var(--card-border)', backgroundColor: 'var(--card-bg)', fontSize: 14 },
    input: { flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #ccc', fontSize: 14 },
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h2 style={styles.h2}><span role="img" aria-label="trophy">🏆</span> Tournament Management</h2>

        {message.text && (
          <div style={styles.message(message.type)}>
            <i className={`fas ${message.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`} /> {message.text}
          </div>
        )}

        <div style={styles.tableDiv}>
          <h3 style={styles.h3}>Tournament Approval &amp; Management</h3>

          <div style={styles.searchBarContainer}>
            <select aria-label="Attribute" value={searchAttr} onChange={(e) => setSearchAttr(e.target.value)} style={styles.select}>
              <option value="name">Name</option>
              <option value="date">Date</option>
              <option value="location">Location</option>
              <option value="entry_fee">Entry Fee</option>
              <option value="type">Type</option>
              <option value="added_by">Added By</option>
              <option value="status">Status</option>
            </select>
            <input aria-label="Search" type="text" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} style={styles.input} />
          </div>

          {loading ? (
            <p>Loading tournaments…</p>
          ) : error ? (
            <p style={{ color: '#c62828', textAlign: 'center' }}>{error}</p>
          ) : (
            <>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}><i className="fas fa-trophy" /> Name</th>
                    <th style={styles.th}><i className="fas fa-calendar" /> Date</th>
                    <th style={styles.th}><i className="fas fa-map-marker-alt" /> Location</th>
                    <th style={styles.th}><i className="fas fa-coins" /> Entry Fee</th>
                    <th style={styles.th}><i className="fas fa-users" /> Type</th>
                    <th style={styles.th}><i className="fas fa-user" /> Added By</th>
                    <th style={styles.th}><i className="fas fa-info-circle" /> Status</th>
                    <th style={styles.th}><i className="fas fa-cogs" /> Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td style={styles.td} colSpan={8}>
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                          <i className="fas fa-info-circle" /> No tournaments available for review.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filtered.slice(0, visibleCount).map((t) => (
                      <tr key={t._id}>
                        <td style={styles.td}>{t.name}</td>
                        <td style={styles.td}>{t.date ? new Date(t.date).toLocaleDateString() : ''}</td>
                        <td style={styles.td}>{t.location}</td>
                        <td style={styles.td}>₹{t.entry_fee}</td>
                        <td style={styles.td}>{t.type}</td>
                        <td style={styles.td}>{t.added_by}</td>
                        <td style={styles.td}>
                          {t.status === 'Approved' ? (
                            <>
                              <span style={styles.statusBadge('active')}><i className="fas fa-check-circle" /> Approved</span>
                              <div style={styles.approvedBy}>by {t.approved_by || ''}</div>
                            </>
                          ) : (
                            <span style={styles.statusBadge('pending')}><i className="fas fa-clock" /> {t.status || 'Pending'}</span>
                          )}
                        </td>
                        <td style={styles.td}>
                          {!t.status || t.status === 'Pending' ? (
                            <div style={styles.actionBtns}>
                              <button type="button" style={styles.approveBtn} onClick={() => updateTournament(t._id, 'approve')}>
                                <i className="fas fa-check" /> Approve
                              </button>
                              <button type="button" style={styles.rejectBtn} onClick={() => updateTournament(t._id, 'reject')}>
                                <i className="fas fa-times" /> Reject
                              </button>
                            </div>
                          ) : (
                            <span>{t.status}</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <div style={styles.moreContainer}>
                {canShowMore && (
                  <button type="button" style={styles.moreBtn} onClick={handleMore}>
                    <i className="fas fa-chevron-down" /> More
                  </button>
                )}
                {visibleCount > 5 && (
                  <button type="button" style={styles.moreBtn} onClick={handleHide}>
                    <i className="fas fa-chevron-up" /> Hide
                  </button>
                )}
              </div>
            </>
          )}

          <div style={styles.backRight}>
            <Link to="/organizer/organizer_dashboard" style={styles.backLink}>
              <i className="fas fa-arrow-left" /> Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrganizerTournament;
