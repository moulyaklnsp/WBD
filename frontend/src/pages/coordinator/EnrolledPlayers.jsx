import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import '../../styles/playerNeoNoir.css';
import { motion } from 'framer-motion';
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

function EnrolledPlayers() {
  const [isDark, toggleTheme] = usePlayerTheme();
  const [searchParams] = useSearchParams();
  const tournamentId = searchParams.get('tournament_id');
  const sectionsPath = tournamentId ? `/coordinator/tournaments/${tournamentId}` : '/coordinator/tournament_management';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('Enrolled Players');
  const [type, setType] = useState(''); // 'Individual' | 'Team'
  const [individualPlayers, setIndividualPlayers] = useState([]);
  const [teamEnrollments, setTeamEnrollments] = useState([]);
  const [individualPage, setIndividualPage] = useState(1);
  const [teamPage, setTeamPage] = useState(1);
  const rowsPerPage = 10;

  useEffect(() => {
    const load = async () => {
      if (!tournamentId) {
        setError('Invalid tournament ID in URL.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/coordinator/api/enrolled-players?tournament_id=${encodeURIComponent(tournamentId)}`, { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load players');
        setTitle(`Enrolled Players for ${data.tournamentName}`);
        setType(data.tournamentType || '');
        setIndividualPlayers(Array.isArray(data.individualPlayers) ? data.individualPlayers : []);
        setTeamEnrollments(Array.isArray(data.teamEnrollments) ? data.teamEnrollments : []);
        setIndividualPage(1);
        setTeamPage(1);
      } catch (e) {
        console.error(e);
        setError('Failed to load enrolled players.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tournamentId]);

  const individualTotalPages = Math.max(1, Math.ceil(individualPlayers.length / rowsPerPage));
  const paginatedIndividuals = useMemo(() => {
    const start = (individualPage - 1) * rowsPerPage;
    return individualPlayers.slice(start, start + rowsPerPage);
  }, [individualPlayers, individualPage, rowsPerPage]);

  const teamTotalPages = Math.max(1, Math.ceil(teamEnrollments.length / rowsPerPage));
  const paginatedTeams = useMemo(() => {
    const start = (teamPage - 1) * rowsPerPage;
    return teamEnrollments.slice(start, start + rowsPerPage);
  }, [teamEnrollments, teamPage, rowsPerPage]);

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
        .players-table { width:100%; border-collapse:collapse; margin-bottom:2rem; }
        .players-table th { background:var(--sea-green); color:var(--on-accent); padding:1rem; text-align:left; font-family:'Cinzel', serif; }
        .players-table td { padding:1rem; border-bottom:1px solid rgba(var(--sea-green-rgb, 27, 94, 63), 0.2); }
        .status-approved { color:var(--sea-green); font-weight:700; }
        .status-pending { color:#c62828; font-weight:700; }
        .action-btn { display:inline-flex; align-items:center; gap:0.5rem; background:var(--sea-green); color:var(--on-accent); text-decoration:none; padding:0.8rem 1.5rem; border-radius:8px; font-family:'Cinzel', serif; font-weight:bold; }
        .error-text { text-align:center; color:#c62828; margin-top:1rem; }
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
          <i className="fas fa-users" />
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
            <i className="fas fa-users" /> {title}
          </motion.h1>

          {loading && <div className="loading">Loading…</div>}
          {error && <div className="error-text">{error}</div>}

          {!loading && !error && type === 'Individual' && individualPlayers.length > 0 && (
            <motion.div
              className="updates-section"
              custom={0}
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
            >
              <h3 style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', marginBottom: '1rem' }}>Individual Players</h3>
              <table className="players-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>College</th>
                    <th>Gender</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedIndividuals.map((p, idx) => (
                    <tr key={`${p.username}-${idx}`}>
                      <td>{p.username}</td>
                      <td>{p.college}</td>
                      <td>{p.gender}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {individualTotalPages > 1 && (
                <div className="pagination">
                  <button type="button" className="page-btn" onClick={() => setIndividualPage((p) => Math.max(1, p - 1))} disabled={individualPage === 1}>
                    <i className="fas fa-chevron-left" />
                  </button>
                  {Array.from({ length: individualTotalPages }, (_, i) => i + 1).map((p) => (
                    <button key={p} type="button" className={`page-btn ${p === individualPage ? 'active' : ''}`} onClick={() => setIndividualPage(p)}>
                      {p}
                    </button>
                  ))}
                  <button type="button" className="page-btn" onClick={() => setIndividualPage((p) => Math.min(individualTotalPages, p + 1))} disabled={individualPage === individualTotalPages}>
                    <i className="fas fa-chevron-right" />
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {!loading && !error && type === 'Team' && teamEnrollments.length > 0 && (
            <motion.div
              className="updates-section"
              custom={0}
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
            >
              <h3 style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', marginBottom: '1rem' }}>Team Enrollments</h3>
              <table className="players-table">
                <thead>
                  <tr>
                    <th>Captain</th>
                    <th>Player 1</th>
                    <th>Player 2</th>
                    <th>Player 3</th>
                    <th>Approval Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTeams.map((t, idx) => {
                    const p1 = t.player1_approved;
                    const p2 = t.player2_approved;
                    const p3 = t.player3_approved;
                    const allApproved = !!(p1 && p2 && p3);
                    return (
                      <tr key={`${t.captain_name}-${idx}`}>
                        <td>{t.captain_name}</td>
                        <td>
                          {t.player1_name}{' '}
                          <span className={p1 ? 'status-approved' : 'status-pending'}>({p1 ? 'Approved' : 'Pending'})</span>
                        </td>
                        <td>
                          {t.player2_name}{' '}
                          <span className={p2 ? 'status-approved' : 'status-pending'}>({p2 ? 'Approved' : 'Pending'})</span>
                        </td>
                        <td>
                          {t.player3_name}{' '}
                          <span className={p3 ? 'status-approved' : 'status-pending'}>({p3 ? 'Approved' : 'Pending'})</span>
                        </td>
                        <td>
                          {allApproved ? (
                            <span className="status-approved">Fully Approved</span>
                          ) : (
                            <span className="status-pending">Pending</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {teamTotalPages > 1 && (
                <div className="pagination">
                  <button type="button" className="page-btn" onClick={() => setTeamPage((p) => Math.max(1, p - 1))} disabled={teamPage === 1}>
                    <i className="fas fa-chevron-left" />
                  </button>
                  {Array.from({ length: teamTotalPages }, (_, i) => i + 1).map((p) => (
                    <button key={p} type="button" className={`page-btn ${p === teamPage ? 'active' : ''}`} onClick={() => setTeamPage(p)}>
                      {p}
                    </button>
                  ))}
                  <button type="button" className="page-btn" onClick={() => setTeamPage((p) => Math.min(teamTotalPages, p + 1))} disabled={teamPage === teamTotalPages}>
                    <i className="fas fa-chevron-right" />
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {!loading && !error && individualPlayers.length === 0 && teamEnrollments.length === 0 && (
            <p style={{ textAlign: 'center' }}>No players enrolled yet.</p>
          )}

          <div style={{ textAlign: 'right' }}>
            <Link to={sectionsPath} className="action-btn">
              <i className="fas fa-arrow-left" /> {tournamentId ? 'Back to Open Sections' : 'Back to Tournaments'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EnrolledPlayers;






