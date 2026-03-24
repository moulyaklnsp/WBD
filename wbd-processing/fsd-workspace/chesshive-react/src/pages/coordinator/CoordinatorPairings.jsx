import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

// React conversion of views/coordinator/pairings.html
// Loads D3 from CDN dynamically to avoid adding a new npm dependency.

const D3_CDN = 'https://d3js.org/d3.v7.min.js';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function CoordinatorPairings() {
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
        const res = await fetch(`/coordinator/api/pairings?tournament_id=${encodeURIComponent(tournamentId)}&rounds=${encodeURIComponent(roundsParam)}`,
          { credentials: 'include' }
        );
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

  const styles = {
    root: { fontFamily: 'Playfair Display, serif', backgroundColor: '#FFFDD0', minHeight: '100vh', padding: '2rem' },
    container: { maxWidth: 1000, margin: '0 auto' },
    h1: { fontFamily: 'Cinzel, serif', fontSize: '3rem', color: '#2E8B57', marginBottom: '2rem', textAlign: 'center' },
    h2: { fontFamily: 'Cinzel, serif', fontSize: '2.5rem', color: '#2E8B57', marginBottom: '2rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' },
    pairingsContainer: { background: 'var(--card-bg)', borderRadius: 15, padding: '2rem', boxShadow: 'none', marginBottom: '2rem', border: '1px solid var(--card-border)' },
    table: { width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' },
    th: { backgroundColor: '#2E8B57', color: '#fff', padding: '1rem', textAlign: 'left', fontFamily: 'Cinzel, serif' },
    td: { padding: '1rem', borderBottom: '1px solid rgba(46,139,87,0.2)' },
    score: { color: '#2E8B57', fontWeight: 'bold' },
    bye: { color: '#666', fontStyle: 'italic' },
    navWrap: { textAlign: 'right', marginTop: '2rem' },
    navLink: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#2E8B57', color: '#fff', textDecoration: 'none', padding: '0.8rem 1.5rem', borderRadius: 8, fontFamily: 'Cinzel, serif', fontWeight: 'bold' },
    treeContainer: { background: 'var(--card-bg)', borderRadius: 15, padding: '2rem', boxShadow: 'none', marginTop: '2rem', border: '1px solid var(--card-border)' },
  };

  return (
    <div style={styles.root}>
      <div style={styles.container}>
        <h1 style={styles.h1}>Pairings & Results</h1>

        {loading && <p>Loading pairings...</p>}
        {!!error && !loading && <p>{error}</p>}

        {!loading && !error && allRounds.length === 0 && (
          <p>No pairings available.</p>
        )}

        {!loading && !error && allRounds.map((round) => (
          <div key={round.round} style={styles.pairingsContainer}>
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
          <Link to="/coordinator/tournament_management" style={styles.navLink}>
            <i className="fas fa-users" aria-hidden="true"></i> <span>Back to Tournaments</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default CoordinatorPairings;
