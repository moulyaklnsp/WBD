import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
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

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function CoordinatorRankings() {
  const [isDark, toggleTheme] = usePlayerTheme();
  const query = useQuery();
  const tournamentId = query.get('tournament_id');
  const tournamentType = query.get('type') || 'individual'; // 'individual' or 'team'
  const isTeamTournament = tournamentType === 'team';
  const sectionsPath = tournamentId ? `/coordinator/tournaments/${tournamentId}` : '/coordinator/tournament_management';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rankings, setRankings] = useState([]);
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

  useEffect(() => {
    const load = async () => {
      if (!tournamentId) {
        setError('Tournament ID is required.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError('');
        const endpoint = isTeamTournament 
          ? `/coordinator/api/team-rankings?tournament_id=${encodeURIComponent(tournamentId)}`
          : `/coordinator/api/rankings?tournament_id=${encodeURIComponent(tournamentId)}`;
        const res = await fetch(endpoint, { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load rankings');
        setRankings(Array.isArray(data.rankings) ? data.rankings : []);
        setPage(1);
      } catch (e) {
        console.error('Rankings load error:', e);
        setError('Failed to load rankings.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tournamentId, isTeamTournament]);

  const totalPages = Math.max(1, Math.ceil(rankings.length / rowsPerPage));
  const paginatedRankings = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return rankings.slice(start, start + rowsPerPage);
  }, [rankings, page, rowsPerPage]);

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
        .rankings-table { width:100%; border-collapse:collapse; margin-bottom:2rem; }
        .rankings-table th { background:var(--sea-green); color:var(--on-accent); padding:1rem; text-align:left; font-family:'Cinzel', serif; }
        .rankings-table td { padding:1rem; border-bottom:1px solid rgba(var(--sea-green-rgb, 27, 94, 63), 0.2); }
        .rank-text { font-weight:bold; color:var(--sea-green); font-family:'Cinzel', serif; }
        .score-text { font-weight:bold; color:var(--sea-green); }
        .action-btn { display:inline-flex; align-items:center; gap:0.5rem; background:var(--sea-green); color:var(--on-accent); text-decoration:none; padding:0.8rem 1.5rem; border-radius:8px; font-family:'Cinzel', serif; font-weight:bold; }
        .top1 { background:rgba(255, 215, 0, 0.1); }
        .top2 { background:rgba(192, 192, 192, 0.1); }
        .top3 { background:rgba(205, 127, 50, 0.1); }
        .error-text { color:red; text-align:center; margin-bottom:1rem; }
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
          <i className="fas fa-medal" />
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
            <i className="fas fa-trophy" /> {isTeamTournament ? 'Team Rankings' : 'Final Rankings'}
          </motion.h1>

          {error && <div className="error-text">{error}</div>}

          <motion.div
            className="updates-section"
            custom={0}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
          >
            <table className="rankings-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>{isTeamTournament ? 'Team Name' : 'Player Name'}</th>
                  {isTeamTournament && <th>Team Members</th>}
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={isTeamTournament ? 4 : 3}>Loading rankings...</td>
                  </tr>
                )}
                {!loading && !error && rankings.length === 0 && (
                  <tr>
                    <td colSpan={isTeamTournament ? 4 : 3}>{isTeamTournament ? 'No approved teams available for rankings.' : 'No rankings available.'}</td>
                  </tr>
                )}
                {!loading && !error && paginatedRankings.map((item, index) => {
                  const rankNum = (page - 1) * rowsPerPage + index + 1;
                  const rowClass = rankNum === 1 ? 'top1' : rankNum === 2 ? 'top2' : rankNum === 3 ? 'top3' : '';
                  return (
                    <tr key={(isTeamTournament ? item.teamName : item.playerName) + index} className={rowClass}>
                      <td>
                        <span className="rank-text">{rankNum}</span> {rankNum <= 3 && <i className="fas fa-medal" style={{ fontSize: '1.2rem', marginLeft: 6 }} />}
                      </td>
                      <td>{isTeamTournament ? item.teamName : item.playerName}</td>
                      {isTeamTournament && <td style={{ fontSize: '0.9rem', opacity: 0.85 }}>{item.players?.join(', ')}</td>}
                      <td className="score-text">{item.score}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

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

            <div style={{ textAlign: 'right' }}>
              <Link to={sectionsPath} className="action-btn">
                <i className="fas fa-arrow-left" /> {tournamentId ? 'Back to Open Sections' : 'Back to Tournaments'}
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default CoordinatorRankings;






