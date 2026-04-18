import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import '../../styles/playerNeoNoir.css';
import { motion } from 'framer-motion';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import AnimatedSidebar from '../../components/AnimatedSidebar';
import { coordinatorLinks } from '../../constants/coordinatorLinks';

const sectionVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.97 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: i * 0.12,
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1]
    }
  })
};

function FeedbackView() {
  const [isDark, toggleTheme] = usePlayerTheme();
  const [searchParams] = useSearchParams();
  const tournamentId = searchParams.get('tournament_id');
  const sectionsPath = tournamentId ? `/coordinator/tournaments/${tournamentId}` : '/coordinator/tournament_management';

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

  const renderStars = (rating) => {
    const r = Math.max(0, Math.min(5, Number(rating) || 0));
    return '★'.repeat(r) + '☆'.repeat(5 - r);
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; }
        body, #root { min-height: 100vh; }
        .page { font-family: 'Playfair Display', serif; background-color: var(--page-bg); min-height: 100vh; display:flex; color: var(--text-color); }
        .content { flex-grow:1; margin-left:0; padding:2rem; }
        h1 { font-family:'Cinzel', serif; color:var(--sea-green); margin-bottom:2rem; font-size:2.5rem; display:flex; align-items:center; gap:1rem; }
        .feedback-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:1rem; }
        .feedback-card { background:var(--card-bg); border-radius:15px; padding:1.5rem; border:1px solid var(--card-border); }
        .feedback-name { color:var(--sea-green); margin-bottom:0.5rem; }
        .feedback-rating { color:#FFD700; font-size:1.2rem; }
        .feedback-comments { margin-top:1rem; font-style:italic; }
        .feedback-date { font-size:0.8rem; color:var(--text-color); opacity:0.7; text-align:right; }
        .action-btn { display:inline-flex; align-items:center; gap:0.5rem; background:var(--sea-green); color:var(--on-accent); text-decoration:none; padding:0.6rem 1.2rem; border-radius:8px; font-family:'Cinzel', serif; font-weight:bold; }
        .error-text { text-align:center; color:#c62828; margin-bottom:1rem; }
      `}</style>

      <div className="page player-neo">
        <motion.div
          className="chess-knight-float"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 0.14, scale: 1 }}
          transition={{ delay: 0.9, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 0, fontSize: '2.5rem', color: 'var(--sea-green)' }}
          aria-hidden="true"
        >
          <i className="fas fa-comment" />
        </motion.div>
        
        <AnimatedSidebar links={coordinatorLinks} logo={<i className="fas fa-chess" />} title={`ChessHive`} />

        <div className="coordinator-dash-header" style={{ position: 'fixed', top: 18, right: 18, zIndex: 1001, display: 'flex', gap: '12px', alignItems: 'center' }}>
          <motion.button
            type="button"
            onClick={toggleTheme}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              color: 'var(--text-color)',
              width: 40,
              height: 40,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1.1rem'
            }}
          >
            <i className={isDark ? 'fas fa-sun' : 'fas fa-moon'} />
          </motion.button>
        </div>

        <div className="content">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <i className="fas fa-comment" /> Feedback for Tournament
          </motion.h1>

          {error && <div className="error-text">{error}</div>}
          {loading && <div className="loading">Loading…</div>}

          {!loading && !error && (
            <motion.div
              className="feedback-grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              {feedbacks.length === 0 ? (
                <p>No feedback yet.</p>
              ) : (
                feedbacks.map((f, idx) => (
                  <motion.div
                    key={f._id || idx}
                    className="feedback-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1, duration: 0.5 }}
                  >
                    <h3 className="feedback-name">{f.username}</h3>
                    <div className="feedback-rating">{renderStars(f.rating)}</div>
                    <div className="feedback-comments">{f.comments || 'No comments'}</div>
                    <div className="feedback-date">{f.submitted_date ? new Date(f.submitted_date).toLocaleDateString() : ''}</div>
                  </motion.div>
                ))
              )}
            </motion.div>
          )}

          <div style={{ textAlign: 'right', marginTop: '1.5rem' }}>
            <Link to={sectionsPath} className="action-btn">
              <i className="fas fa-arrow-left" /> {tournamentId ? 'Back to Open Sections' : 'Back to Tournaments'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FeedbackView;






