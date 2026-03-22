import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import usePlayerTheme from '../../hooks/usePlayerTheme';
// React conversion of views/player/rankings.html

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function PlayerRankings() {
  const query = useQuery();
  const tournamentId = query.get('tournament_id');

  const [isDark, toggleTheme] = usePlayerTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rankings, setRankings] = useState([]);

  useEffect(() => {
    if (!tournamentId) {
      setError('Tournament ID is required.');
      setLoading(false);
      return;
    }
    const run = async () => {
      try {
        const res = await fetch(`/player/api/rankings?tournament_id=${encodeURIComponent(tournamentId)}`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setRankings(data?.rankings || []);
      } catch (e) {
        setError('Failed to load rankings.');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [tournamentId]);

  const styles = {
    root: { fontFamily: 'Playfair Display, serif', backgroundColor: 'var(--page-bg)', minHeight: '100vh', padding: '2rem', color: 'var(--text-color)' },
    container: { maxWidth: 900, margin: '0 auto' },
    h2: { fontFamily: 'Cinzel, serif', fontSize: '2.5rem', color: 'var(--sea-green)', marginBottom: '2rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' },
    card: { background: 'var(--content-bg)', borderRadius: 15, padding: '2rem', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' },
    table: { width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' },
    th: { backgroundColor: 'var(--sea-green)', color: 'var(--content-bg)', padding: '1rem', textAlign: 'left', fontFamily: 'Cinzel, serif' },
    td: { padding: '1rem', borderBottom: '1px solid rgba(46,139,87,0.2)' },
    rank: { fontWeight: 'bold', color: 'var(--sea-green)', fontFamily: 'Cinzel, serif' },
    top3: { fontSize: '1.1rem' },
    score: { fontWeight: 'bold', color: 'var(--sea-green)' },
    nav: { textAlign: 'right' },
    navLink: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--sea-green)', color: 'var(--content-bg)', textDecoration: 'none', padding: '0.8rem 1.5rem', borderRadius: 8, fontFamily: 'Cinzel, serif', fontWeight: 'bold' },
  };

  return (
    <div style={styles.root}>
      <div style={styles.container}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={styles.h2}><span role="img" aria-label="trophy">🏆</span> Final Rankings</h2>
          <div>
            <button onClick={toggleTheme} style={{ background: 'transparent', border: '2px solid var(--sea-green)', color: 'var(--sea-green)', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'Cinzel, serif', fontWeight: 'bold' }}>{isDark ? 'Switch to Light' : 'Switch to Dark'}</button>
          </div>
        </div>

        <div style={styles.card}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Rank</th>
                <th style={styles.th}>Player Name</th>
                <th style={styles.th}>Score</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td style={styles.td} colSpan={3}>Loading rankings...</td></tr>
              )}
              {!!error && !loading && (
                <tr><td style={styles.td} colSpan={3}>{error}</td></tr>
              )}
              {!loading && !error && rankings.length === 0 && (
                <tr><td style={styles.td} colSpan={3}>No rankings available.</td></tr>
              )}
              {!loading && !error && rankings.map((p, idx) => {
                const rankNum = idx + 1;
                const rowStyle = {
                  ...(rankNum === 1 ? { backgroundColor: 'rgba(255,215,0,0.1)' } : {}),
                  ...(rankNum === 2 ? { backgroundColor: 'rgba(192,192,192,0.1)' } : {}),
                  ...(rankNum === 3 ? { backgroundColor: 'rgba(205,127,50,0.1)' } : {}),
                };
                return (
                  <tr key={p.playerName + '-' + idx} style={rowStyle}>
                    <td style={styles.td}>
                      <span style={{ ...styles.rank, ...(rankNum <= 3 ? styles.top3 : {}) }}>
                        {rankNum} {rankNum <= 3 ? <i className="fas fa-medal" aria-hidden="true" style={{ fontSize: '1.2rem' }}></i> : null}
                      </span>
                    </td>
                    <td style={styles.td}>{p.playerName}</td>
                    <td style={{ ...styles.td, ...styles.score }}>{p.score}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={styles.nav}>
          <Link to="/player/player_tournament" style={styles.navLink}>
            <i className="fas fa-users" aria-hidden="true"></i> <span>Back to tournaments</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default PlayerRankings;
