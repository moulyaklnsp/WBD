import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAsOrganizer } from '../../utils/fetchWithRole';
import '../../styles/playerNeoNoir.css';
import { motion } from 'framer-motion';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import AnimatedSidebar from '../../components/AnimatedSidebar';
import { organizerLinks } from '../../constants/organizerLinks';

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

const OrganizerTournament = () => {
  const [isDark, toggleTheme] = usePlayerTheme();
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
      const res = await fetchAsOrganizer('/organizer/api/tournaments');
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
      const res = await fetchAsOrganizer(`/organizer/api/tournaments/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        .table { width:100%; border-collapse:collapse; margin-bottom:1rem; }
        .th { background:var(--sea-green); color:var(--on-accent); padding:1rem; text-align:left; font-family:'Cinzel', serif; }
        .td { padding:1rem; border-bottom:1px solid rgba(var(--sea-green-rgb, 27, 94, 63), 0.2); }
        .search-bar { display:flex; align-items:center; gap:10px; padding:10px; background:var(--card-bg); border-radius:10px; box-shadow:0 2px 6px rgba(0,0,0,0.1); max-width:500px; margin:20px auto; border:1px solid var(--card-border); }
        .select { padding:10px 14px; border-radius:8px; border:1px solid var(--card-border); background:var(--page-bg); color:var(--text-color); font-size:16px; }
        .input { flex:1; padding:10px 14px; border-radius:8px; border:1px solid var(--card-border); background:var(--page-bg); color:var(--text-color); font-size:16px; min-width:300px; }
        .message { padding:1rem; border-radius:8px; margin-bottom:1.5rem; text-align:center; }
        .message.success { background-color:rgba(var(--sea-green-rgb, 27, 94, 63),0.1); color:var(--sea-green); }
        .message.error { background-color:#ffebee; color:#c62828; }
        .approve-btn { padding:0.6rem 1rem; border:none; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; background-color:var(--sea-green); color:var(--on-accent); display:flex; align-items:center; gap:0.5rem; }
        .reject-btn { padding:0.6rem 1rem; border:none; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; background-color:#dc3545; color:#fff; display:flex; align-items:center; gap:0.5rem; }
        .status-badge { padding:0.5rem 1rem; border-radius:20px; font-size:0.9rem; font-weight:bold; text-align:center; display:inline-block; }
        .status-badge.active { background-color:rgba(var(--sea-green-rgb, 27, 94, 63),0.1); color:var(--sea-green); }
        .status-badge.pending { background-color:rgba(255,193,7,0.1); color:#ffc107; }
        .approved-by { font-style:italic; color:var(--sea-green); font-size:0.9rem; }
        .action-btns { display:flex; gap:0.5rem; }
        .more-btn { display:inline-flex; align-items:center; gap:0.5rem; background-color:var(--sea-green); color:var(--on-accent); text-decoration:none; padding:0.8rem 1.5rem; border-radius:8px; transition:all 0.3s ease; font-family:'Cinzel', serif; font-weight:bold; cursor:pointer; border:none; }
        .back-link { display:inline-flex; align-items:center; gap:0.5rem; background-color:var(--sea-green); color:var(--on-accent); text-decoration:none; padding:0.8rem 1.5rem; border-radius:8px; transition:all 0.3s ease; font-family:'Cinzel', serif; font-weight:bold; }
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
          <i className="fas fa-trophy" />
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
            <i className="fas fa-trophy" /> Tournament Management
          </motion.h1>

          {message.text && (
            <div className={`message ${message.type}`}>
              <i className={`fas ${message.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`} /> {message.text}
            </div>
          )}

          <motion.div
            className="updates-section"
            custom={0}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
          >
            <h3 style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', textAlign: 'center', marginBottom: '1.5rem', fontSize: '1.8rem' }}>Tournament Approval & Management</h3>

            <div className="search-bar">
              <select aria-label="Attribute" value={searchAttr} onChange={(e) => setSearchAttr(e.target.value)} className="select">
                <option value="name">Name</option>
                <option value="date">Date</option>
                <option value="location">Location</option>
                <option value="entry_fee">Entry Fee</option>
                <option value="type">Type</option>
                <option value="added_by">Added By</option>
                <option value="status">Status</option>
              </select>
              <input aria-label="Search" type="text" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} className="input" />
            </div>

            {loading ? (
              <p>Loading tournaments…</p>
            ) : error ? (
              <p className="empty" style={{ color: '#c62828' }}>{error}</p>
            ) : (
              <>
                <table className="table">
                  <thead>
                    <tr>
                      <th className="th"><i className="fas fa-trophy" /> Name</th>
                      <th className="th"><i className="fas fa-calendar" /> Date</th>
                      <th className="th"><i className="fas fa-map-marker-alt" /> Location</th>
                      <th className="th"><i className="fas fa-coins" /> Entry Fee</th>
                      <th className="th"><i className="fas fa-users" /> Type</th>
                      <th className="th"><i className="fas fa-user" /> Added By</th>
                      <th className="th"><i className="fas fa-info-circle" /> Status</th>
                      <th className="th"><i className="fas fa-cogs" /> Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td className="td" colSpan={8}>
                          <div className="empty">
                            <i className="fas fa-info-circle" /> No tournaments available for review.
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filtered.slice(0, visibleCount).map((t) => (
                        <tr key={t._id}>
                          <td className="td">{t.name}</td>
                          <td className="td">{t.date ? new Date(t.date).toLocaleDateString() : ''}</td>
                          <td className="td">{t.location}</td>
                          <td className="td">₹{t.entry_fee}</td>
                          <td className="td">{t.type}</td>
                          <td className="td">{t.added_by}</td>
                          <td className="td">
                            {t.status === 'Approved' ? (
                              <>
                                <span className="status-badge active"><i className="fas fa-check-circle" /> Approved</span>
                                <div className="approved-by">by {t.approved_by || ''}</div>
                              </>
                            ) : (
                              <span className="status-badge pending"><i className="fas fa-clock" /> {t.status || 'Pending'}</span>
                            )}
                          </td>
                          <td className="td">
                            {!t.status || t.status === 'Pending' ? (
                              <div className="action-btns">
                                <button type="button" className="approve-btn" onClick={() => updateTournament(t._id, 'approve')}>
                                  <i className="fas fa-check" /> Approve
                                </button>
                                <button type="button" className="reject-btn" onClick={() => updateTournament(t._id, 'reject')}>
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

                <div style={{ textAlign: 'center', margin: '1rem 0', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                  {canShowMore && (
                    <button type="button" className="more-btn" onClick={handleMore}>
                      <i className="fas fa-chevron-down" /> More
                    </button>
                  )}
                  {visibleCount > 5 && (
                    <button type="button" className="more-btn" onClick={handleHide}>
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
};

export default OrganizerTournament;
