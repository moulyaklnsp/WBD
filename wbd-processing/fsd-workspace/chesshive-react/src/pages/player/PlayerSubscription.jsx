import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import usePlayerTheme from '../../hooks/usePlayerTheme';

// React conversion of views/player/subscription.html

function PlayerSubscription() {
  const [isDark, toggleTheme] = usePlayerTheme();
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [walletBalance, setWalletBalance] = useState(0);
  const [currentSubscription, setCurrentSubscription] = useState(null); // { plan, price, start_date }
  const [addAmount, setAddAmount] = useState('');

  const plans = [
    { name: 'Basic', price: 15, features: ['Access to tournaments', '10% discount on store products'] },
    { name: 'Premium', price: 30, features: ['Access to tournaments', '20% discount on store products'] },
  ];

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3000/player/api/subscription', { credentials: 'include' });
      const data = await res.json();
      setSuccessMessage(data.successMessage || '');
      setErrorMessage(data.errorMessage || '');
      setWalletBalance(data.walletBalance || 0);
      setCurrentSubscription(data.currentSubscription || null);
    } catch (e) {
      setErrorMessage('Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFunds = async (e) => {
    e.preventDefault();
    const amountNum = parseFloat(addAmount);
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid positive amount.');
      return;
    }
    try {
      const res = await fetch('/player/api/add-funds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ amount: amountNum, redirectTo: '/player/subscription' }),
      });
      const data = await res.json();
      if (data.success) {
        setWalletBalance(data.walletBalance || 0);
        setSuccessMessage('Funds added successfully!');
        setErrorMessage('');
        setAddAmount('');
      } else {
        alert(data.message || 'Failed to add funds.');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to add funds.');
    }
  };

  const subscribe = async (plan) => {
    try {
      const res = await fetch('/player/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plan: plan.name, price: plan.price }),
      });
      const data = await res.json();
      alert(data.message || 'Subscription successful!');
      await load();
    } catch (err) {
      console.error(err);
      alert('Subscription failed.');
    }
  };

  const styles = {
    root: { backgroundColor: 'var(--page-bg)', fontFamily: 'Playfair Display, serif', margin: 0, padding: 20, color: 'var(--text-color)', minHeight: '100vh' },
    container: { maxWidth: 1000, margin: '0 auto', padding: 20 },
    h2: { fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', textAlign: 'center' },
    card: { background: 'var(--content-bg)', borderRadius: 10, padding: 25, margin: '20px 0', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', transition: 'transform 0.3s ease' },
    wallet: { backgroundColor: 'var(--sea-green)', color: 'var(--content-bg)', padding: 20, borderRadius: 10, textAlign: 'center', marginBottom: '1.5rem', overflow: 'hidden' },
    walletH3: { color: 'var(--content-bg)', marginTop: 0, marginBottom: '1rem' },
    walletForm: { display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 300, margin: '0 auto' },
    walletInput: { width: '100%', padding: 12, border: '2px solid var(--sea-green)', borderRadius: 5, fontSize: 16, boxSizing: 'border-box', background: 'var(--content-bg)', color: 'var(--text-color)' },
    walletButton: { backgroundColor: 'var(--sky-blue)', color: 'var(--sea-green)', border: 'none', padding: '12px 24px', borderRadius: 5, cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.3s ease', fontFamily: 'Cinzel, serif', textAlign: 'center', width: '100%', boxSizing: 'border-box' },
    planGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, margin: '30px 0' },
    planButton: { backgroundColor: 'var(--sky-blue)', color: 'var(--sea-green)', border: 'none', padding: '12px 24px', borderRadius: 5, cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.3s ease', fontFamily: 'Cinzel, serif', textAlign: 'center', width: '100%', boxSizing: 'border-box' },
    success: { backgroundColor: 'var(--sea-green)', color: 'var(--content-bg)', padding: 15, borderRadius: 5, marginBottom: 20, textAlign: 'center' },
    error: { backgroundColor: 'var(--sky-blue)', color: 'var(--on-accent)', padding: 15, borderRadius: 5, marginBottom: 20, textAlign: 'center' },
    backRow: { textAlign: 'center', marginTop: '2rem' },
    backLink: { backgroundColor: 'var(--sky-blue)', color: 'var(--sea-green)', border: 'none', padding: '12px 24px', borderRadius: 5, cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.3s ease', width: 'auto', fontFamily: 'Cinzel, serif', textDecoration: 'none', display: 'inline-block', textAlign: 'center' },
    price: { fontSize: 24, fontWeight: 'bold', color: 'var(--sea-green)', margin: '15px 0' },
    ul: { listStyle: 'none', padding: 0, margin: '15px 0' },
    li: { padding: '8px 0', borderBottom: '1px solid rgba(46,139,87,0.2)' },
  };

  return (
    <div style={styles.root}>
      <div style={styles.container}>
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
    <h2 style={styles.h2}>Manage Subscription</h2>

  </div>
  {loading ? <p style={{ textAlign: 'center' }}>Loading...</p> : null}

        {successMessage ? <div style={styles.success}>{successMessage}</div> : null}
        {errorMessage ? <div style={styles.error}>{errorMessage}</div> : null}

        <div style={styles.wallet}>
          <span role="img" aria-label="wallet">💰</span>
          <h3 style={styles.walletH3}>Wallet Balance: ₹<span>{walletBalance}</span></h3>
          <form onSubmit={addFunds} style={styles.walletForm}>
            <input type="number" placeholder="Enter amount" min="1" required value={addAmount} onChange={(e) => setAddAmount(e.target.value)} style={styles.walletInput} />
            <button type="submit" style={styles.walletButton}>Add Funds</button>
          </form>
        </div>

        <div style={styles.planGrid}>
          {plans.map((plan) => {
            const isSubscribed = !!currentSubscription;
            const isCurrent = currentSubscription?.plan === plan.name;
            const cardStyle = { ...styles.card, ...(isCurrent ? { border: '2px solid var(--sea-green)', backgroundColor: 'rgba(var(--sea-green-rgb),0.06)' } : {}) };
            return (
              <div key={plan.name} style={cardStyle}>
                <h3 style={{ ...styles.h2, margin: 0 }}>{plan.name} Plan</h3>
                <ul style={styles.ul}>
                  {plan.features.map((f) => (
                    <li key={f} style={styles.li}>{f}</li>
                  ))}
                </ul>
                <div style={styles.price}>₹{plan.price}/month</div>
                <button type="button" style={styles.planButton} onClick={() => subscribe(plan)} disabled={isSubscribed}>
                  Subscribe
                </button>
                {isSubscribed && isCurrent ? (
                  <div style={{ color: 'var(--sea-green)', fontWeight: 'bold', textAlign: 'center', marginTop: 10 }}>You're on this plan</div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div>
          {currentSubscription ? (
            <div style={styles.card}>
              <h3 style={styles.h2}>Current Subscription</h3>
              <h4 style={{ ...styles.h2, fontSize: '1.3rem' }}>Plan: {currentSubscription.plan}</h4>
              <h4 style={{ ...styles.h2, fontSize: '1.3rem' }}>Start Date: {new Date(currentSubscription.start_date).toLocaleDateString()}</h4>
              <h4 style={{ ...styles.h2, fontSize: '1.3rem' }}>Price: ₹{currentSubscription.price}/month</h4>
            </div>
          ) : null}
        </div>

        <div style={styles.backRow}>
          <Link to="/player/player_dashboard" style={styles.backLink}>Back to Dashboard</Link>
        </div>
      </div>
    </div>
  );
}

export default PlayerSubscription;
