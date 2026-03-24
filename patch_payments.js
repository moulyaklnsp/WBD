const fs = require('fs');
const content = fs.readFileSync('frontend/src/pages/admin/AdminPayments.jsx', 'utf8');

const regexStore = /\{\/\*\ 4\.\ Store\ \*\/\}.*?(?=<div style=\{\{ marginTop: '2rem', textAlign: 'right' \}\}>)/s;

let newStore = `{/* 4. Store */}
          <motion.div
            className="updates-section"
            initial={{ opacity: 0, y: 28, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.4, duration: 0.55 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h4 style={{ color: 'var(--sea-green)', fontSize: '1.2rem', fontFamily: 'Cinzel, serif', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <i className="fas fa-shopping-cart" /> Store Purchases Analysis
              </h4>
              <div style={{ background: 'rgba(var(--sea-green-rgb, 27, 94, 63), 0.1)', padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid rgba(var(--sea-green-rgb, 27, 94, 63), 0.3)' }}>
                <span style={{ fontFamily: 'Cinzel, serif', fontWeight: 'bold', color: 'var(--sea-green)' }}>
                  Total Store Revenue: ₹{store.reduce((acc, s) => acc + (Number(s.price) || 0), 0).toFixed(2)}
                </span>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <span className="row-counter">Total Records: {store.length}</span>
            </div>

            {loading ? (
              <div className="empty"><i className="fas fa-info-circle" /> Loading store...</div>
            ) : storeShown.length === 0 ? (
              <div className="empty"><i className="fas fa-info-circle" /> No store transactions found.</div>
            ) : (
              <div className="product-grid">
                {storeShown.map((s, idx) => (
                  <motion.div 
                    key={\`store-\${idx}\`} 
                    whileHover={{ translateY: -5 }}
                    style={{ 
                      background: 'var(--card-bg)', 
                      border: '1px solid var(--card-border)', 
                      borderRadius: '12px', 
                      padding: '1.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: '1.2rem', color: 'var(--sea-green)', margin: '0 0 0.25rem 0', fontFamily: 'Cinzel, serif' }}>{s.item || 'N/A'}</h3>
                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-color)' }}>₹{s.price || 0}</div>
                      </div>
                      <div style={{ background: 'var(--sea-green)', color: 'var(--on-accent)', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 'bold', fontFamily: 'Cinzel, serif' }}>
                        PURCHASED
                      </div>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.8rem', marginTop: '0.5rem', background: 'rgba(0,0,0,0.1)', padding: '1rem', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                        <i className="fas fa-user-tag" style={{ color: 'var(--sea-green)', width: '20px', textAlign: 'center' }} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.75rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '1px' }}>Added By (Coordinator)</span>
                          <span style={{ fontWeight: 'bold' }}>{s.soldBy || 'N/A'}</span>
                        </div>
                      </div>
                      
                      <div style={{ width: '100%', height: '1px', background: 'var(--card-border)' }} />

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                        <i className="fas fa-shopping-bag" style={{ color: 'var(--sky-blue)', width: '20px', textAlign: 'center' }} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.75rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '1px' }}>Bought By</span>
                          <span style={{ fontWeight: 'bold', color: 'var(--sky-blue)' }}>{s.boughtBy || 'N/A'}</span>
                        </div>
                      </div>

                      {s.purchase_date && (
                        <>
                          <div style={{ width: '100%', height: '1px', background: 'var(--card-border)' }} />
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                            <i className="fas fa-calendar-alt" style={{ color: 'gray', width: '20px', textAlign: 'center' }} />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.75rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '1px' }}>Date</span>
                              <span style={{ fontSize: '0.9rem' }}>{new Date(s.purchase_date).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            <div className="pagination" style={{ marginTop: '2rem' }}>
              <button className="page-btn" disabled={pageStore === 1} onClick={() => setPageStore(p => p - 1)}>
                <i className="fas fa-chevron-left" /> Previous
              </button>
              <span className="page-info">Page {pageStore} of {totalPageStore}</span>
              <button className="page-btn" disabled={pageStore === totalPageStore} onClick={() => setPageStore(p => p + 1)}>
                Next <i className="fas fa-chevron-right" />
              </button>
            </div>
          </motion.div>
          `;

const headStyleStr = `.page-info { font-family:'Cinzel', serif; font-weight:bold; color:var(--sea-green); }`;
const extraCSS = `
        .product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; }`;

if (content.includes('4. Store') && content.match(regexStore)) {
  let newContent = content.replace(regexStore, newStore);
  if (!newContent.includes('.product-grid {')) {
    newContent = newContent.replace(headStyleStr, headStyleStr + extraCSS);
  }
  fs.writeFileSync('frontend/src/pages/admin/AdminPayments.jsx', newContent);
  console.log('Successfully updated AdminPayments.jsx with Cards!!!');
} else {
  console.log('Failed to match Store section.');
}
