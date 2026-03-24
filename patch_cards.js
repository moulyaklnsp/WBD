const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'frontend/src/pages/admin/AdminPayments.jsx');
let content = fs.readFileSync(file, 'utf8');

const cardsCode = `
  const totalWallet = walletRecharges.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const totalSubs = subscriptions.reduce((sum, item) => sum + (Number(item.price) || Number(item.amount) || 0), 0);
  const totalStore = store.reduce((sum, item) => sum + (Number(item.price) || Number(item.amount) || 0), 0);
  const totalTournaments = tournamentsList.reduce((sum, item) => sum + (Number(item.totalRevenue) || 0), 0);
  const grandTotal = totalWallet + totalSubs + totalStore + totalTournaments;

  return (
    <div style={{ minHeight: '100vh' }}>`;

content = content.replace(/return \(\s*<div style=\{\{ minHeight: '100vh' \}\}>/, cardsCode);

const uiCards = `
          {error && <div className="banner error">{error}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--card-border)', textAlign: 'center' }}>
              <div style={{ color: 'var(--sea-green)', fontSize: '1.1rem', marginBottom: '0.5rem', fontFamily: 'Cinzel, serif' }}><i className="fas fa-wallet" /> Wallet</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>₹{totalWallet.toFixed(2)}</div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--card-border)', textAlign: 'center' }}>
              <div style={{ color: 'var(--sky-blue)', fontSize: '1.1rem', marginBottom: '0.5rem', fontFamily: 'Cinzel, serif' }}><i className="fas fa-trophy" /> Tournaments</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>₹{totalTournaments.toFixed(2)}</div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--card-border)', textAlign: 'center' }}>
              <div style={{ color: 'var(--orange)', fontSize: '1.1rem', marginBottom: '0.5rem', fontFamily: 'Cinzel, serif' }}><i className="fas fa-crown" /> Subscriptions</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>₹{totalSubs.toFixed(2)}</div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--card-border)', textAlign: 'center' }}>
              <div style={{ color: '#e74c3c', fontSize: '1.1rem', marginBottom: '0.5rem', fontFamily: 'Cinzel, serif' }}><i className="fas fa-shopping-cart" /> Store</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>₹{totalStore.toFixed(2)}</div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} style={{ background: 'var(--sea-green)', color: 'var(--on-accent)', padding: '1.5rem', borderRadius: '12px', textAlign: 'center', gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '1.1rem', marginBottom: '0.5rem', fontFamily: 'Cinzel, serif' }}><i className="fas fa-chart-line" /> Total Platform Revenue</div>
              <div style={{ fontSize: '2.2rem', fontWeight: 'bold' }}>₹{grandTotal.toFixed(2)}</div>
            </motion.div>
          </div>
`;

content = content.replace(/\{error && <div className="banner error">\{error\}<\/div>\}/, uiCards);

fs.writeFileSync(file, content);
console.log('Cards injected into AdminPayments');
