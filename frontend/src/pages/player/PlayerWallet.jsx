import React, { useEffect, useState, useMemo } from 'react';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import { useNavigate } from 'react-router-dom';
import PaymentGatewayModal from '../../components/PaymentGatewayModal';
import { fetchAsPlayer } from '../../utils/fetchWithRole';

export default function PlayerWallet() {
  const navigate = useNavigate();
  usePlayerTheme(); // Apply player theme

  const [walletBalance, setWalletBalance] = useState(0);
  const [maxWalletBalance] = useState(100000);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [message, setMessage] = useState(null);
  
  // Transaction filter state
  const [activeTab, setActiveTab] = useState('all');

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch profile to get balance
      const [profileRes, txRes, subRes] = await Promise.all([
        fetchAsPlayer('/player/api/profile'),
        fetchAsPlayer('/player/api/wallet-transactions'),
        fetchAsPlayer('/player/api/subscription/history')
      ]);

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setWalletBalance(profileData.player?.walletBalance || 0);
      } else {
        if (profileRes.status === 401) return navigate('/login');
      }

      let fetchedTx = [];
      let fetchedSubs = [];

      if (txRes.ok) {
        const txData = await txRes.json();
        fetchedTx = txData.transactions || [];
      }
      
      if (subRes.ok) {
        const subData = await subRes.json();
        fetchedSubs = subData.history || [];
      }

      // Format and deduplicate subscription history to act as wallet transactions
      const combinedTx = [...fetchedTx];
      fetchedSubs.forEach(sub => {
        // Check if there is an existing wallet transaction for this subscription to avoid duplicates
        const subDate = new Date(sub.date).getTime();
        const exists = fetchedTx.some(t => {
          const tDate = new Date(t.date).getTime();
          // within 2 minutes and same amount
          return Math.abs(tDate - subDate) < 120000 && t.amount === (sub.price || 0);
        });

        if (!exists) {
          combinedTx.push({
            date: sub.date,
            description: sub.action === 'upgrade' ? `Upgraded to ${sub.plan} Plan` 
               : sub.action === 'downgrade' ? `Downgraded to ${sub.plan} Plan` 
               : `Subscription to ${sub.plan} Plan`,
            amount: sub.price || 0,
            type: sub.action === 'downgrade' ? 'credit' : 'debit'
          });
        }
      });

      // Sort combined descending by date
      combinedTx.sort((a, b) => new Date(b.date) - new Date(a.date));

      setTransactions(combinedTx);
    } catch (err) {
      console.error('Error loading wallet data:', err);
      setMessage({ type: 'error', text: 'Failed to load wallet data.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 'N/A' : d.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const filteredTransactions = useMemo(() => {
    if (activeTab === 'all') return transactions;
    if (activeTab === 'recharge') return transactions.filter(t => t.type === 'credit' && !(t.description || '').toLowerCase().includes('plan')); 
    if (activeTab === 'subscription') return transactions.filter(t => (t.description || '').toLowerCase().includes('subscription') || (t.description || '').toLowerCase().includes('plan'));
    if (activeTab === 'store') return transactions.filter(t => (t.description || '').toLowerCase().includes('store'));
    if (activeTab === 'tournament') return transactions.filter(t => (t.description || '').toLowerCase().includes('tournament entry'));
    return transactions;
  }, [transactions, activeTab]);

  const styles = useMemo(() => ({
    page: {
      minHeight: '100vh',
      backgroundColor: 'var(--page-bg)',
      color: 'var(--text-color)',
      padding: '2rem',
      fontFamily: "'Playfair Display', serif",
    },
    container: {
      maxWidth: '800px',
      margin: '0 auto',
      background: 'var(--card-bg)',
      border: '1px solid var(--card-border)',
      borderRadius: '15px',
      padding: '2rem',
      boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
    },
    title: {
      fontFamily: "'Cinzel', serif",
      color: 'var(--sea-green)',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      margin: '0 0 1.5rem 0',
      fontSize: '2rem'
    },
    msgBox: {
      padding: '1rem',
      borderRadius: '8px',
      marginBottom: '1.5rem',
      textAlign: 'center',
      fontWeight: 'bold'
    },
    success: { backgroundColor: 'rgba(46,139,87, 0.1)', color: 'var(--sea-green)' },
    error: { backgroundColor: '#ffebee', color: '#c62828' }
  }), []);

  return (
    <div style={styles.page}>
      <style>{`
        .wallet-btn {
          background: var(--sea-green);
          color: var(--on-accent);
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          cursor: pointer;
          font-family: 'Cinzel', serif;
          font-weight: bold;
          transition: all 0.2s;
        }
        .wallet-btn:hover:not(:disabled) {
          filter: brightness(1.1);
          transform: translateY(-2px);
        }
        .wallet-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .wallet-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1.5rem;
          padding: 2rem;
          border-radius: 15px;
          background: linear-gradient(135deg, rgba(46,139,87,0.15), rgba(46,139,87,0.05));
          border: 1px solid var(--sea-green);
          margin-bottom: 2rem;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .wallet-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 10px 25px rgba(46,139,87, 0.25);
        }
        .tx-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 1rem;
          font-family: 'Playfair Display', serif;
        }
        .tx-table th, .tx-table td {
          padding: 1rem;
          text-align: left;
          border-bottom: 1px solid var(--card-border);
        }
        .tx-table th {
          font-family: 'Cinzel', serif;
          color: var(--sea-green);
          position: sticky;
          top: 0;
          background-color: var(--content-bg);
          z-index: 10;
        }
        .tx-row:hover {
          background-color: rgba(46,139,87,0.05);
        }
        .tx-credit { color: var(--sea-green); font-weight: bold; }
        .tx-debit { color: #d32f2f; font-weight: bold; }
        
        .tx-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }
        .tx-tab-btn {
          background: transparent;
          border: 1px solid var(--card-border);
          color: var(--text-color);
          padding: 0.5rem 1rem;
          border-radius: 20px;
          cursor: pointer;
          font-family: 'Cinzel', serif;
          font-weight: 500;
          transition: all 0.2s;
          opacity: 0.7;
        }
        .tx-tab-btn:hover {
          background: rgba(46,139,87, 0.1);
          opacity: 1;
        }
        .tx-tab-btn.active {
          background: var(--sea-green);
          color: var(--on-accent);
          border-color: var(--sea-green);
          opacity: 1;
        }
      `}</style>
      <button onClick={() => navigate('/player/player_dashboard')} className="back-to-dashboard">
        <i className="fas fa-arrow-left" /> Back to Dashboard
      </button>

      <div style={styles.container}>

        <h1 style={styles.title}><i className="fas fa-wallet" /> My Wallet</h1>

        {message && (
          <div style={{ ...styles.msgBox, ...(message.type === 'success' ? styles.success : styles.error) }}>
            {message.text}
          </div>
        )}

        {/* Balance & Top-up Card */}
        <div className="wallet-card">
          <div>
            <div style={{ fontSize: '1.2rem', fontWeight: '500', opacity: 0.85, marginBottom: '0.5rem', color: 'var(--text-color)' }}>Current Balance</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', fontFamily: "'Cinzel', serif", color: 'var(--sea-green)' }}>
              ₹{walletBalance.toLocaleString('en-IN')}
            </div>
          </div>
          <button 
            className="wallet-btn" 
            onClick={() => setShowPayment(true)}
            disabled={walletBalance >= maxWalletBalance}
          >
            <i className="fas fa-plus-circle" style={{ marginRight: '0.5rem' }} />
            {walletBalance >= maxWalletBalance ? 'Wallet Full' : 'Add Funds'}
          </button>
        </div>

        {/* Transactions Section */}
        <h3 style={{ fontFamily: "'Cinzel', serif", color: 'var(--sea-green)', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem' }}>
          <i className="fas fa-history" style={{ marginRight: '0.5rem' }} /> Transaction History
        </h3>

        <div className="tx-tabs">
          <button className={`tx-tab-btn ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>All</button>
          <button className={`tx-tab-btn ${activeTab === 'recharge' ? 'active' : ''}`} onClick={() => setActiveTab('recharge')}>Recharge</button>
          <button className={`tx-tab-btn ${activeTab === 'subscription' ? 'active' : ''}`} onClick={() => setActiveTab('subscription')}>Subscriptions</button>
          <button className={`tx-tab-btn ${activeTab === 'store' ? 'active' : ''}`} onClick={() => setActiveTab('store')}>Store</button>
          <button className={`tx-tab-btn ${activeTab === 'tournament' ? 'active' : ''}`} onClick={() => setActiveTab('tournament')}>Tournaments</button>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.8 }}>
            <i className="fas fa-spinner fa-spin" style={{ marginRight: '0.5rem' }} /> Loading transactions...
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.8 }}>
            No transactions found in this category.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
            <table className="tx-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx, idx) => (
                  <tr key={idx} className="tx-row">
                    <td style={{ fontSize: '0.95rem', opacity: 0.9 }}>{formatDateTime(tx.date)}</td>
                    <td style={{ opacity: 0.95 }}>{tx.description}</td>
                    <td style={{ textAlign: 'right' }} className={tx.type === 'credit' ? 'tx-credit' : 'tx-debit'}>
                      {tx.type === 'credit' ? '+' : '-'}₹{(tx.amount || 0).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showPayment && (
        <PaymentGatewayModal
          walletBalance={walletBalance}
          onClose={() => setShowPayment(false)}
          onSuccess={(newBal) => {
            setWalletBalance(newBal);
            setMessage({ type: 'success', text: `Wallet funded successfully! Checked new balance: ₹${newBal.toLocaleString('en-IN')}` });
            loadData(); // refresh transactions
          }}
        />
      )}
    </div>
  );
}
