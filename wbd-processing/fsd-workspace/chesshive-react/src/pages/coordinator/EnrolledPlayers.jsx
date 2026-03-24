import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

// React conversion of views/coordinator/enrolled_players.html

function EnrolledPlayers() {
  const [searchParams] = useSearchParams();
  const tournamentId = searchParams.get('tournament_id');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('Enrolled Players');
  const [type, setType] = useState(''); // 'Individual' | 'Team'
  const [individualPlayers, setIndividualPlayers] = useState([]);
  const [teamEnrollments, setTeamEnrollments] = useState([]);

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
      } catch (e) {
        console.error(e);
        setError('Failed to load enrolled players.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tournamentId]);

  const styles = {
    root: { fontFamily: 'Playfair Display, serif', backgroundColor: '#FFFDD0', minHeight: '100vh', padding: '2rem' },
    container: { maxWidth: 1000, margin: '0 auto' },
    h2: { fontFamily: 'Cinzel, serif', fontSize: '2.5rem', color: '#2E8B57', marginBottom: '2rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' },
    card: { background: 'var(--card-bg)', borderRadius: 15, padding: '2rem', boxShadow: 'none', marginBottom: '2rem', border: '1px solid var(--card-border)' },
    table: { width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' },
    th: { backgroundColor: '#2E8B57', color: '#fff', padding: '1rem', textAlign: 'left', fontFamily: 'Cinzel, serif' },
    td: { padding: '1rem', borderBottom: '1px solid rgba(46,139,87,0.2)' },
    statusApproved: { color: '#2E8B57', fontWeight: 700 },
    statusPending: { color: '#c62828', fontWeight: 700 },
    backRow: { textAlign: 'right' },
    backLink: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#2E8B57', color: '#fff', textDecoration: 'none', padding: '0.8rem 1.5rem', borderRadius: 8, fontFamily: 'Cinzel, serif', fontWeight: 'bold' },
    err: { textAlign: 'center', color: '#c62828', marginTop: '1rem' },
  };

  return (
    <div style={styles.root}>
      <div style={styles.container}>
        <h2 style={styles.h2}><span role="img" aria-label="chess">♟️</span> {title}</h2>

        {loading ? <div className="loading">Loading…</div> : null}
        {error ? <div style={styles.err}>{error}</div> : null}

        {!loading && !error && type === 'Individual' && individualPlayers.length > 0 ? (
          <div style={styles.card}>
            <h3 style={{ fontFamily: 'Cinzel, serif', color: '#2E8B57', marginBottom: '1rem' }}>Individual Players</h3>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Username</th>
                  <th style={styles.th}>College</th>
                  <th style={styles.th}>Gender</th>
                </tr>
              </thead>
              <tbody>
                {individualPlayers.map((p, idx) => (
                  <tr key={`${p.username}-${idx}`}>
                    <td style={styles.td}>{p.username}</td>
                    <td style={styles.td}>{p.college}</td>
                    <td style={styles.td}>{p.gender}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!loading && !error && type === 'Team' && teamEnrollments.length > 0 ? (
          <div style={styles.card}>
            <h3 style={{ fontFamily: 'Cinzel, serif', color: '#2E8B57', marginBottom: '1rem' }}>Team Enrollments</h3>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Captain</th>
                  <th style={styles.th}>Player 1</th>
                  <th style={styles.th}>Player 2</th>
                  <th style={styles.th}>Player 3</th>
                  <th style={styles.th}>Approval Status</th>
                </tr>
              </thead>
              <tbody>
                {teamEnrollments.map((t, idx) => {
                  const p1 = t.player1_approved;
                  const p2 = t.player2_approved;
                  const p3 = t.player3_approved;
                  const allApproved = !!(p1 && p2 && p3);
                  return (
                    <tr key={`${t.captain_name}-${idx}`}>
                      <td style={styles.td}>{t.captain_name}</td>
                      <td style={styles.td}>
                        {t.player1_name}{' '}
                        <span style={p1 ? styles.statusApproved : styles.statusPending}>({p1 ? 'Approved' : 'Pending'})</span>
                      </td>
                      <td style={styles.td}>
                        {t.player2_name}{' '}
                        <span style={p2 ? styles.statusApproved : styles.statusPending}>({p2 ? 'Approved' : 'Pending'})</span>
                      </td>
                      <td style={styles.td}>
                        {t.player3_name}{' '}
                        <span style={p3 ? styles.statusApproved : styles.statusPending}>({p3 ? 'Approved' : 'Pending'})</span>
                      </td>
                      <td style={styles.td}>
                        {allApproved ? (
                          <span style={styles.statusApproved}>Fully Approved</span>
                        ) : (
                          <span style={styles.statusPending}>Pending</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {!loading && !error && individualPlayers.length === 0 && teamEnrollments.length === 0 ? (
          <p style={{ textAlign: 'center' }}>No players enrolled yet.</p>
        ) : null}

        <div style={styles.backRow}>
          <a href="/coordinator/tournament_management" style={styles.backLink}><i className="fas fa-users" /> Back to tournaments</a>
        </div>
      </div>
    </div>
  );
}

export default EnrolledPlayers;
