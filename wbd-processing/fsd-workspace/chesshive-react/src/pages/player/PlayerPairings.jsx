import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import usePlayerTheme from '../../hooks/usePlayerTheme';

// React conversion of views/player/pairings.html
// Loads D3 from CDN dynamically to avoid adding a new npm dependency.

const D3_CDN = 'https://d3js.org/d3.v7.min.js';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function PlayerPairings() {
  const [isDark, toggleTheme] = usePlayerTheme();
  const query = useQuery();
  const tournamentId = query.get('tournament_id');
  const roundsParam = query.get('rounds') || '5';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [allRounds, setAllRounds] = useState([]);

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
        const res = await fetch(`/player/api/pairings?tournament_id=${encodeURIComponent(tournamentId)}&rounds=${encodeURIComponent(roundsParam)}`,
          { credentials: 'include' }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const rounds = data?.allRounds || [];
        setAllRounds(rounds);
      } catch (e) {
        setError('Failed to load pairings.');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [tournamentId, roundsParam]);

  // Build unique player list from all rounds
  const players = useMemo(() => {
    const set = new Set();
    allRounds.forEach((round) => {
      (round.pairings || []).forEach((p) => {
        if (p?.player1?.username) set.add(p.player1.username);
        if (p?.player2?.username) set.add(p.player2.username);
      });
      if (round?.byePlayer?.username) set.add(round.byePlayer.username);
    });
    return Array.from(set);
  }, [allRounds]);

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
      .attr('stroke', 'var(--sea-green)')
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
      .attr('fill', 'var(--sea-green)')
      .attr('stroke', 'var(--sea-green)')
      .attr('stroke-width', 2);

    nodes
      .append('text')
      .attr('y', 0)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', 'var(--on-accent)')
      .style('font-family', 'Playfair Display, serif')
      .style('font-size', '14px')
      .text((d) => {
        const name = d?.data?.name || 'Unknown';
        return name.length > 12 ? name.substring(0, 10) + '...' : name;
      });
  }, [players]);

  const styles = {
    root: { fontFamily: 'Playfair Display, serif', backgroundColor: 'var(--page-bg)', minHeight: '100vh', padding: '2rem', color: 'var(--text-color)' },
    container: { maxWidth: 1100, margin: '0 auto' },
    h1: { fontFamily: 'Cinzel, serif', fontSize: '2.6rem', color: 'var(--sky-blue)', marginBottom: '1.5rem', textAlign: 'center', letterSpacing: '.5px' },
    h2: { fontFamily: 'Cinzel, serif', fontSize: '1.9rem', color: 'var(--sky-blue)', margin: '0 0 1.25rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.75rem', letterSpacing: '.4px' },
    pairingsContainer: { background: 'var(--panel-bg)', borderRadius: 16, padding: '1.75rem 1.75rem 1.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.35)', marginBottom: '2rem', border: '1px solid var(--border-color)' },
    table: { width: '100%', borderCollapse: 'collapse', marginBottom: '1.25rem', fontFamily: 'Playfair Display, serif' },
    th: { backgroundColor: 'var(--sea-green)', color: 'var(--on-accent)', padding: '.85rem .9rem', textAlign: 'left', fontFamily: 'Cinzel, serif', fontWeight: 600, fontSize: '.9rem', letterSpacing: '.4px' },
    td: { padding: '.85rem .9rem', border: '1px solid var(--border-color)', fontSize: '.9rem' },
    score: { color: 'var(--sea-green)', fontWeight: 600 },
    bye: { color: 'var(--sea-green)', fontStyle: 'italic', fontSize: '.85rem' },
    navWrap: { textAlign: 'right', marginTop: '2.25rem' },
    navLink: { display: 'inline-flex', alignItems: 'center', gap: '.5rem', background: 'var(--sky-blue)', color: 'var(--on-accent)', textDecoration: 'none', padding: '.75rem 1.3rem', borderRadius: 10, fontFamily: 'Cinzel, serif', fontWeight: 600, letterSpacing: '.4px', boxShadow: '0 3px 12px rgba(0,0,0,0.4)' },
    treeContainer: { background: 'var(--panel-bg)', borderRadius: 16, padding: '1.75rem', boxShadow: '0 4px 20px rgba(0,0,0,0.35)', marginTop: '2rem', border: '1px solid var(--border-color)' },
    toggleBtn: { background: 'transparent', border: '2px solid var(--sea-green)', color: 'var(--sea-green)', padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontFamily: 'Cinzel, serif', fontWeight: 'bold', letterSpacing: '.5px' },
  };

  return (
    <div style={styles.root}>
      {/* Use global theme variables from index.css; do not override locally */}
      <style>{`
        .pairings-container table tbody tr:hover { background: var(--row-hover-bg); }
        .pairings-container table tbody tr:nth-child(even){ background: var(--row-hover-bg); }
        .pairings-title-icon { filter: drop-shadow(0 2px 4px rgba(0,0,0,.4)); }
        .d3-node rect { transition: fill .3s; }
        .d3-node:hover rect { fill: var(--sky-blue); }
      `}</style>
      <div style={styles.container}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <h1 style={styles.h1}>Pairings & Results</h1>
          <button onClick={toggleTheme} style={styles.toggleBtn}>{isDark ? 'Switch to Light' : 'Switch to Dark'}</button>
        </div>

        {loading && <p>Loading pairings...</p>}
        {!!error && !loading && <p>{error}</p>}

        {!loading && !error && allRounds.length === 0 && (
          <p>No pairings available.</p>
        )}

        {!loading && !error && allRounds.map((round) => (
          <div key={round.round} style={styles.pairingsContainer} className="pairings-container">
            <h2 style={styles.h2}><span role="img" aria-label="crossed-swords">⚔️</span> Round {round.round}</h2>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Player 1</th>
                  <th style={styles.th}>Player 2</th>
                  <th style={styles.th}>Result</th>
                </tr>
              </thead>
              <tbody>
                {(round.pairings || []).map((pair, idx) => (
                  <tr key={idx}>
                    <td style={styles.td}>
                      {pair.player1?.username}{' '}
                      <span style={styles.score}>(Score: {pair.player1?.score})</span>
                    </td>
                    <td style={styles.td}>
                      {pair.player2?.username}{' '}
                      <span style={styles.score}>(Score: {pair.player2?.score})</span>
                    </td>
                    <td style={styles.td}>{pair.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {round.byePlayer && (
              <p style={styles.bye}>
                <strong>BYE:</strong> {round.byePlayer?.username}{' '}
                <span style={styles.score}>(Score: {round.byePlayer?.score})</span>
              </p>
            )}
          </div>
        ))}

        <div style={styles.treeContainer}>
          <h2 style={styles.h2}><span role="img" aria-label="trophy">🏆</span> Tournament Progression</h2>
          {/* D3 will render into this SVG */}
          <svg ref={svgRef} />
        </div>

        <div style={styles.navWrap}>
          <Link to="/player/player_tournament" style={styles.navLink}>
            <i className="fas fa-arrow-left" aria-hidden="true"></i> <span>Back to Tournaments</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default PlayerPairings;
