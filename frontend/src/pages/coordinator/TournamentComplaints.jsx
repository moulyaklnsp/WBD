import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import '../../styles/playerNeoNoir.css';
import { motion } from 'framer-motion';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import AnimatedSidebar from '../../components/AnimatedSidebar';
import { coordinatorLinks } from '../../constants/coordinatorLinks';
import { fetchAsCoordinator } from '../../utils/fetchWithRole';

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

function TournamentComplaints() {
  const [isDark, toggleTheme] = usePlayerTheme();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(null);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [response, setResponse] = useState('');
  const [searchParams] = useSearchParams();
  const tournamentId = searchParams.get('tournament_id');
  const sectionsPath = tournamentId ? `/coordinator/tournaments/${tournamentId}` : '/coordinator/tournament_management';
  const [statusFilter, setStatusFilter] = useState('all');
  const [tournamentFilter, setTournamentFilter] = useState(tournamentId || 'all');
  const [searchText, setSearchText] = useState('');

  const showMessage = (text, type = 'success') => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  useEffect(() => {
    setTournamentFilter(tournamentId || 'all');
  }, [tournamentId]);

  const fetchComplaints = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchAsCoordinator('/coordinator/api/complaints');
      const data = await res.json();
      if (res.ok) {
        setComplaints(Array.isArray(data.complaints) ? data.complaints : []);
      } else {
        setError(data.message || 'Failed to fetch complaints');
      }
    } catch (err) {
      console.error('Error fetching complaints:', err);
      setError('Failed to load complaints');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  const tournamentOptions = useMemo(() => {
    const map = new Map();
    (complaints || []).forEach((c) => {
      const id = String(c?.tournament_id || c?.tournament?._id || '');
      const name = (c?.tournament?.name || c?.tournament_name || '').toString().trim();
      if (id && name && !map.has(id)) map.set(id, name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [complaints]);

  const filteredComplaints = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    return (complaints || []).filter((complaint) => {
      const status = (complaint?.status || 'pending').toString().toLowerCase();
      const complaintTournamentId = String(complaint?.tournament_id || complaint?.tournament?._id || '');
      const tournamentName = (complaint?.tournament?.name || complaint?.tournament_name || '').toString();
      const playerName = (complaint?.player?.name || complaint?.player_name || '').toString();
      const subject = (complaint?.subject || '').toString();
      const description = (complaint?.description || complaint?.message || complaint?.complaint || '').toString();

      const statusOk = statusFilter === 'all' || status === statusFilter;
      const tournamentOk = tournamentFilter === 'all' || complaintTournamentId === tournamentFilter;
      const searchOk = !term || [tournamentName, playerName, subject, description, status]
        .some((v) => v.toLowerCase().includes(term));

      return statusOk && tournamentOk && searchOk;
    });
  }, [complaints, statusFilter, tournamentFilter, searchText]);

  const handleResponse = async (complaintId) => {
    if (!response.trim()) {
      showMessage('Please enter a response', 'error');
      return;
    }

    try {
      const res = await fetchAsCoordinator(`/coordinator/api/complaints/${complaintId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: response.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        showMessage('Response sent successfully', 'success');
        setSelectedComplaint(null);
        setResponse('');
        await fetchComplaints();
      } else {
        showMessage(data.message || 'Failed to send response', 'error');
      }
    } catch (err) {
      console.error('Error sending response:', err);
      showMessage('Failed to send response', 'error');
    }
  };

  const markAsResolved = async (complaintId) => {
    try {
      const res = await fetchAsCoordinator(`/coordinator/api/complaints/${complaintId}/resolve`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok) {
        showMessage('Complaint marked as resolved', 'success');
        await fetchComplaints();
      } else {
        showMessage(data.message || 'Failed to resolve complaint', 'error');
      }
    } catch (err) {
      console.error('Error resolving complaint:', err);
      showMessage('Failed to resolve complaint', 'error');
    }
  };

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
        .complaint-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 10px; padding: 1.5rem; margin-bottom: 1rem; }
        .complaint-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
        .complaint-title { font-family: 'Cinzel', serif; color: var(--sea-green); font-size: 1.2rem; }
        .complaint-status { padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.8rem; font-weight: bold; }
        .status-pending { background: rgba(255, 193, 7, 0.2); color: #ff9800; }
        .status-resolved { background: rgba(76, 175, 80, 0.2); color: #4caf50; }
        .complaint-meta { color: var(--text-color); opacity: 0.7; font-size: 0.9rem; margin-bottom: 1rem; }
        .complaint-content { margin-bottom: 1rem; line-height: 1.5; }
        .filters-row { display:grid; grid-template-columns:1fr 1fr 1fr auto; gap:0.75rem; margin-bottom:1rem; }
        .filter-input { width:100%; padding:0.65rem 0.75rem; border-radius:8px; border:1px solid var(--card-border); background:var(--card-bg); color:var(--text-color); font-family:'Playfair Display', serif; }
        .filter-input:focus { outline:none; border-color:var(--sea-green); }
        .filter-clear { background:transparent; border:1px solid var(--card-border); color:var(--text-color); padding:0.65rem 0.9rem; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; }
        .filter-count { font-size:0.85rem; opacity:0.75; margin-bottom:0.6rem; }
        .response-section { background: rgba(var(--sea-green-rgb, 27, 94, 63), 0.05); border-radius: 8px; padding: 1rem; margin-top: 1rem; }
        .response-form { display: flex; flex-direction: column; gap: 1rem; }
        .response-textarea { width: 100%; padding: 0.8rem; border: 2px solid var(--sea-green); border-radius: 8px; font-family: 'Playfair Display', serif; background: var(--card-bg); color: var(--text-color); min-height: 100px; resize: vertical; }
        .btn-primary { background: var(--sea-green); color: var(--on-accent); border: none; padding: 0.8rem 1.5rem; border-radius: 8px; cursor: pointer; font-family: 'Cinzel', serif; font-weight: bold; display: flex; align-items: center; gap: 0.5rem; width: fit-content; }
        .btn-secondary { background: var(--sky-blue); color: var(--on-accent); border: none; padding: 0.8rem 1.5rem; border-radius: 8px; cursor: pointer; font-family: 'Cinzel', serif; font-weight: bold; display: flex; align-items: center; gap: 0.5rem; width: fit-content; }
        .btn-success { background: #4caf50; color: white; border: none; padding: 0.8rem 1.5rem; border-radius: 8px; cursor: pointer; font-family: 'Cinzel', serif; font-weight: bold; display: flex; align-items: center; gap: 0.5rem; width: fit-content; }
        .message { margin-bottom: 1rem; padding: 0.75rem 1rem; border-radius: 8px; }
        .message.success { color: #1b5e20; background: rgba(76, 175, 80, 0.15); }
        .message.error { color: #c62828; background: rgba(198, 40, 40, 0.15); }
        .no-complaints { text-align: center; padding: 3rem; color: var(--text-color); opacity: 0.7; font-style: italic; }
        @media (max-width: 768px) {
          .filters-row { grid-template-columns:1fr; }
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
          <i className="fas fa-chess-rook" />
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
            <i className="fas fa-exclamation-triangle" /> Tournament Complaints
          </motion.h1>

          <motion.div
            className="updates-section"
            custom={0}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
          >
            {message && (
              <div className={`message ${message.type}`}>
                <i className={`fas ${message.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`} /> {message.text}
              </div>
            )}

            <div className="filters-row">
              <select
                className="filter-input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="resolved">Resolved</option>
                <option value="dismissed">Dismissed</option>
              </select>

              <select
                className="filter-input"
                value={tournamentFilter}
                onChange={(e) => setTournamentFilter(e.target.value)}
              >
                <option value="all">All Tournaments</option>
                {tournamentOptions.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>

              <input
                className="filter-input"
                type="text"
                placeholder="Search by tournament, player, subject..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />

              <button
                type="button"
                className="filter-clear"
                onClick={() => {
                  setStatusFilter('all');
                  setTournamentFilter(tournamentId || 'all');
                  setSearchText('');
                }}
              >
                Clear
              </button>
            </div>

            <div className="filter-count">
              Showing {filteredComplaints.length} of {complaints.length} complaints
            </div>

            {loading && <div>Loading complaints...</div>}
            {!loading && error && (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--sea-green)', fontStyle: 'italic' }}>
                <i className="fas fa-info-circle" /> {error}
              </div>
            )}
            {!loading && !error && filteredComplaints.length === 0 && (
              <div className="no-complaints">
                <i className="fas fa-info-circle" style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }} />
                <div>No complaints match the selected filters</div>
              </div>
            )}

            {!loading && !error && filteredComplaints.length > 0 && (
              <div>
                {filteredComplaints.map((complaint, index) => (
                  <motion.div
                    key={complaint._id}
                    className="complaint-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1, duration: 0.3 }}
                  >
                    <div className="complaint-header">
                      <div className="complaint-title">{complaint.subject}</div>
                      <div className={`complaint-status ${complaint.status === 'resolved' ? 'status-resolved' : 'status-pending'}`}>
                        {complaint.status === 'resolved' ? 'Resolved' : 'Pending'}
                      </div>
                    </div>

                    <div className="complaint-meta">
                      <div><strong>Tournament:</strong> {complaint.tournament?.name || 'N/A'}</div>
                      <div><strong>Submitted by:</strong> {complaint.player?.name || 'Anonymous'}</div>
                      <div>
                        <strong>Date:</strong>{' '}
                        {(complaint.createdAt || complaint.created_at)
                          ? new Date(complaint.createdAt || complaint.created_at).toLocaleDateString()
                          : 'N/A'}
                      </div>
                    </div>

                    <div className="complaint-content">
                      <strong>Description:</strong>
                      <p style={{ marginTop: '0.5rem' }}>{complaint.description}</p>
                    </div>

                    {complaint.response && (
                      <div className="response-section">
                        <strong>Your Response:</strong>
                        <p style={{ marginTop: '0.5rem' }}>{complaint.response}</p>
                        <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.5rem' }}>
                          Responded on {(complaint.respondedAt || complaint.resolved_at)
                            ? new Date(complaint.respondedAt || complaint.resolved_at).toLocaleDateString()
                            : 'N/A'}
                        </div>
                      </div>
                    )}

                    {complaint.status !== 'resolved' && (
                      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button
                          className="btn-secondary"
                          onClick={() => setSelectedComplaint(selectedComplaint === complaint._id ? null : complaint._id)}
                        >
                          <i className="fas fa-reply" /> {selectedComplaint === complaint._id ? 'Cancel' : 'Respond'}
                        </button>
                        <button
                          className="btn-success"
                          onClick={() => markAsResolved(complaint._id)}
                        >
                          <i className="fas fa-check" /> Mark as Resolved
                        </button>
                      </div>
                    )}

                    {selectedComplaint === complaint._id && (
                      <motion.div
                        className="response-section"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <h4 style={{ marginBottom: '1rem', color: 'var(--sea-green)' }}>Send Response</h4>
                        <div className="response-form">
                          <textarea
                            className="response-textarea"
                            placeholder="Enter your response to this complaint..."
                            value={response}
                            onChange={(e) => setResponse(e.target.value)}
                          />
                          <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                              className="btn-primary"
                              onClick={() => handleResponse(complaint._id)}
                            >
                              <i className="fas fa-paper-plane" /> Send Response
                            </button>
                            <button
                              className="btn-secondary"
                              onClick={() => {
                                setSelectedComplaint(null);
                                setResponse('');
                              }}
                            >
                              <i className="fas fa-times" /> Cancel
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          <div style={{ textAlign: 'right', marginTop: '2rem' }}>
            <Link to={sectionsPath} className="back-to-dashboard">
              <i className="fas fa-arrow-left" /> {tournamentId ? 'Back to Open Sections' : 'Back to Tournaments'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TournamentComplaints;





