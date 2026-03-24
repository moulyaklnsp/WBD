const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'frontend/src/pages/admin/AdminPayments.jsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add state variable
content = content.replace(
  /const \[store, setStore\] = useState\(\[\]\);/,
  `const [store, setStore] = useState([]);\n  const [selectedProduct, setSelectedProduct] = useState(null);`
);

// 2. Add onClick to motion.div for store item
content = content.replace(
  /<motion\.div\s+key=\{`store-\$\{idx\}`\}\s+whileHover=\{\{ translateY: -5 \}\}/,
  `<motion.div
                      key={\`store-\${idx}\`}
                      onClick={() => setSelectedProduct(s.item)}
                      whileHover={{ translateY: -5 }}
                      role="button"
                      tabIndex={0}`
);

// Add cursor pointer to that motion.div's style
content = content.replace(
  /style=\{\{\s*background: 'var\(--card-bg\)',/,
  `style={{
                        cursor: 'pointer',
                        background: 'var(--card-bg)',`
);

// 3. Inject StoreAnalyticsModal component definition ABOVE AdminPayments
const modalCode = `
const StoreAnalyticsModal = ({ store, selectedProduct, onClose }) => {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  
  let prodBuyers = {};
  let prodTotalCount = 0;
  let prodTotalRevenue = 0;
  let rev30 = 0, rev60 = 0, rev120 = 0, rev180 = 0, rev365 = 0;

  let allProducts = {};
  let allBuyers = {};

  store.forEach(s => {
    const price = Number(s.amount) || Number(s.price) || 0;
    const item = s.item || 'Unknown';
    const buyer = s.boughtBy || s.buyer || s.user || 'Unknown';
    const seller = s.soldBy || 'Admin';
    const pDate = new Date(s.date || s.purchase_date || s.createdAt || Date.now()).getTime();

    if (!allProducts[item]) allProducts[item] = { name: item, seller, count: 0, rev: 0 };
    allProducts[item].count += 1;
    allProducts[item].rev += price;

    if (!allBuyers[buyer]) allBuyers[buyer] = { name: buyer, count: 0, spent: 0 };
    allBuyers[buyer].count += 1;
    allBuyers[buyer].spent += price;

    if (item === selectedProduct) {
      prodTotalCount += 1;
      prodTotalRevenue += price;

      if (!prodBuyers[buyer]) prodBuyers[buyer] = { name: buyer, count: 0, spent: 0 };
      prodBuyers[buyer].count += 1;
      prodBuyers[buyer].spent += price;

      const diff = now - pDate;
      if (diff <= 30 * DAY) rev30 += price;
      if (diff <= 60 * DAY) rev60 += price;
      if (diff <= 120 * DAY) rev120 += price;
      if (diff <= 180 * DAY) rev180 += price;
      if (diff <= 365 * DAY) rev365 += price;
    }
  });

  const topPurchasers = Object.values(prodBuyers).sort((a,b) => b.count - a.count);
  const topProducts = Object.values(allProducts).sort((a,b) => b.count - a.count).slice(0, 3);
  const topGlobalBuyers = Object.values(allBuyers).sort((a,b) => b.spent - a.spent).slice(0, 3);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 9999, padding: '2rem'
    }} onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--page-bg, #1a1a1a)', border: '1px solid var(--card-border, #333)',
          borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '800px',
          maxHeight: '90vh', overflowY: 'auto', position: 'relative',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)', color: 'var(--text-color, #fff)'
        }}
      >
        <button onClick={onClose} style={{
          position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'transparent',
          border: 'none', color: 'var(--text-color, #fff)', fontSize: '1.5rem', cursor: 'pointer'
        }}><i className="fas fa-times" />×</button>

        <h2 style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green, #20c997)', marginBottom: '1.5rem' }}>
          <i className="fas fa-chart-pie" /> {selectedProduct} Analytics
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          
          <div style={{ background: 'var(--card-bg, #2a2a2a)', padding: '1.2rem', borderRadius: '12px', border: '1px solid var(--card-border, #444)' }}>
            <h4 style={{ color: 'var(--text-color, #fff)', marginBottom: '1rem', borderBottom: '1px solid var(--card-border, #444)', paddingBottom: '0.5rem' }}>Revenue Timeline</h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}><span>Past 30 Days:</span> <strong>₹{rev30.toFixed(2)}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}><span>Past 2 Months:</span> <strong>₹{rev60.toFixed(2)}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}><span>Past 4 Months:</span> <strong>₹{rev120.toFixed(2)}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}><span>Past 6 Months:</span> <strong>₹{rev180.toFixed(2)}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}><span>Past 1 Year:</span> <strong>₹{rev365.toFixed(2)}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', paddingTop: '0.5rem', borderTop: '2px dashed var(--sea-green, #20c997)' }}>
              <span style={{ color: 'var(--sea-green, #20c997)' }}>Total All Time:</span> <strong style={{ color: 'var(--sea-green, #20c997)' }}>₹{prodTotalRevenue.toFixed(2)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
              <span>Total Units Sold:</span> <strong>{prodTotalCount}</strong>
            </div>
          </div>

          <div style={{ background: 'var(--card-bg, #2a2a2a)', padding: '1.2rem', borderRadius: '12px', border: '1px solid var(--card-border, #444)', maxHeight: '320px', overflowY: 'auto' }}>
            <h4 style={{ color: 'var(--text-color, #fff)', marginBottom: '1rem', borderBottom: '1px solid var(--card-border, #444)', paddingBottom: '0.5rem' }}>Purchased By</h4>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
              <thead><tr><th style={{ paddingBottom: '0.5rem' }}>Buyer</th><th style={{ paddingBottom: '0.5rem' }}>Times</th><th style={{ paddingBottom: '0.5rem', textAlign: 'right' }}>Spent</th></tr></thead>
              <tbody>
                {topPurchasers.length === 0 && <tr><td colSpan={3} style={{ opacity: 0.6, paddingTop: '1rem', textAlign: 'center' }}>No purchasers found</td></tr>}
                {topPurchasers.map((b, i) => (
                  <tr key={i} style={{ borderBottom: i === topPurchasers.length - 1 ? 'none' : '1px solid var(--card-border, #444)' }}>
                    <td style={{ padding: '0.6rem 0' }}>{b.name}</td>
                    <td>{b.count}</td>
                    <td style={{ textAlign: 'right' }}>₹{b.spent.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>

        <h3 style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green, #20c997)', margin: '2rem 0 1rem 0', paddingBottom: '0.5rem', borderBottom: '1px solid var(--card-border, #444)' }}>
           Global Top 3 (All Products)
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          <div style={{ background: 'var(--card-bg, #2a2a2a)', padding: '1.2rem', borderRadius: '12px', border: '1px solid var(--card-border, #444)' }}>
            <h4 style={{ color: '#f39c12', marginBottom: '1rem' }}><i className="fas fa-medal" /> Top Sold Products</h4>
            {topProducts.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem', paddingBottom: '0.5rem', borderBottom: i === topProducts.length - 1 ? 'none' : '1px solid var(--card-border, #444)' }}>
                <div>
                  <strong>{p.name}</strong>
                  <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Sold by: {p.seller}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: 'var(--sea-green, #20c997)', fontWeight: 'bold' }}>{p.count} units</div>
                  <div style={{ fontSize: '0.85rem' }}>₹{p.rev.toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: 'var(--card-bg, #2a2a2a)', padding: '1.2rem', borderRadius: '12px', border: '1px solid var(--card-border, #444)' }}>
            <h4 style={{ color: '#3498db', marginBottom: '1rem' }}><i className="fas fa-crown" /> Top Buyers</h4>
            {topGlobalBuyers.map((b, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem', paddingBottom: '0.5rem', borderBottom: i === topGlobalBuyers.length - 1 ? 'none' : '1px solid var(--card-border, #444)' }}>
                <strong>{b.name}</strong>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: 'var(--sea-green, #20c997)', fontWeight: 'bold' }}>₹{b.spent.toFixed(2)}</div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>{b.count} orders</div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </motion.div>
    </div>
  );
};

const AdminPayments = () => {`;

content = content.replace(/const AdminPayments = \(\) => \{/, modalCode);

// 4. Inject Modal before closing div
content = content.replace(
  /<\/div>\s*<\/div>\s*<\/div>\s*\);\s*};\s*export default AdminPayments;/m,
  `        </div>
        {selectedProduct && <StoreAnalyticsModal store={store} selectedProduct={selectedProduct} onClose={() => setSelectedProduct(null)} />}
      </div>
    </div>
  );
};

export default AdminPayments;`
);

fs.writeFileSync(file, content);
console.log('Patched AdminPayments.jsx with Modal');