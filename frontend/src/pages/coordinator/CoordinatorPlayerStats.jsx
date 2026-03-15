import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import '../../styles/playerNeoNoir.css';
import { motion } from 'framer-motion';
import { fetchAsCoordinator } from '../../utils/fetchWithRole';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import AnimatedSidebar from '../../components/AnimatedSidebar';
import { coordinatorLinks } from '../../constants/coordinatorLinks';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

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

function CoordinatorPlayerStats() {
  const [isDark, toggleTheme] = usePlayerTheme();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [playerDetail, setPlayerDetail] = useState(null);
  const [historyPage, setHistoryPage] = useState(1);
  const historyRowsPerPage = 10;

  const closePlayerDetail = () => {
    setSelectedPlayer(null);
    setPlayerDetail(null);
    setDetailError('');
    setDetailLoading(false);
  };

  const fetchPlayers = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetchAsCoordinator('/coordinator/api/player-stats');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load data. Please try again.');
      setPlayers(Array.isArray(data.players) ? data.players : []);
    } catch (e) {
      console.error('Error fetching player stats:', e);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  const fetchPlayerDetail = useCallback(async (player) => {
    if (!player?.playerId) {
      setDetailError('Failed to load data. Please try again.');
      setSelectedPlayer(player);
      setPlayerDetail(null);
      setDetailLoading(false);
      return;
    }

    setSelectedPlayer(player);
    setDetailLoading(true);
    setDetailError('');
    setPlayerDetail(null);

    try {
      const res = await fetchAsCoordinator(`/coordinator/api/player-stats/${encodeURIComponent(player.playerId)}/details`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load data. Please try again.');
      setPlayerDetail(data);
    } catch (e) {
      console.error('Error fetching player detail:', e);
      setDetailError('Failed to load data. Please try again.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openPlayerDetail = async (player) => {
    await fetchPlayerDetail(player);
  };

  useEffect(() => {
    if (!selectedPlayer) return undefined;
    const onEsc = (event) => {
      if (event.key === 'Escape') closePlayerDetail();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [selectedPlayer]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) => (p.name || '').toLowerCase().includes(q));
  }, [players, query]);

  useEffect(() => {
    setPage(1);
  }, [query, players.length]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const paginatedPlayers = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  const totals = useMemo(() => {
    const totalPlayers = players.length;
    const totalGames = players.reduce((sum, p) => sum + (Number(p.gamesPlayed) || 0), 0);
    const avgRating = totalPlayers
      ? Math.round(players.reduce((sum, p) => sum + (Number(p.rating) || 0), 0) / totalPlayers)
      : 0;
    return { totalPlayers, totalGames, avgRating };
  }, [players]);

  const detailSummary = useMemo(() => {
    const summary = playerDetail?.summary || {};
    const gamesPlayed = Number(summary.gamesPlayed || 0);
    const wins = Number(summary.wins || 0);
    const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
    return {
      gamesPlayed,
      wins,
      losses: Number(summary.losses || 0),
      draws: Number(summary.draws || 0),
      rating: Number(summary.rating || 0),
      winRate
    };
  }, [playerDetail]);

  useEffect(() => {
    setHistoryPage(1);
  }, [playerDetail]);

  const historyTotalPages = Math.max(1, Math.ceil((playerDetail?.matchHistory || []).length / historyRowsPerPage));
  const paginatedHistory = useMemo(() => {
    const history = Array.isArray(playerDetail?.matchHistory) ? playerDetail.matchHistory : [];
    const start = (historyPage - 1) * historyRowsPerPage;
    return history.slice(start, start + historyRowsPerPage);
  }, [playerDetail, historyPage, historyRowsPerPage]);

  const ratingChartData = useMemo(() => {
    const points = Array.isArray(playerDetail?.ratingProgression) ? playerDetail.ratingProgression : [];
    return {
      labels: points.map((point) => point.date),
      datasets: [
        {
          label: 'Rating',
          data: points.map((point) => Number(point.rating || 0)),
          borderColor: '#2E8B57',
          backgroundColor: 'rgba(46, 139, 87, 0.15)',
          tension: 0.3
        }
      ]
    };
  }, [playerDetail]);

  const performanceChartData = useMemo(() => {
    const rows = Array.isArray(playerDetail?.performanceHistory) ? playerDetail.performanceHistory : [];
    return {
      labels: rows.map((row) => row.month),
      datasets: [
        {
          label: 'Wins',
          data: rows.map((row) => Number(row.wins || 0)),
          backgroundColor: 'rgba(46, 139, 87, 0.75)'
        },
        {
          label: 'Losses',
          data: rows.map((row) => Number(row.losses || 0)),
          backgroundColor: 'rgba(198, 40, 40, 0.7)'
        },
        {
          label: 'Draws',
          data: rows.map((row) => Number(row.draws || 0)),
          backgroundColor: 'rgba(29, 126, 168, 0.7)'
        }
      ]
    };
  }, [playerDetail]);

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
        .stats-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1.5rem; margin-bottom:2rem; }
        .stat-card { background:var(--card-bg); padding:1.5rem; border-radius:10px; text-align:center; border:1px solid var(--card-border); }
        .stat-value { font-size:2rem; font-weight:bold; color:var(--sea-green); margin-bottom:0.5rem; }
        .stat-label { color:var(--text-color); opacity:0.7; font-family:'Cinzel', serif; }
        .search-input { padding:0.6rem 1rem; width:100%; max-width:300px; border:2px solid var(--sea-green); border-radius:8px; font-size:1rem; font-family:'Playfair Display', serif; background:var(--card-bg); color:var(--text-color); }
        .stats-table { width:100%; border-collapse:collapse; margin-bottom:1.5rem; }
        .stats-table th { background:var(--sea-green); color:var(--on-accent); padding:1rem; text-align:left; font-family:'Cinzel', serif; }
        .stats-table td { padding:1rem; border-bottom:1px solid rgba(var(--sea-green-rgb, 27, 94, 63), 0.2); }
        .rating-cell { font-weight:bold; color:var(--sea-green); }
        .btn-primary { background:var(--sea-green); color:var(--on-accent); border:none; padding:0.65rem 1rem; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; display:inline-flex; align-items:center; gap:0.5rem; }
        .player-name-btn { background:none; border:none; color:var(--sea-green); text-decoration:underline; cursor:pointer; font-family:inherit; font-weight:700; padding:0; text-align:left; }
        .player-name-btn:disabled { color:var(--text-color); opacity:0.55; cursor:not-allowed; text-decoration:none; }
        .detail-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:1rem; margin-bottom:1rem; }
        .mini-card { border:1px solid var(--card-border); border-radius:10px; padding:1rem; background:rgba(var(--sea-green-rgb, 27, 94, 63), 0.06); }
        .mini-label { font-size:0.82rem; opacity:0.75; margin-bottom:0.25rem; }
        .mini-value { font-size:1.35rem; font-weight:700; color:var(--sea-green); }
        .chart-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:1rem; margin-bottom:1rem; }
        .chart-card { border:1px solid var(--card-border); border-radius:12px; padding:1rem; background:var(--card-bg); height:320px; }
        .history-table { width:100%; border-collapse:collapse; margin-top:0.75rem; }
        .history-table th, .history-table td { padding:0.7rem; border-bottom:1px solid var(--card-border); text-align:left; }
        .history-table th { color:var(--sea-green); font-family:'Cinzel', serif; }
        .result-win { color:#2E8B57; font-weight:700; text-transform:capitalize; }
        .result-loss { color:#c62828; font-weight:700; text-transform:capitalize; }
        .result-draw { color:#1d7ea8; font-weight:700; text-transform:capitalize; }
        .result-pending { opacity:0.7; font-weight:700; text-transform:capitalize; }
        .pagination { display:flex; justify-content:center; align-items:center; gap:0.5rem; margin:1rem 0; flex-wrap:wrap; }
        .page-btn { background:var(--card-bg); color:var(--text-color); border:1px solid var(--card-border); padding:0.45rem 0.85rem; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; }
        .page-btn.active { background:var(--sea-green); color:var(--on-accent); border-color:var(--sea-green); }
        .page-btn:disabled { opacity:0.6; cursor:not-allowed; }
        .player-detail-modal {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.78);
          z-index: 3000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.2rem;
        }
        .player-detail-panel {
          width: min(1100px, 96vw);
          max-height: 92vh;
          overflow-y: auto;
          background: var(--card-bg);
          color: var(--text-color);
          border: 1px solid var(--card-border);
          border-radius: 16px;
          padding: 1.25rem;
          position: relative;
          box-shadow: 0 18px 50px rgba(0,0,0,0.32);
        }
        .detail-close-btn {
          position: sticky;
          top: 0.2rem;
          margin-left: auto;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border-radius: 8px;
          border: 1px solid var(--card-border);
          background: var(--card-bg);
          color: var(--text-color);
          cursor: pointer;
          z-index: 2;
        }
        .detail-close-btn:hover { border-color: var(--sea-green); color: var(--sea-green); }
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
          <i className="fas fa-chart-bar" />
        </motion.div>

        <AnimatedSidebar links={coordinatorLinks} logo={<i className="fas fa-chess" />} title={'ChessHive'} />

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
            <i className="fas fa-chart-bar" /> Player Statistics
          </motion.h1>

          <div className="stats-grid">
            <motion.div className="stat-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }}>
              <div className="stat-value">{totals.totalPlayers}</div>
              <div className="stat-label">Total Players</div>
            </motion.div>
            <motion.div className="stat-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}>
              <div className="stat-value">{totals.totalGames}</div>
              <div className="stat-label">Total Games</div>
            </motion.div>
            <motion.div className="stat-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }}>
              <div className="stat-value">{totals.avgRating}</div>
              <div className="stat-label">Average Rating</div>
            </motion.div>
          </div>

          <motion.div className="updates-section" custom={0} variants={sectionVariants} initial="hidden" animate="visible">
            <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by player name..."
                className="search-input"
                aria-label="Search players by name"
              />
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="stats-table">
                <thead>
                  <tr>
                    <th><i className="fas fa-user" /> Player Name</th>
                    <th><i className="fas fa-chess" /> Games Played</th>
                    <th><i className="fas fa-trophy" /> Wins</th>
                    <th><i className="fas fa-times" /> Losses</th>
                    <th><i className="fas fa-handshake" /> Draws</th>
                    <th><i className="fas fa-star" /> Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={6}>Loading...</td>
                    </tr>
                  )}
                  {!loading && !!error && (
                    <tr>
                      <td style={{ textAlign: 'center' }} colSpan={6}>
                        <div style={{ color: '#c62828', marginBottom: '0.6rem' }}>{error}</div>
                        <button type="button" className="btn-primary" onClick={fetchPlayers}>
                          <i className="fas fa-rotate-right" /> Retry
                        </button>
                      </td>
                    </tr>
                  )}
                  {!loading && !error && filtered.length === 0 && (
                    <tr>
                      <td style={{ textAlign: 'center' }} colSpan={6}><i className="fas fa-info-circle" /> No player statistics available.</td>
                    </tr>
                  )}
                  {!loading && !error && paginatedPlayers.map((player, idx) => (
                    <tr key={`${player.playerId || player.name || 'player'}-${idx}`}>
                      <td>
                        <button
                          type="button"
                          className="player-name-btn"
                          onClick={() => openPlayerDetail(player)}
                          disabled={!player.playerId}
                          title={player.playerId ? 'Open detailed player stats' : 'Player details unavailable'}
                        >
                          {player.name}
                        </button>
                      </td>
                      <td>{player.gamesPlayed}</td>
                      <td>{player.wins}</td>
                      <td>{player.losses}</td>
                      <td>{player.draws}</td>
                      <td className="rating-cell">{player.rating}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button type="button" className="page-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  <i className="fas fa-chevron-left" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button key={p} type="button" className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>
                    {p}
                  </button>
                ))}
                <button type="button" className="page-btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                  <i className="fas fa-chevron-right" />
                </button>
              </div>
            )}

            <div style={{ textAlign: 'right', marginTop: '2rem' }}>
              <Link to="/coordinator/coordinator_dashboard" className="back-to-dashboard">
                <i className="fas fa-arrow-left" /> Back to Dashboard
              </Link>
            </div>
          </motion.div>

        </div>
      </div>

      {selectedPlayer && (
        <div className="player-detail-modal" onClick={closePlayerDetail}>
          <motion.div
            className="player-detail-panel"
            onClick={(event) => event.stopPropagation()}
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.22 }}
          >
            <button type="button" className="detail-close-btn" onClick={closePlayerDetail} aria-label="Close player details">
              <i className="fas fa-times" />
            </button>

            <h2 style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <i className="fas fa-chart-line" /> Player Growth and Performance: {playerDetail?.player?.name || selectedPlayer.name}
            </h2>

            {detailLoading && <p>Loading player details...</p>}
            {!detailLoading && detailError && (
              <div style={{ border: '1px solid rgba(198, 40, 40, 0.35)', background: 'rgba(198, 40, 40, 0.08)', padding: '1rem', borderRadius: 10, marginBottom: '1rem' }}>
                <p style={{ color: '#c62828', marginBottom: '0.7rem' }}>{detailError}</p>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => fetchPlayerDetail(selectedPlayer)}
                >
                  <i className="fas fa-rotate-right" /> Retry
                </button>
              </div>
            )}

            {!detailLoading && !detailError && playerDetail && (
              <>
                <div className="detail-grid">
                  <div className="mini-card"><div className="mini-label">Current Rating</div><div className="mini-value">{detailSummary.rating}</div></div>
                  <div className="mini-card"><div className="mini-label">Games Played</div><div className="mini-value">{detailSummary.gamesPlayed}</div></div>
                  <div className="mini-card"><div className="mini-label">Win Rate</div><div className="mini-value">{detailSummary.winRate}%</div></div>
                  <div className="mini-card"><div className="mini-label">Participation</div><div className="mini-value">{Number(playerDetail?.participationStats?.totalTournaments || 0)}</div></div>
                </div>

                <div className="chart-grid">
                  <div className="chart-card">
                    <h4 style={{ marginBottom: '0.8rem' }}>Rating Progression</h4>
                    {ratingChartData.labels.length > 0 ? (
                      <Line data={ratingChartData} options={{ responsive: true, maintainAspectRatio: false }} />
                    ) : (
                      <div style={{ opacity: 0.7 }}>No rating progression data available.</div>
                    )}
                  </div>
                  <div className="chart-card">
                    <h4 style={{ marginBottom: '0.8rem' }}>Monthly Performance History</h4>
                    {performanceChartData.labels.length > 0 ? (
                      <Bar data={performanceChartData} options={{ responsive: true, maintainAspectRatio: false }} />
                    ) : (
                      <div style={{ opacity: 0.7 }}>No monthly performance data available.</div>
                    )}
                  </div>
                </div>

                <div className="detail-grid">
                  <div className="mini-card">
                    <div className="mini-label">Individual Entries</div>
                    <div className="mini-value">{Number(playerDetail?.participationStats?.individualEntries || 0)}</div>
                  </div>
                  <div className="mini-card">
                    <div className="mini-label">Team Entries</div>
                    <div className="mini-value">{Number(playerDetail?.participationStats?.teamEntries || 0)}</div>
                  </div>
                  <div className="mini-card">
                    <div className="mini-label">Wins / Losses / Draws</div>
                    <div className="mini-value">{detailSummary.wins} / {detailSummary.losses} / {detailSummary.draws}</div>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <h4 style={{ marginBottom: '0.5rem' }}>Match History</h4>
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Tournament</th>
                        <th>Round</th>
                        <th>Opponent</th>
                        <th>Result</th>
                        <th>Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(playerDetail?.matchHistory || []).length === 0 ? (
                        <tr><td colSpan={6}>No match history available.</td></tr>
                      ) : (
                        paginatedHistory.map((match, idx) => (
                          <tr key={`${match.tournamentId || 't'}-${match.round || 0}-${idx}`}>
                            <td>{match.date || '-'}</td>
                            <td>{match.tournamentName || 'Tournament'}</td>
                            <td>{match.round || '-'}</td>
                            <td>{match.opponent || '-'}</td>
                            <td>
                              <span className={`result-${match.result || 'pending'}`}>
                                {match.result || 'pending'}
                              </span>
                            </td>
                            <td>{Number(match.playerScore || 0)} - {Number(match.opponentScore || 0)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  {historyTotalPages > 1 && (
                    <div className="pagination" style={{ marginTop: '0.75rem' }}>
                      <button type="button" className="page-btn" onClick={() => setHistoryPage((p) => Math.max(1, p - 1))} disabled={historyPage === 1}>
                        <i className="fas fa-chevron-left" />
                      </button>
                      {Array.from({ length: historyTotalPages }, (_, i) => i + 1).map((p) => (
                        <button key={p} type="button" className={`page-btn ${p === historyPage ? 'active' : ''}`} onClick={() => setHistoryPage(p)}>
                          {p}
                        </button>
                      ))}
                      <button type="button" className="page-btn" onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))} disabled={historyPage === historyTotalPages}>
                        <i className="fas fa-chevron-right" />
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default CoordinatorPlayerStats;
