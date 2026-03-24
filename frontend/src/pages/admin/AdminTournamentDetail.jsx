import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchAsAdmin } from '../../utils/fetchWithRole';
import { motion } from 'framer-motion';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import AnimatedSidebar from '../../components/AnimatedSidebar';
import '../../styles/playerNeoNoir.css';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

const AdminTournamentDetail = () => {
  const { id } = useParams();
  const [isDark, toggleTheme] = usePlayerTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [details, setDetails] = useState({ tournament: null, conductedBy: '', approvedBy: '', moneyGenerated: 0, players: [] });

  const [participantsPage, setParticipantsPage] = useState(1);
  const itemsPerPage = 5;

  const adminLinks = [
    { path: '/admin/organizer_management', label: 'Manage Organizers', icon: 'fas fa-users-cog' },
    { path: '/admin/coordinator_management', label: 'Manage Coordinators', icon: 'fas fa-user-tie' },
    { path: '/admin/player_management', label: 'Manage Players', icon: 'fas fa-user-tie' },
    { path: '/admin/admin_tournament_management', label: 'Tournament Approvals', icon: 'fas fa-trophy' },
    { path: '/admin/payments', label: 'Payments & Subscriptions', icon: 'fas fa-money-bill-wave' },
    { path: '/admin/growth_analytics', label: 'Growth Analytics', icon: 'fas fa-chart-area' },

  ];

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        const res = await fetchAsAdmin(`/admin/api/tournaments/${id}/details`);
        if (!res.ok) throw new Error('Failed to load tournament details.');
        const data = await res.json();
        setDetails(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [id]);

  const participantsList = details?.players || [];
  const totalParticipantsPages = Math.ceil(participantsList.length / itemsPerPage);
  const paginatedParticipants = participantsList.slice(
    (participantsPage - 1) * itemsPerPage,
    participantsPage * itemsPerPage
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; }
        .page { font-family: 'Playfair Display', serif; background-color: var(--page-bg); min-height: 100vh; display:flex; color: var(--text-color); width: 100%; }
        .content { flex-grow:1; margin-left:0; padding:2rem; }
        .back-link { display:inline-flex; align-items:center; gap:0.5rem; background-color:var(--sea-green); color:var(--on-accent); text-decoration:none; padding:0.8rem 1.5rem; border-radius:8px; transition:all 0.3s ease; font-family:'Cinzel', serif; font-weight:bold; }
        .back-link:hover { opacity: 0.9; transform: translateY(-2px); }
        .banner { padding:1rem; border-radius:8px; margin-bottom:1rem; text-align:center; font-weight:bold; }
        .banner.error { background:rgba(220,53,69,0.1); color:#dc3545; }
        .header-title { font-family:'Cinzel', serif; color:var(--sea-green); font-size:2.5rem; display:flex; align-items:center; gap:1rem; margin-bottom: 0.5rem; }
        .section-card { background:rgba(30, 41, 59, 0.4); backdrop-filter: blur(8px); border:1px solid var(--card-border); border-radius:15px; padding:2rem; margin-bottom:2rem; transition: transform 0.3s ease; }
        .section-title { font-family:'Cinzel', serif; color:var(--sea-green); font-size:1.5rem; display:flex; align-items:center; gap:0.8rem; margin-bottom: 1.5rem; }
        .table { width:100%; border-collapse:collapse; }
        .th { background:rgba(20, 184, 166, 0.1); color:var(--sea-green); padding:1rem 1.2rem; text-align:left; font-family:'Cinzel', serif; text-transform: uppercase; font-size: 0.9rem; letter-spacing: 0.5px; }
        .td { padding:1rem; border-bottom:1px solid var(--card-border); }
        .status-pill { padding: 0.3rem 0.8rem; border-radius: 9999px; font-size: 0.85rem; font-weight: bold; text-transform: uppercase; background: rgba(34, 197, 94, 0.2); color: #86efac; }
        .empty { text-align:center; padding:2rem; color:var(--text-color); opacity: 0.7; font-style:italic; }
        .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
        .stat-box { background: rgba(30, 41, 59, 0.6); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--card-border); display: flex; flex-direction: column; justify-content: center; }
        .stat-box h4 { font-size: 0.9rem; opacity: 0.7; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 1px; }
        .stat-box p { font-size: 1.6rem; color: var(--sea-green); font-family: 'Cinzel', serif; font-weight: bold; word-break: break-all; }
        .pagination { display: flex; justify-content: center; align-items: center; gap: 1rem; margin-top: 1.5rem; }
        .page-btn { background: rgba(20, 184, 166, 0.2); color: var(--sea-green); border: 1px solid var(--sea-green); padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; transition: all 0.3s ease; font-family: 'Cinzel', serif; font-weight: bold; }
        .page-btn:hover:not(:disabled) { background: var(--sea-green); color: #fff; }
        .page-btn:disabled { opacity: 0.5; cursor: not-allowed; border-color: gray; color: gray; }
        .page-info { font-family: 'Cinzel', serif; color: var(--sea-green); font-weight: bold; }
      `}</style>

      <div className="page player-neo">
        <AnimatedSidebar links={adminLinks} logo={<i className="fas fa-chess" />} title="ChessHive" />

        <div className="admin-dash-header" style={{ position: 'fixed', top: 18, right: 18, zIndex: 1001 }}>
          <motion.button
            type="button"
            onClick={toggleTheme}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-color)', width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.1rem' }}
          >
            <i className={isDark ? 'fas fa-sun' : 'fas fa-moon'} />
          </motion.button>
        </div>

        <div className="content">
          {error && <div className="banner error">{error}</div>}

          {loading ? (
             <div style={{ textAlign: 'center', padding: '4rem', opacity: 0.7 }}>
               <i className="fas fa-circle-notch fa-spin fa-3x" style={{ color: 'var(--sea-green)', marginBottom: '1rem' }} />
               <p>Loading tournament details...</p>
             </div>
          ) : details.tournament && !error ? (
            <motion.div variants={containerVariants} initial="hidden" animate="visible">
              
              <motion.div variants={itemVariants} style={{ marginBottom: '2rem' }}>
                <h1 className="header-title">{details.tournament.name || 'Unnamed Tournament'}</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', opacity: 0.8, flexWrap: 'wrap' }}>
                  <span><i className="far fa-calendar" /> {details.tournament.date ? new Date(details.tournament.date).toLocaleDateString() : 'TBD'}</span>
                  <span>|</span>
                  <span><i className="fas fa-map-marker-alt" /> {details.tournament.location || 'Online'}</span>
                  <span>|</span>
                  <span><i className="fas fa-chess" /> {details.tournament.type || 'Standard'}</span>
                  <span>|</span>
                  <span className="status-pill">{details.tournament.status}</span>
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="stat-grid">
                <div className="stat-box">
                  <h4>Conducted By</h4>
                  <p style={{fontSize: '1.2rem'}}>{details.conductedBy || 'Unknown'}</p>
                </div>
                <div className="stat-box">
                  <h4>Approved By</h4>
                  <p style={{fontSize: '1.2rem'}}>{details.approvedBy || 'Unknown'}</p>
                </div>
                <div className="stat-box">
                  <h4>Money Generated</h4>
                  <p>₹{details.moneyGenerated || 0}</p>
                </div>
                <div className="stat-box">
                  <h4>Total Players</h4>
                  <p>{details.players?.length || 0}</p>
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="section-card">
                <h2 className="section-title"><i className="fas fa-users" /> Participant Roster</h2>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th className="th">Name / Team Name</th>
                        <th className="th">Email</th>
                        <th className="th">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {participantsList.length === 0 ? (
                         <tr><td colSpan={3} className="empty">No participants registered yet.</td></tr>
                      ) : (
                        paginatedParticipants.map((p, idx) => (
                          <tr key={idx}>
                            <td className="td" style={{ fontWeight: 'bold' }}>{p.name}</td>
                            <td className="td">{p.email || 'N/A'}</td>
                            <td className="td">{p.type}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {totalParticipantsPages > 1 && (
                  <div className="pagination">
                    <button 
                      className="page-btn" 
                      disabled={participantsPage === 1} 
                      onClick={() => setParticipantsPage(p => p - 1)}>
                      Prev
                    </button>
                    <span className="page-info">Page {participantsPage} of {totalParticipantsPages}</span>
                    <button 
                      className="page-btn" 
                      disabled={participantsPage === totalParticipantsPages} 
                      onClick={() => setParticipantsPage(p => p + 1)}>
                      Next
                    </button>
                  </div>
                )}
              </motion.div>

              <div style={{ marginTop: '2rem', textAlign: 'right' }}>
                <Link to="/admin/admin_tournament_management" className="back-link">
                  <i className="fas fa-arrow-left" /> Back to Tournaments
                </Link>
              </div>

            </motion.div>
          ) : null}

        </div>
      </div>
    </div>
  );
};

export default AdminTournamentDetail;
