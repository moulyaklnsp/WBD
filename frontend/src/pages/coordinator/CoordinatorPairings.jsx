import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
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

const D3_CDN = 'https://d3js.org/d3.v7.min.js';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function CoordinatorPairings() {
  const [isDark, toggleTheme] = usePlayerTheme();
  const query = useQuery();
  const tournamentId = query.get('tournament_id');
  const roundsParam = query.get('rounds') || '5';
  const tournamentType = query.get('type') || 'individual'; // 'individual' or 'team'
  const isTeamTournament = tournamentType === 'team';
  const sectionsPath = tournamentId ? `/coordinator/tournaments/${tournamentId}` : '/coordinator/tournament_management';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [allRounds, setAllRounds] = useState([]);
  const [roundPages, setRoundPages] = useState({});
  const rowsPerPage = 10;

  const svgRef = useRef(null);

  // Inject D3 if not present
  useEffect(() => {
    if (window.d3) return;
    const script = document.createElement('script');
    script.src = D3_CDN;
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    if (!tournamentId) {
      setError('Tournament ID is required.');
      setLoading(false);
      return;
    }

    const run = async () => {
      try {
        const endpoint = isTeamTournament 
          ? `/coordinator/api/team-pairings?tournament_id=${encodeURIComponent(tournamentId)}&rounds=${encodeURIComponent(roundsParam)}`
          : `/coordinator/api/pairings?tournament_id=${encodeURIComponent(tournamentId)}&rounds=${encodeURIComponent(roundsParam)}`;
        const res = await fetch(endpoint, { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const rounds = data?.allRounds || [];
        setAllRounds(rounds);
      } catch (e) {
        console.error('Pairings fetch error:', e);
        setError('Failed to load pairings.');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [tournamentId, roundsParam, isTeamTournament]);

  useEffect(() => {
    setRoundPages({});
  }, [allRounds]);

  // Build unique player/team list from all rounds
  const players = useMemo(() => {
    const set = new Set();
    allRounds.forEach((round) => {
      (round.pairings || []).forEach((p) => {
        if (isTeamTournament) {
          if (p?.team1?.teamName) set.add(p.team1.teamName);
          if (p?.team2?.teamName) set.add(p.team2.teamName);
        } else {
          if (p?.player1?.username) set.add(p.player1.username);
          if (p?.player2?.username) set.add(p.player2.username);
        }
      });
      if (isTeamTournament) {
        if (round?.byeTeam?.teamName) set.add(round.byeTeam.teamName);
      } else {
        if (round?.byePlayer?.username) set.add(round.byePlayer.username);
      }
    });
    return Array.from(set);
  }, [allRounds, isTeamTournament]);

  // Draw tournament tree with D3 when ready
  useEffect(() => {
    if (!window.d3) return; // wait for D3
    const d3 = window.d3;
    const svgEl = svgRef.current;
    if (!svgEl) return;

    // Clear previous content
    while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);

    if (!players || players.length === 0) return;

    const minPlayers = Math.max(2, players.length);
    const slots = Math.pow(2, Math.ceil(Math.log2(minPlayers)));
    const padded = players.slice();
    while (padded.length < slots) padded.push('BYE');

    // Build tree structure similar to original
    const treeData = { name: padded[0] || 'Champion', children: [] };
    const firstRound = [];
    for (let i = 0; i < slots; i += 2) {
      firstRound.push({
        name: `${padded[i] || 'BYE'} vs ${padded[i + 1] || 'BYE'}`,
        children: [{ name: padded[i] || 'BYE' }, { name: padded[i + 1] || 'BYE' }],
      });
    }

    let currentRound = firstRound;
    while (currentRound.length > 1) {
      const nextRound = [];
      for (let i = 0; i < currentRound.length; i += 2) {
        if (i + 1 < currentRound.length) {
          nextRound.push({
            name: `${currentRound[i].name} vs ${currentRound[i + 1].name}`,
            children: [currentRound[i], currentRound[i + 1]],
          });
        } else {
          nextRound.push(currentRound[i]);
        }
      }
      currentRound = nextRound;
    }
    treeData.children = currentRound;

    // D3 rendering
    const svg = d3.select(svgEl);
    const width = 900;
    const height = Math.max(300, slots * 50);
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const treeLayout = d3.tree().size([height - 100, width - 200]);
    const root = d3.hierarchy(treeData);
    treeLayout(root);

    svg
      .append('g')
      .attr('transform', 'translate(100,50)')
      .selectAll('path')
      .data(root.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', d3.linkHorizontal().x((d) => d.y).y((d) => d.x))
      .attr('fill', 'none')
      .attr('stroke', '#2E8B57')
      .attr('stroke-width', 2);

    const nodes = svg
      .append('g')
      .attr('transform', 'translate(100,50)')
      .selectAll('g')
      .data(root.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', (d) => `translate(${d.y},${d.x})`);

    nodes
      .append('rect')
      .attr('x', -50)
      .attr('y', -15)
      .attr('width', 100)
      .attr('height', 30)
      .attr('rx', 5)
      .attr('ry', 5)
      .attr('fill', '#2E8B57')
      .attr('stroke', '#FFFDD0')
      .attr('stroke-width', 2);

    nodes
      .append('text')
      .attr('y', 0)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#fff')
      .style('font-family', 'Playfair Display, serif')
      .style('font-size', '14px')
      .text((d) => {
        const name = d?.data?.name || 'Unknown';
        return name.length > 12 ? name.substring(0, 10) + '...' : name;
      });
  }, [players]);

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
        .pairings-table { width:100%; border-collapse:collapse; margin-bottom:2rem; }
        .pairings-table th { background:var(--sea-green); color:var(--on-accent); padding:1rem; text-align:left; font-family:'Cinzel', serif; }
        .pairings-table td { padding:1rem; border-bottom:1px solid rgba(var(--sea-green-rgb, 27, 94, 63), 0.2); }
        .score-text { color:var(--sea-green); font-weight:bold; }
        .bye-text { color:var(--text-color); opacity:0.7; font-style:italic; }
        .action-btn { display:inline-flex; align-items:center; gap:0.5rem; background:var(--sea-green); color:var(--on-accent); text-decoration:none; padding:0.8rem 1.5rem; border-radius:8px; font-family:'Cinzel', serif; font-weight:bold; }
        .pagination { display:flex; justify-content:center; align-items:center; gap:0.5rem; margin:1rem 0; flex-wrap:wrap; }
        .page-btn { background:var(--card-bg); color:var(--text-color); border:1px solid var(--card-border); padding:0.45rem 0.85rem; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; }
        .page-btn.active { background:var(--sea-green); color:var(--on-accent); border-color:var(--sea-green); }
        .page-btn:disabled { opacity:0.6; cursor:not-allowed; }
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
          <i className="fas fa-chess-board" />
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
            <i className="fas fa-chess-board" /> {isTeamTournament ? 'Team Pairings & Results' : 'Pairings & Results'}
          </motion.h1>

          {loading && <p>Loading pairings...</p>}
          {!!error && !loading && <p>{error}</p>}

          {!loading && !error && allRounds.length === 0 && (
            <p>{isTeamTournament ? 'No approved teams available for pairings. Teams must have all members approved first.' : 'No pairings available.'}</p>
          )}

          {!loading && !error && allRounds.map((round, idx) => (
            <motion.div
              key={round.round}
              className="updates-section"
              custom={idx}
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
            >
              {(() => {
                const page = roundPages[round.round] || 1;
                const totalPages = Math.max(1, Math.ceil((round.pairings || []).length / rowsPerPage));
                const start = (page - 1) * rowsPerPage;
                const paginatedPairings = (round.pairings || []).slice(start, start + rowsPerPage);
                return (
                  <>
              <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: '2rem', color: 'var(--sea-green)', marginBottom: '2rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}><i className="fas fa-swords" /> Round {round.round}</h2>
              <table className="pairings-table">
                <thead>
                  <tr>
                    <th>{isTeamTournament ? 'Team 1' : 'Player 1'}</th>
                    <th>{isTeamTournament ? 'Team 2' : 'Player 2'}</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPairings.map((pair, idx) => (
                    <tr key={idx}>
                      {isTeamTournament ? (
                        <>
                          <td>
                            <strong>{pair.team1?.teamName}</strong>
                            <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                              {pair.team1?.player1}, {pair.team1?.player2}, {pair.team1?.player3}
                            </div>
                            <span className="score-text">(Score: {pair.team1?.score})</span>
                          </td>
                          <td>
                            <strong>{pair.team2?.teamName}</strong>
                            <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                              {pair.team2?.player1}, {pair.team2?.player2}, {pair.team2?.player3}
                            </div>
                            <span className="score-text">(Score: {pair.team2?.score})</span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>
                            {pair.player1?.username}{' '}
                            <span className="score-text">(Score: {pair.player1?.score})</span>
                          </td>
                          <td>
                            {pair.player2?.username}{' '}
                            <span className="score-text">(Score: {pair.player2?.score})</span>
                          </td>
                        </>
                      )}
                      <td>{pair.result}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    type="button"
                    className="page-btn"
                    onClick={() => setRoundPages((prev) => ({ ...prev, [round.round]: Math.max(1, page - 1) }))}
                    disabled={page === 1}
                  >
                    <i className="fas fa-chevron-left" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`page-btn ${p === page ? 'active' : ''}`}
                      onClick={() => setRoundPages((prev) => ({ ...prev, [round.round]: p }))}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="page-btn"
                    onClick={() => setRoundPages((prev) => ({ ...prev, [round.round]: Math.min(totalPages, page + 1) }))}
                    disabled={page === totalPages}
                  >
                    <i className="fas fa-chevron-right" />
                  </button>
                </div>
              )}
              {isTeamTournament && round.byeTeam && (
                <p className="bye-text">
                  <strong>BYE:</strong> {round.byeTeam?.teamName}{' '}
                  <span className="score-text">(Score: {round.byeTeam?.score})</span>
                </p>
              )}
              {!isTeamTournament && round.byePlayer && (
                <p className="bye-text">
                  <strong>BYE:</strong> {round.byePlayer?.username}{' '}
                  <span className="score-text">(Score: {round.byePlayer?.score})</span>
                </p>
              )}
                  </>
                );
              })()}
            </motion.div>
          ))}

          <motion.div
            className="updates-section"
            custom={allRounds.length}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
          >
            <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: '2rem', color: 'var(--sea-green)', marginBottom: '2rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}><i className="fas fa-trophy" /> Tournament Progression</h2>
            <svg ref={svgRef} />
          </motion.div>

          <div style={{ textAlign: 'right', marginTop: '2rem' }}>
            <Link to={sectionsPath} className="action-btn">
              <i className="fas fa-arrow-left" /> <span>{tournamentId ? 'Back to Open Sections' : 'Back to Tournaments'}</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CoordinatorPairings;


