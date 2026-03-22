import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const OrganizerProfile = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState({ name: '', email: '', college: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const timeoutRef = useRef(null);

  const clearMessageLater = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setMessage({ type: '', text: '' });
      timeoutRef.current = null;
    }, 3000);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/organizer/api/profile', {
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setProfile({
            name: data?.name || 'N/A',
            email: data?.email || 'N/A',
            college: data?.college || 'N/A',
          });
        }
      } catch (e) {
        if (!cancelled) setError('Failed to fetch profile.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleDelete = async () => {
    if (!profile.email || profile.email === 'N/A') {
      setMessage({ type: 'error', text: 'Cannot determine account to delete' });
      clearMessageLater();
      return;
    }
    // eslint-disable-next-line no-restricted-globals
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return;
    }
    try {
      const res = await fetch(`/organizer/api/organizers/${encodeURIComponent(profile.email)}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
        credentials: 'include',
      });
      let data = {};
      try { data = await res.json(); } catch (_) {}
      if (res.ok && (data?.success ?? false)) {
        setMessage({ type: 'success', text: data?.message || 'Account deleted successfully.' });
        setTimeout(() => navigate('/login'), 3000);
      } else {
        setMessage({ type: 'error', text: data?.message || `Failed to delete account (HTTP ${res.status})` });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to delete account' });
    } finally {
      clearMessageLater();
    }
  };

  const styles = {
    page: { fontFamily: 'Playfair Display, serif', backgroundColor: '#FFFDD0', minHeight: '100vh', padding: '2rem' },
    container: { maxWidth: 800, margin: '0 auto' },
    h2: {
      fontFamily: 'Cinzel, serif', fontSize: '2.5rem', color: '#2E8B57', marginBottom: '2rem', textAlign: 'center',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem',
    },
    profileCard: { background: 'var(--card-bg)', borderRadius: 15, padding: '2rem', boxShadow: 'none', marginBottom: '2rem', border: '1px solid var(--card-border)' },
    profileInfo: { display: 'grid', gap: '1.5rem' },
    infoItem: { display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(46, 139, 87, 0.2)' },
    infoIcon: { color: '#2E8B57', fontSize: '1.5rem', width: 30, textAlign: 'center' },
    infoLabel: { fontFamily: 'Cinzel, serif', fontWeight: 'bold', color: '#2E8B57', minWidth: 100 },
    infoValue: { color: '#333', flexGrow: 1 },
    deleteContainer: { textAlign: 'right', marginTop: '1rem' },
    deleteButton: {
      display: 'inline-flex', alignItems: 'center', gap: '.5rem', backgroundColor: '#c62828', color: '#FFFDD0',
      textDecoration: 'none', padding: '.8rem 1.5rem', borderRadius: 8, transition: 'all .3s ease',
      fontFamily: 'Cinzel, serif', fontWeight: 'bold', cursor: 'pointer', border: 'none'
    },
    backLink: {
      display: 'inline-flex', alignItems: 'center', gap: '.5rem', backgroundColor: '#2E8B57', color: '#FFFDD0',
      textDecoration: 'none', padding: '.8rem 1.5rem', borderRadius: 8, transition: 'all .3s ease',
      fontFamily: 'Cinzel, serif', fontWeight: 'bold'
    },
    msg: { textAlign: 'center', marginTop: '1rem' },
    msgError: { backgroundColor: 'rgba(198,40,40,0.1)', color: '#c62828', padding: '1rem', borderRadius: 5 },
    msgSuccess: { backgroundColor: 'rgba(46,125,50,0.1)', color: '#1b5e20', padding: '1rem', borderRadius: 5 },
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h2 style={styles.h2}><span role="img" aria-label="profile">👤</span> Chess Organizer Profile</h2>

        <div style={styles.profileCard}>
          {loading ? (
            <p>Loading profile…</p>
          ) : error ? (
            <p style={styles.msgError}>{error}</p>
          ) : (
            <div style={styles.profileInfo}>
              <div style={styles.infoItem}>
                <i className="fas fa-user" style={styles.infoIcon} />
                <span style={styles.infoLabel}>Name:</span>
                <span style={styles.infoValue}>{profile.name}</span>
              </div>
              <div style={styles.infoItem}>
                <i className="fas fa-envelope" style={styles.infoIcon} />
                <span style={styles.infoLabel}>Email:</span>
                <span style={styles.infoValue}>{profile.email}</span>
              </div>
              <div style={styles.infoItem}>
                <i className="fas fa-university" style={styles.infoIcon} />
                <span style={styles.infoLabel}>College:</span>
                <span style={styles.infoValue}>{profile.college}</span>
              </div>
            </div>
          )}
        </div>

        <div style={styles.deleteContainer}>
          <button type="button" style={styles.deleteButton} onClick={handleDelete}>
            Delete Account <i className="fas fa-trash" />
          </button>
        </div>
        <div style={styles.msg}>
          {message.text && (
            <p style={message.type === 'error' ? styles.msgError : styles.msgSuccess}>{message.text}</p>
          )}
        </div>

        <div style={{ textAlign: 'left', marginTop: '1rem' }}>
          <Link to="/organizer/organizer_dashboard" style={styles.backLink}>
            <i className="fas fa-arrow-left" /> Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default OrganizerProfile;
