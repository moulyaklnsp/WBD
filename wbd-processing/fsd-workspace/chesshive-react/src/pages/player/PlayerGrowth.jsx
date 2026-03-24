import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chart } from 'chart.js/auto';
import usePlayerTheme from '../../hooks/usePlayerTheme';

function PlayerGrowth() {
  const navigate = useNavigate();
  const [isDark, toggleTheme] = usePlayerTheme();
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  const [stats, setStats] = useState({ gamesPlayed: '--', winRate: '--', rating: '--', peakRating: '--' });
  const [compareQuery, setCompareQuery] = useState('');
  const [compareResult, setCompareResult] = useState(null); // { name, rating, winRate }
  const [message, setMessage] = useState(null); // string or null

  const fetchJson = async (url, options = {}) => {
    const res = await fetch(url, { credentials: 'include', ...options });
    if (res.status === 401) { navigate('/login'); return null; }
    const data = await res.json().catch(() => ({}));
    return { res, data };
  };

  const drawChart = (labels, datasets) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    if (chartRef.current) { chartRef.current.destroy(); }

    // gradient only for first dataset background
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(46,139,87,0.6)');
    gradient.addColorStop(1, 'rgba(46,139,87,0.1)');

    const ds = datasets.map((d, idx) => ({
      label: d.label,
      data: d.data,
      borderColor: idx === 0 ? 'var(--sea-green)' : 'var(--sky-blue)',
      backgroundColor: idx === 0 ? gradient : 'rgba(135,206,235,0.2)',
      fill: true,
      tension: 0.3,
      borderWidth: 2,
      pointRadius: 4,
      pointBackgroundColor: idx === 0 ? '#2E8B57' : '#87CEEB',
      pointBorderColor: 'var(--on-accent)',
      pointBorderWidth: 2
    }));

    // dynamic y range from all points
    const all = datasets.flatMap(d => d.data || []);
    const min = all.length ? Math.min(...all) - 100 : 0;
    const max = all.length ? Math.max(...all) + 100 : undefined;

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: ds },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { min, max, ticks: { color: '#2E8B57' }, grid: { color: 'rgba(46,139,87,0.2)' } },
          x: { ticks: { color: '#2E8B57' }, grid: { color: 'rgba(46,139,87,0.2)' } }
        },
        plugins: { legend: { position: 'bottom' } }
      }
    });
  };

  const loadAnalytics = async () => {
    setMessage(null);
    const out = await fetchJson('/player/api/growth_analytics');
    if (!out) return;
    const { res, data } = out;
    if (!res.ok) { setMessage('Failed to load analytics'); return; }
    setStats({
      gamesPlayed: data.player?.gamesPlayed ?? '--',
      winRate: data.player?.winRate ?? '--',
      rating: data.player?.rating ?? '--',
      peakRating: data.player?.peakRating ?? '--'
    });
    drawChart(data.chartLabels || [], [
      { label: 'Rating Progress', data: data.ratingHistory || [] }
    ]);
  };

  const onCompare = async () => {
    const q = (compareQuery || '').trim();
    if (!q) { setMessage('Please enter a player name or email to compare.'); return; }
    setMessage('Fetching player data...');
    setCompareResult(null);

    const out = await fetchJson(`/player/api/compare?query=${encodeURIComponent(q)}`);
    if (!out) return;
    const { res, data } = out;
    if (!res.ok) { setMessage(data.error || 'Player not found.'); return; }

    const comparePlayer = data.player;
    setCompareResult({ name: comparePlayer.name, rating: comparePlayer.rating, winRate: Math.round(comparePlayer.winRate || 0) });

    // fetch my analytics again to obtain labels/history
    const me = await fetchJson('/player/api/growth_analytics');
    if (!me) return;
    const myData = me.data || {};

    setMessage(null);
    drawChart(myData.chartLabels || [], [
      { label: 'Your Rating', data: myData.ratingHistory || [] },
      { label: `${comparePlayer.name}'s Rating`, data: comparePlayer.ratingHistory || [comparePlayer.rating] }
    ]);
  };

  useEffect(() => {
    loadAnalytics();
    return () => { if (chartRef.current) chartRef.current.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <style>{`
        /* using global theme variables */
        *{ margin:0; padding:0; box-sizing:border-box; }
        .page{ font-family:'Playfair Display', serif; background-color:var(--page-bg); color:var(--text-color); min-height:100vh; padding:2rem; }
        .container{ max-width:1200px; margin:0 auto; }
        h2{ font-family:'Cinzel', serif; font-size:2.5rem; color:var(--sea-green); margin-bottom:2rem; text-align:center; display:flex; align-items:center; justify-content:center; gap:1rem; }
        h2::before{ content:'📈'; font-size:2.5rem; }
        .stats{ display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1.5rem; margin-bottom:2rem; }
        .stat-card{ background:var(--card-bg); padding:1.5rem; border-radius:15px; box-shadow:none; text-align:center; transition: transform 0.3s ease; border:1px solid var(--card-border); }
        .stat-card:hover{ transform: translateY(-5px); }
        .stat-value{ font-size:2rem; font-weight:bold; color:var(--sea-green); margin-bottom:0.5rem; }
        .stat-label{ color:#666; font-family:'Cinzel', serif; }
        .chart-container{ background:var(--card-bg); border-radius:15px; padding:2rem; box-shadow:none; margin-bottom:2rem; height:400px; border:1px solid var(--card-border); }
        .back-container{ text-align:right; }
        .back{ display:inline-flex; align-items:center; gap:0.5rem; background:var(--sea-green); color:var(--on-accent); text-decoration:none; padding:0.8rem 1.5rem; border-radius:8px; transition:all 0.3s ease; font-family:'Cinzel', serif; font-weight:bold; }
        .back:hover{ background:#236B43; transform: translateY(-2px); box-shadow:0 4px 8px rgba(0,0,0,0.1); }
        .compare-box{ background:var(--card-bg); padding:1.5rem; border-radius:15px; box-shadow:none; margin-bottom:2rem; border:1px solid var(--card-border); }
        .compare-grid{ display:flex; gap:1rem; flex-wrap:wrap; justify-content:center; }
        .compare-input{ flex:1; min-width:250px; padding:0.8rem; border:2px solid var(--sea-green); border-radius:8px; font-size:1rem; }
        .compare-btn{ background:var(--sea-green); color:var(--on-accent); padding:0.8rem 1.5rem; border:none; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; }
        @media (max-width:768px){ .page{ padding:1rem; } .chart-container{ height:300px; } }
      `}</style>

      <div className="page">
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2>Player Growth Analytics</h2>
            <div>
             
            </div>
          </div>

          {/* Compare box */}
          <div className="compare-box">
            <h3 style={{ textAlign: 'center', color: 'var(--sea-green)', fontFamily: 'Cinzel, serif', marginBottom: '1rem' }}>
              <i className="fas fa-user-compare" /> Compare with Another Player
            </h3>
            <div className="compare-grid">
              <input className="compare-input" type="text" placeholder="Enter player name or email" value={compareQuery} onChange={e => setCompareQuery(e.target.value)} />
              <button className="compare-btn" onClick={onCompare}>Compare</button>
            </div>
            <div id="compareResult" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              {message && (
                <p style={{ color: message.includes('Fetching') ? 'var(--sea-green)' : '#c62828' }}>{message}</p>
              )}
              {compareResult && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', textAlign: 'center', marginTop: '1rem' }}>
                  <div style={{ background: 'rgba(46,139,87,0.1)', padding: '1rem', borderRadius: 8 }}>
                    <h4 style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)' }}>You</h4>
                    <p><strong>Rating:</strong> {parseInt(stats.rating, 10) || 0}</p>
                    <p><strong>Win Rate:</strong> {parseFloat(stats.winRate) || 0}%</p>
                  </div>
                  <div style={{ background: 'rgba(135,206,235,0.1)', padding: '1rem', borderRadius: 8 }}>
                    <h4 style={{ fontFamily: 'Cinzel, serif', color: 'var(--sky-blue)' }}>{compareResult.name}</h4>
                    <p><strong>Rating:</strong> {compareResult.rating}</p>
                    <p><strong>Win Rate:</strong> {compareResult.winRate}%</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="stats">
            <div className="stat-card">
              <div className="stat-value">{stats.gamesPlayed}</div>
              <div className="stat-label">Recent Matches</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.winRate}%</div>
              <div className="stat-label">Win Rate</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.rating}</div>
              <div className="stat-label">Current Rating</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.peakRating}</div>
              <div className="stat-label">Peak Rating</div>
            </div>
          </div>

          {/* Chart */}
          <div className="chart-container">
            <canvas id="growthChart" ref={canvasRef} />
          </div>

          <div className="back-container">
            <a href="/player/player_dashboard" className="back">
              <i className="fas fa-arrow-left" /> Back to Dashboard
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlayerGrowth;
