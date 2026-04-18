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
import { Line, Bar } from 'react-chartjs-2';
import { fetchAsOrganizer } from '../../utils/fetchWithRole';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import AnimatedSidebar from '../../components/AnimatedSidebar';
import { GlobalLoader } from '../../components/ChessTransformation';
import { organizerLinks } from '../../constants/organizerLinks';
import '../../styles/playerNeoNoir.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const mapToSeries = (input, valueKey = 'value') => {
  if (Array.isArray(input)) {
    return input.map((item) => ({
      label: item.month || item.label || item._id || '--',
      value: toNumber(item[valueKey] ?? item.count ?? item.amount ?? item.value ?? 0)
    }));
  }
  if (input && typeof input === 'object') {
    return Object.entries(input)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, value]) => ({ label, value: toNumber(value) }));
  }
  return [];
};

const formatInr = (value) => `INR ${toNumber(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const percentText = (value) => `${toNumber(value)}%`;

const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: '#2E8B57',
        font: { family: 'Cinzel, serif' }
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
      ticks: { color: '#2E8B57' },
      grid: { color: 'rgba(46,139,87,0.1)' }
    }
  }
};

export default function GrowthAnalysis() {
  const [isDark, toggleTheme] = usePlayerTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState({
    totalUsers: 0,
    totalPlayers: 0,
    totalCoordinators: 0,
    totalOrganizers: 0,
    totalTournaments: 0,
    totalRevenue: 0,
    platformGrowthRate: 0,
    userGrowthRate: 0,
    revenueGrowthRate: 0,
    engagementGrowthRate: 0
  });
  const [userGrowth, setUserGrowth] = useState([]);
  const [userRoleBreakdown, setUserRoleBreakdown] = useState([]);
  const [revenueGrowth, setRevenueGrowth] = useState([]);
  const [tournamentGrowth, setTournamentGrowth] = useState([]);
  const [engagementGrowth, setEngagementGrowth] = useState([]);
  const [platformGrowthTrend, setPlatformGrowthTrend] = useState([]);
  const [platformBreakdown, setPlatformBreakdown] = useState([]);

  const loadGrowthData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const res = await fetchAsOrganizer('/organizer/api/growth-analysis');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to load growth analysis');

      const summaryData = data.summary || {};
      setSummary({
        totalUsers: toNumber(summaryData.totalUsers),
        totalPlayers: toNumber(summaryData.totalPlayers),
        totalCoordinators: toNumber(summaryData.totalCoordinators),
        totalOrganizers: toNumber(summaryData.totalOrganizers),
        totalTournaments: toNumber(summaryData.totalTournaments),
        totalRevenue: toNumber(summaryData.totalRevenue),
        platformGrowthRate: toNumber(summaryData.platformGrowthRate),
        userGrowthRate: toNumber(summaryData.userGrowthRate),
        revenueGrowthRate: toNumber(summaryData.revenueGrowthRate),
        engagementGrowthRate: toNumber(summaryData.engagementGrowthRate)
      });

      setUserGrowth(mapToSeries(data.userGrowth, 'count'));
      setUserRoleBreakdown(Array.isArray(data.userRoleBreakdown) ? data.userRoleBreakdown : []);
      setRevenueGrowth(mapToSeries(data.revenueGrowth, 'amount'));
      setTournamentGrowth(mapToSeries(data.tournamentGrowth, 'count'));
      setEngagementGrowth(mapToSeries(data.engagementGrowth, 'count'));
      setPlatformGrowthTrend(mapToSeries(data.platformGrowthTrend, 'score'));
      setPlatformBreakdown(Array.isArray(data.platformBreakdown) ? data.platformBreakdown : []);
    } catch (e) {
      console.error('Growth analysis load error:', e);
      setError(e.message || 'Failed to load growth analysis');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGrowthData();
  }, [loadGrowthData]);

  const userGrowthChart = useMemo(() => ({
    labels: userGrowth.map((row) => row.label),
    datasets: [
      {
        label: 'User Growth',
        data: userGrowth.map((row) => row.value),
        borderColor: '#2E8B57',
        backgroundColor: 'rgba(46, 139, 87, 0.15)',
        fill: true,
        tension: 0.3
      }
    ]
  }), [userGrowth]);

  const roleBreakdownByMonth = useMemo(() => {
    const map = {};
    (userRoleBreakdown || []).forEach((row) => {
      const month = row?.month || '--';
      map[month] = {
        players: toNumber(row?.players),
        coordinators: toNumber(row?.coordinators),
        organizers: toNumber(row?.organizers),
        totalUsers: toNumber(row?.totalUsers)
      };
    });
    return map;
  }, [userRoleBreakdown]);

  const userManagementBarChart = useMemo(() => ({
    labels: userRoleBreakdown.map((row) => row.month || '--'),
    datasets: [
      {
        label: 'Total Active Users',
        data: userRoleBreakdown.map((row) => toNumber(row.totalUsers)),
        backgroundColor: 'rgba(46, 139, 87, 0.7)',
        borderColor: '#2E8B57',
        borderWidth: 1
      }
    ]
  }), [userRoleBreakdown]);

  const storeManagementBarChart = useMemo(() => ({
    labels: revenueGrowth.map((row) => row.label),
    datasets: [
      {
        label: 'Store Revenue',
        data: revenueGrowth.map((row) => row.value),
        backgroundColor: 'rgba(43, 141, 171, 0.7)',
        borderColor: '#2B8DAB',
        borderWidth: 1
      }
    ]
  }), [revenueGrowth]);

  const tournamentManagementBarChart = useMemo(() => ({
    labels: tournamentGrowth.map((row) => row.label),
    datasets: [
      {
        label: 'Tournaments Created',
        data: tournamentGrowth.map((row) => row.value),
        backgroundColor: 'rgba(156, 106, 222, 0.7)',
        borderColor: '#9C6ADE',
        borderWidth: 1
      }
    ]
  }), [tournamentGrowth]);

  const userManagementBarOptions = useMemo(() => ({
    ...baseOptions,
    plugins: {
      ...baseOptions.plugins,
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const month = ctx?.label || '--';
            const row = roleBreakdownByMonth[month] || { players: 0, coordinators: 0, organizers: 0, totalUsers: 0 };
            return [
              `Total Active Users: ${row.totalUsers}`,
              `Players: ${row.players}`,
              `Coordinators: ${row.coordinators}`,
              `Organizers: ${row.organizers}`
            ];
          }
        }
      }
    }
  }), [roleBreakdownByMonth]);

  const storeManagementBarOptions = useMemo(() => ({
    ...baseOptions,
    scales: {
      ...baseOptions.scales,
      y: {
        ...baseOptions.scales.y,
        ticks: {
          color: '#2E8B57',
          callback: (v) => formatInr(v)
        }
      }
    }
  }), []);

  const revenueGrowthChart = useMemo(() => ({
    labels: revenueGrowth.map((row) => row.label),
    datasets: [
      {
        label: 'Revenue Growth',
        data: revenueGrowth.map((row) => row.value),
        borderColor: '#2B8DAB',
        backgroundColor: 'rgba(43, 141, 171, 0.18)',
        fill: true,
        tension: 0.3
      }
    ]
  }), [revenueGrowth]);

  const engagementGrowthChart = useMemo(() => ({
    labels: engagementGrowth.map((row) => row.label),
    datasets: [
      {
        label: 'Engagement Growth',
        data: engagementGrowth.map((row) => row.value),
        borderColor: '#F4B942',
        backgroundColor: 'rgba(244, 185, 66, 0.2)',
        fill: true,
        tension: 0.3
      }
    ]
  }), [engagementGrowth]);

  const tournamentGrowthChart = useMemo(() => ({
    labels: tournamentGrowth.map((row) => row.label),
    datasets: [
      {
        label: 'Tournament Creation Growth',
        data: tournamentGrowth.map((row) => row.value),
        borderColor: '#9C6ADE',
        backgroundColor: 'rgba(156, 106, 222, 0.18)',
        fill: true,
        tension: 0.3
      }
    ]
  }), [tournamentGrowth]);

  const platformGrowthChart = useMemo(() => ({
    labels: platformGrowthTrend.map((row) => row.label),
    datasets: [
      {
        label: 'Platform Activity Count',
        data: platformGrowthTrend.map((row) => row.value),
        backgroundColor: 'rgba(46, 139, 87, 0.7)',
        borderColor: '#2E8B57',
        borderWidth: 1
      }
    ]
  }), [platformGrowthTrend]);

  return (
    <div style={{ minHeight: '100vh' }}>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body, #root { min-height: 100vh; }
        .page { font-family: 'Playfair Display', serif; background-color: var(--page-bg); min-height: 100vh; display: flex; color: var(--text-color); }
        .content { flex-grow: 1; margin-left: 0; padding: 2rem; }
        h1 { font-family: 'Cinzel', serif; color: var(--sea-green); margin-bottom: 1.4rem; font-size: 2.3rem; display: flex; align-items: center; gap: 0.8rem; }
        .panel { background: var(--card-bg); border-radius: 15px; border: 1px solid var(--card-border); padding: 1.2rem; margin-bottom: 1rem; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 1rem; margin-bottom: 1rem; }
        .stat-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; padding: 1rem; }
        .stat-label { color: var(--sea-green); font-family: 'Cinzel', serif; font-size: 0.85rem; margin-bottom: 0.3rem; }
        .stat-value { font-size: 1.4rem; font-weight: bold; }
        .growth-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 1rem; margin-bottom: 1rem; }
        .growth-badge { border: 1px solid var(--card-border); border-radius: 10px; padding: 0.8rem; background: rgba(var(--sea-green-rgb, 27, 94, 63), 0.06); }
        .charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .chart-wrap { height: 300px; }
        .table-wrap { overflow-x: auto; }
        .table { width: 100%; border-collapse: collapse; }
        .th { text-align: left; padding: 0.7rem; color: var(--sea-green); font-family: 'Cinzel', serif; border-bottom: 1px solid var(--card-border); }
        .td { padding: 0.7rem; border-bottom: 1px solid rgba(46,139,87,0.12); }
        .back-link { display: inline-flex; align-items: center; gap: 0.5rem; background: var(--sea-green); color: var(--on-accent); text-decoration: none; padding: 0.8rem 1.2rem; border-radius: 8px; font-family: 'Cinzel', serif; font-weight: bold; }
        @media (max-width: 980px) {
          .charts-grid { grid-template-columns: 1fr; }
          .chart-wrap { height: 270px; }
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
            <i className="fas fa-chart-area" /> Statistical Growth Analysis
          </motion.h1>

          {error && (
            <div className="panel" style={{ color: '#c62828', borderColor: '#c62828' }}>
              <strong>Error:</strong> {error}
            </div>
          )}

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Total Users</div>
              <div className="stat-value">{loading ? '--' : summary.totalUsers}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Players</div>
              <div className="stat-value">{loading ? '--' : summary.totalPlayers}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Coordinators</div>
              <div className="stat-value">{loading ? '--' : summary.totalCoordinators}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Organizers</div>
              <div className="stat-value">{loading ? '--' : summary.totalOrganizers}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Tournaments</div>
              <div className="stat-value">{loading ? '--' : summary.totalTournaments}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Revenue</div>
              <div className="stat-value">{loading ? '--' : formatInr(summary.totalRevenue)}</div>
            </div>
          </div>

          <div className="growth-grid">
            <div className="growth-badge"><strong>Platform Growth Rate:</strong> {loading ? '--' : percentText(summary.platformGrowthRate)}</div>
            <div className="growth-badge"><strong>User Growth Rate:</strong> {loading ? '--' : percentText(summary.userGrowthRate)}</div>
            <div className="growth-badge"><strong>Revenue Growth Rate:</strong> {loading ? '--' : percentText(summary.revenueGrowthRate)}</div>
            <div className="growth-badge"><strong>Engagement Growth Rate:</strong> {loading ? '--' : percentText(summary.engagementGrowthRate)}</div>
          </div>

          {!loading && (
            <div className="charts-grid">
              <div className="panel">
                <h3 style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', marginBottom: '0.7rem' }}>User Management (Active Users Over Time)</h3>
                <div className="chart-wrap">
                  <Bar data={userManagementBarChart} options={userManagementBarOptions} />
                </div>
              </div>
              <div className="panel">
                <h3 style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', marginBottom: '0.7rem' }}>Store Management (Revenue Over Time)</h3>
                <div className="chart-wrap">
                  <Bar data={storeManagementBarChart} options={storeManagementBarOptions} />
                </div>
              </div>
              <div className="panel">
                <h3 style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', marginBottom: '0.7rem' }}>Tournament Management (Creation Over Time)</h3>
                <div className="chart-wrap">
                  <Bar data={tournamentManagementBarChart} options={baseOptions} />
                </div>
              </div>
              <div className="panel">
                <h3 style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', marginBottom: '0.7rem' }}>User Growth</h3>
                <div className="chart-wrap">
                  <Line data={userGrowthChart} options={baseOptions} />
                </div>
              </div>
              <div className="panel">
                <h3 style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', marginBottom: '0.7rem' }}>Revenue Growth</h3>
                <div className="chart-wrap">
                  <Line
                    data={revenueGrowthChart}
                    options={{
                      ...baseOptions,
                      scales: {
                        ...baseOptions.scales,
                        y: {
                          ...baseOptions.scales.y,
                          ticks: {
                            color: '#2E8B57',
                            callback: (v) => formatInr(v)
                          }
                        }
                      }
                    }}
                  />
                </div>
              </div>
              <div className="panel">
                <h3 style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', marginBottom: '0.7rem' }}>Engagement Growth</h3>
                <div className="chart-wrap">
                  <Line data={engagementGrowthChart} options={baseOptions} />
                </div>
              </div>
              <div className="panel">
                <h3 style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', marginBottom: '0.7rem' }}>Platform Activity Growth</h3>
                <div className="chart-wrap">
                  <Bar data={platformGrowthChart} options={baseOptions} />
                </div>
              </div>
              <div className="panel">
                <h3 style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', marginBottom: '0.7rem' }}>Tournament Creation Growth</h3>
                <div className="chart-wrap">
                  <Line data={tournamentGrowthChart} options={baseOptions} />
                </div>
              </div>
            </div>
          )}

          {!loading && (
            <div className="panel">
              <h3 style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', marginBottom: '0.7rem' }}>Platform Activity Breakdown (Monthly)</h3>
              <div style={{ marginBottom: '0.7rem', opacity: 0.75, fontSize: '0.9rem' }}>
                `Total = users + tournaments + sales transactions + meetings created + enrollments`
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="th">Month</th>
                      <th className="th">Users</th>
                      <th className="th">Tournaments</th>
                      <th className="th">Sales</th>
                      <th className="th">Meetings</th>
                      <th className="th">Enrollments</th>
                      <th className="th">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {platformBreakdown.length === 0 ? (
                      <tr><td className="td" colSpan="7">No monthly activity data available.</td></tr>
                    ) : (
                      platformBreakdown.map((row) => (
                        <tr key={row.month}>
                          <td className="td">{row.month}</td>
                          <td className="td">{toNumber(row.users)}</td>
                          <td className="td">{toNumber(row.tournaments)}</td>
                          <td className="td">{toNumber(row.sales)}</td>
                          <td className="td">{toNumber(row.meetings)}</td>
                          <td className="td">{toNumber(row.enrollments)}</td>
                          <td className="td"><strong>{toNumber(row.total)}</strong></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {loading && (
            <div className="panel" style={{ textAlign: 'center' }}>
              <GlobalLoader style={{ marginRight: '0.5rem', padding: '1rem' }} />
              Loading growth analytics...
            </div>
          )}

          <div style={{ textAlign: 'right', marginTop: '1rem' }}>
            <Link to="/organizer/organizer_dashboard" className="back-to-dashboard">
              <i className="fas fa-arrow-left" /> Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
