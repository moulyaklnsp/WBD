import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAsOrganizer } from '../../utils/fetchWithRole';
import '../../styles/playerNeoNoir.css';
import { motion } from 'framer-motion';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import AnimatedSidebar from '../../components/AnimatedSidebar';
import { organizerLinks } from '../../constants/organizerLinks';

const PER_PAGE = 10;

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

const StoreMonitoring = () => {
  const [isDark, toggleTheme] = usePlayerTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [buyerQuery, setBuyerQuery] = useState('');

  // Products pagination & search
  const [pPage, setPPage] = useState(0);
  const [pAttr, setPAttr] = useState('buyers');
  const [pQuery, setPQuery] = useState('');

  const loadStoreData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchAsOrganizer('/organizer/api/store');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProducts(Array.isArray(data?.products) ? data.products : []);
      setSales(Array.isArray(data?.sales) ? data.sales : []);
      setPPage(0);
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
  const totalRevenue = useMemo(
    () => sales.reduce((sum, s) => sum + parseFloat(s.price || 0), 0),
    [sales]
  );
  const totalBuyers = useMemo(() => {
    const buyers = new Set();
    sales.forEach((s) => {
      const name = String(s.buyer || '').trim();
      if (name) buyers.add(name.toLowerCase());
    });
    return buyers.size;
  }, [sales]);
  const productBuyerCounts = useMemo(() => {
    const map = {};
    sales.forEach((s) => {
      const key = String(s.product || '').toLowerCase();
      if (!key) return;
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [sales]);

  const filteredProducts = useMemo(() => {
    if (!pQuery.trim()) return products;
    const q = pQuery.toLowerCase();
    const getVal = (p) => {
      switch (pAttr) {
        case 'name': return p.name;
        case 'price': return `${p.price}`;
        case 'buyers': return `${productBuyerCounts[String(p?.name || '').toLowerCase()] || 0}`;
        case 'coordinator': return p.coordinator;
        case 'college': return p.college;
        default: return '';
      }
    };
    return products.filter((p) => (getVal(p) || '').toString().toLowerCase().includes(q));
  }, [products, pQuery, pAttr, productBuyerCounts]);

  const selectedProductSales = useMemo(() => {
    if (!selectedProduct?.name) return [];
    const key = String(selectedProduct.name).toLowerCase();
    return sales.filter((s) => String(s.product || '').toLowerCase() === key);
  }, [sales, selectedProduct]);

  const sortedProducts = useMemo(() => {
    const list = [...filteredProducts];
    list.sort((a, b) => {
      const aCount = productBuyerCounts[String(a?.name || '').toLowerCase()] || 0;
      const bCount = productBuyerCounts[String(b?.name || '').toLowerCase()] || 0;
      if (bCount !== aCount) return bCount - aCount;
      return String(a?.name || '').localeCompare(String(b?.name || ''));
    });
    return list;
  }, [filteredProducts, productBuyerCounts]);

  const pStart = pPage * PER_PAGE;
  const pSlice = sortedProducts.slice(pStart, pStart + PER_PAGE);
  const pHasPrev = pPage > 0;
  const pHasNext = pStart + PER_PAGE < sortedProducts.length;

  const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : 'N/A');

  const filteredSelectedSales = useMemo(() => {
    if (!buyerQuery.trim()) return selectedProductSales;
    const q = buyerQuery.toLowerCase();
    return selectedProductSales.filter((s) => {
      const buyer = String(s.buyer || '').toLowerCase();
      const college = String(s.college || '').toLowerCase();
      const date = s.purchase_date ? new Date(s.purchase_date).toLocaleDateString().toLowerCase() : '';
      return buyer.includes(q) || college.includes(q) || date.includes(q);
    });
  }, [selectedProductSales, buyerQuery]);

  const handleProductClick = (product) => {
    setSelectedProduct((prev) => {
      const prevName = String(prev?.name || '').toLowerCase();
      const nextName = String(product?.name || '').toLowerCase();
      return prevName === nextName ? null : product;
    });
    setBuyerQuery('');
  };

  const closeProductDetail = () => setSelectedProduct(null);

  useEffect(() => {
    if (!selectedProduct) return undefined;
    const onEsc = (event) => {
      if (event.key === 'Escape') closeProductDetail();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [selectedProduct]);

  return (
    <div style={{ minHeight: '100vh' }}>
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; }
        body, #root { min-height: 100vh; }
        .page { font-family: 'Playfair Display', serif; background-color: var(--page-bg); min-height: 100vh; display:flex; color: var(--text-color); }
        .content { flex-grow:1; margin-left:0; padding:2rem; }
        h1 { font-family:'Cinzel', serif; color:var(--sea-green); margin-bottom:2rem; font-size:2.5rem; display:flex; align-items:center; gap:1rem; }
        .updates-section { background:var(--card-bg); border-radius:15px; padding:2rem; margin-bottom:2rem; box-shadow:none; border:1px solid var(--card-border); transition: transform 0.3s ease; overflow-x:auto; }
        .updates-section:hover { transform: translateY(-5px); }
        .table { width:100%; border-collapse:collapse; margin-bottom:1rem; }
        .th { background:var(--sea-green); color:var(--on-accent); padding:1.2rem; text-align:left; font-family:'Cinzel', serif; }
        .td { padding:1rem; border-bottom:1px solid rgba(var(--sea-green-rgb, 27, 94, 63), 0.2); vertical-align:middle; }
        .price { font-weight:bold; color:var(--sea-green); }
        .empty { text-align:center; padding:2rem; color:var(--sea-green); font-style:italic; }
        .stats-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1.5rem; margin-bottom:2rem; }
        .stat-card { background:var(--card-bg); padding:1.5rem; border-radius:10px; text-align:center; box-shadow:none; border:1px solid var(--card-border); }
        .stat-value { font-size:1.8rem; font-weight:bold; color:var(--sea-green); margin-bottom:0.5rem; }
        .stat-label { color:var(--text-color); font-size:0.9rem; opacity:0.8; }
        .back-link { display:inline-flex; align-items:center; gap:0.5rem; background-color:var(--sea-green); color:var(--on-accent); text-decoration:none; padding:0.8rem 1.5rem; border-radius:8px; transition:all 0.3s ease; font-family:'Cinzel', serif; font-weight:bold; }
        .pager { text-align:center; margin:1rem 0; display:flex; justify-content:center; gap:1rem; }
        .page-btn { display:inline-flex; align-items:center; gap:0.5rem; background-color:var(--sea-green); color:var(--on-accent); text-decoration:none; padding:0.8rem 1.5rem; border-radius:8px; transition:all 0.3s ease; font-family:'Cinzel', serif; font-weight:bold; cursor:pointer; border:none; }
        .search-bar { display:flex; align-items:center; gap:10px; padding:10px; background:var(--card-bg); border-radius:10px; box-shadow:0 2px 6px rgba(0,0,0,0.1); max-width:500px; margin:20px auto; border:1px solid var(--card-border); }
        .select { padding:10px 14px; border-radius:8px; border:1px solid var(--card-border); background:var(--page-bg); color:var(--text-color); font-size:16px; }
        .input { flex:1; padding:10px 14px; border-radius:8px; border:1px solid var(--card-border); background:var(--page-bg); color:var(--text-color); font-size:16px; min-width:300px; }
        .row-counter { text-align:center; margin-bottom:1rem; font-family:'Cinzel', serif; font-size:1.2rem; color:var(--sea-green); background-color:rgba(var(--sea-green-rgb, 27, 94, 63), 0.1); padding:0.5rem 1rem; border-radius:8px; display:inline-block; }
        .error { color:#c62828; text-align:center; margin-bottom:1rem; }
        .product-card-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:1.4rem; }
        .product-card { position:relative; overflow:hidden; background:linear-gradient(135deg, rgba(var(--sea-green-rgb, 27, 94, 63), 0.2), rgba(0,0,0,0) 60%), var(--card-bg); border:1px solid rgba(var(--sea-green-rgb, 27, 94, 63), 0.35); border-radius:18px; padding:1.4rem; box-shadow:0 12px 24px rgba(0,0,0,0.22); transition:transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease; }
        .product-card { cursor:pointer; }
        .product-card:hover { transform:translateY(-8px); border-color:rgba(var(--sea-green-rgb, 27, 94, 63), 0.85); box-shadow:0 16px 32px rgba(0,0,0,0.28), 0 0 22px rgba(46,139,87,0.25); }
        .product-card.is-selected { border-color:rgba(var(--sea-green-rgb, 27, 94, 63), 0.95); box-shadow:0 18px 36px rgba(0,0,0,0.3), 0 0 26px rgba(46,139,87,0.35); }
        .product-card-top { display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-bottom:1rem; }
        .product-title-block { display:flex; align-items:center; gap:0.9rem; }
        .product-icon { width:46px; height:46px; border-radius:14px; background:radial-gradient(circle at top, rgba(46,139,87,0.4), rgba(46,139,87,0.1)); border:1px solid rgba(46,139,87,0.5); display:flex; align-items:center; justify-content:center; color:var(--sea-green); font-size:1.1rem; }
        .product-card-title { font-family:'Cinzel', serif; color:var(--sea-green); font-size:1.15rem; margin:0; }
        .product-card-subtitle { font-size:0.8rem; opacity:0.7; letter-spacing:0.02em; }
        .product-card-price { font-weight:700; color:var(--on-accent); background:var(--sea-green); padding:0.35rem 0.8rem; border-radius:999px; font-size:0.9rem; box-shadow:0 6px 12px rgba(46,139,87,0.35); }
        .product-meta-list { display:grid; gap:0.6rem; }
        .product-meta-row { display:flex; justify-content:space-between; align-items:center; gap:1rem; padding:0.4rem 0; border-bottom:1px solid rgba(var(--sea-green-rgb, 27, 94, 63), 0.2); }
        .product-meta-row:last-child { border-bottom:none; }
        .product-meta-label { font-family:'Cinzel', serif; font-size:0.78rem; color:var(--sea-green); display:flex; align-items:center; gap:0.4rem; }
        .product-meta-value { font-weight:600; font-size:0.95rem; color:var(--text-color); text-align:right; word-break:break-word; }
        .buyers-modal { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.78); z-index: 3000; display: flex; align-items: center; justify-content: center; padding: 1.2rem; }
        .buyers-panel { width: min(900px, 96vw); max-height: 90vh; overflow-y: auto; padding:1.4rem; border-radius:16px; border:1px solid rgba(var(--sea-green-rgb, 27, 94, 63), 0.4); background:var(--card-bg); box-shadow:0 18px 50px rgba(0,0,0,0.32); }
        .buyers-header { display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-bottom:1rem; }
        .buyers-title { font-family:'Cinzel', serif; color:var(--sea-green); font-size:1.2rem; margin:0; }
        .buyers-subtitle { opacity:0.7; font-size:0.9rem; }
        .buyers-close { background:transparent; border:1px solid var(--card-border); color:var(--text-color); width:32px; height:32px; border-radius:8px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; }
        .buyers-search { display:flex; align-items:center; gap:0.6rem; padding:0.6rem 0.8rem; border-radius:10px; border:1px solid var(--card-border); background:var(--page-bg); margin-bottom:1rem; }
        .buyers-search input { flex:1; border:none; background:transparent; color:var(--text-color); font-size:0.95rem; outline:none; }
        .buyers-list { display:grid; gap:0.6rem; }
        .buyers-row { display:grid; grid-template-columns:1.2fr 1.2fr 0.8fr; gap:0.8rem; padding:0.65rem 0.8rem; border-radius:10px; border:1px solid rgba(var(--sea-green-rgb, 27, 94, 63), 0.2); background:rgba(var(--sea-green-rgb, 27, 94, 63), 0.06); }
        .buyers-row.head { background:rgba(var(--sea-green-rgb, 27, 94, 63), 0.16); font-family:'Cinzel', serif; color:var(--sea-green); font-size:0.85rem; border-color:rgba(var(--sea-green-rgb, 27, 94, 63), 0.3); }
        .buyers-cell { font-weight:600; color:var(--text-color); }
        .buyers-cell.muted { opacity:0.75; font-weight:500; }
        @media (max-width: 900px) {
          .buyers-row { grid-template-columns:1fr; }
          .buyers-row.head { display:none; }
        }
        @media (max-width: 1200px) {
          .product-card-grid { grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); }
        }
        @media (max-width: 768px) {
          .product-card-grid { grid-template-columns:1fr; }
          .product-card { padding:1.1rem; }
          .product-card-top { flex-direction:column; align-items:flex-start; }
          .product-card-price { align-self:flex-start; }
        }
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
          <i className="fas fa-store" />
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
          {/* Products Overview */}
          <div className="products">
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <i className="fas fa-box" /> Products Overview
            </motion.h1>

            {error && <div className="error">{error}</div>}

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value"><i className="fas fa-box" /> <span>{totalProducts}</span></div>
                <div className="stat-label">Total Products</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{formatCurrency(totalInventoryValue)}</div>
                <div className="stat-label">Total Inventory Value</div>
              </div>
              <div className="stat-card">
                <div className="stat-value"><i className="fas fa-users" /> <span>{totalBuyers}</span></div>
                <div className="stat-label">Total Buyers</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{formatCurrency(totalRevenue)}</div>
                <div className="stat-label">Total Revenue</div>
              </div>
            </div>

            <motion.div
              className="updates-section"
              custom={0}
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
            >
              <div className="search-bar">
                <select aria-label="Product attribute" value={pAttr} onChange={(e) => { setPAttr(e.target.value); setPPage(0); }} className="select">
                  <option value="name">Product</option>
                  <option value="price">Price</option>
                  <option value="buyers">Buyers</option>
                  <option value="coordinator">Coordinator</option>
                  <option value="college">College</option>
                </select>
                <input aria-label="Product search" value={pQuery} onChange={(e) => { setPQuery(e.target.value); setPPage(0); }} placeholder="Search products…" className="input" />
              </div>

              {loading ? (
                <p>Loading…</p>
              ) : (
                <>
                  <div style={{ textAlign: 'center' }}>
                    <span className="row-counter">{sortedProducts.length} item(s)</span>
                  </div>
                  {sortedProducts.length === 0 ? (
                    <div className="empty"><i className="fas fa-box-open" /> No products available.</div>
                  ) : (
                    <div className="product-card-grid">
                      {pSlice.map((p, idx) => (
                        (() => {
                          const buyerCount = productBuyerCounts[String(p.name || '').toLowerCase()] || 0;
                          return (
                        <div
                          className={`product-card ${selectedProduct?.name === p.name ? 'is-selected' : ''}`}
                          key={`${p.name}-${idx}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleProductClick(p)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleProductClick(p);
                            }
                          }}
                        >
                          <div className="product-card-top">
                            <div className="product-title-block">
                              <div className="product-icon" aria-hidden="true">
                                <i className="fas fa-box" />
                              </div>
                              <div>
                                <div className="product-card-title">{p.name}</div>
                                <div className="product-card-subtitle">Product</div>
                              </div>
                            </div>
                            <div className="product-card-price">{formatCurrency(p.price)}</div>
                          </div>
                          <div className="product-meta-list">
                            <div className="product-meta-row">
                              <span className="product-meta-label"><i className="fas fa-users" /> Buyers</span>
                              <span className="product-meta-value">{buyerCount}</span>
                            </div>
                            <div className="product-meta-row">
                              <span className="product-meta-label"><i className="fas fa-user" /> Coordinator</span>
                              <span className="product-meta-value">{p.coordinator || 'N/A'}</span>
                            </div>
                            <div className="product-meta-row">
                              <span className="product-meta-label"><i className="fas fa-university" /> College</span>
                              <span className="product-meta-value">{p.college || 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                          );
                        })()
                      ))}
                    </div>
                  )}

                  {selectedProduct && (
                    <div className="buyers-modal" onClick={closeProductDetail}>
                      <motion.div
                        className="buyers-panel"
                        onClick={(event) => event.stopPropagation()}
                        initial={{ opacity: 0, y: 20, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.98 }}
                        transition={{ duration: 0.22 }}
                      >
                        <div className="buyers-header">
                          <div>
                            <h3 className="buyers-title">Buyers for {selectedProduct.name}</h3>
                            <div className="buyers-subtitle">Showing all players who purchased this product.</div>
                          </div>
                          <button type="button" className="buyers-close" onClick={closeProductDetail}>
                            <i className="fas fa-times" />
                          </button>
                        </div>

                        <div className="buyers-search">
                          <i className="fas fa-search" />
                          <input
                            type="text"
                            value={buyerQuery}
                            onChange={(e) => setBuyerQuery(e.target.value)}
                            placeholder="Search buyer, college, or date..."
                            aria-label="Search buyers"
                          />
                        </div>

                        {filteredSelectedSales.length === 0 ? (
                          <div className="empty">No purchases recorded for this product.</div>
                        ) : (
                          <div className="buyers-list">
                            <div className="buyers-row head">
                              <div>Buyer</div>
                              <div>College</div>
                              <div>Date</div>
                            </div>
                            {filteredSelectedSales.map((s, idx) => (
                              <div className="buyers-row" key={`${s.buyer || 'buyer'}-${idx}`}>
                                <div className="buyers-cell">{s.buyer || 'N/A'}</div>
                                <div className="buyers-cell muted">{s.college || 'N/A'}</div>
                                <div className="buyers-cell muted">{formatDate(s.purchase_date)}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    </div>
                  )}

                  <div className="pager">
                    {pHasPrev && (
                      <button type="button" className="page-btn" onClick={() => setPPage((v) => Math.max(0, v - 1))}>
                        <i className="fas fa-chevron-left" /> Previous
                      </button>
                    )}
                    {pHasNext && (
                      <button type="button" className="page-btn" onClick={() => setPPage((v) => v + 1)}>
                        <i className="fas fa-chevron-right" /> Next
                      </button>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </div>

          <div style={{ textAlign: 'right', marginTop: '2rem' }}>
            <Link to="/organizer/organizer_dashboard" className="back-to-dashboard">
              <i className="fas fa-arrow-left" /> Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoreMonitoring;
