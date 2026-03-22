import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProducts } from '../../features/products/productsSlice';
import SearchFilter from '../../components/SearchFilter';

// React conversion of views/player/store.html

function PlayerStore() {
  const navigate = useNavigate();
  const [isDark, toggleTheme] = usePlayerTheme();
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [subscription, setSubscription] = useState(null); // {plan}
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const dispatch = useDispatch();
  const productState = useSelector((s) => s.products || {});
  const productsList = productState.products || [];
  const [playerName, setPlayerName] = useState('');
  const [playerCollege, setPlayerCollege] = useState('');
  const [filter, setFilter] = useState({ search: '', category: '' });

  const [addAmount, setAddAmount] = useState('');

  const loadStore = async () => {
    setLoading(true);
    try {
      const res = await fetch('/player/api/store', { credentials: 'include' });
      const data = await res.json();
      setSuccessMessage(data.successMessage || '');
      setErrorMessage(data.errorMessage || '');
      setSubscription(data.subscription || null);
      setDiscountPercentage(data.discountPercentage || 0);
      setWalletBalance(data.walletBalance || 0);
      // products are fetched via Redux slice for consistency
      // setProducts(Array.isArray(data.products) ? data.products : []);
      setPlayerName(data.playerName || '');
      setPlayerCollege(data.playerCollege || '');
    } catch (e) {
      setErrorMessage('Failed to load store data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStore();
    // also populate products in Redux (separate endpoint)
    dispatch(fetchProducts('player'));
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
        body: JSON.stringify({ amount: amountNum }),
      });
      const data = await res.json();
      if (data.success) {
        setWalletBalance(data.walletBalance);
        setSuccessMessage('Funds added successfully!');
        setErrorMessage('');
        setAddAmount('');
      } else {
        alert(data.error || 'Failed to add funds.');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to add funds.');
    }
  };

  const buyProduct = async (product) => {
    // Use discounted price if subscription applies (to match displayed price)
    const discount = discountPercentage > 0 ? (product.price * discountPercentage) / 100 : 0;
    const finalPrice = Number((product.price - discount).toFixed(2));
    const payload = {
      price: finalPrice,
      buyer: playerName,
      college: playerCollege,
      productId: product._id,
    };
    try {
      const res = await fetch('/player/api/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success && typeof data.walletBalance === 'number') {
        setWalletBalance(data.walletBalance);
      }
      alert(data.message || 'Purchase successful!');
      loadStore();
    } catch (err) {
      console.error(err);
      alert('Purchase failed.');
    }
  };

  const styles = {
    root: { fontFamily: 'Playfair Display, serif', lineHeight: 1.6, backgroundColor: 'var(--page-bg)', color: 'var(--text-color)', minHeight: '100vh' },
    container: { maxWidth: 1200, margin: '0 auto', padding: '2rem' },
    h1: { fontFamily: 'Cinzel, serif', fontSize: '2.5rem', textAlign: 'center', marginBottom: '2rem', color: 'var(--sea-green)' },
    alert: { padding: '1rem', borderRadius: 4, marginBottom: '1rem' },
    success: { backgroundColor: 'rgba(46,139,87,0.12)', border: '1px solid rgba(46,139,87,0.2)', color: 'var(--sea-green)' },
    error: { backgroundColor: 'rgba(255,107,107,0.12)', border: '1px solid rgba(255,107,107,0.2)', color: '#721c24' },
    subscriptionSection: { background: 'var(--content-bg)', padding: '1.5rem', borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginBottom: '1.5rem' },
    subscribeBox: { textAlign: 'center' },
    subscriptionInfo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' },
    wallet: { backgroundColor: 'var(--sea-green)', color: 'var(--content-bg)', padding: 20, borderRadius: 10, textAlign: 'center', marginBottom: '1.5rem' },
    walletH3: { color: 'var(--content-bg)', marginTop: 0, marginBottom: '1rem' },
    walletForm: { display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 300, margin: '0 auto' },
    walletInput: { width: '100%', padding: 12, border: '2px solid var(--sea-green)', borderRadius: 5, fontSize: 16, boxSizing: 'border-box', background: 'var(--content-bg)', color: 'var(--text-color)' },
    walletButton: { backgroundColor: 'var(--sky-blue)', color: 'var(--sea-green)', border: 'none', padding: '12px 24px', borderRadius: 5, cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.3s ease', fontFamily: 'Cinzel, serif', textAlign: 'center', width: '100%', boxSizing: 'border-box' },
    productsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' },
    card: { background: 'var(--content-bg)', padding: '1.5rem', borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    productIcon: { fontSize: '2rem', textAlign: 'center', marginBottom: '1rem' },
    productTitle: { fontFamily: 'Cinzel, serif', textAlign: 'center', marginBottom: '0.5rem', color: 'var(--sea-green)' },
    availability: { color: 'var(--text-color)', textAlign: 'center', marginBottom: '1rem' },
    priceDetails: { textAlign: 'center', marginBottom: '1rem' },
    originalPrice: { textDecoration: 'line-through', color: 'var(--text-color)' },
    discount: { color: 'var(--sea-green)' },
    finalPrice: { fontSize: '1.25rem', fontWeight: 'bold', marginTop: '0.5rem' },
    primaryBtn: { backgroundColor: 'var(--sea-green)', color: 'var(--content-bg)', border: 'none', padding: '0.5rem 1rem', borderRadius: 4, cursor: 'pointer', fontWeight: 500 },
    secondaryLink: { display: 'inline-flex', alignItems: 'center', backgroundColor: 'var(--sea-green)', color: 'var(--content-bg)', textDecoration: 'none', padding: '0.5rem 1rem', borderRadius: 4, fontWeight: 500 },
    backRow: { textAlign: 'center', marginTop: '2rem' },
  };

  const filteredProducts = (productsList || []).filter(p => (
    (p?.availability ?? 0) > 0 &&
    (!filter.category || String(p.category || '').toLowerCase() === String(filter.category || '').toLowerCase()) &&
    (!filter.search || String(p.name || '').toLowerCase().includes(String(filter.search || '').toLowerCase()))
  ));

  const renderSubscription = () => {
    if (!subscription) {
      return (
        <div style={styles.subscribeBox}>
          <h2 style={{ ...styles.productTitle, marginBottom: '1rem' }}>Subscribe for Discounts</h2>
          <button
            type="button"
            style={{ ...styles.primaryBtn, padding: '12px 24px', fontFamily: 'Cinzel, serif' }}
            onClick={() => navigate('/player/subscription')}
          >
            Subscribe Now
          </button>
        </div>
      );
    }
    return (
      <div style={styles.subscriptionInfo}>
        <span>Subscription Plan: {subscription.plan}</span>
        <span>(Discount: {discountPercentage}%)</span>
      </div>
    );
  };

  const renderProductPrice = (product) => {
    if (discountPercentage > 0) {
      const discount = (product.price * discountPercentage) / 100;
      const final = (product.price - discount).toFixed(2);
      return (
        <div style={styles.priceDetails}>
          <p style={styles.originalPrice}>Original: ₹{product.price}</p>
          <p style={styles.discount}>Discount ({discountPercentage}%): ₹{discount.toFixed(2)}</p>
          <p style={styles.finalPrice}>Now: ₹{final}</p>
        </div>
      );
    }
    return <div style={styles.priceDetails}><p>Price: ₹{product.price}</p></div>;
  };

  return (
    <div style={styles.root}>
      <div style={styles.container}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={styles.h1}>ChessHive Store</h1>

        </div>

        {/* Alerts */}
        {successMessage ? (
          <div style={{ ...styles.alert, ...styles.success }}>{successMessage}</div>
        ) : null}
        {errorMessage ? (
          <div style={{ ...styles.alert, ...styles.error }}>{errorMessage}</div>
        ) : null}

        {/* Subscription */}
        <div style={styles.subscriptionSection}>
          {renderSubscription()}
        </div>

        {/* Wallet */}
        <div style={styles.wallet}>
          <span role="img" aria-label="wallet">💰</span>
          <h3 style={styles.walletH3}>Wallet Balance: ₹<span>{walletBalance}</span></h3>
          <form onSubmit={addFunds} style={styles.walletForm}>
            <input
              type="number"
              placeholder="Enter amount"
              min="1"
              required
              value={addAmount}
              onChange={(e) => setAddAmount(e.target.value)}
              style={styles.walletInput}
            />
            <button type="submit" style={styles.walletButton}>Add Funds</button>
          </form>
        </div>

        {/* Products */}
        {loading ? (
          <p>Loading products...</p>
        ) : (
          <>
            <SearchFilter search={filter.search} category={filter.category} categories={[...new Set(productsList.map(p => p.category).filter(Boolean))]} onChange={setFilter} />
            <div style={styles.productsGrid}>
              {filteredProducts.length === 0 ? (
                <div>No products available.</div>
              ) : (
                filteredProducts.map((product) => (
                  <div key={product._id} style={styles.card} data-category={product.category}>
                    <div style={styles.productIcon}>🛍️</div>
                    <h3 style={styles.productTitle}>{product.name}</h3>
                    <h3 style={styles.productTitle}>{product.category}</h3>
                    <p style={styles.availability}>Available: {product.availability}</p>
                    {renderProductPrice(product)}
                    <button type="button" style={styles.primaryBtn} onClick={() => buyProduct(product)}>Buy</button>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        <div style={styles.backRow}>
          <Link to="/player/player_dashboard" style={styles.secondaryLink}>← Back to Dashboard</Link>
        </div>
      </div>
    </div>
  );
}

export default PlayerStore;
