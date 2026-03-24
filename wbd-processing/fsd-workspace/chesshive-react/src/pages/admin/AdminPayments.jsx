import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const AdminPayments = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [players, setPlayers] = useState([]);
  const [sales, setSales] = useState([]);
  const [tournamentSales, setTournamentSales] = useState([]);

  // per-section visible counts (More/Hide style)
  const [visSubs, setVisSubs] = useState(5);
  const [visSales, setVisSales] = useState(5);
  const [visTour, setVisTour] = useState(5);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/admin/api/payments', { credentials: 'include', cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPlayers(Array.isArray(data?.players) ? data.players : []);
      setSales(Array.isArray(data?.sales) ? data.sales : []);
      setTournamentSales(Array.isArray(data?.tournamentSales) ? data.tournamentSales : []);
      setVisSubs(5); setVisSales(5); setVisTour(5);
    } catch (e) {
      setError('Failed to load payments data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const totals = useMemo(() => {
    const totalRevenue = sales.reduce((acc, s) => acc + parseFloat(s.price || 0), 0);
    const tourEnrollments = tournamentSales.reduce((acc, t) => acc + (t.total_enrollments || 0), 0);
    const tourRevenue = tournamentSales.reduce((acc, t) => acc + parseFloat(t.revenue || 0), 0);
    return { totalSales: sales.length, totalRevenue, tourEnrollments, tourRevenue };
  }, [sales, tournamentSales]);

  const styles = {
    page: { fontFamily: 'Playfair Display, serif', backgroundColor: '#FFFDD0', color: '#2E8B57', minHeight: '100vh', padding: '2rem' },
    container: { maxWidth: 1200, margin: '0 auto' },
    h2: { fontFamily: 'Cinzel, serif', fontSize: '2.2rem', color: '#2E8B57', marginBottom: '1.2rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' },
    stats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: '1.5rem', marginBottom: '1.5rem' },
    statCard: { background: 'var(--card-bg)', padding: '1.5rem', borderRadius: 10, textAlign: 'center', boxShadow: 'none', border: '1px solid var(--card-border)' },
    statValue: { fontSize: '1.6rem', fontWeight: 'bold', color: '#2E8B57', marginBottom: '.5rem' },
    statLabel: { color: '#666', fontSize: '.9rem' },
    tableWrap: { background: 'var(--card-bg)', borderRadius: 15, padding: '1.5rem', boxShadow: 'none', overflowX: 'auto', marginBottom: '2rem', border: '1px solid var(--card-border)' },
    table: { width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' },
    th: { backgroundColor: '#2E8B57', color: '#FFFDD0', padding: '1rem', textAlign: 'left', fontFamily: 'Cinzel, serif' },
    td: { padding: '1rem', borderBottom: '1px solid rgba(46,139,87,0.2)' },
    badge: { padding: '.4rem .9rem', borderRadius: 20, backgroundColor: '#87CEEB', color: '#2E8B57', fontWeight: 'bold' },
    moreWrap: { textAlign: 'center', margin: '1rem 0', display: 'flex', justifyContent: 'center', gap: '1rem' },
    moreBtn: { display: 'inline-flex', alignItems: 'center', gap: '.5rem', backgroundColor: '#87CEEB', color: '#2E8B57', textDecoration: 'none', padding: '.8rem 1.5rem', borderRadius: 8, transition: 'all .3s ease', fontFamily: 'Cinzel, serif', fontWeight: 'bold', cursor: 'pointer' },
    rowCounter: { textAlign: 'center', marginBottom: '1rem', fontFamily: 'Cinzel, serif', fontSize: '1.1rem', color: '#2E8B57', backgroundColor: 'rgba(46,139,87,0.1)', padding: '.4rem .8rem', borderRadius: 8, display: 'inline-block' },
    backRight: { marginTop: '2rem', textAlign: 'right' },
    backLink: { display: 'inline-flex', alignItems: 'center', gap: '.5rem', backgroundColor: '#2E8B57', color: '#FFFDD0', textDecoration: 'none', padding: '.8rem 1.5rem', borderRadius: 8, transition: 'all .3s ease', fontFamily: 'Cinzel, serif', fontWeight: 'bold' },
    empty: { textAlign: 'center', padding: '2rem', color: '#2E8B57', fontStyle: 'italic' },
    banner: (variant) => ({ padding: '1rem', borderRadius: 8, marginBottom: '1rem', textAlign: 'center', fontWeight: 'bold', background: variant === 'error' ? 'rgba(220,53,69,0.1)' : 'rgba(46,139,87,0.1)', color: variant === 'error' ? '#dc3545' : '#2E8B57' }),
  };

  // slices for display
  const subsShown = players.slice(0, visSubs);
  const salesShown = sales.slice(0, visSales);
  const tourShown = tournamentSales.slice(0, visTour);

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h2 style={styles.h2}><span role="img" aria-label="money">💰</span> Payments & Subscriptions</h2>

        {error && <div style={styles.banner('error')}>{error}</div>}

        {/* Subscriptions */}
        <div style={styles.tableWrap}>
          <div style={{ textAlign: 'center' }}>
            <span style={styles.rowCounter}>{`${Math.min(visSubs, players.length)} / ${players.length}`}</span>
          </div>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}><i className="fas fa-user" /> Player Name</th>
                <th style={styles.th}><i className="fas fa-crown" /> Subscription Level</th>
                <th style={styles.th}><i className="fas fa-calendar" /> Date of Subscription</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} style={styles.empty}><i className="fas fa-info-circle" /> Loading subscriptions…</td></tr>
              ) : subsShown.length === 0 ? (
                <tr><td colSpan={3} style={styles.empty}><i className="fas fa-info-circle" /> No players available.</td></tr>
              ) : (
                subsShown.map((p, idx) => (
                  <tr key={`${p.email || p.name || 'sub'}-${idx}`}>
                    <td style={styles.td}>{p.name || 'N/A'}</td>
                    <td style={styles.td}><span style={styles.badge}>Level {p.plan || 'Unknown'}</span></td>
                    <td style={styles.td}>{p.start_date ? new Date(p.start_date).toLocaleDateString() : 'N/A'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div style={styles.moreWrap}>
            {players.length > visSubs && (
              <button type="button" style={styles.moreBtn} onClick={() => setVisSubs((v) => Math.min(v + 5, players.length))}>
                <i className="fas fa-chevron-down" /> More
              </button>
            )}
            {visSubs > 5 && (
              <button type="button" style={styles.moreBtn} onClick={() => setVisSubs(5)}>
                <i className="fas fa-chevron-up" /> Hide
              </button>
            )}
          </div>
        </div>

        {/* Sales Report */}
        <h2 style={styles.h2}>Sales Report</h2>
        <div style={styles.stats}>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{totals.totalSales}</div>
            <div style={styles.statLabel}>Total Sales</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>₹{totals.totalRevenue.toFixed(2)}</div>
            <div style={styles.statLabel}>Total Revenue</div>
          </div>
        </div>
        <div style={styles.tableWrap}>
          <div style={{ textAlign: 'center' }}>
            <span style={styles.rowCounter}>{`${Math.min(visSales, sales.length)} / ${sales.length}`}</span>
          </div>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Product</th>
                <th style={styles.th}>Price</th>
                <th style={styles.th}>Coordinator</th>
                <th style={styles.th}>Buyer</th>
                <th style={styles.th}>College</th>
                <th style={styles.th}>Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={styles.empty}><i className="fas fa-info-circle" /> Loading sales…</td></tr>
              ) : salesShown.length === 0 ? (
                <tr><td colSpan={6} style={styles.empty}><i className="fas fa-info-circle" /> No sales recorded.</td></tr>
              ) : (
                salesShown.map((s, idx) => (
                  <tr key={`${s.product || 'sale'}-${idx}`}>
                    <td style={styles.td}>{s.product || 'N/A'}</td>
                    <td style={styles.td}>₹{s.price || 0}</td>
                    <td style={styles.td}>{s.coordinator || 'N/A'}</td>
                    <td style={styles.td}>{s.buyer || 'N/A'}</td>
                    <td style={styles.td}>{s.college || 'N/A'}</td>
                    <td style={styles.td}>{s.purchase_date ? new Date(s.purchase_date).toLocaleDateString() : 'N/A'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div style={styles.moreWrap}>
            {sales.length > visSales && (
              <button type="button" style={styles.moreBtn} onClick={() => setVisSales((v) => Math.min(v + 5, sales.length))}>
                <i className="fas fa-chevron-down" /> More
              </button>
            )}
            {visSales > 5 && (
              <button type="button" style={styles.moreBtn} onClick={() => setVisSales(5)}>
                <i className="fas fa-chevron-up" /> Hide
              </button>
            )}
          </div>
        </div>

        {/* Tournament Sales */}
        <h2 style={styles.h2}>Tournament Sales Report</h2>
        <div style={styles.stats}>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{totals.tourEnrollments}</div>
            <div style={styles.statLabel}>Total Tournament Enrollments</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>₹{totals.tourRevenue.toFixed(2)}</div>
            <div style={styles.statLabel}>Total Tournament Revenue</div>
          </div>
        </div>
        <div style={styles.tableWrap}>
          <div style={{ textAlign: 'center' }}>
            <span style={styles.rowCounter}>{`${Math.min(visTour, tournamentSales.length)} / ${tournamentSales.length}`}</span>
          </div>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Tournament</th>
                <th style={styles.th}>Entry Fee</th>
                <th style={styles.th}>Total Players/Teams</th>
                <th style={styles.th}>Revenue</th>
                <th style={styles.th}>Enrollment Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={styles.empty}><i className="fas fa-info-circle" /> Loading tournament sales…</td></tr>
              ) : tourShown.length === 0 ? (
                <tr><td colSpan={5} style={styles.empty}><i className="fas fa-info-circle" /> No tournament enrollments recorded.</td></tr>
              ) : (
                tourShown.map((t, idx) => (
                  <tr key={`${t.name || 'tourn'}-${idx}`}>
                    <td style={styles.td}>{t.name || 'N/A'}</td>
                    <td style={styles.td}>₹{t.entry_fee || 0}</td>
                    <td style={styles.td}>{t.total_enrollments || 0} {t.type === 'Individual' ? 'Players' : 'Teams'}</td>
                    <td style={styles.td}>₹{(t.revenue || 0).toFixed(2)}</td>
                    <td style={styles.td}>{t.enrollment_date ? new Date(t.enrollment_date).toLocaleDateString() : 'N/A'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div style={styles.moreWrap}>
            {tournamentSales.length > visTour && (
              <button type="button" style={styles.moreBtn} onClick={() => setVisTour((v) => Math.min(v + 5, tournamentSales.length))}>
                <i className="fas fa-chevron-down" /> More
              </button>
            )}
            {visTour > 5 && (
              <button type="button" style={styles.moreBtn} onClick={() => setVisTour(5)}>
                <i className="fas fa-chevron-up" /> Hide
              </button>
            )}
          </div>
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

export default AdminPayments;
