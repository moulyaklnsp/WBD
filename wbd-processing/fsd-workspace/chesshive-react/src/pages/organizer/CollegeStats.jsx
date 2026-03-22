import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

// React conversion of views/organizer/college_stats.html

function CollegeStats() {
  const [stats, setStats] = useState({ collegePerformance: [], tournamentRecords: [], topCollegesByFormat: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Simple local filters for a better UX (optional enhancement)
  const [perfQuery, setPerfQuery] = useState('');
  const [recordsQuery, setRecordsQuery] = useState('');
  const [recordsFormat, setRecordsFormat] = useState('all');

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/organizer/api/college-stats', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch college stats');
      setStats({
        collegePerformance: Array.isArray(data.collegePerformance) ? data.collegePerformance : [],
        tournamentRecords: Array.isArray(data.tournamentRecords) ? data.tournamentRecords : [],
        topCollegesByFormat: data.topCollegesByFormat || {}
      });
    } catch (e) {
      console.error('Fetch college stats error:', e);
      setError('Error fetching college stats.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const filteredPerformance = useMemo(() => {
    const q = perfQuery.trim().toLowerCase();
    if (!q) return stats.collegePerformance;
    return stats.collegePerformance.filter((r) => (r.college || '').toLowerCase().includes(q));
  }, [stats.collegePerformance, perfQuery]);

  const filteredRecords = useMemo(() => {
    const q = recordsQuery.trim().toLowerCase();
    return stats.tournamentRecords.filter((r) => {
      const matchesText = !q || (r.name || '').toLowerCase().includes(q) || (r.college || '').toLowerCase().includes(q);
      const matchesFormat = recordsFormat === 'all' || (r.format || '').toLowerCase() === recordsFormat;
      return matchesText && matchesFormat;
    });
  }, [stats.tournamentRecords, recordsQuery, recordsFormat]);

  const styles = {
    root: { fontFamily: 'Playfair Display, serif', backgroundColor: '#FFFDD0', color: '#2E8B57', minHeight: '100vh', padding: '2rem' },
    container: { maxWidth: 1200, margin: '0 auto' },
    h1: { fontFamily: 'Cinzel, serif', fontSize: '2.5rem', color: '#2E8B57', marginBottom: '3rem', textAlign: 'center', position: 'relative' },
    section: { background: 'var(--card-bg)', borderRadius: 15, padding: '2rem', boxShadow: 'none', marginBottom: '2rem', border: '1px solid var(--card-border)' },
    h2: { fontFamily: 'Cinzel, serif', color: '#2E8B57', textAlign: 'left', marginBottom: '1rem', fontSize: '1.5rem' },
    table: { width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' },
    th: { background: '#2E8B57', color: '#FFFDD0', padding: '1rem', textAlign: 'left', fontFamily: 'Cinzel, serif' },
    td: { padding: '1rem', borderBottom: '1px solid rgba(46, 139, 87, 0.2)' },
    searchRow: { display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: '#f5f5f5', borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.1)', maxWidth: 500, margin: '0 auto 20px' },
    input: { flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #ccc', fontSize: 14 },
    select: { padding: '8px 12px', borderRadius: 8, border: '1px solid #ccc', fontSize: 14 },
    backRow: { textAlign: 'right', marginTop: '2rem' },
    backLink: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#2E8B57', color: '#fff', textDecoration: 'none', padding: '0.8rem 1.5rem', borderRadius: 8, fontFamily: 'Cinzel, serif', fontWeight: 'bold' },
    empty: { textAlign: 'center', padding: '2rem', color: '#2E8B57', fontStyle: 'italic' }
  };

  return (
    <div style={styles.root}>
      <div style={styles.container}>
        <h1 style={styles.h1}>College Chess Statistics</h1>

        {/* Overall Performance */}
        <section style={styles.section}>
          <h2 style={styles.h2}><i className="fas fa-chart-line" aria-hidden="true"></i> Overall Performance</h2>
          <div style={styles.searchRow}>
            <input style={styles.input} placeholder="Search college…" value={perfQuery} onChange={(e) => setPerfQuery(e.target.value)} />
          </div>

          {loading && <div>Loading statistics…</div>}
          {!loading && !!error && <div style={styles.empty}><i className="fas fa-info-circle" aria-hidden="true" /> {error}</div>}
          {!loading && !error && (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}><i className="fas fa-university" aria-hidden="true"></i> College</th>
                  <th style={styles.th}><i className="fas fa-trophy" aria-hidden="true"></i> Total Tournaments</th>
                  <th style={styles.th}><i className="fas fa-medal" aria-hidden="true"></i> Wins</th>
                  <th style={styles.th}><i className="fas fa-award" aria-hidden="true"></i> Runner-Ups</th>
                  <th style={styles.th}><i className="fas fa-star" aria-hidden="true"></i> Top-5 Finishes</th>
                  <th style={styles.th}><i className="fas fa-percentage" aria-hidden="true"></i> Win Rate</th>
                </tr>
              </thead>
              <tbody>
                {filteredPerformance.length === 0 && (
                  <tr>
                    <td style={styles.td} colSpan={6}>
                      <div style={styles.empty}><i className="fas fa-info-circle" aria-hidden="true"></i> No colleges match your search.</div>
                    </td>
                  </tr>
                )}
                {filteredPerformance.map((r, idx) => (
                  <tr key={(r.college || idx) + ''}>
                    <td style={styles.td}>{r.college}</td>
                    <td style={styles.td}>{r.tournaments}</td>
                    <td style={styles.td}>{r.wins}</td>
                    <td style={styles.td}>{r.losses}</td>
                    <td style={styles.td}>{r.draws}</td>
                    <td style={styles.td}>{r && r.tournaments ? (((r.wins || 0) / r.tournaments) * 100).toFixed(1) : '0.0'}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Tournament Records */}
        <section style={styles.section}>
          <h2 style={styles.h2}><i className="fas fa-chess" aria-hidden="true"></i> Tournament Records</h2>
          <div style={styles.searchRow}>
            <select style={styles.select} value={recordsFormat} onChange={(e) => setRecordsFormat(e.target.value)}>
              <option value="all">All formats</option>
              <option value="classical">Classical</option>
              <option value="rapid">Rapid</option>
              <option value="blitz">Blitz</option>
            </select>
            <input style={styles.input} placeholder="Search tournament or college…" value={recordsQuery} onChange={(e) => setRecordsQuery(e.target.value)} />
          </div>

          {loading && <div>Loading records…</div>}
          {!loading && !!error && <div style={styles.empty}><i className="fas fa-info-circle" aria-hidden="true"></i> {error}</div>}
          {!loading && !error && (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}><i className="fas fa-trophy" aria-hidden="true"></i> Tournament Name</th>
                  <th style={styles.th}><i className="fas fa-university" aria-hidden="true"></i> College</th>
                  <th style={styles.th}><i className="fas fa-chess-board" aria-hidden="true"></i> Format</th>
                  <th style={styles.th}><i className="fas fa-medal" aria-hidden="true"></i> Position</th>
                  <th style={styles.th}><i className="fas fa-calendar" aria-hidden="true"></i> Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 && (
                  <tr>
                    <td style={styles.td} colSpan={5}>
                      <div style={styles.empty}><i className="fas fa-info-circle" aria-hidden="true"></i> No records match your filters.</div>
                    </td>
                  </tr>
                )}
                {filteredRecords.map((r, idx) => (
                  <tr key={(r._id || idx) + ''}>
                    <td style={styles.td}>{r.name}</td>
                    <td style={styles.td}>{r.college}</td>
                    <td style={styles.td}>{r.format}</td>
                    <td style={styles.td}>{r.position}</td>
                    <td style={styles.td}>{r.date ? new Date(r.date).toLocaleDateString() : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Top 3 Colleges by Format */}
        <section style={styles.section}>
          <h2 style={styles.h2}><i className="fas fa-crown" aria-hidden="true"></i> Top 3 Colleges by Format</h2>
          {loading && <div>Loading top colleges…</div>}
          {!loading && !!error && <div style={styles.empty}><i className="fas fa-info-circle" aria-hidden="true"></i> {error}</div>}
          {!loading && !error && (
            <div>
              {['classical', 'rapid', 'blitz'].map((format) => (
                <div key={format} style={{ background: 'var(--card-bg)', padding: '1rem 1rem 0.5rem', borderRadius: 12, marginBottom: '1rem', border: '1px solid var(--card-border)' }}>
                  <h3 style={{ ...styles.h2, marginBottom: '0.5rem' }}>{format.charAt(0).toUpperCase() + format.slice(1)}</h3>
                  <ol style={{ listStylePosition: 'inside', padding: 0 }}>
                    {(stats.topCollegesByFormat?.[format] || []).map((college, index) => (
                      <li key={college + index} style={{ padding: '0.8rem', borderBottom: '1px solid rgba(46, 139, 87, 0.2)' }} className={index < 3 ? 'top-three' : ''}>
                        <span style={{ fontWeight: index < 3 ? 'bold' : 'normal' }}>{index < 3 ? '🏆 ' : ''}{college}</span>
                      </li>
                    ))}
                    {(stats.topCollegesByFormat?.[format] || []).length === 0 && (
                      <li style={{ padding: '0.8rem' }}>No data.</li>
                    )}
                  </ol>
                </div>
              ))}
            </div>
          )}
        </section>

        <div style={styles.backRow}>
          <Link to="/organizer/organizer_dashboard" style={styles.backLink}>
            <i className="fas fa-arrow-left" aria-hidden="true"></i> Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export default CollegeStats;
