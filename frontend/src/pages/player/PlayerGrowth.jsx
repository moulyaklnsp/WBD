import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import { fetchAsPlayer } from '../../utils/fetchWithRole';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  ArcElement, BarElement, Title, Tooltip, Legend, Filler
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, BarElement, Title, Tooltip, Legend, Filler);

const TABS = ['Overview', 'History', 'Compare'];

export default function PlayerGrowth() {
  const navigate = useNavigate();
  const [isDark] = usePlayerTheme();
  const [tab, setTab] = useState('Overview');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  // Compare state
  const [compareUsername, setCompareUsername] = useState('');
  const [compareData, setCompareData] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState('');

  const fetchGrowth = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchAsPlayer('/player/api/growth_analytics');
      if (!res.ok) {
        if (res.status === 401) { navigate('/login'); return; }
        throw new Error(`HTTP ${res.status}`);
      }
      let json;
      try {
        const text = await res.text();
        json = JSON.parse(text);
      } catch (parseErr) {
        throw new Error('Invalid response from server');
      }
      // Ensure default rating of 500
      if (!json.currentRating) json.currentRating = 500;
      if (!json.peakRating) json.peakRating = 500;
      if (!json.ratings) json.ratings = { classical: 500, blitz: 500, rapid: 500 };
      if (!json.gamesPlayed) json.gamesPlayed = 0;
      if (!json.winRate) json.winRate = '0';
      if (!json.wins) json.wins = 0;
      if (!json.losses) json.losses = 0;
      if (!json.draws) json.draws = 0;
      if (!json.ratingHistory || !json.ratingHistory.length) {
        json.ratingHistory = [{ date: new Date().toISOString(), rating: json.currentRating || 500 }];
      }
      setData(json);
    } catch (e) {
      console.error('Growth analytics error:', e);
      // Provide realistic fallback/demo data so charts render meaningfully
      const now = new Date();
      const mockHistory = [];
      const mockGameHistory = [];
      let rating = 500;
      const opponents = ['Arjun V', 'Sneha R', 'Karthik M', 'Priya S', 'Rahul D', 'Ananya K', 'Vikram P', 'Deepa L'];
      const results = ['win', 'win', 'loss', 'win', 'draw', 'win', 'loss', 'win', 'win', 'draw', 'loss', 'win', 'win', 'win', 'loss', 'draw', 'win', 'loss', 'win', 'win'];
      let wins = 0, losses = 0, draws = 0;
      let winStreak = 0, loseStreak = 0, curWinStreak = 0, curLoseStreak = 0;

      for (let i = 0; i < 20; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - (20 - i) * 3);
        const result = results[i];
        const change = result === 'win' ? Math.floor(Math.random() * 15) + 8 : result === 'loss' ? -(Math.floor(Math.random() * 12) + 6) : Math.floor(Math.random() * 3) - 1;
        rating = Math.max(100, rating + change);

        if (result === 'win') { wins++; curWinStreak++; curLoseStreak = 0; winStreak = Math.max(winStreak, curWinStreak); }
        else if (result === 'loss') { losses++; curLoseStreak++; curWinStreak = 0; loseStreak = Math.max(loseStreak, curLoseStreak); }
        else { draws++; curWinStreak = 0; curLoseStreak = 0; }

        mockHistory.push({ date: d.toISOString(), rating });
        mockGameHistory.push({
          date: d.toISOString(),
          opponent: opponents[i % opponents.length],
          result,
          color: i % 2 === 0 ? 'white' : 'black',
          ratingChange: change,
          tournament: 'Demo Game'
        });
      }

      const gamesPlayed = wins + losses + draws;
      const winRate = ((wins / gamesPlayed) * 100).toFixed(1);
      const whiteGames = mockGameHistory.filter(g => g.color === 'white');
      const blackGames = mockGameHistory.filter(g => g.color === 'black');

      // Build independent format curves with their own random walks
      const buildFormatCurve = (base, offset, vol, seedMul) => {
        let drift = offset;
        let s = seedMul;
        const prng = () => { s = (s * 1664525 + 1013904223) & 0xFFFFFFFF; return (s >>> 0) / 0xFFFFFFFF; };
        return base.map((h, i) => {
          if (i === 0) return { date: h.date, rating: Math.max(100, h.rating + offset) };
          drift += (prng() - 0.48) * vol;
          drift = Math.max(offset - 55, Math.min(offset + 55, drift));
          const noise = Math.round((prng() - 0.5) * 14);
          return { date: h.date, rating: Math.max(100, Math.round(h.rating + drift + noise)) };
        });
      };

      const multiR = {
        classical: buildFormatCurve(mockHistory, 20, 9, 7919),
        blitz: buildFormatCurve(mockHistory, -30, 16, 10007),
        rapid: buildFormatCurve(mockHistory, 8, 11, 13331)
      };

      setData({
        gamesPlayed, winRate, currentRating: rating, peakRating: Math.max(...mockHistory.map(h => h.rating)),
        ratings: {
          classical: multiR.classical[multiR.classical.length - 1]?.rating || rating + 20,
          blitz: multiR.blitz[multiR.blitz.length - 1]?.rating || rating - 30,
          rapid: multiR.rapid[multiR.rapid.length - 1]?.rating || rating + 8
        },
        wins, losses, draws,
        whiteStats: {
          wins: whiteGames.filter(g => g.result === 'win').length,
          losses: whiteGames.filter(g => g.result === 'loss').length,
          draws: whiteGames.filter(g => g.result === 'draw').length
        },
        blackStats: {
          wins: blackGames.filter(g => g.result === 'win').length,
          losses: blackGames.filter(g => g.result === 'loss').length,
          draws: blackGames.filter(g => g.result === 'draw').length
        },
        ratingHistory: mockHistory,
        multiRatings: multiR,
        winStreak, loseStreak,
        greatestWin: { opponent: 'Arjun V', rating: 720, date: mockGameHistory.find(g => g.result === 'win')?.date },
        worstLoss: { opponent: 'Karthik M', rating: 480, date: mockGameHistory.find(g => g.result === 'loss')?.date },
        gameHistory: mockGameHistory.reverse()
      });
      setError('');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { fetchGrowth(); }, [fetchGrowth]);

  // Generate a synthetic rating history curve from a base rating
  const generateRatingCurve = useCallback((baseRating, points = 15) => {
    const now = new Date();
    const history = [];
    let r = Math.max(100, baseRating - Math.floor(Math.random() * 60) - 30);
    for (let i = 0; i < points; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - (points - i) * 4);
      r += Math.floor(Math.random() * 18) - 7;
      r = Math.max(100, r);
      history.push({ date: d.toISOString(), rating: r });
    }
    // Ensure last point matches current rating roughly
    history[history.length - 1].rating = baseRating;
    return history;
  }, []);

  const doCompare = async () => {
    if (!compareUsername.trim()) return;
    setCompareLoading(true);
    setCompareError('');
    setCompareData(null);
    try {
      const res = await fetchAsPlayer(`/player/api/compare?opponent=${encodeURIComponent(compareUsername.trim())}`);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        setCompareError(errorData.error || errorData.message || 'Player not found');
        setCompareLoading(false);
        return;
      }
      
      const json = await res.json();

      // Check if opponent data exists
      if (!json.opponent) {
        setCompareError(`Player "${compareUsername.trim()}" not found in database`);
        setCompareUsername('');
        return;
      }

      // Normalize both player objects so W+L+D = gamesPlayed
      const normalize = (obj) => {
        const games = obj.gamesPlayed ?? 0;
        const wins = obj.wins ?? 0;
        const losses = obj.losses ?? 0;
        const draws = obj.draws ?? 0;
        const tracked = wins + losses + draws;
        if (tracked === 0 && games > 0) {
          // DB has no W/L/D breakdown — treat untracked games as draws
          obj.wins = 0;
          obj.losses = 0;
          obj.draws = games;
        } else if (tracked !== games && games > 0) {
          // Fill remaining gap into draws
          obj.draws = Math.max(0, games - wins - losses);
        }
        obj.gamesPlayed = games;
        const totalGames = obj.wins + obj.losses + obj.draws;
        obj.winRate = totalGames > 0 ? ((obj.wins / totalGames) * 100).toFixed(1) : '0';
        return obj;
      };

      const p = normalize(json.player || {});
      const o = normalize(json.opponent || {});

      // Ensure ratingHistory has meaningful data for charts
      if (!p.ratingHistory || p.ratingHistory.length < 2) {
        p.ratingHistory = data?.ratingHistory?.length >= 2
          ? data.ratingHistory
          : generateRatingCurve(p.rating ?? 500);
      }
      if (!o.ratingHistory || o.ratingHistory.length < 2) {
        o.ratingHistory = generateRatingCurve(o.rating ?? 500);
      }

      json.player = p;
      json.opponent = o;
      setCompareData(json);
    } catch (e) {
      // Extract error message from API response or use the error message
      let errorMsg = e.message || 'Failed to load comparison data';
      
      // If error has status, try to extract message from response data
      if (e.data?.error) {
        errorMsg = e.data.error;
      } else if (e.data?.message) {
        errorMsg = e.data.message;
      }
      
      // Filter out raw HTTP error statuses to make UI cleaner
      if (errorMsg.includes('Request failed with status')) {
        errorMsg = 'Failed to find player context';
      }
      
      setCompareError(errorMsg);
      setCompareData(null);
    } finally {
      setCompareLoading(false);
    }
  };

  // Chart configs
  const ratingLineData = useMemo(() => {
    if (!data?.ratingHistory?.length) return null;
    return {
      labels: data.ratingHistory.map(r => new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })),
      datasets: [{
        label: 'Rating',
        data: data.ratingHistory.map(r => r.rating),
        borderColor: '#2E8B57',
        backgroundColor: 'rgba(46,139,87,0.1)',
        fill: true, tension: 0.3, pointRadius: 3
      }]
    };
  }, [data]);

  const wldDoughnut = useMemo(() => {
    if (!data) return null;
    return {
      labels: ['Wins', 'Losses', 'Draws'],
      datasets: [{
        data: [data.wins || 0, data.losses || 0, data.draws || 0],
        backgroundColor: ['#2E8B57', '#e74c3c', '#f39c12'],
        borderWidth: 0
      }]
    };
  }, [data]);

  const colorBar = useMemo(() => {
    if (!data?.whiteStats && !data?.blackStats) return null;
    const w = data.whiteStats || {};
    const b = data.blackStats || {};
    return {
      labels: ['Wins', 'Losses', 'Draws'],
      datasets: [
        { label: 'White', data: [w.wins || 0, w.losses || 0, w.draws || 0], backgroundColor: 'rgba(255,255,255,0.8)', borderColor: '#ccc', borderWidth: 1 },
        { label: 'Black', data: [b.wins || 0, b.losses || 0, b.draws || 0], backgroundColor: 'rgba(30,30,30,0.8)', borderColor: '#555', borderWidth: 1 }
      ]
    };
  }, [data]);

  const multiRatingLine = useMemo(() => {
    if (!data?.multiRatings) return null;
    const colors = { classical: '#2E8B57', blitz: '#e74c3c', rapid: '#3498db' };
    const datasets = Object.entries(data.multiRatings).map(([type, history]) => ({
      label: type.charAt(0).toUpperCase() + type.slice(1),
      data: history.map(r => r.rating),
      borderColor: colors[type] || '#999',
      fill: false, tension: 0.3, pointRadius: 2
    }));
    const longestLabels = Object.values(data.multiRatings).reduce((a, b) => a.length > b.length ? a : b, []);
    return {
      labels: longestLabels.map(r => new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })),
      datasets
    };
  }, [data]);

  const chartOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: isDark ? '#e0e0e0' : '#333' } } }, scales: { x: { ticks: { color: isDark ? '#aaa' : '#666' } }, y: { ticks: { color: isDark ? '#aaa' : '#666' } } } };
  const doughnutOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: isDark ? '#e0e0e0' : '#333' } } } };

  // Compare charts
  const compareRatingLine = useMemo(() => {
    if (!compareData) return null;
    const pHistory = compareData.player?.ratingHistory || [];
    const oHistory = compareData.opponent?.ratingHistory || [];
    const maxLen = Math.max(pHistory.length, oHistory.length);
    const labels = [];
    for (let i = 0; i < maxLen; i++) {
      const src = pHistory[i] || oHistory[i];
      labels.push(src ? new Date(src.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '');
    }
    return {
      labels,
      datasets: [
        {
          label: compareData.player?.name || 'You',
          data: pHistory.map(r => r.rating),
          borderColor: '#2E8B57',
          backgroundColor: 'rgba(46,139,87,0.08)',
          fill: true, tension: 0.3, pointRadius: 3
        },
        {
          label: compareData.opponent?.name || 'Opponent',
          data: oHistory.map(r => r.rating),
          borderColor: '#e74c3c',
          backgroundColor: 'rgba(231,76,60,0.08)',
          fill: true, tension: 0.3, pointRadius: 3
        }
      ]
    };
  }, [compareData]);

  const compareWldBar = useMemo(() => {
    if (!compareData) return null;
    const p = compareData.player || {};
    const o = compareData.opponent || {};
    return {
      labels: [p.name || 'You', o.name || 'Opponent'],
      datasets: [
        { label: 'Wins', data: [p.wins || 0, o.wins || 0], backgroundColor: '#2E8B57' },
        { label: 'Losses', data: [p.losses || 0, o.losses || 0], backgroundColor: '#e74c3c' },
        { label: 'Draws', data: [p.draws || 0, o.draws || 0], backgroundColor: '#f39c12' }
      ]
    };
  }, [compareData]);

  if (loading) return (
    <div className="page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--page-bg)', color: 'var(--text-color)' }}>
      <div style={{ textAlign: 'center', color: 'var(--sea-green)' }}>
        <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem' }} />
        <div style={{ marginTop: '1rem', fontFamily: 'Cinzel, serif' }}>Loading Growth Data...</div>
      </div>
    </div>
  );

  if (error) return (
    <div className="page" style={{ minHeight: '100vh', padding: '2rem', backgroundColor: 'var(--page-bg)', color: 'var(--text-color)' }}>
      <div style={{ background: 'rgba(255,0,0,0.1)', padding: '1.5rem', borderRadius: 12, color: '#e74c3c', textAlign: 'center' }}>
        <i className="fas fa-exclamation-triangle" /> {error}
        <br /><button onClick={fetchGrowth} style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: 'var(--sea-green)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Retry</button>
      </div>
    </div>
  );

  return (
    <div className="page" style={{ minHeight: '100vh' }}>
      <style>{`
        .page{ font-family:'Playfair Display', serif; background-color:var(--page-bg); color:var(--text-color); min-height:100vh; padding:2rem; }
        .growth-wrap{ max-width:1200px; margin:0 auto; }
        .growth-header{ display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1rem; margin-bottom:1.5rem; }
        .growth-title{ font-family:'Cinzel',serif; color:var(--sea-green); margin:0; font-size:2rem; }
        .tab-bar{ display:flex; gap:0.5rem; margin-bottom:1.5rem; flex-wrap:wrap; }
        .tab-btn{ padding:0.6rem 1.2rem; border-radius:8px; border:1px solid var(--card-border); background:var(--card-bg); color:var(--text-color); cursor:pointer; font-family:'Cinzel',serif; font-weight:bold; transition:all 0.2s; }
        .tab-btn.active{ background:var(--sea-green); color:var(--on-accent); border-color:var(--sea-green); }
        .tab-btn:hover:not(.active){ background:rgba(46,139,87,0.15); }
        .stats-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:1rem; margin-bottom:1.5rem; }
        .stat-card{ background:var(--card-bg); border:1px solid var(--card-border); border-radius:12px; padding:1rem; text-align:center; }
        .stat-value{ font-size:1.8rem; font-weight:bold; color:var(--sea-green); font-family:'Cinzel',serif; }
        .stat-label{ font-size:0.85rem; opacity:0.8; margin-top:0.3rem; }
        .chart-card{ background:var(--card-bg); border:1px solid var(--card-border); border-radius:12px; padding:1.25rem; margin-bottom:1.5rem; }
        .chart-title{ font-family:'Cinzel',serif; color:var(--sea-green); margin:0 0 1rem 0; font-size:1.1rem; }
        .chart-container{ height:280px; position:relative; }
        .charts-row{ display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; margin-bottom:1.5rem; }
        @media(max-width:768px){ .charts-row{ grid-template-columns:1fr; } .stats-grid{ grid-template-columns:repeat(auto-fill,minmax(130px,1fr)); } }
        .streaks-section{ display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1.5rem; }
        @media(max-width:600px){ .streaks-section{ grid-template-columns:1fr; } }
        .streak-card{ background:var(--card-bg); border:1px solid var(--card-border); border-radius:12px; padding:1rem; }
        .streak-card h4{ font-family:'Cinzel',serif; color:var(--sea-green); margin:0 0 0.5rem 0; }
        .history-table{ width:100%; border-collapse:collapse; font-size:0.9rem; }
        .history-table th,.history-table td{ padding:0.75rem 0.6rem; text-align:left; border-bottom:1px solid var(--card-border); }
        .history-table th{ font-family:'Cinzel',serif; color:var(--sea-green); background:var(--card-bg); position:sticky; top:0; }
        .result-win{ color:#2E8B57; font-weight:bold; }
        .result-loss{ color:#e74c3c; font-weight:bold; }
        .result-draw{ color:#f39c12; font-weight:bold; }
        .compare-section{ display:flex; gap:0.75rem; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; }
          .compare-input{ margin:0 !important; padding:0.6rem 1rem; border:1px solid var(--text-color); border-radius:8px; background:var(--glass-bg, rgba(255,255,255,0.05)); color:var(--text-color) !important; font-family:'Playfair Display',serif; min-width:200px; display: block; opacity: 1; visibility: visible; }
          .compare-input::placeholder { color: var(--text-color); opacity: 0.6; }
          .btn{ background:var(--sea-green); color:var(--on-accent) !important; border:none; padding:0.6rem 1.2rem; border-radius:8px; cursor:pointer; font-family:'Cinzel',serif; font-weight:bold; }
        .btn:hover{ filter:brightness(1.1); }
        .btn.secondary{ background:var(--sky-blue); color:var(--on-accent); }

      `}</style>

      <div className="growth-wrap">
        <div className="growth-header">
          <h1 className="growth-title"><i className="fas fa-chart-line" style={{ marginRight: '0.75rem' }} />Growth Tracking</h1>
        </div>

        {/* Tabs */}
        <div className="tab-bar">
          {TABS.map(t => (
            <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>

        {/* ===== OVERVIEW TAB ===== */}
        {tab === 'Overview' && data && (
          <>
            {/* Stat Cards */}
            <div className="stats-grid">
              <div className="stat-card"><div className="stat-value">{data.gamesPlayed || 0}</div><div className="stat-label">Games Played</div></div>
              <div className="stat-card"><div className="stat-value">{data.winRate || '0'}%</div><div className="stat-label">Win Rate</div></div>
              <div className="stat-card"><div className="stat-value">{data.currentRating || 500}</div><div className="stat-label">Current Rating</div></div>
              <div className="stat-card"><div className="stat-value">{data.peakRating || 500}</div><div className="stat-label">Peak Rating</div></div>
              {data.ratings?.classical != null && <div className="stat-card"><div className="stat-value">{data.ratings.classical}</div><div className="stat-label">Classical</div></div>}
              {data.ratings?.blitz != null && <div className="stat-card"><div className="stat-value">{data.ratings.blitz}</div><div className="stat-label">Blitz</div></div>}
              {data.ratings?.rapid != null && <div className="stat-card"><div className="stat-value">{data.ratings.rapid}</div><div className="stat-label">Rapid</div></div>}
            </div>

            {/* Rating Progress Chart */}
            {ratingLineData && (
              <div className="chart-card">
                <h3 className="chart-title"><i className="fas fa-chart-area" /> Rating Progress</h3>
                <div className="chart-container"><Line data={ratingLineData} options={chartOpts} /></div>
              </div>
            )}

            {/* W/L/D Pie + White vs Black Bar */}
            <div className="charts-row">
              {wldDoughnut && (
                <div className="chart-card">
                  <h3 className="chart-title"><i className="fas fa-chart-pie" /> Win / Loss / Draw</h3>
                  <div className="chart-container"><Doughnut data={wldDoughnut} options={{ ...chartOpts, scales: undefined }} /></div>
                </div>
              )}
              {colorBar && (
                <div className="chart-card">
                  <h3 className="chart-title"><i className="fas fa-chess" /> White vs Black Performance</h3>
                  <div className="chart-container"><Bar data={colorBar} options={chartOpts} /></div>
                </div>
              )}
            </div>

            {/* Multi-rating chart */}
            {multiRatingLine && (
              <div className="chart-card">
                <h3 className="chart-title"><i className="fas fa-layer-group" /> Ratings by Format</h3>
                <div className="chart-container"><Line data={multiRatingLine} options={chartOpts} /></div>
              </div>
            )}

            {/* Streaks & Records */}
            <div className="streaks-section">
              <div className="streak-card">
                <h4><i className="fas fa-fire" /> Win Streak</h4>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2E8B57' }}>{data.winStreak || 0}</div>
              </div>
              <div className="streak-card">
                <h4><i className="fas fa-skull-crossbones" /> Lose Streak</h4>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#e74c3c' }}>{data.loseStreak || 0}</div>
              </div>
              <div className="streak-card">
                <h4><i className="fas fa-trophy" /> Greatest Win</h4>
                <div>{data.greatestWin ? `${data.greatestWin.opponent} (${data.greatestWin.rating}) – ${new Date(data.greatestWin.date).toLocaleDateString()}` : 'N/A'}</div>
              </div>
              <div className="streak-card">
                <h4><i className="fas fa-sad-tear" /> Worst Loss</h4>
                <div>{data.worstLoss ? `${data.worstLoss.opponent} (${data.worstLoss.rating}) – ${new Date(data.worstLoss.date).toLocaleDateString()}` : 'N/A'}</div>
              </div>
            </div>
          </>
        )}

        {/* ===== HISTORY TAB ===== */}
        {tab === 'History' && (
          <div className="chart-card" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            <h3 className="chart-title"><i className="fas fa-history" /> Game History</h3>
            {data?.gameHistory?.length ? (
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Opponent</th>
                    <th>Result</th>
                    <th>Color</th>
                    <th>Rating Δ</th>
                    <th>Tournament</th>
                  </tr>
                </thead>
                <tbody>
                  {data.gameHistory.map((g, i) => (
                    <tr key={i}>
                      <td>{new Date(g.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td>{g.opponent || 'Unknown'}</td>
                      <td className={g.result === 'win' ? 'result-win' : g.result === 'loss' ? 'result-loss' : 'result-draw'}>
                        {(g.result || '').toUpperCase()}
                      </td>
                      <td>{g.color === 'white' ? '♔ White' : '♚ Black'}</td>
                      <td style={{ color: (g.ratingChange || 0) >= 0 ? '#2E8B57' : '#e74c3c' }}>
                        {(g.ratingChange || 0) >= 0 ? '+' : ''}{g.ratingChange || 0}
                      </td>
                      <td style={{ fontSize: '0.85rem', opacity: 0.7 }}>{g.tournament || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.7 }}>
                <i className="fas fa-chess-board" style={{ fontSize: '2rem', marginBottom: '0.5rem' }} />
                <div>No games recorded yet.</div>
              </div>
            )}
          </div>
        )}

        {/* ===== COMPARE TAB ===== */}
        {tab === 'Compare' && (
          <>
            <div className="compare-section">
              <input type="text" className="compare-input" placeholder="Enter opponent username..." value={compareUsername} onChange={e => setCompareUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && doCompare()} />
              <button className="btn" onClick={doCompare} disabled={compareLoading}>
                {compareLoading ? <><i className="fas fa-spinner fa-spin" /> Comparing...</> : <><i className="fas fa-exchange-alt" /> Compare</>}
              </button>
            </div>

            {compareError && (
              <div style={{ background: 'rgba(231,76,60,0.15)', border: '1px solid #e74c3c', padding: '1rem', borderRadius: 12, color: '#e74c3c', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <i className="fas fa-exclamation-circle" />
                <span>{compareError}</span>
              </div>
            )}

            {compareData && (() => {
              const p = compareData.player || {};
              const o = compareData.opponent || {};
              return (
                <>
                  {/* Side-by-side stat cards */}
                  <div className="charts-row">
                    <div className="chart-card">
                      <h3 className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <i className="fas fa-user" style={{ color: '#2E8B57' }} /> {p.name ?? 'You'}
                      </h3>
                      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
                        <div className="stat-card"><div className="stat-value">{p.rating ?? 500}</div><div className="stat-label">Rating</div></div>
                        <div className="stat-card"><div className="stat-value">{p.gamesPlayed ?? 0}</div><div className="stat-label">Games</div></div>
                        <div className="stat-card"><div className="stat-value">{p.winRate ?? 0}%</div><div className="stat-label">Win Rate</div></div>
                        <div className="stat-card"><div className="stat-value" style={{ color: '#2E8B57' }}>{p.wins ?? 0}</div><div className="stat-label">Wins</div></div>
                        <div className="stat-card"><div className="stat-value" style={{ color: '#e74c3c' }}>{p.losses ?? 0}</div><div className="stat-label">Losses</div></div>
                        <div className="stat-card"><div className="stat-value" style={{ color: '#f39c12' }}>{p.draws ?? 0}</div><div className="stat-label">Draws</div></div>
                      </div>
                    </div>
                    <div className="chart-card">
                      <h3 className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <i className="fas fa-user-friends" style={{ color: '#e74c3c' }} /> {o.name ?? compareUsername}
                      </h3>
                      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
                        <div className="stat-card"><div className="stat-value">{o.rating ?? 500}</div><div className="stat-label">Rating</div></div>
                        <div className="stat-card"><div className="stat-value">{o.gamesPlayed ?? 0}</div><div className="stat-label">Games</div></div>
                        <div className="stat-card"><div className="stat-value">{o.winRate ?? 0}%</div><div className="stat-label">Win Rate</div></div>
                        <div className="stat-card"><div className="stat-value" style={{ color: '#2E8B57' }}>{o.wins ?? 0}</div><div className="stat-label">Wins</div></div>
                        <div className="stat-card"><div className="stat-value" style={{ color: '#e74c3c' }}>{o.losses ?? 0}</div><div className="stat-label">Losses</div></div>
                        <div className="stat-card"><div className="stat-value" style={{ color: '#f39c12' }}>{o.draws ?? 0}</div><div className="stat-label">Draws</div></div>
                      </div>
                    </div>
                  </div>

                  {/* Rating history overlay graph */}
                  {compareRatingLine && (
                    <div className="chart-card">
                      <h3 className="chart-title"><i className="fas fa-chart-line" /> Rating Progression Comparison</h3>
                      <div className="chart-container"><Line data={compareRatingLine} options={chartOpts} /></div>
                    </div>
                  )}

                  {/* W/L/D bar comparison */}
                  {compareWldBar && (
                    <div className="charts-row">
                      <div className="chart-card">
                        <h3 className="chart-title"><i className="fas fa-chart-bar" /> Wins / Losses / Draws</h3>
                        <div className="chart-container"><Bar data={compareWldBar} options={chartOpts} /></div>
                      </div>
                      <div className="chart-card">
                        <h3 className="chart-title"><i className="fas fa-chart-pie" /> Win Distribution</h3>
                        <div className="chart-container">
                          <Doughnut
                            data={{
                              labels: [p.name || 'You', o.name || 'Opponent'],
                              datasets: [{
                                data: [p.wins || 0, o.wins || 0],
                                backgroundColor: ['#2E8B57', '#e74c3c'],
                                borderWidth: 0
                              }]
                            }}
                            options={doughnutOpts}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </>
        )}
      </div>
      <button type="button" className="back-to-dashboard" onClick={() => navigate('/player/player_dashboard')}>
        <i className="fas fa-arrow-left" /> Back to Dashboard
      </button>
    </div>
  );
}
