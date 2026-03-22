import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

// React conversion of views/coordinator/coordinator_profile.html

function CoordinatorProfile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState({ name: '', email: '', college: '' });

  const loadProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/coordinator/api/profile', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load profile');
      setProfile({ name: data.name || 'N/A', email: data.email || 'N/A', college: data.college || 'N/A' });
    } catch (e) {
      console.error(e);
      setError('Error loading profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProfile(); }, []);

  const deleteAccount = async () => {
    const ok = window.confirm('Are you sure you want to delete your account?');
    if (!ok) return;
    try {
      const res = await fetch('/coordinator/api/profile', { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        alert('Account deleted successfully. You will be redirected to login page');
        navigate('/login?message=Account deleted');
      } else {
        alert('Failed to delete account: ' + (data.message || 'Unknown error'));
      }
    } catch (e) {
      console.error(e);
      alert('Error deleting account. Please try again.');
    }
  };

  const styles = {
    root: { fontFamily: 'Playfair Display, serif', backgroundColor: '#FFFDD0', minHeight: '100vh', padding: '2rem' },
    container: { maxWidth: 800, margin: '0 auto' },
    h1: { fontFamily: 'Cinzel, serif', fontSize: '2.5rem', color: '#2E8B57', marginBottom: '2rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' },
    card: { background: 'var(--card-bg)', borderRadius: 15, padding: '2rem', boxShadow: 'none', border: '1px solid var(--card-border)' },
    infoGrid: { display: 'grid', gap: '1.5rem', marginBottom: '2rem' },
    infoItem: { display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', borderBottom: '1px solid rgba(46,139,87,0.2)' },
    label: { fontFamily: 'Cinzel, serif', fontWeight: 'bold', color: '#2E8B57', minWidth: 100, display: 'flex', alignItems: 'center', gap: '0.5rem' },
    value: { color: '#333', flexGrow: 1 },
    actions: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', gap: '1rem', flexWrap: 'wrap' },
    backLink: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#2E8B57', color: '#fff', textDecoration: 'none', padding: '0.8rem 1.5rem', borderRadius: 8, fontFamily: 'Cinzel, serif', fontWeight: 'bold' },
    delBtn: { background: '#d32f2f', color: '#fff', border: 'none', padding: '0.8rem 1.5rem', borderRadius: 8, cursor: 'pointer', fontFamily: 'Cinzel, serif', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' },
    err: { color: '#b71c1c', marginBottom: '1rem', textAlign: 'center' },
  };

  return (
    <div style={styles.root}>
      <div style={styles.container}>
        <h1 style={styles.h1}><span role="img" aria-label="profile">👤</span> Coordinator Profile</h1>
        <div style={styles.card}>
          {error ? <div style={styles.err}>{error}</div> : null}
          {loading ? (
            <p>Loading…</p>
          ) : (
            <>
              <div style={styles.infoGrid}>
                <div style={styles.infoItem}>
                  <div style={styles.label}><i className="fas fa-user" /> Name:</div>
                  <div style={styles.value}>{profile.name}</div>
                </div>
                <div style={styles.infoItem}>
                  <div style={styles.label}><i className="fas fa-envelope" /> Email:</div>
                  <div style={styles.value}>{profile.email}</div>
                </div>
                <div style={styles.infoItem}>
                  <div style={styles.label}><i className="fas fa-university" /> College:</div>
                  <div style={styles.value}>{profile.college}</div>
                </div>
              </div>

              <div style={styles.actions}>
                <Link to="/coordinator/coordinator_dashboard" style={styles.backLink}><i className="fas fa-arrow-left" /> Back to Dashboard</Link>
                <button type="button" style={styles.delBtn} onClick={deleteAccount}><i className="fas fa-trash" /> Delete Account</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default CoordinatorProfile;
