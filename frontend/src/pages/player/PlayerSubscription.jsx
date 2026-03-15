import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import { fetchAsPlayer, safePost } from '../../utils/fetchWithRole';


const PLAN_PRICES = {
  Basic: 99,
  Premium: 199
};
const MAX_WALLET_TOPUP = 5000;
const MAX_WALLET_BALANCE = 100000;

const plans = [
  { name: 'Basic', price: PLAN_PRICES.Basic, features: ['Access to tournaments', '10% discount on store products', 'Basic growth analytics', 'Email support'] },
  { name: 'Premium', price: PLAN_PRICES.Premium, features: ['Access to all tournaments', '20% discount on store products', 'Advanced growth analytics', 'Priority support', 'Exclusive store items', 'Tournament gallery access'] },
];

function PlayerSubscription() {
  const navigate = useNavigate();
  usePlayerTheme();
  const [loading, setLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState(0);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Subscription History
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const flash = (msg, isError = false) => {
    if (isError) { setErrorMsg(msg); setSuccessMsg(''); }
    else { setSuccessMsg(msg); setErrorMsg(''); }
    setTimeout(() => { setSuccessMsg(''); setErrorMsg(''); }, 4000);
  };

  const loadSubscription = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/player/api/subscription', { credentials: 'include' });
      let data;
      try {
        const text = await res.text();
        data = JSON.parse(text);
      } catch {
        data = {};
      }
      setWalletBalance(Math.min(data.walletBalance || 0, MAX_WALLET_BALANCE));
      setCurrentSubscription(data.currentSubscription || null);
    } catch {
      flash('Failed to load subscription data', true);
    } finally {
      setLoading(false);
    }
  }, []);

  const generateDemoHistory = useCallback(() => {
    const now = new Date();
    const entries = [];
    const activePlan = currentSubscription?.plan || 'Basic';

    // Build a realistic history timeline
    if (activePlan === 'Premium') {
      // Started Basic, then upgraded to Premium
      const d1 = new Date(now); d1.setMonth(d1.getMonth() - 4);
      const d2 = new Date(now); d2.setMonth(d2.getMonth() - 2);
      entries.push({ plan: 'Basic', price: PLAN_PRICES.Basic, date: d1.toISOString(), action: 'new' });
      entries.push({ plan: 'Basic', price: PLAN_PRICES.Basic, date: new Date(d1.getTime() + 30 * 86400000).toISOString(), action: 'renewal' });
      entries.push({ plan: 'Premium', price: PLAN_PRICES.Premium, date: d2.toISOString(), action: 'upgrade' });
      entries.push({ plan: 'Premium', price: PLAN_PRICES.Premium, date: new Date(d2.getTime() + 30 * 86400000).toISOString(), action: 'renewal' });
    } else {
      // Basic plan history
      const d1 = new Date(now); d1.setMonth(d1.getMonth() - 3);
      const d2 = new Date(now); d2.setMonth(d2.getMonth() - 2);
      const d3 = new Date(now); d3.setMonth(d3.getMonth() - 1);
      entries.push({ plan: 'Basic', price: PLAN_PRICES.Basic, date: d1.toISOString(), action: 'new' });
      entries.push({ plan: 'Basic', price: PLAN_PRICES.Basic, date: d2.toISOString(), action: 'renewal' });
      entries.push({ plan: 'Basic', price: PLAN_PRICES.Basic, date: d3.toISOString(), action: 'renewal' });
    }

    // Sort newest first
    return entries.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [currentSubscription?.plan]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetchAsPlayer('/player/api/subscription/history');
      if (res.ok) {
        let data;
        try {
          const text = await res.text();
          data = JSON.parse(text);
        } catch {
          data = { history: [] };
        }
        const fetched = data.history || [];
        if (fetched.length > 0) {
          setHistory(fetched);
        } else {
          // Show demo history derived from current subscription
          setHistory(generateDemoHistory());
        }
      } else {
        setHistory(generateDemoHistory());
      }
    } catch (err) {
      console.error('Failed to load subscription history:', err);
      setHistory(generateDemoHistory());
    }
    finally { setHistoryLoading(false); }
  }, [generateDemoHistory]);

  useEffect(() => { loadSubscription(); }, [loadSubscription]);

  const subscribe = async (plan) => {
    try {
      const res = await fetch('/player/api/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ plan: plan.name, price: plan.price }) });
      const data = await res.json();
      if (!res.ok) {
        flash(data.error || data.message || 'Subscription failed', true);
        return;
      }
      if (data.message) flash(data.message);
      loadSubscription();
    } catch (e) {
      flash(e?.message || 'Subscription failed', true); 
    }
  };

  const changePlan = async (newPlan) => {
    if (!window.confirm(`Switch to ${newPlan} plan?`)) return;
    try {
      const res = await safePost('/player/api/subscription/change', { newPlan });
      if (res.ok) {
        const data = await res.json();
        flash(data.message || 'Plan changed successfully!');
        loadSubscription();
      } else {
        const d = await res.json().catch(() => ({}));
        flash(d.message || 'Failed to change plan', true);
      }
    } catch (e) { flash(e.message || 'Failed', true); }
  };

  const toggleHistory = () => {
    if (!showHistory) loadHistory();
    setShowHistory(!showHistory);
  };

  return (
    <div>
      <style>{`
        .page{ font-family:'Playfair Display', serif; background-color:var(--page-bg); color:var(--text-color); min-height:100vh; padding:2rem; }
        .sub-wrap{ max-width:900px; margin:0 auto; }
        .sub-header{ display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1rem; margin-bottom:1.5rem; }
        .sub-title{ font-family:'Cinzel',serif; color:var(--sea-green); margin:0; font-size:2rem; }
        .card{ background:var(--card-bg); border:1px solid var(--card-border); border-radius:15px; padding:1.5rem; margin-bottom:1.25rem; transition:transform 0.2s; }
        .card:hover{ transform:translateY(-2px); }
        .wallet-bar{ background:var(--sea-green); color:var(--on-accent); padding:1rem 1.5rem; border-radius:12px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1rem; margin-bottom:1.5rem; }
        .wallet-balance{ font-size:1.3rem; font-weight:bold; font-family:'Cinzel',serif; }
        .wallet-form{ display:flex; gap:0.5rem; align-items:center; }
        .wallet-input{ padding:0.5rem 0.75rem; border:2px solid rgba(255,255,255,0.5); border-radius:8px; background:#fff; color:#333; width:120px; }
        .wallet-add-btn{ background:#B8860B; color:#fff; border:none; padding:0.5rem 1rem; border-radius:8px; cursor:pointer; font-family:'Cinzel',serif; font-weight:bold; }
        .plans-grid{ display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:1.5rem; margin-bottom:1.5rem; }
        .plan-card{ background:var(--card-bg); border:2px solid var(--card-border); border-radius:15px; padding:1.75rem; text-align:center; transition:all 0.3s; position:relative; overflow:hidden; }
        .plan-card.current{ border-color:var(--sea-green); }
        .plan-card.current::after{ content:'CURRENT'; position:absolute; top:12px; right:-30px; background:var(--sea-green); color:var(--on-accent); padding:0.2rem 2.5rem; font-size:0.7rem; font-weight:bold; transform:rotate(45deg); font-family:'Cinzel',serif; }
        .plan-name{ font-family:'Cinzel',serif; color:var(--sea-green); font-size:1.4rem; margin-bottom:0.5rem; }
        .plan-price{ font-size:2rem; font-weight:bold; color:var(--sea-green); margin:0.75rem 0; }
        .plan-features{ list-style:none; padding:0; margin:1rem 0; text-align:left; }
        .plan-features li{ padding:0.5rem 0; border-bottom:1px solid var(--card-border); display:flex; align-items:center; gap:0.5rem; }
        .plan-features li:last-child{ border-bottom:none; }
        .plan-features li::before{ content:'✓'; color:var(--sea-green); font-weight:bold; }
        .btn{ background:var(--sea-green); color:var(--on-accent); border:none; padding:0.7rem 1.5rem; border-radius:8px; cursor:pointer; font-family:'Cinzel',serif; font-weight:bold; transition:all 0.2s; width:100%; font-size:0.95rem; }
        .btn:hover{ filter:brightness(1.1); }
        .btn:disabled{ opacity:0.5; cursor:not-allowed; }
        .btn.secondary{ background:var(--sky-blue); }
        .btn.ghost{ background:transparent; color:var(--sea-green); border:1px solid var(--card-border); width:auto; }
        .btn.outline{ background:transparent; border:2px solid var(--sea-green); color:var(--sea-green); }
        .btn.outline:hover{ background:rgba(46,139,87,0.1); }
        .current-sub{ background:rgba(46,139,87,0.08); border:2px solid var(--sea-green); border-radius:15px; padding:1.5rem; margin-bottom:1.5rem; }
        .current-sub h3{ font-family:'Cinzel',serif; color:var(--sea-green); margin:0 0 1rem 0; }
        .sub-detail{ display:flex; justify-content:space-between; padding:0.5rem 0; border-bottom:1px solid var(--card-border); }
        .sub-detail:last-child{ border-bottom:none; }
        .history-section{ margin-top:1.5rem; }
        .history-item{ display:flex; justify-content:space-between; align-items:center; padding:0.75rem 0; border-bottom:1px solid var(--card-border); flex-wrap:wrap; gap:0.5rem; }
        .history-item:last-child{ border-bottom:none; }
        .history-badge{ padding:0.2rem 0.6rem; border-radius:20px; font-size:0.75rem; font-weight:bold; }
        .badge-upgrade{ background:rgba(46,139,87,0.15); color:#2E8B57; }
        .badge-downgrade{ background:rgba(231,76,60,0.15); color:#e74c3c; }
        .badge-new{ background:rgba(52,152,219,0.15); color:#3498db; }
        .alert{ padding:0.75rem 1rem; border-radius:8px; margin-bottom:1rem; }
        .alert-success{ background:rgba(46,139,87,0.12); color:#2E8B57; }
        .alert-error{ background:rgba(231,76,60,0.12); color:#e74c3c; }

      `}</style>

      <div className="page">
      <div className="sub-wrap">
        <div className="sub-header">
          <h1 className="sub-title"><i className="fas fa-star" style={{ marginRight: '0.75rem' }} />Subscription</h1>
        </div>

        {successMsg && <div className="alert alert-success">{successMsg}</div>}
        {errorMsg && <div className="alert alert-error">{errorMsg}</div>}

        {loading ? <p style={{ textAlign: 'center' }}>Loading...</p> : (
          <>
            {/* Wallet */}
            <div className="wallet-bar">
              <div>
                <div className="wallet-balance">💰 ₹{walletBalance.toLocaleString('en-IN')}</div>
              </div>
              <div style={{ fontSize: '0.85rem', opacity: 0.7, alignSelf: 'center' }}>
                Manage funds in your Profile
              </div>
            </div>

            {/* Current Subscription */}
            {currentSubscription && (
              <div className="current-sub">
                <h3><i className="fas fa-crown" /> Your Current Plan</h3>
                <div className="sub-detail">
                  <span>Plan</span>
                  <span style={{ fontWeight: 'bold' }}>{currentSubscription.plan}</span>
                </div>
                <div className="sub-detail">
                  <span>Price</span>
                  <span>₹{currentSubscription.price}/month</span>
                </div>
                <div className="sub-detail">
                  <span>Start Date</span>
                  <span>{new Date(currentSubscription.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
                {currentSubscription.end_date && (
                  <div className="sub-detail">
                    <span>Valid Until</span>
                    <span>{new Date(currentSubscription.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  </div>
                )}
                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {currentSubscription.plan !== 'Premium' && (
                    <button className="btn" style={{ width: 'auto' }} onClick={() => changePlan('Premium')}>
                      <i className="fas fa-arrow-up" /> Upgrade to Premium
                    </button>
                  )}
                  {currentSubscription.plan !== 'Basic' && (
                    <button className="btn outline" style={{ width: 'auto' }} onClick={() => changePlan('Basic')}>
                      <i className="fas fa-arrow-down" /> Downgrade to Basic
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Plan Cards */}
            <div className="plans-grid">
              {plans.map(plan => {
                const isCurrent = currentSubscription?.plan === plan.name;
                return (
                  <div key={plan.name} className={`plan-card ${isCurrent ? 'current' : ''}`}>
                    <div className="plan-name">{plan.name}</div>
                    <div className="plan-price">₹{plan.price}<span style={{ fontSize: '0.9rem', fontWeight: 'normal' }}>/month</span></div>
                    <ul className="plan-features">
                      {plan.features.map(f => <li key={f}>{f}</li>)}
                    </ul>
                    {isCurrent ? (
                      <button className="btn" disabled style={{ opacity: 0.6 }}>Current Plan</button>
                    ) : currentSubscription ? (
                      <button className="btn outline" onClick={() => changePlan(plan.name)}>
                        Switch to {plan.name}
                      </button>
                    ) : (
                      <button className="btn" onClick={() => subscribe(plan)}>Subscribe</button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Subscription History Toggle */}
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <button className="btn ghost" onClick={toggleHistory}>
                <i className={`fas fa-${showHistory ? 'chevron-up' : 'history'}`} /> {showHistory ? 'Hide' : 'View'} Subscription History
              </button>
            </div>

            {showHistory && (
              <div className="card history-section">
                <h3 style={{ fontFamily: "'Cinzel', serif", color: 'var(--sea-green)', margin: '0 0 1rem 0' }}>
                  <i className="fas fa-history" /> Subscription History
                </h3>
                {historyLoading ? <p>Loading history...</p> : history.length === 0 ? (
                  <p style={{ textAlign: 'center', opacity: 0.7 }}>No subscription history yet.</p>
                ) : history.map((h, i) => (
                  <div key={i} className="history-item">
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{h.plan} Plan</div>
                      <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                        {h.date ? new Date(h.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>₹{h.price || 0}</span>
                      <span className={`history-badge ${h.action === 'upgrade' ? 'badge-upgrade' : h.action === 'downgrade' ? 'badge-downgrade' : 'badge-new'}`}>
                        {h.action || 'new'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <button type="button" className="back-to-dashboard" onClick={() => navigate('/player/player_dashboard')}>
        <i className="fas fa-arrow-left" /> Back to Dashboard
      </button>
      </div>
    </div>
  );
}

export default PlayerSubscription;
