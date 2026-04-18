import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import AnimatedSidebar from '../../components/AnimatedSidebar';
import { fetchAsOrganizer } from '../../utils/fetchWithRole';
import { organizerLinks } from '../../constants/organizerLinks';
import '../../styles/playerNeoNoir.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

const defaultTournamentRevenue = {
  tournaments: [],
  monthlyRevenue: {},
  yearlyRevenue: {},
  totalRevenue: 0
};

const defaultStoreRevenue = {
  totalRevenue: 0,
  monthlyRevenue: {},
  yearlyRevenue: {},
  productRevenue: {},
  totalSales: 0
};

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const formatInr = (value) => `INR ${toNumber(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const monthLabel = (monthKey) => {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return monthKey || '--';
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleString('en-IN', { month: 'short', year: 'numeric' });
};

const sortMonthKeys = (keys) => [...keys].sort((a, b) => a.localeCompare(b));
const sortYearKeys = (keys) => [...keys].sort((a, b) => Number(a) - Number(b));

const getPeakEntry = (rows, selector) => {
  if (!rows.length) return null;
  let peak = rows[0];
  for (const row of rows) {
    if (selector(row) > selector(peak)) peak = row;
  }
  return peak;
};

const computeGrowth = (rows) => {
  if (rows.length < 2) return { percentage: 0, current: 0, previous: 0 };
  const previous = toNumber(rows[rows.length - 2].total);
  const current = toNumber(rows[rows.length - 1].total);
  if (previous === 0) {
    return { percentage: current > 0 ? 100 : 0, current, previous };
  }
  return {
    percentage: Math.round(((current - previous) / previous) * 100),
    current,
    previous
  };
};

const detectDropReason = (rows, insightLines) => {
  if (rows.length < 2) return 'Not enough monthly data to detect a drop reason.';
  const previous = rows[rows.length - 2];
  const current = rows[rows.length - 1];
  const totalDelta = toNumber(current.total) - toNumber(previous.total);
  if (totalDelta >= 0) return 'No overall revenue drop in the latest month.';

  const storeDelta = toNumber(current.store) - toNumber(previous.store);
  const tournamentDelta = toNumber(current.tournament) - toNumber(previous.tournament);
  const reasons = [];

  if (storeDelta < 0 && tournamentDelta < 0) reasons.push('Both store and tournament revenue declined together.');
  else if (storeDelta < 0) reasons.push('Store revenue decline is the main contributor.');
  else if (tournamentDelta < 0) reasons.push('Tournament revenue decline is the main contributor.');
  else reasons.push('Revenue mix shifted unfavorably in the latest month.');

  const backendDrop = (insightLines || []).find((line) => /drop|decrease|lower/i.test(line));
  if (backendDrop) reasons.push(backendDrop);

  return reasons.join(' ');
};

export default function SalesAnalysis() {
  const [isDark, toggleTheme] = usePlayerTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tournamentRevenue, setTournamentRevenue] = useState(defaultTournamentRevenue);
  const [storeRevenue, setStoreRevenue] = useState(defaultStoreRevenue);
  const [insights, setInsights] = useState({ peakMonth: null, growthPercentage: 0, demandTrend: [], insights: [] });

  const loadAnalysis = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const [tournamentRes, storeRes, insightsRes] = await Promise.all([
        fetchAsOrganizer('/organizer/api/sales/tournament-revenue'),
        fetchAsOrganizer('/organizer/api/sales/store-revenue'),
        fetchAsOrganizer('/organizer/api/sales/insights')
      ]);

      const tournamentData = await tournamentRes.json().catch(() => ({}));
      const storeData = await storeRes.json().catch(() => ({}));
      const insightsData = await insightsRes.json().catch(() => ({}));

      if (!tournamentRes.ok) throw new Error(tournamentData.error || 'Failed to load tournament revenue');
      if (!storeRes.ok) throw new Error(storeData.error || 'Failed to load store revenue');
      if (!insightsRes.ok) throw new Error(insightsData.error || 'Failed to load revenue insights');

      setTournamentRevenue({
        tournaments: Array.isArray(tournamentData.tournaments) ? tournamentData.tournaments : [],
        monthlyRevenue: tournamentData.monthlyRevenue || {},
        yearlyRevenue: tournamentData.yearlyRevenue || {},
        totalRevenue: toNumber(tournamentData.totalRevenue)
      });
      setStoreRevenue({
        totalRevenue: toNumber(storeData.totalRevenue),
        monthlyRevenue: storeData.monthlyRevenue || {},
        yearlyRevenue: storeData.yearlyRevenue || {},
        productRevenue: storeData.productRevenue || {},
        totalSales: toNumber(storeData.totalSales)
      });
      setInsights({
        peakMonth: insightsData.peakMonth || null,
        growthPercentage: toNumber(insightsData.growthPercentage),
        demandTrend: Array.isArray(insightsData.demandTrend) ? insightsData.demandTrend : [],
        insights: Array.isArray(insightsData.insights) ? insightsData.insights : []
      });
    } catch (e) {
      console.error('Failed to load sales analysis:', e);
      setError(e.message || 'Failed to load detailed sales analysis');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalysis();
  }, [loadAnalysis]);

  const monthlyRows = useMemo(() => {
    const monthKeys = sortMonthKeys(
      new Set([
        ...Object.keys(tournamentRevenue.monthlyRevenue || {}),
        ...Object.keys(storeRevenue.monthlyRevenue || {})
      ])
    );
    return monthKeys.map((month) => {
      const tournament = toNumber(tournamentRevenue.monthlyRevenue?.[month]);
      const store = toNumber(storeRevenue.monthlyRevenue?.[month]);
      return {
        month,
        tournament,
        store,
        total: tournament + store
      };
    });
  }, [tournamentRevenue.monthlyRevenue, storeRevenue.monthlyRevenue]);

  const yearlyRows = useMemo(() => {
    const yearKeys = sortYearKeys(
      new Set([
        ...Object.keys(tournamentRevenue.yearlyRevenue || {}),
        ...Object.keys(storeRevenue.yearlyRevenue || {})
      ])
    );
    return yearKeys.map((year) => {
      const tournament = toNumber(tournamentRevenue.yearlyRevenue?.[year]);
      const store = toNumber(storeRevenue.yearlyRevenue?.[year]);
      return {
        year,
        tournament,
        store,
        total: tournament + store
      };
    });
  }, [tournamentRevenue.yearlyRevenue, storeRevenue.yearlyRevenue]);

  const demandSeries = useMemo(() => {
    if (insights.demandTrend?.length) {
      return insights.demandTrend.map((row) => ({
        label: monthLabel(row.month),
        value: toNumber(row.revenue)
      }));
    }
    return monthlyRows.map((row) => ({ label: monthLabel(row.month), value: row.total }));
  }, [insights.demandTrend, monthlyRows]);

  const revenueTotals = useMemo(() => {
    const tournamentTotal = toNumber(tournamentRevenue.totalRevenue);
    const storeTotal = toNumber(storeRevenue.totalRevenue);
    return {
      tournamentTotal,
      storeTotal,
      combinedTotal: tournamentTotal + storeTotal
    };
  }, [tournamentRevenue.totalRevenue, storeRevenue.totalRevenue]);

  const topTournament = useMemo(
    () => getPeakEntry(tournamentRevenue.tournaments || [], (item) => toNumber(item.revenue)),
    [tournamentRevenue.tournaments]
  );

  const topProduct = useMemo(() => {
    const productEntries = Object.entries(storeRevenue.productRevenue || {});
    if (!productEntries.length) return null;
    const [name, revenue] = productEntries.sort((a, b) => toNumber(b[1]) - toNumber(a[1]))[0];
    return { name, revenue: toNumber(revenue) };
  }, [storeRevenue.productRevenue]);

  const peakTournamentMonth = useMemo(
    () => getPeakEntry(monthlyRows, (row) => row.tournament),
    [monthlyRows]
  );
  const peakStoreMonth = useMemo(
    () => getPeakEntry(monthlyRows, (row) => row.store),
    [monthlyRows]
  );
  const peakOverallMonth = useMemo(
    () => getPeakEntry(monthlyRows, (row) => row.total),
    [monthlyRows]
  );

  const growthStats = useMemo(() => computeGrowth(monthlyRows), [monthlyRows]);
  const dropReason = useMemo(() => detectDropReason(monthlyRows, insights.insights), [monthlyRows, insights.insights]);

  const monthlyComparisonData = useMemo(() => ({
    labels: monthlyRows.map((row) => monthLabel(row.month)),
    datasets: [
      {
        label: 'Tournament Revenue',
        data: monthlyRows.map((row) => row.tournament),
        backgroundColor: 'rgba(46, 139, 87, 0.65)',
        borderColor: '#2E8B57',
        borderWidth: 1
      },
      {
        label: 'Store Revenue',
        data: monthlyRows.map((row) => row.store),
        backgroundColor: 'rgba(135, 206, 235, 0.7)',
        borderColor: '#2B8DAB',
        borderWidth: 1
      }
    ]
  }), [monthlyRows]);

  const yearlyComparisonData = useMemo(() => ({
    labels: yearlyRows.map((row) => row.year),
    datasets: [
      {
        label: 'Tournament Revenue',
        data: yearlyRows.map((row) => row.tournament),
        borderColor: '#2E8B57',
        backgroundColor: 'rgba(46, 139, 87, 0.25)',
        tension: 0.3,
        fill: true
      },
      {
        label: 'Store Revenue',
        data: yearlyRows.map((row) => row.store),
        borderColor: '#2B8DAB',
        backgroundColor: 'rgba(43, 141, 171, 0.2)',
        tension: 0.3,
        fill: true
      },
      {
        label: 'Combined Revenue',
        data: yearlyRows.map((row) => row.total),
        borderColor: '#F4B942',
        backgroundColor: 'rgba(244, 185, 66, 0.12)',
        borderDash: [6, 4],
        tension: 0.25,
        fill: false
      }
    ]
  }), [yearlyRows]);

  const demandTrendData = useMemo(() => ({
    labels: demandSeries.map((row) => row.label),
    datasets: [
      {
        label: 'Demand Trend (Revenue)',
        data: demandSeries.map((row) => row.value),
        borderColor: '#F4B942',
        backgroundColor: 'rgba(244, 185, 66, 0.16)',
        fill: true,
        tension: 0.3
      }
    ]
  }), [demandSeries]);

  const baseChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#2E8B57', font: { family: 'Cinzel, serif' } }
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${formatInr(ctx.raw)}`
        }
      }
    },
    scales: {
      x: {
        ticks: { color: '#2E8B57' },
        grid: { color: 'rgba(46,139,87,0.1)' }
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: '#2E8B57',
          callback: (value) => formatInr(value)
        },
        grid: { color: 'rgba(46,139,87,0.1)' }
      }
    }
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body, #root { min-height: 100vh; }
        .page { font-family: 'Playfair Display', serif; background-color: var(--page-bg); min-height: 100vh; display: flex; color: var(--text-color); }
        .content { flex-grow: 1; margin-left: 0; padding: 2rem; }
        h1 { font-family: 'Cinzel', serif; color: var(--sea-green); margin-bottom: 1.5rem; font-size: 2.2rem; display: flex; align-items: center; gap: 0.8rem; }
        .panel { background: var(--card-bg); border-radius: 15px; padding: 1.4rem; border: 1px solid var(--card-border); margin-bottom: 1.2rem; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.2rem; }
        .stat-card { background: var(--card-bg); border-radius: 12px; border: 1px solid var(--card-border); padding: 1rem; }
        .stat-label { font-family: 'Cinzel', serif; color: var(--sea-green); font-size: 0.86rem; margin-bottom: 0.3rem; }
        .stat-value { font-size: 1.5rem; color: var(--text-color); font-weight: bold; }
        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .chart-wrap { height: 320px; }
        .table-wrap { overflow-x: auto; }
        .table { width: 100%; border-collapse: collapse; }
        .th { text-align: left; background: var(--sea-green); color: var(--on-accent); padding: 0.8rem; font-family: 'Cinzel', serif; }
        .td { padding: 0.7rem 0.8rem; border-bottom: 1px solid rgba(var(--sea-green-rgb, 27, 94, 63), 0.2); }
        .muted { opacity: 0.75; font-size: 0.9rem; }
        .insight-list { display: grid; gap: 0.7rem; margin-top: 0.8rem; }
        .insight-item { border: 1px solid var(--card-border); border-radius: 10px; padding: 0.8rem; background: rgba(var(--sea-green-rgb, 27, 94, 63), 0.06); }
        .back-link { display: inline-flex; align-items: center; gap: 0.5rem; background: var(--sea-green); color: var(--on-accent); text-decoration: none; padding: 0.8rem 1.2rem; border-radius: 8px; font-family: 'Cinzel', serif; font-weight: bold; }
        @media (max-width: 980px) {
          .two-col { grid-template-columns: 1fr; }
          .chart-wrap { height: 280px; }
        }
      `}</style>

      <div className="page player-neo">
        <AnimatedSidebar links={organizerLinks} logo={<i className="fas fa-chess" />} title="ChessHive" />

        <div style={{ position: 'fixed', top: 18, right: 18, zIndex: 1001, display: 'flex', gap: '12px', alignItems: 'center' }}>
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
          <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <i className="fas fa-chart-line" /> Detailed Sales Analysis
          </motion.h1>

          {error && (
            <div className="panel" style={{ color: '#c62828', borderColor: '#c62828' }}>
              <strong>Error:</strong> {error}
            </div>
          )}

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Tournament Revenue</div>
              <div className="stat-value">{loading ? '--' : formatInr(revenueTotals.tournamentTotal)}</div>
              <div className="muted">{topTournament ? `Top tournament: ${topTournament.name}` : 'No tournament revenue yet'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Store Revenue</div>
              <div className="stat-value">{loading ? '--' : formatInr(revenueTotals.storeTotal)}</div>
              <div className="muted">
                {topProduct ? `Top product: ${topProduct.name}` : 'No product revenue yet'}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Combined Revenue</div>
              <div className="stat-value">{loading ? '--' : formatInr(revenueTotals.combinedTotal)}</div>
              <div className="muted">Store transactions: {storeRevenue.totalSales || 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Latest Growth</div>
              <div className="stat-value" style={{ color: growthStats.percentage < 0 ? '#ff6b6b' : 'var(--sea-green)' }}>
                {loading ? '--' : `${growthStats.percentage}%`}
              </div>
              <div className="muted">Compared with previous month</div>
            </div>
          </div>

          <div className="panel">
            <h3 style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', marginBottom: '0.8rem' }}>
              Monthly Revenue Comparison
            </h3>
            <div className="chart-wrap">
              <Bar data={monthlyComparisonData} options={baseChartOptions} />
            </div>
          </div>

          <div className="panel">
            <h3 style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', marginBottom: '0.8rem' }}>
              Yearly Revenue Comparison
            </h3>
            <div className="chart-wrap">
              <Line data={yearlyComparisonData} options={baseChartOptions} />
            </div>
          </div>

          <div className="panel">
            <h3 style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', marginBottom: '0.8rem' }}>
              Demand Trend
            </h3>
            <div className="chart-wrap">
              <Line data={demandTrendData} options={baseChartOptions} />
            </div>
          </div>

          <div className="two-col">
            <div className="panel">
              <h3 style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', marginBottom: '0.8rem' }}>
                Monthly Analysis
              </h3>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="th">Month</th>
                      <th className="th">Tournament</th>
                      <th className="th">Store</th>
                      <th className="th">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyRows.length === 0 ? (
                      <tr><td className="td" colSpan="4">No monthly data available.</td></tr>
                    ) : (
                      monthlyRows.map((row) => (
                        <tr key={row.month}>
                          <td className="td">{monthLabel(row.month)}</td>
                          <td className="td">{formatInr(row.tournament)}</td>
                          <td className="td">{formatInr(row.store)}</td>
                          <td className="td"><strong>{formatInr(row.total)}</strong></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel">
              <h3 style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', marginBottom: '0.8rem' }}>
                Yearly Analysis
              </h3>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="th">Year</th>
                      <th className="th">Tournament</th>
                      <th className="th">Store</th>
                      <th className="th">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearlyRows.length === 0 ? (
                      <tr><td className="td" colSpan="4">No yearly data available.</td></tr>
                    ) : (
                      yearlyRows.map((row) => (
                        <tr key={row.year}>
                          <td className="td">{row.year}</td>
                          <td className="td">{formatInr(row.tournament)}</td>
                          <td className="td">{formatInr(row.store)}</td>
                          <td className="td"><strong>{formatInr(row.total)}</strong></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="panel">
            <h3 style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', marginBottom: '0.8rem' }}>
              Insights
            </h3>
            <div className="two-col">
              <div className="insight-item">
                <strong>Peak Months</strong>
                <div className="muted" style={{ marginTop: '0.5rem' }}>
                  Tournament: {peakTournamentMonth ? monthLabel(peakTournamentMonth.month) : '--'}<br />
                  Store: {peakStoreMonth ? monthLabel(peakStoreMonth.month) : '--'}<br />
                  Overall: {peakOverallMonth ? monthLabel(peakOverallMonth.month) : '--'}
                </div>
              </div>
              <div className="insight-item">
                <strong>Growth and Drop Detection</strong>
                <div className="muted" style={{ marginTop: '0.5rem' }}>
                  Growth: {growthStats.percentage}%<br />
                  Drop reason: {dropReason}
                </div>
              </div>
            </div>

            <div className="insight-list">
              {(insights.insights || []).length === 0 ? (
                <div className="insight-item">No additional insights generated yet.</div>
              ) : (
                insights.insights.map((line, idx) => (
                  <div key={idx} className="insight-item">
                    <i className="fas fa-lightbulb" style={{ marginRight: '0.5rem', color: 'var(--sea-green)' }} />
                    {line}
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={{ textAlign: 'right', marginTop: '1rem' }}>
            <Link to="/organizer/store_monitoring" className="back-link">
              <i className="fas fa-arrow-left" /> Back to Store Monitoring
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
