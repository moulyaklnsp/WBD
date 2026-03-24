import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

// React conversion of views/coordinator/player_stats.html

function CoordinatorPlayerStats() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await fetch('/coordinator/api/player-stats', { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch player stats');
        setPlayers(Array.isArray(data.players) ? data.players : []);
      } catch (e) {
        console.error('Error fetching player stats:', e);
        setError('Error fetching player data');
      } finally {
        setLoading(false);
      }
    };
    fetchPlayers();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) => (p.name || '').toLowerCase().includes(q));
  }, [players, query]);

  const totals = useMemo(() => {
    const totalPlayers = players.length;
    const totalGames = players.reduce((sum, p) => sum + (Number(p.gamesPlayed) || 0), 0);
    const avgRating = totalPlayers
      ? Math.round(players.reduce((sum, p) => sum + (Number(p.rating) || 0), 0) / totalPlayers)
      : 0;
    return { totalPlayers, totalGames, avgRating };
  }, [players]);

  const styles = {
    root: { fontFamily: 'Playfair Display, serif', backgroundColor: '#FFFDD0', minHeight: '100vh', padding: '2rem' },
    container: { maxWidth: 1200, margin: '0 auto' },
    h2: { fontFamily: 'Cinzel, serif', fontSize: '2.5rem', color: '#2E8B57', marginBottom: '2rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' },
    card: { background: 'var(--card-bg)', padding: '1.5rem', borderRadius: 10, textAlign: 'center', boxShadow: 'none', border: '1px solid var(--card-border)' },
    statVal: { fontSize: '2rem', fontWeight: 'bold', color: '#2E8B57', marginBottom: '0.5rem' },
    statLbl: { color: '#666', fontFamily: 'Cinzel, serif' },
    tableWrap: { background: 'var(--card-bg)', borderRadius: 15, padding: '2rem', boxShadow: 'none', overflowX: 'auto', border: '1px solid var(--card-border)' },
    searchWrap: { marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' },
    searchInput: { padding: '0.6rem 1rem', width: '100%', maxWidth: 300, border: '2px solid #2E8B57', borderRadius: 8, fontSize: '1rem', fontFamily: 'Playfair Display, serif' },
    table: { width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' },
    th: { backgroundColor: '#2E8B57', color: '#fff', padding: '1rem', textAlign: 'left', fontFamily: 'Cinzel, serif' },
    td: { padding: '1rem', borderBottom: '1px solid rgba(46,139,87,0.2)' },
    ratingCell: { fontWeight: 'bold', color: '#2E8B57' },
    backRow: { textAlign: 'right', marginTop: '2rem' },
    backLink: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#2E8B57', color: '#fff', textDecoration: 'none', padding: '0.8rem 1.5rem', borderRadius: 8, fontFamily: 'Cinzel, serif', fontWeight: 'bold' },
  };

  return (
    <div style={styles.root}>
      <div style={styles.container}>
        <h2 style={styles.h2}><span role="img" aria-label="chart">📊</span> Player Statistics</h2>

        <div style={styles.grid}>
          <div style={styles.card}>
            <div style={styles.statVal}>{totals.totalPlayers}</div>
            <div style={styles.statLbl}>Total Players</div>
          </div>
          <div style={styles.card}>
            <div style={styles.statVal}>{totals.totalGames}</div>
            <div style={styles.statLbl}>Total Games</div>
          </div>
          <div style={styles.card}>
            <div style={styles.statVal}>{totals.avgRating}</div>
            <div style={styles.statLbl}>Average Rating</div>
          </div>
        </div>

        <div style={styles.tableWrap}>
          <div style={styles.searchWrap}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by player name..."
              style={styles.searchInput}
              aria-label="Search players by name"
            />
          </div>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}><i className="fas fa-user" aria-hidden="true"></i> Player Name</th>
                <th style={styles.th}><i className="fas fa-chess" aria-hidden="true"></i> Games Played</th>
                <th style={styles.th}><i className="fas fa-trophy" aria-hidden="true"></i> Wins</th>
                <th style={styles.th}><i className="fas fa-times" aria-hidden="true"></i> Losses</th>
                <th style={styles.th}><i className="fas fa-handshake" aria-hidden="true"></i> Draws</th>
                <th style={styles.th}><i className="fas fa-star" aria-hidden="true"></i> Rating</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td style={styles.td} colSpan={6}>Loading…</td>
                </tr>
              )}
              {!loading && !!error && (
                <tr>
                  <td style={{...styles.td, color: 'red', textAlign: 'center'}} colSpan={6}>{error}</td>
                </tr>
              )}
              {!loading && !error && filtered.length === 0 && (
                <tr>
                  <td style={{...styles.td, textAlign: 'center'}} colSpan={6}><i className="fas fa-info-circle" aria-hidden="true"></i> No player statistics available.</td>
                </tr>
              )}
              {!loading && !error && filtered.map((p, idx) => (
                <tr key={idx}>
                  <td style={styles.td}>{p.name}</td>
                  <td style={styles.td}>{p.gamesPlayed}</td>
                  <td style={styles.td}>{p.wins}</td>
                  <td style={styles.td}>{p.losses}</td>
                  <td style={styles.td}>{p.draws}</td>
                  <td style={{...styles.td, ...styles.ratingCell}}>{p.rating}</td>
                </tr>
              ))}
            </tbody>
          </table>

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

export default CoordinatorPlayerStats;
