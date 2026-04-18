import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAsAdmin } from '../../utils/fetchWithRole';
import '../../styles/playerNeoNoir.css';
import { motion, AnimatePresence } from 'framer-motion';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import AnimatedSidebar from '../../components/AnimatedSidebar';
import { getStoredUser } from '../../utils/tokenManager';

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 100, damping: 12 }
  }
};


const AdminDashboard = () => {
  const navigate = useNavigate();
  const [isDark, toggleTheme] = usePlayerTheme();
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  const [isSuperAdmin] = useState(() => Boolean(getStoredUser()?.isSuperAdmin));
  const [savingMessageId, setSavingMessageId] = useState('');
  const [messageEdits, setMessageEdits] = useState({});
  const [messageSaveUi, setMessageSaveUi] = useState({});
  const [pinnedMessageId, setPinnedMessageId] = useState('');
  const [hoveredMessageId, setHoveredMessageId] = useState('');
  const [dashboardData, setDashboardData] = useState({
    adminName: 'Admin',
    stats: { players: 0, organizers: 0, coordinators: 0, tournaments: 0, revenue: 0 },
    messages: [],
    meetings: []
  });
  const [visibleRows, setVisibleRows] = useState(25);

  const onResize = useCallback(() => {
    const mobile = window.innerWidth <= 768;
    setIsMobile(mobile);
  }, []);

  useEffect(() => {
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [onResize]);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetchAsAdmin('/admin/api/dashboard');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDashboardData({
        adminName: data?.adminName || 'Admin',
        stats: data?.stats || { players: 0, organizers: 0, coordinators: 0, tournaments: 0, revenue: 0 },
        messages: Array.isArray(data?.contactMessages) ? data.contactMessages : [],
        meetings: Array.isArray(data?.meetings) ? data.meetings : []
      });
    } catch (e) {
      console.error('Failed to load dashboard', e);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const adminLinks = [
    { path: '/admin/organizer_management', label: 'Manage Organizers', icon: 'fas fa-users-cog' },
    { path: '/admin/coordinator_management', label: 'Manage Coordinators', icon: 'fas fa-user-tie' },
    { path: '/admin/player_management', label: 'Manage Players', icon: 'fas fa-user-tie' },
    { path: '/admin/admin_tournament_management', label: 'Tournament Approvals', icon: 'fas fa-trophy' },
    { path: '/admin/payments', label: 'Payments & Subscriptions', icon: 'fas fa-money-bill-wave' },
    { path: '/admin/growth_analytics', label: 'Growth Analytics', icon: 'fas fa-chart-area' },

  ];

  const moderationMessages = useMemo(
    () => dashboardData.messages.filter((m) => String(m?.status || 'pending').toLowerCase() !== 'resolved'),
    [dashboardData.messages]
  );
  const visibleMessages = useMemo(() => moderationMessages.slice(0, visibleRows), [moderationMessages, visibleRows]);
  const statusClass = (status = 'pending') => String(status).toLowerCase().replace('_', '-');
  const ensureMessageState = (msg) => ({
    status: msg?.status === 'new' ? 'pending' : (msg?.status || 'pending'),
    internal_note: msg?.internal_note || ''
  });
  const getMessageEdit = (msg) => messageEdits[msg?._id] || ensureMessageState(msg);
  const truncateMessage = (text) => {
    const value = String(text || '');
    return value.length > 50 ? `${value.slice(0, 50)}…` : value;
  };

  const handleMessageEdit = (msg, key, value) => {
    if (!msg?._id) return;
    setMessageEdits((prev) => ({
      ...prev,
      [msg._id]: {
        ...ensureMessageState(msg),
        ...(prev[msg._id] || {}),
        [key]: value
      }
    }));
    setMessageSaveUi((prev) => ({
      ...prev,
      [msg._id]: { state: 'idle', error: '' }
    }));
  };

  const saveMessageStatus = async (msg) => {
    if (!msg?._id) return;
    const msgId = msg._id;
    try {
      setSavingMessageId(msgId);
      setMessageSaveUi((prev) => ({ ...prev, [msgId]: { state: 'saving', error: '' } }));
      const edit = getMessageEdit(msg);
      const res = await fetchAsAdmin(`/admin/api/contact/${msgId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: edit.status, internal_note: edit.internal_note })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Failed to update message');
      setDashboardData((prev) => ({
        ...prev,
        messages: prev.messages.map((m) => (m._id === msgId ? { ...m, ...(payload?.message || {}) } : m))
      }));
      setMessageSaveUi((prev) => ({ ...prev, [msgId]: { state: 'saved', error: '' } }));
      setTimeout(() => {
        setMessageSaveUi((prev) => {
          if (!prev[msgId] || prev[msgId].state !== 'saved') return prev;
          return { ...prev, [msgId]: { state: 'idle', error: '' } };
        });
      }, 1800);
    } catch (err) {
      const message = err?.message || 'Failed to update message';
      console.error(err);
      setMessageSaveUi((prev) => ({ ...prev, [msgId]: { state: 'error', error: message } }));
    } finally {
      setSavingMessageId((prev) => (prev === msgId ? '' : prev));
    }
  };

  return (
    <div className="page player-neo" style={{ minHeight: '100vh', display: 'flex', width: '100%' }}>
      <style>{`
        :root {
          --card-bg-neo: rgba(30, 41, 59, 0.7);
          --card-border-neo: rgba(148, 163, 184, 0.1);
          --text-primary: #e2e8f0;
          --text-secondary: #94a3b8;
        }
        .page {
          font-family: 'Playfair Display', serif;
          background-color: var(--page-bg);
          min-height: 100vh;
          display: flex;
          color: var(--text-color);
        }
        .content {
          flex-grow: 1;
          margin-left: 0;
          padding: 2rem;
        }
        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }
        .stat-card-neo {
          background: var(--card-bg);
          backdrop-filter: blur(12px);
          border: 1px solid var(--card-border);
          border-radius: 16px;
          padding: 1.5rem;
          display: flex;
          align-items: center;
          gap: 1.5rem;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .stat-icon-wrapper {
          width: 60px;
          height: 60px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.8rem;
        }
        .stat-content h3 {
          font-family: 'Cinzel', serif;
          font-size: 2rem;
          margin: 0;
          line-height: 1.2;
        }
        .stat-content p {
          color: var(--text-color);
          margin: 0;
          font-size: 0.9rem;
          opacity: 0.8;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }
        .section-title {
          font-family: 'Cinzel', serif;
          color: var(--sea-green);
          font-size: 1.5rem;
          display: flex;
          align-items: center;
          gap: 0.8rem;
        }
        .messages-stack-container {
          position: relative;
          display: flex;
          flex-direction: row;
          padding: 2rem 0;
          padding-left: 30px;
          overflow-x: auto;
          overflow-y: visible;
          min-height: 400px;
        }
        .message-card {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(8px);
          border: 1px solid var(--card-border);
          border-radius: 16px;
          padding: 1.5rem;
          min-width: 320px;
          max-width: 350px;
          height: 340px;
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          position: relative;
          margin-left: -300px;
          box-shadow: -10px 0 20px rgba(0,0,0,0.1);
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          color: #334155;
        }
        .message-card:first-child {
          margin-left: 0;
        }
        .message-card:hover {
          transform: translateY(-25px) translateX(-15px) scale(1.05);
          z-index: 100 !important;
          background: rgba(255, 255, 255, 1);
          border-color: var(--sea-green);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15), 0 0 20px rgba(20, 184, 166, 0.2);
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .stats-card {
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid var(--card-border);
          border-radius: 14px;
          padding: 1rem;
          box-shadow: 0 4px 6px rgba(0,0,0,0.05);
        }
        .stats-card h4 {
          margin: 0;
          font-size: 0.85rem;
          color: #475569;
          text-transform: uppercase;
          font-weight: bold;
          letter-spacing: 0.8px;
        }
        .stats-card p {
          margin: 0.55rem 0 0;
          font-size: 1.3rem;
          color: var(--sea-green);
          font-family: 'Cinzel', serif;
        }
        .message-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 4px;
          height: 100%;
          background: var(--sea-green);
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .message-card:hover::before {
          opacity: 1;
        }
        .message-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5rem;
          font-size: 0.9rem;
          color: var(--sea-green);
          font-weight: bold;
        }
        .message-email {
          display: block;
          font-weight: 600;
          font-size: 0.82rem;
          opacity: 0.75;
          margin-top: 0.15rem;
        }
        .message-body {
          color: #475569;
          line-height: 1.5;
          opacity: 0.9;
          flex: 1;
          overflow: hidden;
        }
        .message-body.expanded {
          overflow-y: auto;
        }
        .message-date {
          font-size: 0.8rem;
          opacity: 0.6;
          margin-top: 0.5rem;
          text-align: right;
        }
        .view-more-btn {
          background: transparent;
          border: 1px solid var(--sea-green);
          color: var(--sea-green);
          padding: 0.5rem 1.5rem;
          border-radius: 20px;
          cursor: pointer;
          font-family: 'Cinzel', serif;
          transition: all 0.3s ease;
        }
        .view-more-btn:hover {
          background: var(--sea-green);
          color: var(--on-accent);
        }
        .input {
          width: 100%;
          padding: 0.55rem 0.75rem;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          background: #f8fafc;
          color: #1e293b;
        }
        .status-pill {
          font-size: 0.75rem;
          padding: 0.2rem 0.55rem;
          border-radius: 999px;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }
        .status-pill.pending { background: rgba(245,158,11,0.2); color: #fcd34d; }
        .status-pill.in-progress { background: rgba(245,158,11,0.2); color: #fcd34d; }
        .status-pill.resolved { background: rgba(34,197,94,0.2); color: #86efac; }
        .status-pill.spam { background: rgba(239,68,68,0.2); color: #fca5a5; }

        /* Dark mode overrides for cards & messages */
        body.player-dark .stat-card-neo {
          background: var(--card-bg);
          border-color: var(--card-border);
          box-shadow: var(--card-shadow);
        }
        body.player-dark .stats-card {
          background: var(--card-bg);
          border-color: var(--card-border);
          box-shadow: var(--card-shadow);
        }
        body.player-dark .stats-card h4 { color: var(--text-secondary); }
        body.player-dark .message-card {
          background: var(--card-bg);
          border-color: var(--card-border);
          color: var(--text-color);
          box-shadow: var(--card-shadow);
        }
        body.player-dark .message-card:hover {
          background: var(--card-bg-hover);
          border-color: var(--border-hover);
          box-shadow: var(--card-shadow-hover);
        }
        body.player-dark .message-body { color: var(--text-color); }
        body.player-dark .message-date { color: var(--text-secondary); }
        body.player-dark .input {
          background: var(--input-bg);
          border-color: var(--input-border);
          color: var(--text-color);
        }
      `}</style>
      
      <motion.div className="chess-knight-float" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 0.14, scale: 1 }} transition={{ delay: 0.9, duration: 0.6 }} style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 0, fontSize: '2.5rem', color: 'var(--sea-green)' }}>
        <i className="fas fa-chess-king" />
      </motion.div>

      <AnimatedSidebar links={adminLinks} logo={<i className="fas fa-chess-king" />} title="ChessHive" />

      <div className="content" style={{ padding: '2rem', width: '100%', marginLeft: isMobile ? 0 : '0' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <motion.h1
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              style={{ margin: 0, fontFamily: 'Cinzel, serif', color: 'var(--sea-green)' }}
            >
              Hi, {dashboardData.adminName || 'Admin'}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              style={{ color: 'var(--text-color)', opacity: 0.7, marginTop: '0.5rem' }}
            >
              Dashboard Overview
            </motion.p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {isSuperAdmin && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/admin/add_admin')}
                className="view-more-btn"
              >
                Add Admin
              </motion.button>
            )}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleTheme}
              className="theme-toggle-btn"
              style={{
                width: 40, height: 40, borderRadius: '50%',
                border: '1px solid var(--card-border)',
                background: 'var(--card-bg)',
                color: 'var(--text-color)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <i className={isDark ? "fas fa-sun" : "fas fa-moon"} />
            </motion.button>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--card-border)', padding: '1.5rem', marginBottom: '1.5rem' }}
        >
          <h2 className="section-title" style={{ marginBottom: '1rem' }}>
            <i className="fas fa-users" />
            Active Users
          </h2>
          <div className="stats-grid">
            <div className="stats-card"><h4>Players</h4><p>{dashboardData.stats.players || 0}</p></div>
            <div className="stats-card"><h4>Organizers</h4><p>{dashboardData.stats.organizers || 0}</p></div>
            <div className="stats-card"><h4>Coordinators</h4><p>{dashboardData.stats.coordinators || 0}</p></div>
          </div>
        </motion.div>

        {/* Contact moderation section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--card-border)', padding: '2rem' }}
        >
          <div className="section-header">
            <h2 className="section-title">
              <i className="fas fa-envelope-open-text" />
              Recent Messages
            </h2>
            <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>
              Showing {visibleMessages.length} of {moderationMessages.length}
            </span>
          </div>

          <div className="messages-stack-container">
            <AnimatePresence>
              {visibleMessages.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{ textAlign: 'center', padding: '2rem', opacity: 0.6, width: '100%' }}
                >
                  <i className="fas fa-inbox" style={{ fontSize: '2rem', marginBottom: '1rem', display: 'block' }} />
                  No new messages
                </motion.div>
              ) : (
                visibleMessages.map((msg, idx) => (
                  <motion.div
                    key={msg._id || idx}
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    className="message-card"
                    style={{ zIndex: visibleMessages.length - idx }}
                    onMouseEnter={() => setHoveredMessageId(msg?._id || '')}
                    onMouseLeave={() => setHoveredMessageId((prev) => (prev === msg?._id ? '' : prev))}
                    onClick={() => setPinnedMessageId((prev) => (prev === msg?._id ? '' : msg?._id || ''))}
                  >
                    {(() => {
                      const edit = getMessageEdit(msg);
                      const currentStatus = String(edit.status || 'pending').toLowerCase();
                      const saveState = messageSaveUi[msg?._id]?.state || 'idle';
                      const saveError = messageSaveUi[msg?._id]?.error || '';
                      const isSaving = savingMessageId === msg._id || saveState === 'saving';
                      const isExpanded = pinnedMessageId === msg?._id || hoveredMessageId === msg?._id;
                      const messageText = isExpanded ? msg.message : truncateMessage(msg.message);
                      return (
                        <>
                    <div className="message-header">
                      <span>
                        <span>{msg.name}</span>
                        <span className="message-email">{msg.email}</span>
                      </span>
                      <span style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span className={`status-pill ${statusClass(edit.status)}`}>{edit.status.replace('_', ' ')}</span>
                        {new Date(msg.submission_date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className={`message-body ${isExpanded ? 'expanded' : ''}`}>
                      {messageText}
                    </div>
                    <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.55rem' }}>
                      <select
                        value={edit.status}
                        onChange={(e) => handleMessageEdit(msg, 'status', e.target.value)}
                        className="input"
                        style={{ maxWidth: 220 }}
                      >
                        <option value="pending" disabled={currentStatus === 'pending'}>Pending</option>
                        <option value="in_progress" disabled={currentStatus === 'in_progress'}>In Progress</option>
                        <option value="resolved" disabled={currentStatus === 'resolved'}>Resolved</option>
                        <option value="spam" disabled={currentStatus === 'spam'}>Spam</option>
                      </select>
                      <textarea
                        value={edit.internal_note}
                        onChange={(e) => handleMessageEdit(msg, 'internal_note', e.target.value)}
                        placeholder="Internal note (optional)"
                        className="input"
                        rows={2}
                      />
                      <div>
                        <button
                          className="view-more-btn"
                          disabled={isSaving}
                          onClick={() => saveMessageStatus(msg)}
                        >
                          {isSaving ? 'Saving...' : (saveState === 'saved' ? 'Saved' : 'Save Status')}
                        </button>
                        {saveState === 'error' && (
                          <div style={{ marginTop: '0.45rem', color: '#fca5a5', fontSize: '0.85rem' }}>{saveError}</div>
                        )}
                      </div>
                    </div>
                        </>
                      );
                    })()}
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>

          {moderationMessages.length > visibleRows && (
            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <button className="view-more-btn" onClick={() => setVisibleRows(v => v + 25)}>
                Load More Messages
              </button>
            </div>
          )}
        </motion.div>

        {/* Tournaments and Revenue Section */}
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.6 }}
           style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}
        >
          {/* Tournaments Card */}
          <div style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--card-border)', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
             <i className="fas fa-trophy" style={{ fontSize: '3rem', color: 'var(--sea-green)', marginBottom: '1rem' }} />
             <h3 style={{ margin: 0, fontFamily: 'Cinzel, serif', color: 'var(--text-color)', fontSize: '1.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Tournaments</h3>
             <p style={{ margin: '0.5rem 0 0', fontSize: '2.5rem', color: 'var(--sea-green)', fontWeight: 'bold' }}>
               {dashboardData.stats.tournaments || 0}
             </p>
             <span style={{ opacity: 0.7, marginTop: '0.5rem', fontSize: '0.9rem' }}>Total Tournaments Created</span>
          </div>

          {/* Revenue Card */}
          <div style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--card-border)', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
             <i className="fas fa-wallet" style={{ fontSize: '3rem', color: 'var(--sea-green)', marginBottom: '1rem' }} />
             <h3 style={{ margin: 0, fontFamily: 'Cinzel, serif', color: 'var(--text-color)', fontSize: '1.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Revenue</h3>
             <p style={{ margin: '0.5rem 0 0', fontSize: '2.5rem', color: 'var(--sea-green)', fontWeight: 'bold' }}>
               INR {Number(dashboardData.stats.revenue || 0).toFixed(2)}
             </p>
             <span style={{ opacity: 0.7, marginTop: '0.5rem', fontSize: '0.9rem' }}>Overall Platform Earnings</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AdminDashboard;
