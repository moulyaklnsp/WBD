import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const AdminCoordinatorManagement = () => {
  const [coordinators, setCoordinators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [visible, setVisible] = useState(5);
  const [attr, setAttr] = useState('name');
  const [query, setQuery] = useState('');

  const fetchCoordinators = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/admin/api/coordinators', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // Legacy returned array directly; safeguard if API later wraps
      setCoordinators(Array.isArray(data) ? data : (Array.isArray(data?.coordinators) ? data.coordinators : []));
      setVisible(5);
    } catch (e) {
      setError('Failed to load coordinators.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCoordinators(); }, [fetchCoordinators]);

  const filtered = useMemo(() => {
    if (!query.trim()) return coordinators;
    const q = query.toLowerCase();
    const getVal = (c) => {
      switch (attr) {
        case 'name': return c.name;
        case 'email': return c.email;
        case 'college': return c.college;
        case 'status': return c.isDeleted ? 'removed' : 'active';
        default: return '';
      }
    };
    return coordinators.filter((c) => (getVal(c) || '').toString().toLowerCase().includes(q));
  }, [coordinators, query, attr]);

  const shown = filtered.slice(0, visible);
  const canMore = filtered.length > visible;
  const canHide = visible > 5;

  const handleRemove = async (email) => {
    if (!window.confirm(`Are you sure you want to remove ${email}?`)) return;
    try {
      const res = await fetch(`/admin/api/coordinators/${encodeURIComponent(email)}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      setCoordinators((prev) => prev.map((c) => (c.email === email ? { ...c, isDeleted: true } : c)));
      setNotice('Coordinator removed successfully.');
      setTimeout(() => setNotice(''), 2500);
    } catch (e) {
      setError('Failed to remove coordinator.');
      setTimeout(() => setError(''), 2500);
    }
  };

  const handleRestore = async (email) => {
    if (!window.confirm(`Are you sure you want to restore ${email}?`)) return;
    try {
      const res = await fetch(`/admin/api/coordinators/restore/${encodeURIComponent(email)}`, { method: 'PATCH', credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      setCoordinators((prev) => prev.map((c) => (c.email === email ? { ...c, isDeleted: false } : c)));
      setNotice('Coordinator restored successfully.');
      setTimeout(() => setNotice(''), 2500);
    } catch (e) {
      setError('Failed to restore coordinator.');
      setTimeout(() => setError(''), 2500);
    }
  };

  const styles = {
    page: { fontFamily: 'Playfair Display, serif', backgroundColor: '#FFFDD0', color: '#2E8B57', minHeight: '100vh', padding: '2rem' },
    container: { maxWidth: 1200, margin: '0 auto' },
    h2: { fontFamily: 'Cinzel, serif', fontSize: '2.5rem', color: '#2E8B57', marginBottom: '2rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' },
    tableDiv: { background: 'var(--card-bg)', borderRadius: 15, padding: '2rem', boxShadow: 'none', overflowX: 'auto', border: '1px solid var(--card-border)' },
    table: { width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' },
    th: { backgroundColor: '#2E8B57', color: '#FFFDD0', padding: '1.2rem', textAlign: 'left', fontFamily: 'Cinzel, serif', fontSize: '1.1rem' },
    td: { padding: '1rem', borderBottom: '1px solid rgba(46,139,87,0.2)' },
    actionBtn: { backgroundColor: '#ff6b6b', color: '#fff', border: 'none', padding: '.6rem 1rem', borderRadius: 5, cursor: 'pointer', transition: 'all .3s ease', fontFamily: 'Cinzel, serif', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '.5rem' },
    restoreBtn: { backgroundColor: '#87CEEB', color: '#2E8B57' },
    backRight: { marginTop: '2rem', textAlign: 'right' },
    backLink: { display: 'inline-flex', alignItems: 'center', gap: '.5rem', backgroundColor: '#2E8B57', color: '#FFFDD0', textDecoration: 'none', padding: '.8rem 1.5rem', borderRadius: 8, transition: 'all .3s ease', fontFamily: 'Cinzel, serif', fontWeight: 'bold' },
    moreWrap: { textAlign: 'center', margin: '1rem 0', display: 'flex', justifyContent: 'center', gap: '1rem' },
    moreBtn: { display: 'inline-flex', alignItems: 'center', gap: '.5rem', backgroundColor: '#87CEEB', color: '#2E8B57', textDecoration: 'none', padding: '.8rem 1.5rem', borderRadius: 8, transition: 'all .3s ease', fontFamily: 'Cinzel, serif', fontWeight: 'bold', cursor: 'pointer' },
    rowCounter: { textAlign: 'center', marginBottom: '1rem', fontFamily: 'Cinzel, serif', fontSize: '1.2rem', color: '#2E8B57', backgroundColor: 'rgba(46,139,87,0.1)', padding: '.5rem 1rem', borderRadius: 8, display: 'inline-block' },
    empty: { textAlign: 'center', padding: '2rem', color: '#2E8B57', fontStyle: 'italic' },
    searchBar: { display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: '#f5f5f5', borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.1)', maxWidth: 500, margin: '20px auto' },
    select: { padding: '8px 12px', borderRadius: 8, border: '1px solid #ccc', backgroundColor: '#fff', fontSize: 14 },
    input: { flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #ccc', fontSize: 14 },
    banner: (variant) => ({ padding: '1rem', borderRadius: 8, marginBottom: '1rem', textAlign: 'center', fontWeight: 'bold', background: variant === 'error' ? 'rgba(220,53,69,0.1)' : 'rgba(46,139,87,0.1)', color: variant === 'error' ? '#dc3545' : '#2E8B57' }),
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h2 style={styles.h2}><span role="img" aria-label="rook">♖</span> Coordinator Management</h2>

        {error && <div style={styles.banner('error')}>{error}</div>}
        {notice && <div style={styles.banner('ok')}>{notice}</div>}

        <div style={styles.tableDiv}>
          <div style={{ textAlign: 'center' }}>
            <span style={styles.rowCounter}>{`${Math.min(visible, filtered.length)} / ${filtered.length}`}</span>
          </div>

          <div style={styles.searchBar}>
            <select aria-label="Attribute" value={attr} onChange={(e) => { setAttr(e.target.value); setVisible(5); }} style={styles.select}>
              <option value="name">Name</option>
              <option value="email">Email</option>
              <option value="college">Assigned College</option>
              <option value="status">Status</option>
            </select>
            <input aria-label="Search" placeholder="Search…" value={query} onChange={(e) => { setQuery(e.target.value); setVisible(5); }} style={styles.input} />
          </div>

          {loading ? (
            <table style={styles.table}><tbody><tr><td colSpan={4} style={styles.empty}><i className="fas fa-info-circle" /> Loading coordinators…</td></tr></tbody></table>
          ) : (
            <>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}><i className="fas fa-user" /> Name</th>
                    <th style={styles.th}><i className="fas fa-envelope" /> Email</th>
                    <th style={styles.th}><i className="fas fa-university" /> Assigned College</th>
                    <th style={styles.th}><i className="fas fa-cog" /> Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.length === 0 ? (
                    <tr><td colSpan={4} style={styles.empty}><i className="fas fa-info-circle" /> No coordinators available.</td></tr>
                  ) : (
                    shown.map((c, idx) => (
                      <tr key={`${c.email}-${idx}`}>
                        <td style={styles.td}>{c.name}</td>
                        <td style={styles.td}>{c.email}</td>
                        <td style={styles.td}>{c.college}</td>
                        <td style={styles.td}>
                          {c.isDeleted ? (
                            <button type="button" style={{ ...styles.actionBtn, ...styles.restoreBtn }} onClick={() => handleRestore(c.email)}>
                              <i className="fas fa-user-plus" /> Restore
                            </button>
                          ) : (
                            <button type="button" style={styles.actionBtn} onClick={() => handleRemove(c.email)}>
                              <i className="fas fa-user-minus" /> Remove
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <div style={styles.moreWrap}>
                {canMore && (
                  <button type="button" style={styles.moreBtn} onClick={() => setVisible((v) => Math.min(v + 5, filtered.length))}>
                    <i className="fas fa-chevron-down" /> More
                  </button>
                )}
                {canHide && (
                  <button type="button" style={styles.moreBtn} onClick={() => setVisible(5)}>
                    <i className="fas fa-chevron-up" /> Hide
                  </button>
                )}
              </div>
            </>
          )}

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

export default AdminCoordinatorManagement;
