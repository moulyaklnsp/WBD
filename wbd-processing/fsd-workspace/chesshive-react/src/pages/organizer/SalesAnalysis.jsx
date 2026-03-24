import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchMonthlySales, fetchYearlySales } from '../../features/sales/salesSlice';
import { Link } from 'react-router-dom';
import Chart from 'chart.js/auto';

// routes are handled by the sales slice; constants removed to avoid unused warnings

const months = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const SalesAnalysis = () => {
  const chartCanvasRef = useRef(null);
  const chartRef = useRef(null);
  const scrollRef = useRef(null);

  const [mode, setMode] = useState('monthly'); // 'monthly' | 'yearly'
  const [selectedMonth, setSelectedMonth] = useState(''); // '' means current
  const [labels, setLabels] = useState([]);
  const [dataPoints, setDataPoints] = useState([]);
  const dispatch = useDispatch();
  const salesState = useSelector((s) => s.sales || {});
  const loading = salesState.monthly?.loading || salesState.yearly?.loading || false;
  const error = salesState.monthly?.error || salesState.yearly?.error || '';

  const stats = useMemo(() => {
    const vals = dataPoints.filter((v) => typeof v === 'number');
    if (!vals.length) return { total: 0, avg: 0, count: 0, topLabel: '--' };
    const total = vals.reduce((a, b) => a + b, 0);
    const avg = total / vals.length;
    const maxVal = Math.max(...vals);
    const topIdx = dataPoints.findIndex((v) => v === maxVal);
    const topLabel = topIdx >= 0 ? labels[topIdx] : '--';
    return { total, avg, count: vals.length, topLabel };
  }, [dataPoints, labels]);

  const formatCurrency = (n) => `₹${(n ?? 0).toFixed(2)}`;

  const ensureChart = useCallback(() => {
    const canvas = chartCanvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (chartRef.current) return chartRef.current;

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(46,139,87,0.6)');
    gradient.addColorStop(1, 'rgba(46,139,87,0.05)');

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Sales',
            data: [],
            borderColor: '#2E8B57',
            backgroundColor: gradient,
            fill: true,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: '#2E8B57',
            pointBorderColor: '#FFF',
            pointBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, ticks: { color: '#2E8B57' }, grid: { color: 'rgba(46,139,87,0.12)' } },
          x: { ticks: { color: '#2E8B57' }, grid: { color: 'rgba(46,139,87,0.12)' } },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: (ctx) => `₹${(ctx.raw ?? 0).toFixed(2)}` },
          },
        },
      },
    });
    return chartRef.current;
  }, []);

  const updateChart = useCallback((lbls, pts, labelText) => {
    const ch = ensureChart();
    if (!ch) return;
    ch.data.labels = lbls;
    ch.data.datasets[0].data = pts.map((v) => v ?? 0);
    ch.data.datasets[0].label = labelText;
    ch.update();
  }, [ensureChart]);

  const loadYearly = useCallback(() => {
    setMode('yearly');
    setSelectedMonth('');
    dispatch(fetchYearlySales());
  }, [dispatch]);

  const loadMonthly = useCallback((monthVal = '') => {
    setMode('monthly');
    setSelectedMonth(monthVal);
    dispatch(fetchMonthlySales(monthVal));
  }, [dispatch]);

  // When salesState changes, derive labels/dataPoints for chart
  useEffect(() => {
    try {
      if (mode === 'yearly') {
        const agg = salesState.yearly?.data || [];
        const now = new Date();
        const lbls = Array.from({ length: 12 }, (_, m) => new Date(now.getFullYear(), m, 1).toLocaleString('default', { month: 'short' }));
        const data = (Array.isArray(agg) ? agg : []).map((m) => m?.totalSales ?? 0);
        setLabels(lbls);
        setDataPoints(data);
        updateChart(lbls, data, 'Monthly Sales');
        const currentMonth = new Date().getMonth();
        if (scrollRef.current) scrollRef.current.scrollLeft = Math.max(0, (currentMonth - 2) * 100);
      } else {
        const agg = salesState.monthly?.data || [];
        const now = new Date();
        const year = now.getFullYear();
        const monthIndex = selectedMonth ? Number(selectedMonth) - 1 : now.getMonth();
        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
        const monthName = new Date(year, monthIndex, 1).toLocaleString('default', { month: 'short' });
        const lbls = Array.from({ length: daysInMonth }, (_, i) => `${i + 1} ${monthName}`);
        const map = Object.fromEntries((Array.isArray(agg) ? agg : []).map((r) => [r._id, r.totalSales]));
        const data = lbls.map((_, i) => map[i + 1] ?? 0);
        setLabels(lbls);
        setDataPoints(data);
        updateChart(lbls, data, `Daily Sales - ${monthName}`);
        if (scrollRef.current) scrollRef.current.scrollLeft = Math.max(0, (lbls.length - 10) * 100);
      }
    } catch (e) {
      // ignore; error handled via redux state
    }
  }, [salesState, mode, selectedMonth, updateChart]);

  useEffect(() => {
    // initial load: monthly current
    loadMonthly('');
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [loadMonthly]);

  const styles = {
    page: { fontFamily: 'Playfair Display, serif', backgroundColor: '#FFFDD0', minHeight: '100vh', padding: '2rem' },
    container: { maxWidth: 1200, margin: '0 auto' },
    h2: { fontFamily: 'Cinzel, serif', fontSize: '2.5rem', color: '#2E8B57', marginBottom: '1rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' },
    controls: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' },
    filterWrap: { display: 'flex', gap: '.5rem', alignItems: 'center', fontFamily: 'Cinzel, serif' },
    filterBtn: (active) => ({ background: 'var(--card-bg)', borderRadius: 8, padding: '.5rem .9rem', border: '1px solid var(--card-border)', cursor: 'pointer', fontWeight: 700, color: active ? '#fff' : 'var(--text-color)', backgroundColor: active ? '#2E8B57' : 'var(--card-bg)', transform: active ? 'translateY(-2px)' : 'none', transition: 'all .15s ease' }),
    select: { padding: '.4rem', borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)' },
    note: { color: '#555', marginTop: '.5rem', fontSize: '.95rem' },
    statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' },
    statCard: { background: 'var(--card-bg)', padding: '1.5rem', borderRadius: 15, boxShadow: 'none', textAlign: 'center', border: '1px solid var(--card-border)' },
    statValue: { fontSize: '2rem', fontWeight: 'bold', color: '#2E8B57', marginBottom: '.5rem' },
    statLabel: { color: '#666', fontFamily: 'Cinzel, serif' },
    chartWrapper: { background: 'var(--card-bg)', borderRadius: 15, padding: '1.5rem', boxShadow: 'none', marginBottom: '2rem', height: 420, overflow: 'hidden', border: '1px solid var(--card-border)' },
    chartScroll: { width: '100%', height: 420, overflowX: 'auto', overflowY: 'auto', paddingBottom: 10, WebkitOverflowScrolling: 'touch' },
    canvas: { display: 'block', height: 360 },
    backRight: { textAlign: 'right', marginBottom: '1rem' },
    backLink: { display: 'inline-flex', alignItems: 'center', gap: '.5rem', background: '#2E8B57', color: '#fff', textDecoration: 'none', padding: '.8rem 1.5rem', borderRadius: 8, transition: 'all .3s ease', fontFamily: 'Cinzel, serif', fontWeight: 'bold' },
    error: { color: '#c62828', textAlign: 'center', marginBottom: '1rem' },
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h2 style={styles.h2}><span role="img" aria-label="chart">📈</span> Sales Analysis</h2>

        <div style={styles.controls}>
          <div style={styles.filterWrap}>
            <span style={{ fontWeight: 700, color: '#2E8B57', marginRight: 6 }}>View:</span>
            <button type="button" style={styles.filterBtn(mode === 'monthly')} onClick={() => loadMonthly(selectedMonth || '')}>Monthly</button>
            <button type="button" style={styles.filterBtn(mode === 'yearly')} onClick={loadYearly}>Yearly</button>
          </div>

          <div style={styles.filterWrap}>
            <label htmlFor="monthSelect" style={{ fontWeight: 700, color: '#2E8B57' }}>Month:</label>
            <select id="monthSelect" value={selectedMonth} onChange={(e) => loadMonthly(e.target.value)} style={styles.select}>
              <option value="">Current</option>
              {months.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div style={{ textAlign: 'right' }}>
            <small style={styles.note}>Default: current month (last 10 days visible). Scroll horizontally to see older days/months.</small>
          </div>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.statsGrid} aria-live="polite">
          <div style={styles.statCard}>
            <div style={styles.statValue}>{loading ? '--' : formatCurrency(stats.total)}</div>
            <div style={styles.statLabel}>Total Sales (visible range)</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{loading ? '--' : formatCurrency(stats.avg)}</div>
            <div style={styles.statLabel}>Average Sale</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{loading ? '--' : stats.count}</div>
            <div style={styles.statLabel}>Transactions</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{loading ? '--' : stats.topLabel}</div>
            <div style={styles.statLabel}>Top Day</div>
          </div>
        </div>

        <div style={styles.chartWrapper}>
          <div style={styles.chartScroll} ref={scrollRef}>
            <canvas ref={chartCanvasRef} style={styles.canvas} />
          </div>
        </div>
        <div style={{ textAlign: 'right', marginBottom: 12 }}>
          <button aria-label="Export sales CSV" onClick={() => {
            // CSV export from labels and dataPoints
            try {
              const rows = [['Label','Value'], ...labels.map((l, i) => [l, (dataPoints[i] ?? 0)])];
              const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `sales_export_${mode}_${new Date().toISOString().slice(0,10)}.csv`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);
            } catch (e) {
              console.error('CSV export failed', e);
              alert('CSV export failed');
            }
          }} style={{ background: '#2E8B57', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 6 }}>Export CSV</button>
        </div>

        <div style={styles.backRight}>
          <Link to="/organizer/store_monitoring" style={styles.backLink}>
            <i className="fas fa-arrow-left" /> Back to Store Monitor
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SalesAnalysis;
