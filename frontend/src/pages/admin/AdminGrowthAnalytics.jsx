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
import AnimatedSidebar from '../../components/AnimatedSidebar';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import { fetchAsAdmin } from '../../utils/fetchWithRole';
import AnalyticsSummaryCard from '../../components/admin/AnalyticsSummaryCard';
import AnalyticsChartCard from '../../components/admin/AnalyticsChartCard';
import '../../styles/playerNeoNoir.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

const formatInr = (value) => `INR ${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: { color: '#2E8B57', font: { family: 'Cinzel, serif' } }
    }
  },
  scales: {
    x: { ticks: { color: '#2E8B57' }, grid: { color: 'rgba(46,139,87,0.12)' } },
    y: { beginAtZero: true, ticks: { color: '#2E8B57' }, grid: { color: 'rgba(46,139,87,0.12)' } }
  }
};

export default function AdminGrowthAnalytics() {
  const [isDark, toggleTheme] = usePlayerTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState('30d');
  const [summary, setSummary] = useState({ totalRevenue: 0, totalUsers: 0, totalTournaments: 0 });
  const [userTotals, setUserTotals] = useState({ players: 0, coordinators: 0, organizers: 0 });
  const [tournamentsTimeline, setTournamentsTimeline] = useState([]);
  const [salesTimeline, setSalesTimeline] = useState([]);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetchAsAdmin(`/admin/api/analytics/growth?range=${encodeURIComponent(range)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to fetch growth analytics');
      setSummary(data?.summary || { totalRevenue: 0, totalUsers: 0, totalTournaments: 0 });
      setUserTotals(data?.userTotals || { players: 0, coordinators: 0, organizers: 0 });
      setTournamentsTimeline(Array.isArray(data?.tournamentsTimeline) ? data.tournamentsTimeline : []);
      setSalesTimeline(Array.isArray(data?.salesTimeline) ? data.salesTimeline : []);
    } catch (err) {
      setError(err.message || 'Failed to fetch growth analytics');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const adminLinks = [
    { path: '/admin/organizer_management', label: 'Manage Organizers', icon: 'fas fa-users-cog' },
    { path: '/admin/coordinator_management', label: 'Manage Coordinators', icon: 'fas fa-user-tie' },
    { path: '/admin/player_management', label: 'Manage Players', icon: 'fas fa-user-tie' },
    { path: '/admin/admin_tournament_management', label: 'Tournament Approvals', icon: 'fas fa-trophy' },
    { path: '/admin/payments', label: 'Payments & Subscriptions', icon: 'fas fa-money-bill-wave' },
    { path: '/admin/growth_analytics', label: 'Growth Analytics', icon: 'fas fa-chart-area' },

  ];

  const tournamentChartData = useMemo(() => ({
    labels: tournamentsTimeline.map((row) => row.label),
    datasets: [
      {
        label: 'Total Created',
        data: tournamentsTimeline.map((row) => Number(row.totalCreated || 0)),
        borderColor: '#2E8B57',
        backgroundColor: 'rgba(46,139,87,0.6)'
      },
      {
        label: 'Completed',
        data: tournamentsTimeline.map((row) => Number(row.completed || 0)),
        borderColor: '#2B8DAB',
        backgroundColor: 'rgba(43,141,171,0.6)'
      },
      {
        label: 'Ongoing',
        data: tournamentsTimeline.map((row) => Number(row.ongoing || 0)),
        borderColor: '#F4B942',
        backgroundColor: 'rgba(244,185,66,0.6)'
      }
    ]
  }), [tournamentsTimeline]);

  const tournamentOptions = useMemo(() => ({
    ...baseOptions,
    plugins: {
      ...baseOptions.plugins,
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}`
        }
      }
    }
  }), []);

  const salesChartData = useMemo(() => ({
    labels: salesTimeline.map((row) => row.label),
    datasets: [
      {
        type: 'bar',
        label: 'Revenue',
        data: salesTimeline.map((row) => Number(row.revenue || 0)),
        borderColor: '#9C6ADE',
        backgroundColor: 'rgba(156,106,222,0.6)',
        yAxisID: 'y'
      },
      {
        type: 'line',
        label: 'Transactions',
        data: salesTimeline.map((row) => Number(row.transactions || 0)),
        borderColor: '#2E8B57',
        backgroundColor: 'rgba(46,139,87,0.2)',
        tension: 0.3,
        yAxisID: 'y1'
      }
    ]
  }), [salesTimeline]);

  const salesOptions = useMemo(() => ({
    ...baseOptions,
    plugins: {
      ...baseOptions.plugins,
      tooltip: {
        callbacks: {
          label: (ctx) => {
            if (ctx.dataset.label === 'Revenue') return `Revenue: ${formatInr(ctx.parsed.y)}`;
            return `Transactions: ${ctx.parsed.y}`;
          },
          afterBody: (items) => {
            if (!items?.length) return '';
            const i = items[0].dataIndex;
            const row = salesTimeline[i] || { revenue: 0, transactions: 0 };
            return [`Revenue: ${formatInr(row.revenue)}`, `Transactions: ${row.transactions}`];
          }
        }
      }
    },
    scales: {
      ...baseOptions.scales,
      y: {
        ...baseOptions.scales.y,
        position: 'left',
        ticks: {
          color: '#2E8B57',
          callback: (v) => formatInr(v)
        }
      },
      y1: {
        beginAtZero: true,
        position: 'right',
        ticks: { color: '#2E8B57' },
        grid: { drawOnChartArea: false }
      }
    }
  }), [salesTimeline]);

  const userChartData = useMemo(() => ({
    labels: ['Active Users'],
    datasets: [
      {
        label: 'Players',
        data: [Number(userTotals.players || 0)],
        backgroundColor: 'rgba(46,139,87,0.7)'
      },
      {
        label: 'Coordinators',
        data: [Number(userTotals.coordinators || 0)],
        backgroundColor: 'rgba(43,141,171,0.7)'
      },
      {
        label: 'Organizers',
        data: [Number(userTotals.organizers || 0)],
        backgroundColor: 'rgba(244,185,66,0.7)'
      }
    ]
  }), [userTotals]);

  const userChartOptions = useMemo(() => ({
    ...baseOptions,
    plugins: {
      ...baseOptions.plugins,
      tooltip: {
        callbacks: {
          label: () => ([
            `Players: ${userTotals.players}`,
            `Coordinators: ${userTotals.coordinators}`,
            `Organizers: ${userTotals.organizers}`
          ])
        }
      }
    }
  }), [userTotals]);

  return (
    <div style={{ minHeight: '100vh' }}>
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; }
        body, #root { min-height: 100vh; }
        .page { font-family: 'Playfair Display', serif; background-color: var(--page-bg); min-height: 100vh; display:flex; color: var(--text-color); }
        .content { flex-grow:1; margin-left:0; padding:2rem; }
        .title { font-family:'Cinzel', serif; color:var(--sea-green); margin-bottom:1.2rem; font-size:2.1rem; display:flex; align-items:center; gap:0.7rem; justify-content:center; }
        .toolbar { display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-bottom:1rem; flex-wrap:wrap; }
        .select { padding:0.55rem 0.8rem; border:1px solid var(--card-border); border-radius:8px; background:var(--card-bg); color:var(--text-color); }
        .summary-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(190px, 1fr)); gap:0.9rem; margin-bottom:1rem; }
        .chart-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:1rem; }
        .banner { padding:1rem; border-radius:8px; margin-bottom:1rem; text-align:center; font-weight:bold; }
        .banner.error { background:rgba(220,53,69,0.1); color:#dc3545; }
        .back-link { display:inline-flex; align-items:center; gap:0.5rem; background-color:var(--sea-green); color:var(--on-accent); text-decoration:none; padding:0.8rem 1.2rem; border-radius:8px; font-family:'Cinzel', serif; font-weight:bold; }
      `}</style>
      <div className="page player-neo">
        <AnimatedSidebar links={adminLinks} logo={<i className="fas fa-chess" />} title="ChessHive" />

        <div className="admin-dash-header" style={{ position: 'fixed', top: 18, right: 18, zIndex: 1001, display: 'flex', gap: '12px', alignItems: 'center' }}>
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
          <h1 className="title"><i className="fas fa-chart-area" /> Growth Analytics</h1>

          <div className="toolbar">
            <div style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)' }}>
              Analytics Window
            </div>
            <select className="select" value={range} onChange={(e) => setRange(e.target.value)}>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="6m">Last 6 Months</option>
              <option value="1y">Last 1 Year</option>
            </select>
          </div>

          {error && <div className="banner error">{error}</div>}

          <div className="summary-grid">
            <AnalyticsSummaryCard icon={<i className="fas fa-money-bill-wave" />} label="Total Revenue" value={loading ? '--' : formatInr(summary.totalRevenue)} />
            <AnalyticsSummaryCard icon={<i className="fas fa-users" />} label="Total Users" value={loading ? '--' : summary.totalUsers} />
            <AnalyticsSummaryCard icon={<i className="fas fa-trophy" />} label="Total Tournaments" value={loading ? '--' : summary.totalTournaments} />
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', border: '1px solid var(--card-border)', borderRadius: 12 }}>
              <i className="fas fa-spinner fa-spin" /> Loading analytics...
            </div>
          ) : (
            <div className="chart-grid">
              <AnalyticsChartCard title="Tournaments Analytics" icon={<i className="fas fa-chess-board" />} delay={0.05}>
                <Line data={tournamentChartData} options={tournamentOptions} />
              </AnalyticsChartCard>
              <AnalyticsChartCard title="Sales & Revenue Analysis" icon={<i className="fas fa-chart-line" />} delay={0.1}>
                <Bar data={salesChartData} options={salesOptions} />
              </AnalyticsChartCard>
              <AnalyticsChartCard title="User Management Analytics" icon={<i className="fas fa-users-cog" />} delay={0.15}>
                <Bar data={userChartData} options={userChartOptions} />
              </AnalyticsChartCard>
            </div>
          )}

          <div style={{ marginTop: '1rem', textAlign: 'right' }}>
            <Link to="/admin/admin_dashboard" className="back-link">
              <i className="fas fa-arrow-left" /> Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
