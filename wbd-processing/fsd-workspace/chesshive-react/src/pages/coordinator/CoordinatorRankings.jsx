import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

// React conversion of views/coordinator/rankings.html

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function CoordinatorRankings() {
  const query = useQuery();
  const tournamentId = query.get('tournament_id');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rankings, setRankings] = useState([]);

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
        const res = await fetch(`/coordinator/api/rankings?tournament_id=${encodeURIComponent(tournamentId)}`, { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load rankings');
        setRankings(Array.isArray(data.rankings) ? data.rankings : []);
      } catch (e) {
        console.error('Rankings load error:', e);
        setError('Failed to load rankings.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tournamentId]);

  const styles = {
    root: { fontFamily: 'Playfair Display, serif', backgroundColor: '#FFFDD0', minHeight: '100vh', padding: '2rem' },
    container: { maxWidth: 900, margin: '0 auto' },
    h2: { fontFamily: 'Cinzel, serif', fontSize: '2.5rem', color: '#2E8B57', marginBottom: '2rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' },
    card: { background: 'var(--card-bg)', borderRadius: 15, padding: '2rem', boxShadow: 'none', border: '1px solid var(--card-border)' },
    table: { width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' },
    th: { backgroundColor: '#2E8B57', color: '#fff', padding: '1rem', textAlign: 'left', fontFamily: 'Cinzel, serif' },
    td: { padding: '1rem', borderBottom: '1px solid rgba(46,139,87,0.2)' },
    rank: { fontWeight: 'bold', color: '#2E8B57', fontFamily: 'Cinzel, serif' },
    score: { fontWeight: 'bold', color: '#2E8B57' },
    nav: { textAlign: 'right' },
    navLink: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#2E8B57', color: '#fff', textDecoration: 'none', padding: '0.8rem 1.5rem', borderRadius: 8, fontFamily: 'Cinzel, serif', fontWeight: 'bold' },
    top1: { backgroundColor: 'rgba(255, 215, 0, 0.1)' },
    top2: { backgroundColor: 'rgba(192, 192, 192, 0.1)' },
    top3: { backgroundColor: 'rgba(205, 127, 50, 0.1)' },
    err: { color: 'red', textAlign: 'center', marginBottom: '1rem' },
  };

  return (
    <div style={styles.root}>
      <div style={styles.container}>
        <h2 style={styles.h2}><span role="img" aria-label="trophy">🏆</span> Final Rankings</h2>

        {error ? <div style={styles.err}>{error}</div> : null}

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
                <tr>
                  <td style={styles.td} colSpan={3}>Loading rankings...</td>
                </tr>
              )}
              {!loading && !error && rankings.length === 0 && (
                <tr>
                  <td style={styles.td} colSpan={3}>No rankings available.</td>
                </tr>
              )}
              {!loading && !error && rankings.map((player, index) => {
                const rankNum = index + 1;
                const rowStyle = rankNum === 1 ? styles.top1 : rankNum === 2 ? styles.top2 : rankNum === 3 ? styles.top3 : undefined;
                return (
                  <tr key={player.playerName + index} style={rowStyle}>
                    <td style={styles.td}>
                      <span style={styles.rank}>{rankNum}</span> {rankNum <= 3 && <i className="fas fa-medal" aria-hidden="true" style={{ fontSize: '1.2rem', marginLeft: 6 }} />}
                    </td>
                    <td style={styles.td}>{player.playerName}</td>
                    <td style={{ ...styles.td, ...styles.score }}>{player.score}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={styles.nav}>
            <Link to="/coordinator/tournament_management" style={styles.navLink}>
              <i className="fas fa-users" aria-hidden="true" /> Back to tournaments
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CoordinatorRankings;
