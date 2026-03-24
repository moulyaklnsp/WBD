import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const AdminTournamentManagement = () => {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(5);
  const [attr, setAttr] = useState('name');
  const [query, setQuery] = useState('');

  const fetchTournaments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/admin/api/tournaments', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTournaments(Array.isArray(data?.tournaments) ? data.tournaments : []);
      setVisible(5);
    } catch (e) {
      setError('Failed to load tournaments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTournaments(); }, [fetchTournaments]);

  const filtered = useMemo(() => {
    if (!query.trim()) return tournaments;
    const q = query.toLowerCase();
    const getVal = (t) => {
      switch (attr) {
        case 'name': return t.name;
        case 'date': return t.date;
        case 'location': return t.location;
        case 'entry_fee': return `${t.entry_fee}`;
        case 'type': return t.type;
        case 'status': return t.status;
        case 'players': return `${t.player_count}`;
        default: return '';
      }
    };
    return tournaments.filter((t) => (getVal(t) || '').toString().toLowerCase().includes(q));
  }, [tournaments, query, attr]);

  const canMore = filtered.length > visible;
  const canHide = visible > 5;

  const styles = {
    page: { fontFamily: 'Playfair Display, serif', backgroundColor: '#FFFDD0', color: '#2E8B57', minHeight: '100vh', padding: '2rem' },
    container: { maxWidth: 1200, margin: '0 auto' },
    h2: { fontFamily: 'Cinzel, serif', fontSize: '2.5rem', color: '#2E8B57', marginBottom: '2rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' },
    h4: { color: '#2E8B57', fontSize: '1.2rem', marginBottom: '1.5rem', fontFamily: 'Cinzel, serif' },
    message: (type) => ({ padding: '1rem', borderRadius: 8, marginBottom: '1.5rem', textAlign: 'center', fontWeight: 'bold', backgroundColor: type === 'error' ? 'rgba(220,53,69,0.1)' : 'rgba(46,139,87,0.1)', color: type === 'error' ? '#dc3545' : '#2E8B57' }),
    tableDiv: { background: 'var(--card-bg)', borderRadius: 15, padding: '2rem', boxShadow: 'none', overflowX: 'auto', border: '1px solid var(--card-border)' },
    table: { width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' },
    th: { backgroundColor: '#2E8B57', color: '#FFFDD0', padding: '1.2rem', textAlign: 'left', fontFamily: 'Cinzel, serif', fontSize: '1.1rem' },
    td: { padding: '1rem', borderBottom: '1px solid rgba(46,139,87,0.2)' },
    statusBadge: (variant) => ({ padding: '.5rem 1rem', borderRadius: 20, fontSize: '.9rem', fontWeight: 'bold', display: 'inline-block', textAlign: 'center', backgroundColor: variant === 'active' ? 'rgba(46,139,87,0.1)' : 'rgba(255,193,7,0.1)', color: variant === 'active' ? '#2E8B57' : '#ffc107' }),
    backRight: { marginTop: '2rem', textAlign: 'right' },
    backLink: { display: 'inline-flex', alignItems: 'center', gap: '.5rem', backgroundColor: '#2E8B57', color: '#FFFDD0', textDecoration: 'none', padding: '.8rem 1.5rem', borderRadius: 8, transition: 'all .3s ease', fontFamily: 'Cinzel, serif', fontWeight: 'bold' },
    moreWrap: { textAlign: 'center', margin: '1rem 0', display: 'flex', justifyContent: 'center', gap: '1rem' },
    moreBtn: { display: 'inline-flex', alignItems: 'center', gap: '.5rem', backgroundColor: '#87CEEB', color: '#2E8B57', textDecoration: 'none', padding: '.8rem 1.5rem', borderRadius: 8, transition: 'all .3s ease', fontFamily: 'Cinzel, serif', fontWeight: 'bold', cursor: 'pointer' },
    rowCounter: { textAlign: 'center', marginBottom: '1rem', fontFamily: 'Cinzel, serif', fontSize: '1.2rem', color: '#2E8B57', backgroundColor: 'rgba(46,139,87,0.1)', padding: '.5rem 1rem', borderRadius: 8, display: 'inline-block' },
    empty: { textAlign: 'center', padding: '2rem', color: '#2E8B57', fontStyle: 'italic' },
    searchBar: { display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: '#f5f5f5', borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.1)', maxWidth: 500, margin: '20px auto' },
    select: { padding: '8px 12px', borderRadius: 8, border: '1px solid #ccc', backgroundColor: '#fff', fontSize: 14 },
    input: { flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #ccc', fontSize: 14 },
  };

  const shown = filtered.slice(0, visible);
  const counterText = `${Math.min(visible, filtered.length)} / ${filtered.length}`;

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h2 style={styles.h2}><span role="img" aria-label="king">♔</span> Tournament Oversight</h2>

        {error && <div style={styles.message('error')}>{error}</div>}

        <div style={styles.tableDiv}>
          <h4 style={styles.h4}><i className="fas fa-chess-board" /> Tournament Overview</h4>

          <div style={{ textAlign: 'center' }}>
            <span style={styles.rowCounter}>{counterText}</span>
          </div>

          <div style={styles.searchBar}>
            <select aria-label="Attribute" value={attr} onChange={(e) => { setAttr(e.target.value); setVisible(5); }} style={styles.select}>
              <option value="name">Name</option>
              <option value="date">Date</option>
              <option value="location">Location</option>
              <option value="entry_fee">Entry Fee</option>
              <option value="type">Type</option>
              <option value="status">Status</option>
              <option value="players">Players</option>
            </select>
            <input aria-label="Search" placeholder="Search…" value={query} onChange={(e) => { setQuery(e.target.value); setVisible(5); }} style={styles.input} />
          </div>

          {loading ? (
            <table style={styles.table}><tbody><tr><td colSpan={7} style={styles.empty}><i className="fas fa-info-circle" /> Loading tournaments…</td></tr></tbody></table>
          ) : (
            <>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}><i className="fas fa-trophy" /> Name</th>
                    <th style={styles.th}><i className="far fa-calendar" /> Date</th>
                    <th style={styles.th}><i className="fas fa-map-marker-alt" /> Location</th>
                    <th style={styles.th}><i className="fas fa-rupee-sign" /> Entry Fee</th>
                    <th style={styles.th}><i className="fas fa-chess" /> Type</th>
                    <th style={styles.th}><i className="fas fa-info-circle" /> Status</th>
                    <th style={styles.th}><i className="fas fa-users" /> Players</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.length === 0 ? (
                    <tr><td colSpan={7} style={styles.empty}><i className="fas fa-info-circle" /> No approved tournaments available.</td></tr>
                  ) : (
                    shown.map((t, idx) => (
                      <tr key={`${t._id || t.name}-${idx}`}>
                        <td style={styles.td}>{t.name}</td>
                        <td style={styles.td}>{t.date}</td>
                        <td style={styles.td}>{t.location}</td>
                        <td style={styles.td}>₹{t.entry_fee}</td>
                        <td style={styles.td}>{t.type}</td>
                        <td style={styles.td}>
                          <span style={styles.statusBadge((t.status || '').toLowerCase() === 'running' ? 'active' : 'pending')}>{t.status}</span>
                        </td>
                        <td style={styles.td}>{t.player_count}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <div style={styles.moreWrap}>
                {canMore && (
                  <button type="button" style={styles.moreBtn} onClick={() => setVisible((v) => Math.min(v + 5, filtered.length))}>
                    <i className="fas fa-chevron-down" /> More
                  </button>
                )}
                {canHide && (
                  <button type="button" style={styles.moreBtn} onClick={() => setVisible(5)}>
                    <i className="fas fa-chevron-up" /> Hide
                  </button>
                )}
              </div>
            </>
          )}

          <div style={styles.backRight}>
            <Link to="/admin/admin_dashboard" style={styles.backLink}>
              <i className="fas fa-arrow-left" /> Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminTournamentManagement;
