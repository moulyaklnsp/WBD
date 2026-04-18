import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import '../../styles/playerNeoNoir.css';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchAsCoordinator } from '../../utils/fetchWithRole';
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

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: i * 0.07,
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1]
    }
  })
};

const FILTER_TABS = [
  { key: 'all', label: 'All', icon: 'fas fa-list' },
  { key: 'pending', label: 'Pending', icon: 'fas fa-clock' },
  { key: 'resolved', label: 'Resolved', icon: 'fas fa-check-circle' }
];

function CoordinatorComplaints() {
  const [isDark, toggleTheme] = usePlayerTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [complaints, setComplaints] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [replyTexts, setReplyTexts] = useState({});
  const [resolvingId, setResolvingId] = useState(null);
  const [message, setMessage] = useState(null);

  const loadComplaints = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchAsCoordinator('/coordinator/api/complaints');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load complaints');
      setComplaints(data.complaints || data || []);
    } catch (e) {
      console.error(e);
      setError('Error loading complaints');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadComplaints(); }, [loadComplaints]);

  const filteredComplaints = useMemo(() => {
    if (activeFilter === 'all') return complaints;
    return complaints.filter(c => c.status === activeFilter);
  }, [complaints, activeFilter]);

  const handleReplyChange = (id, text) => {
    setReplyTexts(prev => ({ ...prev, [id]: text }));
  };

  const showMessage = (text, type = 'success') => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleResolve = async (id) => {
    const reply = (replyTexts[id] || '').trim();
    if (!reply) {
      showMessage('Please enter a reply before resolving.', 'error');
      return;
    }

    setResolvingId(id);
    try {
      const res = await fetchAsCoordinator(`/coordinator/api/complaints/${id}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resolve complaint');

      // Update local state
      setComplaints(prev => prev.map(c =>
        (c._id === id || c.id === id) ? { ...c, status: 'resolved', reply } : c
      ));
      setReplyTexts(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      showMessage('Complaint resolved successfully!', 'success');
    } catch (e) {
      console.error(e);
      showMessage('Error resolving complaint: ' + e.message, 'error');
    } finally {
      setResolvingId(null);
    }
  };

  const counts = useMemo(() => ({
    all: complaints.length,
    pending: complaints.filter(c => c.status === 'pending').length,
    resolved: complaints.filter(c => c.status === 'resolved').length
  }), [complaints]);

  return (
    <div style={{ minHeight: '100vh' }}>
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; }
        body, #root { min-height: 100vh; }
        .page { font-family: 'Playfair Display', serif; background-color: var(--page-bg); min-height: 100vh; display:flex; color: var(--text-color); }
        .content { flex-grow:1; margin-left:0; padding:2rem; }
        h1 { font-family:'Cinzel', serif; color:var(--sea-green); margin-bottom:2rem; font-size:2.5rem; display:flex; align-items:center; gap:1rem; }
        .updates-section { background:var(--card-bg); border-radius:15px; padding:2rem; margin-bottom:2rem; box-shadow:none; border:1px solid var(--card-border); transition: transform 0.3s ease; }
        .updates-section:hover { transform: translateY(-5px); }
        .btn-primary { background:var(--sea-green); color:var(--on-accent); border:none; padding:0.8rem 1.5rem; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; display:inline-flex; align-items:center; gap:0.5rem; text-decoration:none; }
        .error-text { color:#b71c1c; margin-bottom:1rem; text-align:center; }

        .filter-tabs { display:flex; gap:0.5rem; margin-bottom:1.5rem; flex-wrap:wrap; }
        .filter-tab { background:var(--card-bg); border:1px solid var(--card-border); color:var(--text-color); padding:0.6rem 1.2rem; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; font-size:0.85rem; display:inline-flex; align-items:center; gap:0.5rem; transition:all 0.2s ease; }
        .filter-tab:hover { border-color:var(--sea-green); color:var(--sea-green); }
        .filter-tab.active { background:var(--sea-green); color:var(--on-accent); border-color:var(--sea-green); }
        .filter-count { background:rgba(255,255,255,0.2); padding:0.1rem 0.45rem; border-radius:10px; font-size:0.75rem; margin-left:0.25rem; }
        .filter-tab:not(.active) .filter-count { background:rgba(46,139,87,0.15); }

        .complaints-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(340px, 1fr)); gap:1.25rem; }
        .complaint-card { background:var(--card-bg); border:1px solid var(--card-border); border-radius:12px; padding:1.5rem; transition:all 0.3s ease; }
        .complaint-card:hover { transform:translateY(-4px); border-color:var(--sea-green); }
        .complaint-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem; gap:0.75rem; flex-wrap:wrap; }
        .complaint-subject { font-family:'Cinzel', serif; font-weight:bold; color:var(--text-color); font-size:1.05rem; flex:1; }
        .status-badge { display:inline-block; padding:0.25rem 0.7rem; border-radius:20px; font-size:0.75rem; font-weight:bold; color:#fff; text-transform:capitalize; }
        .status-pending { background:#f0c040; color:#333; }
        .status-resolved { background:#2e7d32; }

        .complaint-meta { display:flex; flex-direction:column; gap:0.4rem; margin-bottom:1rem; }
        .meta-item { display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; color:var(--text-color); opacity:0.8; }
        .meta-item i { color:var(--sea-green); width:16px; text-align:center; }

        .complaint-message { background:rgba(46,139,87,0.05); border-left:3px solid var(--sea-green); padding:0.75rem 1rem; border-radius:0 8px 8px 0; margin-bottom:1rem; font-size:0.9rem; line-height:1.5; color:var(--text-color); }

        .reply-section { margin-top:1rem; }
        .reply-textarea { width:100%; min-height:80px; background:var(--page-bg); border:1px solid var(--card-border); border-radius:8px; padding:0.75rem; color:var(--text-color); font-family:'Playfair Display', serif; font-size:0.9rem; resize:vertical; transition:border-color 0.2s ease; }
        .reply-textarea:focus { outline:none; border-color:var(--sea-green); }
        .reply-textarea::placeholder { color:var(--text-color); opacity:0.4; }
        .resolve-btn { background:var(--sea-green); color:var(--on-accent); border:none; padding:0.65rem 1.3rem; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; font-size:0.85rem; display:inline-flex; align-items:center; gap:0.5rem; margin-top:0.75rem; transition:all 0.2s ease; }
        .resolve-btn:hover { opacity:0.9; transform:translateY(-1px); }
        .resolve-btn:disabled { opacity:0.5; cursor:not-allowed; transform:none; }

        .resolved-reply { background:rgba(46,139,87,0.08); border:1px solid rgba(46,139,87,0.2); border-radius:8px; padding:0.75rem 1rem; margin-top:1rem; }
        .resolved-reply-label { font-family:'Cinzel', serif; font-size:0.8rem; color:var(--sea-green); font-weight:bold; margin-bottom:0.4rem; display:flex; align-items:center; gap:0.4rem; }
        .resolved-reply-text { font-size:0.85rem; color:var(--text-color); line-height:1.5; }

        .message-toast { position:fixed; bottom:24px; right:24px; z-index:3000; padding:0.9rem 1.5rem; border-radius:10px; font-family:'Cinzel', serif; font-weight:bold; font-size:0.9rem; display:flex; align-items:center; gap:0.5rem; box-shadow:0 8px 24px rgba(0,0,0,0.2); }
        .message-success { background:#2e7d32; color:#fff; }
        .message-error { background:#d32f2f; color:#fff; }

        .empty-state { text-align:center; padding:3rem 1rem; color:var(--text-color); opacity:0.5; }
        .empty-state i { font-size:3rem; margin-bottom:1rem; display:block; color:var(--sea-green); opacity:0.4; }

        @media (max-width: 768px) {
          h1 { font-size:1.6rem; }
          .complaints-grid { grid-template-columns:1fr; }
          .content { padding:1rem; }
          .filter-tabs { gap:0.3rem; }
          .filter-tab { padding:0.5rem 0.8rem; font-size:0.78rem; }
        }
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
          <i className="fas fa-exclamation-circle" />
        </motion.div>

        <AnimatedSidebar links={coordinatorLinks} logo={<i className="fas fa-chess" />} title="ChessHive" />

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
            <i className="fas fa-exclamation-circle" /> Complaints
          </motion.h1>

          {error && <div className="error-text">{error}</div>}

          <motion.div
            className="updates-section"
            custom={0}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Filter Tabs */}
            <div className="filter-tabs">
              {FILTER_TABS.map(tab => (
                <motion.button
                  key={tab.key}
                  type="button"
                  className={`filter-tab${activeFilter === tab.key ? ' active' : ''}`}
                  onClick={() => setActiveFilter(tab.key)}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                >
                  <i className={tab.icon} />
                  {tab.label}
                  <span className="filter-count">{counts[tab.key]}</span>
                </motion.button>
              ))}
            </div>

            {loading ? (
              <p style={{ textAlign: 'center', padding: '2rem 0' }}>Loading complaints...</p>
            ) : filteredComplaints.length === 0 ? (
              <div className="empty-state">
                <i className="fas fa-inbox" />
                <p>No {activeFilter !== 'all' ? activeFilter : ''} complaints found.</p>
              </div>
            ) : (
              <div className="complaints-grid">
                <AnimatePresence mode="popLayout">
                  {filteredComplaints.map((complaint, i) => {
                    const cId = complaint._id || complaint.id;
                    const isPending = complaint.status === 'pending';

                    return (
                      <motion.div
                        key={cId}
                        className="complaint-card"
                        custom={i}
                        variants={cardVariants}
                        initial="hidden"
                        animate="visible"
                        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.25 } }}
                        layout
                      >
                        <div className="complaint-header">
                          <div className="complaint-subject">{complaint.subject || 'No Subject'}</div>
                          <span className={`status-badge status-${complaint.status || 'pending'}`}>
                            {complaint.status || 'pending'}
                          </span>
                        </div>

                        <div className="complaint-meta">
                          <div className="meta-item">
                            <i className="fas fa-trophy" />
                            <span>{complaint.tournament_name || 'N/A'}</span>
                          </div>
                          <div className="meta-item">
                            <i className="fas fa-user" />
                            <span>{complaint.player_name || 'Unknown Player'}</span>
                          </div>
                          <div className="meta-item">
                            <i className="fas fa-clock" />
                            <span>{complaint.created_at ? new Date(complaint.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span>
                          </div>
                        </div>

                        <div className="complaint-message">
                          {complaint.message || 'No message provided.'}
                        </div>

                        {isPending && (
                          <div className="reply-section">
                            <textarea
                              className="reply-textarea"
                              placeholder="Type your reply here..."
                              value={replyTexts[cId] || ''}
                              onChange={e => handleReplyChange(cId, e.target.value)}
                            />
                            <motion.button
                              type="button"
                              className="resolve-btn"
                              onClick={() => handleResolve(cId)}
                              disabled={resolvingId === cId}
                              whileHover={{ scale: 1.03 }}
                              whileTap={{ scale: 0.97 }}
                            >
                              <i className={resolvingId === cId ? 'fas fa-spinner fa-spin' : 'fas fa-check-circle'} />
                              {resolvingId === cId ? 'Resolving...' : 'Resolve'}
                            </motion.button>
                          </div>
                        )}

                        {!isPending && complaint.reply && (
                          <div className="resolved-reply">
                            <div className="resolved-reply-label">
                              <i className="fas fa-reply" /> Coordinator Reply
                            </div>
                            <div className="resolved-reply-text">{complaint.reply}</div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </motion.div>

          <div style={{ marginTop: '1rem' }}>
            <Link to="/coordinator/coordinator_dashboard" className="back-to-dashboard">
              <i className="fas fa-arrow-left" /> Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Toast Messages */}
        <AnimatePresence>
          {message && (
            <motion.div
              className={`message-toast message-${message.type}`}
              initial={{ opacity: 0, y: 40, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.9 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <i className={`fas fa-${message.type === 'success' ? 'check-circle' : 'exclamation-circle'}`} />
              {message.text}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default CoordinatorComplaints;






