import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import '../../styles/playerNeoNoir.css';
import { motion } from 'framer-motion';
import { fetchAsOrganizer } from '../../utils/fetchWithRole';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import AnimatedSidebar from '../../components/AnimatedSidebar';
import { GlobalLoader } from '../../components/ChessTransformation';
import { organizerLinks } from '../../constants/organizerLinks';
import { Bar, Line } from 'react-chartjs-2';
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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

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

function CoordinatorPerformance() {
  const [isDark, toggleTheme] = usePlayerTheme();
  const [coordinators, setCoordinators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPerformance = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetchAsOrganizer('/organizer/api/coordinator-performance');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load performance data');
      setCoordinators(Array.isArray(data) ? data : (data.coordinators || []));
    } catch (e) {
      console.error('Performance load error:', e);
      setError('Error loading coordinator performance data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPerformance();
  }, [loadPerformance]);

  // Chart data: top 10 coordinators by total revenue
  const chartData = useMemo(() => {
    const topCoordinators = [...coordinators]
      .sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0))
      .slice(0, 10);
    return {
      labels: topCoordinators.map((c) => c.name || 'Unknown'),
      datasets: [
        {
          label: 'Total Revenue',
          data: topCoordinators.map((c) => c.totalRevenue || 0),
          backgroundColor: 'rgba(46, 139, 87, 0.7)',
          borderColor: '#2E8B57',
          borderWidth: 2,
          borderRadius: 6,
          hoverBackgroundColor: 'rgba(46, 139, 87, 0.9)'
        }
      ]
    };
  }, [coordinators]);

  const growthChartData = useMemo(() => {
    const topByGrowth = [...coordinators]
      .sort((a, b) => (b.growthPercentage || 0) - (a.growthPercentage || 0))
      .slice(0, 10);

    return {
      labels: topByGrowth.map((c) => c.name || 'Unknown'),
      datasets: [
        {
          label: 'Growth %',
          data: topByGrowth.map((c) => c.growthPercentage || 0),
          borderColor: '#F4B942',
          backgroundColor: 'rgba(244, 185, 66, 0.2)',
          fill: true,
          tension: 0.3
        }
      ]
    };
  }, [coordinators]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: 'Top Coordinators by Revenue',
        color: '#2E8B57',
        font: { family: 'Cinzel, serif', size: 16, weight: 'bold' }
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `Revenue: INR ${(ctx.raw ?? 0).toFixed(2)}`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { color: '#2E8B57' },
        grid: { color: 'rgba(46,139,87,0.12)' }
      },
      x: {
        ticks: { color: '#2E8B57', maxRotation: 45 },
        grid: { color: 'rgba(46,139,87,0.12)' }
      }
    }
  };

  const growthChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: 'Performance Growth Trend (%)',
        color: '#2E8B57',
        font: { family: 'Cinzel, serif', size: 16, weight: 'bold' }
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `Growth: ${(ctx.raw ?? 0).toFixed(2)}%`
        }
      }
    },
    scales: {
      y: {
        ticks: {
          color: '#2E8B57',
          callback: (v) => `${v}%`
        },
        grid: { color: 'rgba(46,139,87,0.12)' }
      },
      x: {
        ticks: { color: '#2E8B57', maxRotation: 45 },
        grid: { color: 'rgba(46,139,87,0.12)' }
      }
    }
  };

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
        .updates-section h3 { font-family:'Cinzel', serif; color:var(--sea-green); margin-bottom:1.5rem; display:flex; align-items:center; gap:0.8rem; font-size:1.5rem; }
        .chart-wrapper { background:var(--card-bg); border-radius:15px; padding:1.5rem; margin-bottom:2rem; height:400px; border:1px solid var(--card-border); }
        .back-link { display:inline-flex; align-items:center; gap:0.5rem; background:var(--sea-green); color:var(--on-accent); text-decoration:none; padding:0.8rem 1.5rem; border-radius:8px; font-family:'Cinzel', serif; font-weight:bold; transition:all 0.3s ease; }
        .back-link:hover { transform:translateY(-2px); }
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
          <i className="fas fa-chart-line" />
        </motion.div>

        <AnimatedSidebar links={organizerLinks} logo={<i className="fas fa-chess" />} title={`ChessHive`} />

        <div className="organizer-dash-header" style={{ position: 'fixed', top: 18, right: 18, zIndex: 1001, display: 'flex', gap: '12px', alignItems: 'center' }}>
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
            <i className="fas fa-chart-line" /> Coordinator Performance
          </motion.h1>

          {error && (
            <div style={{ background: '#ffdddd', color: '#cc0000', padding: '1rem', borderRadius: 8, marginBottom: '1rem' }}>
              <strong>Error:</strong> <span>{error}</span>
            </div>
          )}

          {/* Bar Chart */}
          {!loading && coordinators.length > 0 && (
            <motion.div
              className="chart-wrapper"
              custom={0}
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
            >
              <Bar data={chartData} options={chartOptions} />
            </motion.div>
          )}

          {!loading && coordinators.length > 0 && (
            <motion.div
              className="chart-wrapper"
              custom={1}
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
            >
              <Line data={growthChartData} options={growthChartOptions} />
            </motion.div>
          )}

          {loading && (
            <motion.div
              className="updates-section"
              custom={2}
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
            >
              <h3>Loading Performance</h3>
              <GlobalLoader style={{ padding: '2rem' }} />
              <p style={{ textAlign: 'center', opacity: 0.7 }}>Fetching coordinator performance data...</p>
            </motion.div>
          )}

          {!loading && coordinators.length === 0 && !error && (
            <motion.div
              className="updates-section"
              custom={2}
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
            >
              <h3><i className="fas fa-info-circle" /> No Data</h3>
              <p style={{ textAlign: 'center', opacity: 0.7 }}>No coordinator performance data available.</p>
            </motion.div>
          )}

          <div style={{ textAlign: 'right', marginTop: '1rem' }}>
            <Link to="/organizer/organizer_profile" className="back-link">
              <i className="fas fa-arrow-left" /> Back to Profile
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CoordinatorPerformance;
