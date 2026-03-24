import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

// React conversion of views/organizer/coordinator_management.html

const PAGE_SIZE = 5;

function CoordinatorManagement() {
  const [coordinators, setCoordinators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | active | removed

  const fetchCoordinators = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/organizer/api/coordinators', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch coordinators');
      const list = Array.isArray(data) ? data : [];
      setCoordinators(list);
      setVisible(PAGE_SIZE);
    } catch (e) {
      console.error('Fetch coordinators error:', e);
      setError('Failed to load coordinators.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoordinators();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return coordinators.filter((c) => {
      const matchesText = !q || [c.name, c.email, c.college].some((v) => (v || '').toLowerCase().includes(q));
      const isDeleted = !!c.isDeleted;
      const matchesStatus =
        statusFilter === 'all' || (statusFilter === 'active' && !isDeleted) || (statusFilter === 'removed' && isDeleted);
      return matchesText && matchesStatus;
    });
  }, [coordinators, query, statusFilter]);

  const onRemove = async (email) => {
    if (!window.confirm(`Are you sure you want to remove ${email}?`)) return;
    try {
      const res = await fetch(`/organizer/api/coordinators/${encodeURIComponent(email)}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to remove coordinator');
      // update locally
      setCoordinators((prev) => prev.map((c) => (c.email === email ? { ...c, isDeleted: true } : c)));
      alert('Coordinator removed successfully.');
    } catch (e) {
      console.error('Remove error:', e);
      alert('Failed to remove coordinator.');
    }
  };

  const onRestore = async (email) => {
    if (!window.confirm(`Are you sure you want to restore ${email}?`)) return;
    try {
      const res = await fetch(`/organizer/api/coordinators/restore/${encodeURIComponent(email)}`, {
        method: 'PATCH',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to restore coordinator');
      setCoordinators((prev) => prev.map((c) => (c.email === email ? { ...c, isDeleted: false } : c)));
      alert('Coordinator restored successfully.');
    } catch (e) {
      console.error('Restore error:', e);
      alert('Failed to restore coordinator.');
    }
  };

  const styles = {
    root: { fontFamily: 'Playfair Display, serif', backgroundColor: '#FFFDD0', color: '#2E8B57', minHeight: '100vh', padding: '2rem' },
    container: { maxWidth: 1200, margin: '0 auto' },
    h2: { fontFamily: 'Cinzel, serif', fontSize: '2.5rem', color: '#2E8B57', marginBottom: '2rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' },
    card: { background: 'var(--card-bg)', borderRadius: 15, padding: '2rem', boxShadow: 'none', border: '1px solid var(--card-border)' },
    table: { width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' },
    th: { background: '#2E8B57', color: '#FFFDD0', padding: '1.2rem', textAlign: 'left', fontFamily: 'Cinzel, serif', fontSize: '1.1rem' },
    td: { padding: '1rem', borderBottom: '1px solid rgba(46, 139, 87, 0.2)' },
    searchRow: { display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: '#f5f5f5', borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.1)', maxWidth: 500, margin: '0 auto 20px' },
    input: { flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #ccc', fontSize: 14 },
    select: { padding: '8px 12px', borderRadius: 8, border: '1px solid #ccc', fontSize: 14 },
    moreWrap: { textAlign: 'center', margin: '1rem 0', display: 'flex', justifyContent: 'center', gap: '1rem' },
    moreBtn: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#87CEEB', color: '#2E8B57', textDecoration: 'none', padding: '0.8rem 1.5rem', borderRadius: 8, fontFamily: 'Cinzel, serif', fontWeight: 'bold', cursor: 'pointer', border: 'none' },
    rowCounter: { textAlign: 'center', marginBottom: '1rem', fontFamily: 'Cinzel, serif', fontSize: '1.2rem', color: '#2E8B57', backgroundColor: 'rgba(46, 139, 87, 0.1)', padding: '0.5rem 1rem', borderRadius: 8, display: 'inline-block' },
    backRow: { textAlign: 'right', marginTop: '2rem' },
    backLink: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#2E8B57', color: '#fff', textDecoration: 'none', padding: '0.8rem 1.5rem', borderRadius: 8, fontFamily: 'Cinzel, serif', fontWeight: 'bold' },
    empty: { textAlign: 'center', padding: '2rem', color: '#2E8B57', fontStyle: 'italic' },
    removeBtn: { backgroundColor: '#ff6b6b', color: '#fff', border: 'none', padding: '0.6rem 1rem', borderRadius: 5, cursor: 'pointer', fontFamily: 'Cinzel, serif', fontWeight: 'bold' },
    restoreBtn: { backgroundColor: '#87CEEB', color: '#2E8B57', border: 'none', padding: '0.6rem 1rem', borderRadius: 5, cursor: 'pointer', fontFamily: 'Cinzel, serif', fontWeight: 'bold' }
  };

  const visibleRows = filtered.slice(0, visible);

  return (
    <div style={styles.root}>
      <div style={styles.container}>
        <h2 style={styles.h2}><span role="img" aria-label="chess">♟️</span> Coordinator Management</h2>

        <div style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <div style={styles.rowCounter}>
              {Math.min(visibleRows.length, filtered.length)} / {filtered.length}
            </div>
          </div>
          <div style={styles.searchRow}>
            <select style={styles.select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="removed">Removed</option>
            </select>
            <input style={styles.input} placeholder="Search name, email or college…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>

          {loading && (
            <table style={styles.table}><tbody><tr><td style={styles.td} colSpan={4}><div style={styles.empty}><i className="fas fa-info-circle" aria-hidden="true"></i> Loading coordinators…</div></td></tr></tbody></table>
          )}
          {!loading && !!error && (
            <div style={styles.empty}><i className="fas fa-exclamation-triangle" aria-hidden="true"></i> {error}</div>
          )}
          {!loading && !error && (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}><i className="fas fa-user" aria-hidden="true"></i> Name</th>
                  <th style={styles.th}><i className="fas fa-envelope" aria-hidden="true"></i> Email</th>
                  <th style={styles.th}><i className="fas fa-university" aria-hidden="true"></i> Assigned College</th>
                  <th style={styles.th}><i className="fas fa-cog" aria-hidden="true"></i> Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 && (
                  <tr>
                    <td style={styles.td} colSpan={4}><div style={styles.empty}><i className="fas fa-info-circle" aria-hidden="true"></i> No coordinators available.</div></td>
                  </tr>
                )}
                {visibleRows.map((c, idx) => (
                  <tr key={(c.email || idx) + ''}>
                    <td style={styles.td}>{c.name}</td>
                    <td style={styles.td}>{c.email}</td>
                    <td style={styles.td}>{c.college}</td>
                    <td style={styles.td}>
                      {c.isDeleted ? (
                        <button style={styles.restoreBtn} onClick={() => onRestore(c.email)}>
                          <i className="fas fa-user-plus" aria-hidden="true"></i> Restore
                        </button>
                      ) : (
                        <button style={styles.removeBtn} onClick={() => onRemove(c.email)}>
                          <i className="fas fa-user-minus" aria-hidden="true"></i> Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={styles.moreWrap}>
            {visible < filtered.length && (
              <button style={styles.moreBtn} onClick={() => setVisible((v) => Math.min(v + PAGE_SIZE, filtered.length))}>
                <i className="fas fa-chevron-down" aria-hidden="true"></i> More
              </button>
            )}
            {visible > PAGE_SIZE && (
              <button style={styles.moreBtn} onClick={() => setVisible(PAGE_SIZE)}>
                <i className="fas fa-chevron-up" aria-hidden="true"></i> Hide
              </button>
            )}
          </div>

          <div style={styles.backRow}>
            <Link to="/organizer/organizer_dashboard" style={styles.backLink}>
              <i className="fas fa-arrow-left" aria-hidden="true"></i> Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CoordinatorManagement;
