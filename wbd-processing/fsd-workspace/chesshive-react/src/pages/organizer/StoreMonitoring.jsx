import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const PER_PAGE = 10;

const StoreMonitoring = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);

  // Products pagination & search
  const [pPage, setPPage] = useState(0);
  const [pAttr, setPAttr] = useState('name');
  const [pQuery, setPQuery] = useState('');

  // Sales pagination & search
  const [sPage, setSPage] = useState(0);
  const [sAttr, setSAttr] = useState('product');
  const [sQuery, setSQuery] = useState('');

  const loadStoreData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/organizer/api/store', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProducts(Array.isArray(data?.products) ? data.products : []);
      setSales(Array.isArray(data?.sales) ? data.sales : []);
      setPPage(0);
      setSPage(0);
    } catch (e) {
      setError('Error loading store data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStoreData(); }, [loadStoreData]);

  const formatCurrency = (n) => `₹${Number(n || 0).toFixed(2)}`;

  // Derived stats
  const totalProducts = products.length;
  const totalInventoryValue = useMemo(
    () => products.reduce((sum, p) => sum + parseFloat(p.price || 0), 0),
    [products]
  );
  const totalSalesCount = sales.length;
  const totalRevenue = useMemo(
    () => sales.reduce((sum, s) => sum + parseFloat(s.price || 0), 0),
    [sales]
  );

  const filteredProducts = useMemo(() => {
    if (!pQuery.trim()) return products;
    const q = pQuery.toLowerCase();
    const getVal = (p) => {
      switch (pAttr) {
        case 'name': return p.name;
        case 'price': return `${p.price}`;
        case 'coordinator': return p.coordinator;
        case 'college': return p.college;
        default: return '';
      }
    };
    return products.filter((p) => (getVal(p) || '').toString().toLowerCase().includes(q));
  }, [products, pQuery, pAttr]);

  const filteredSales = useMemo(() => {
    if (!sQuery.trim()) return sales;
    const q = sQuery.toLowerCase();
    const getVal = (s) => {
      switch (sAttr) {
        case 'product': return s.product;
        case 'price': return `${s.price}`;
        case 'coordinator': return s.coordinator;
        case 'buyer': return s.buyer;
        case 'college': return s.college;
        case 'date': return s.purchase_date ? new Date(s.purchase_date).toLocaleDateString() : '';
        default: return '';
      }
    };
    return sales.filter((s) => (getVal(s) || '').toString().toLowerCase().includes(q));
  }, [sales, sQuery, sAttr]);

  const pStart = pPage * PER_PAGE;
  const pSlice = filteredProducts.slice(pStart, pStart + PER_PAGE);
  const pHasPrev = pPage > 0;
  const pHasNext = pStart + PER_PAGE < filteredProducts.length;

  const sStart = sPage * PER_PAGE;
  const sSlice = filteredSales.slice(sStart, sStart + PER_PAGE);
  const sHasPrev = sPage > 0;
  const sHasNext = sStart + PER_PAGE < filteredSales.length;

  const theme = {
    page: { fontFamily: 'Playfair Display, serif', backgroundColor: '#FFFDD0', minHeight: '100vh', padding: '2rem' },
    container: { maxWidth: 1200, margin: '0 auto 2rem auto' },
    h2: { fontFamily: 'Cinzel, serif', fontSize: '2.5rem', color: '#2E8B57', marginBottom: '2rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' },
    tableDiv: { background: 'var(--card-bg)', borderRadius: 15, padding: '2rem', boxShadow: 'none', border: '1px solid var(--card-border)', overflowX: 'auto' },
    th: { backgroundColor: '#2E8B57', color: '#FFFDD0', padding: '1.2rem', textAlign: 'left', fontFamily: 'Cinzel, serif' },
    td: { padding: '1rem', borderBottom: '1px solid rgba(46,139,87,0.2)', verticalAlign: 'middle' },
    price: { fontWeight: 'bold', color: '#2E8B57' },
    empty: { textAlign: 'center', padding: '2rem', color: '#2E8B57', fontStyle: 'italic' },
    statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' },
    statCard: { background: 'var(--card-bg)', padding: '1.5rem', borderRadius: 10, textAlign: 'center', boxShadow: 'none', border: '1px solid var(--card-border)' },
    statValue: { fontSize: '1.8rem', fontWeight: 'bold', color: '#2E8B57', marginBottom: '.5rem' },
    statLabel: { color: '#666', fontSize: '.9rem' },
    backRight: { textAlign: 'right', marginTop: '2rem' },
    backLink: { display: 'inline-flex', alignItems: 'center', gap: '.5rem', backgroundColor: '#2E8B57', color: '#FFFDD0', textDecoration: 'none', padding: '.8rem 1.5rem', borderRadius: 8, transition: 'all .3s ease', fontFamily: 'Cinzel, serif', fontWeight: 'bold' },
    pager: { textAlign: 'center', margin: '1rem 0', display: 'flex', justifyContent: 'center', gap: '1rem' },
    pageBtn: { display: 'inline-flex', alignItems: 'center', gap: '.5rem', backgroundColor: '#87CEEB', color: '#2E8B57', textDecoration: 'none', padding: '.8rem 1.5rem', borderRadius: 8, transition: 'all .3s ease', fontFamily: 'Cinzel, serif', fontWeight: 'bold', cursor: 'pointer' },
    searchBar: { display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: '#f5f5f5', borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.1)', maxWidth: 500, margin: '20px auto' },
    select: { padding: '8px 12px', borderRadius: 8, border: '1px solid var(--card-border)', backgroundColor: 'var(--card-bg)', fontSize: 14 },
    input: { flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #ccc', fontSize: 14 },
    rowCounter: { textAlign: 'center', marginBottom: '1rem', fontFamily: 'Cinzel, serif', fontSize: '1.2rem', color: '#2E8B57', backgroundColor: 'rgba(46,139,87,0.1)', padding: '.5rem 1rem', borderRadius: 8, display: 'inline-block' },
    error: { color: '#c62828', textAlign: 'center', marginBottom: '1rem' },
  };

  return (
    <div style={theme.page}>
      {/* Products Overview */}
      <div style={theme.container} className="products">
        <h2 style={theme.h2}><span role="img" aria-label="bag">🛍️</span> Products Overview</h2>

        {error && <div style={theme.error}>{error}</div>}

        <div style={theme.statsGrid}>
          <div style={theme.statCard}>
            <div style={theme.statValue}><i className="fas fa-box" /> <span>{totalProducts}</span></div>
            <div style={theme.statLabel}>Total Products</div>
          </div>
          <div style={theme.statCard}>
            <div style={theme.statValue}>{formatCurrency(totalInventoryValue)}</div>
            <div style={theme.statLabel}>Total Inventory Value</div>
          </div>
          <div style={{ textAlign: 'right', marginBottom: '1rem' }}>
            <Link to="/organizer/sales_analysis" style={theme.backLink}><i className="fas fa-chart-line" /> View Sales Analysis</Link>
          </div>
        </div>

        <div style={theme.tableDiv}>
          <div style={theme.searchBar}>
            <select aria-label="Product attribute" value={pAttr} onChange={(e) => { setPAttr(e.target.value); setPPage(0); }} style={theme.select}>
              <option value="name">Product</option>
              <option value="price">Price</option>
              <option value="coordinator">Coordinator</option>
              <option value="college">College</option>
            </select>
            <input aria-label="Product search" value={pQuery} onChange={(e) => { setPQuery(e.target.value); setPPage(0); }} placeholder="Search products…" style={theme.input} />
          </div>

          {loading ? (
            <p>Loading…</p>
          ) : (
            <>
              <div style={{ textAlign: 'center' }}>
                <span style={theme.rowCounter}>{filteredProducts.length} item(s)</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
                <thead>
                  <tr>
                    <th style={theme.th}><i className="fas fa-tag" /> Product</th>
                    <th style={theme.th}><i className="fas fa-rupee-sign" /> Price</th>
                    <th style={theme.th}><i className="fas fa-user" /> Coordinator</th>
                    <th style={theme.th}><i className="fas fa-university" /> College</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.length === 0 ? (
                    <tr><td colSpan={4} style={theme.empty}><i className="fas fa-box-open" /> No products available.</td></tr>
                  ) : (
                    pSlice.map((p, idx) => (
                      <tr key={`${p.name}-${idx}`}>
                        <td style={theme.td}>{p.name}</td>
                        <td style={{ ...theme.td, ...theme.price }}>{formatCurrency(p.price)}</td>
                        <td style={theme.td}>{p.coordinator || 'N/A'}</td>
                        <td style={theme.td}>{p.college || 'N/A'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <div style={theme.pager}>
                {pHasPrev && (
                  <button type="button" style={theme.pageBtn} onClick={() => setPPage((v) => Math.max(0, v - 1))}>
                    <i className="fas fa-chevron-left" /> Previous
                  </button>
                )}
                {pHasNext && (
                  <button type="button" style={theme.pageBtn} onClick={() => setPPage((v) => v + 1)}>
                    <i className="fas fa-chevron-right" /> Next
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Sales Report */}
      <div style={theme.container} className="sales">
        <h2 style={theme.h2}><span role="img" aria-label="bar">📊</span> Sales Report</h2>

        <div style={theme.statsGrid}>
          <div style={theme.statCard}>
            <div style={theme.statValue}><i className="fas fa-shopping-cart" /> <span>{totalSalesCount}</span></div>
            <div style={theme.statLabel}>Total Sales</div>
          </div>
          <div style={theme.statCard}>
            <div style={theme.statValue}>{formatCurrency(totalRevenue)}</div>
            <div style={theme.statLabel}>Total Revenue</div>
          </div>
        </div>

        <div style={theme.tableDiv}>
          <div style={theme.searchBar}>
            <select aria-label="Sales attribute" value={sAttr} onChange={(e) => { setSAttr(e.target.value); setSPage(0); }} style={theme.select}>
              <option value="product">Product</option>
              <option value="price">Price</option>
              <option value="coordinator">Coordinator</option>
              <option value="buyer">Buyer</option>
              <option value="college">College</option>
              <option value="date">Date</option>
            </select>
            <input aria-label="Sales search" value={sQuery} onChange={(e) => { setSQuery(e.target.value); setSPage(0); }} placeholder="Search sales…" style={theme.input} />
          </div>

          {loading ? (
            <p>Loading…</p>
          ) : (
            <>
              <div style={{ textAlign: 'center' }}>
                <span style={theme.rowCounter}>{filteredSales.length} record(s)</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
                <thead>
                  <tr>
                    <th style={theme.th}><i className="fas fa-tag" /> Product</th>
                    <th style={theme.th}><i className="fas fa-rupee-sign" /> Price</th>
                    <th style={theme.th}><i className="fas fa-user" /> Coordinator</th>
                    <th style={theme.th}><i className="fas fa-user-check" /> Buyer</th>
                    <th style={theme.th}><i className="fas fa-university" /> College</th>
                    <th style={theme.th}><i className="fas fa-calendar" /> Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.length === 0 ? (
                    <tr><td colSpan={6} style={theme.empty}><i className="fas fa-shopping-cart" /> No sales recorded.</td></tr>
                  ) : (
                    sSlice.map((s, idx) => (
                      <tr key={`${s.product}-${s.buyer}-${idx}`}>
                        <td style={theme.td}>{s.product}</td>
                        <td style={{ ...theme.td, ...theme.price }}>{formatCurrency(s.price)}</td>
                        <td style={theme.td}>{s.coordinator || 'N/A'}</td>
                        <td style={theme.td}>{s.buyer || 'N/A'}</td>
                        <td style={theme.td}>{s.college || 'N/A'}</td>
                        <td style={theme.td}>{s.purchase_date ? new Date(s.purchase_date).toLocaleDateString() : ''}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <div style={theme.pager}>
                {sHasPrev && (
                  <button type="button" style={theme.pageBtn} onClick={() => setSPage((v) => Math.max(0, v - 1))}>
                    <i className="fas fa-chevron-left" /> Previous
                  </button>
                )}
                {sHasNext && (
                  <button type="button" style={theme.pageBtn} onClick={() => setSPage((v) => v + 1)}>
                    <i className="fas fa-chevron-right" /> Next
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <div style={theme.backRight}>
          <Link to="/organizer/organizer_dashboard" style={theme.backLink}>
            <i className="fas fa-arrow-left" /> Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default StoreMonitoring;
