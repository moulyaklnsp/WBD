import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';

// React conversion of views/coordinator/feedback_view.html

function FeedbackView() {
  const [searchParams] = useSearchParams();
  const tournamentId = searchParams.get('tournament_id');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedbacks, setFeedbacks] = useState([]);

  useEffect(() => {
    const load = async () => {
      if (!tournamentId) {
        setError('No tournament specified.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError('');
        const res = await fetch(`/coordinator/api/feedbacks?tournament_id=${encodeURIComponent(tournamentId)}`, { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch feedbacks');
        setFeedbacks(Array.isArray(data.feedbacks) ? data.feedbacks : []);
      } catch (e) {
        console.error('Error loading feedbacks:', e);
        setError('Error loading feedback.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tournamentId]);

  const styles = {
    root: { fontFamily: 'Playfair Display, serif', backgroundColor: '#FFFDD0', minHeight: '100vh', padding: '2rem' },
    h1: { fontFamily: 'Cinzel, serif', color: '#2E8B57', textAlign: 'center', marginBottom: '2rem' },
    container: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' },
    card: { background: 'var(--card-bg)', borderRadius: 15, padding: '1.5rem', boxShadow: 'none', border: '1px solid var(--card-border)' },
    name: { color: '#2E8B57', marginBottom: '0.5rem' },
    rating: { color: '#FFD700', fontSize: '1.2rem' },
    comments: { marginTop: '1rem', fontStyle: 'italic' },
    date: { fontSize: '0.8rem', color: '#666', textAlign: 'right' },
    err: { textAlign: 'center', color: '#c62828', marginBottom: '1rem' },
    backRow: { textAlign: 'right', marginTop: '1.5rem' },
    backLink: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#2E8B57', color: '#fff', textDecoration: 'none', padding: '0.6rem 1.2rem', borderRadius: 8, fontFamily: 'Cinzel, serif', fontWeight: 'bold' },
  };

  const renderStars = (rating) => {
    const r = Math.max(0, Math.min(5, Number(rating) || 0));
    return '★'.repeat(r) + '☆'.repeat(5 - r);
  };

  return (
    <div style={styles.root}>
      <h1 style={styles.h1}>Feedback for Tournament</h1>
      {error ? <div style={styles.err}>{error}</div> : null}
      {loading ? <div className="loading">Loading…</div> : null}

      {!loading && !error && (
        <div style={styles.container}>
          {feedbacks.length === 0 ? (
            <p>No feedback yet.</p>
          ) : (
            feedbacks.map((f, idx) => (
              <div key={f._id || idx} style={styles.card}>
                <h3 style={styles.name}>{f.username}</h3>
                <div style={styles.rating}>{renderStars(f.rating)}</div>
                <div style={styles.comments}>{f.comments || 'No comments'}</div>
                <div style={styles.date}>{f.submitted_date ? new Date(f.submitted_date).toLocaleDateString() : ''}</div>
              </div>
            ))
          )}
        </div>
      )}

      <div style={styles.backRow}>
        <Link to="/coordinator/tournament_management" style={styles.backLink}><i className="fas fa-arrow-left" /> Back to tournaments</Link>
      </div>
    </div>
  );
}

export default FeedbackView;
