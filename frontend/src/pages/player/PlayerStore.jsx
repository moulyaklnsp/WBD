import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProducts } from '../../features/products/productsSlice';
import { fetchAsPlayer, safePost } from '../../utils/fetchWithRole';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import SearchFilter from '../../components/SearchFilter';
import PaymentGatewayModal from '../../components/PaymentGatewayModal';

const NAV_ITEMS = [
  { key: 'Store',    icon: 'fas fa-store',         label: 'Store' },
  { key: 'Cart',     icon: 'fas fa-shopping-cart',  label: 'Cart' },
  { key: 'Orders',   icon: 'fas fa-receipt',        label: 'Orders' },
  { key: 'Delivery', icon: 'fas fa-truck',          label: 'Delivery' },
];

const ORDER_STATUSES = [
  { key: 'all',        label: 'All Orders',  icon: 'fas fa-list' },
  { key: 'pending',    label: 'Pending',     icon: 'fas fa-clock' },
  { key: 'processing', label: 'Processing',  icon: 'fas fa-cog' },
  { key: 'packed',     label: 'Packed',      icon: 'fas fa-box' },
  { key: 'delivered',  label: 'Delivered',   icon: 'fas fa-check-circle' },
  { key: 'cancelled',  label: 'Cancelled',   icon: 'fas fa-times-circle' },
];

const MAX_WALLET_BALANCE = 100000;

function PlayerStore() {
  const navigate = useNavigate();
  usePlayerTheme();
  const dispatch = useDispatch();
  const productState = useSelector((s) => s.products || {});
  const productsList = productState.products || [];

  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('Store');
  const [navOpen, setNavOpen] = useState(false);
  const navRef = useRef(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Store data
  const [subscription, setSubscription] = useState(null);
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [playerName, setPlayerName] = useState('');
  const [playerCollege, setPlayerCollege] = useState('');
  const [filter, setFilter] = useState({ search: '', category: '' });
  const [showPayment, setShowPayment] = useState(false);

  // Cart state
  const [cart, setCart] = useState([]);
  const [cartLoading, setCartLoading] = useState(false);

  // Orders state
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [lightbox, setLightbox] = useState(null); // { images: [], index: 0, zoom: 1 }
  const [trackingOrder, setTrackingOrder] = useState(null);
  const [orderFilter, setOrderFilter] = useState('all');
  const [orderStatusOpen, setOrderStatusOpen] = useState(false);
  const orderStatusRef = useRef(null);
  const [orderSearch, setOrderSearch] = useState('');

  // Suggestions
  const [suggestions, setSuggestions] = useState({ suggested: [], mostOrdered: [] });
  const [productImageIndex, setProductImageIndex] = useState({});
  const [selectedProductForReviews, setSelectedProductForReviews] = useState(null);
  const [reviewsData, setReviewsData] = useState({ reviews: [], avgRating: 0, totalReviews: 0 });
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });

  // Purchase flow
  const [purchaseModal, setPurchaseModal] = useState(null); // null | { mode: 'buyNow'|'cart', product?: obj }
  const [purchaseStep, setPurchaseStep] = useState('confirm'); // confirm | gateway | processing | success | error
  const [purchaseError, setPurchaseError] = useState('');

  const flash = (msg, isError = false) => {
    if (isError) { setErrorMsg(msg); setSuccessMsg(''); }
    else { setSuccessMsg(msg); setErrorMsg(''); }
    setTimeout(() => { setSuccessMsg(''); setErrorMsg(''); }, 3000);
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setNavOpen(false);
      if (orderStatusRef.current && !orderStatusRef.current.contains(e.target)) setOrderStatusOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ─── Data Loading ─── */
  const loadStore = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAsPlayer(`/player/api/store?_t=${Date.now()}`);
      let data;
      try { const text = await res.text(); data = JSON.parse(text); } catch { data = {}; }
      setSubscription(data.subscription || null);
      setDiscountPercentage(data.discountPercentage || 0);
      setWalletBalance(Math.min(data.walletBalance || 0, MAX_WALLET_BALANCE));
      setPlayerName(data.playerName || '');
      setPlayerCollege(data.playerCollege || '');
    } catch { flash('Failed to load store data', true); }
    finally { setLoading(false); }
  }, []);

  const loadCart = useCallback(async () => {
    setCartLoading(true);
    try {
      const res = await fetchAsPlayer(`/player/api/cart?_t=${Date.now()}`);
      if (res.ok) {
        let data;
        try { const text = await res.text(); data = JSON.parse(text); } catch { data = { items: [] }; }
        setCart(data.items || []);
      } else { setCart([]); }
    } catch (err) { console.error('Failed to load cart:', err); setCart([]); }
    finally { setCartLoading(false); }
  }, []);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const res = await fetchAsPlayer(`/player/api/orders?_t=${Date.now()}`);
      if (res.ok) {
        let data;
        try { const text = await res.text(); data = JSON.parse(text); } catch { data = { orders: [] }; }
        setOrders(data.orders || []);
      } else { setOrders([]); }
    } catch (err) { console.error('Failed to load orders:', err); setOrders([]); }
    finally { setOrdersLoading(false); }
  }, []);

  const loadSuggestions = useCallback(async () => {
    try {
      const res = await fetchAsPlayer(`/player/api/store/suggestions?_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions({ suggested: data.suggested || [], mostOrdered: data.mostOrdered || [] });
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadStore();
    dispatch(fetchProducts('player'));
    loadSuggestions();
  }, [loadStore, dispatch, loadSuggestions]);

  useEffect(() => {
    if (view === 'Cart') loadCart();
    if (view === 'Orders' || view === 'Delivery') loadOrders();
  }, [view, loadCart, loadOrders]);

  /* ─── Cart Actions ─── */
  const addToCart = async (product) => {
    try {
      const res = await safePost('/player/api/cart/add', { productId: product._id, quantity: 1 });
      if (res.ok) { flash('Added to cart!'); loadCart(); }
      else { const d = await res.json().catch(() => ({})); flash(d.message || 'Failed', true); }
    } catch (e) { flash(e.message || 'Failed to add', true); }
  };

  const removeFromCart = async (productId) => {
    try {
      const pid = typeof productId === 'object' ? productId.toString() : productId;
      const res = await fetchAsPlayer('/player/api/cart/remove', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: pid }) });
      if (res.ok) { loadCart(); flash('Removed from cart'); }
      else flash('Failed to remove item', true);
    } catch { flash('Failed to remove item', true); }
  };

  const updateCartQty = async (productId, newQty) => {
    if (newQty < 1) { removeFromCart(productId); return; }
    try {
      const pid = typeof productId === 'object' ? productId.toString() : productId;
      await fetchAsPlayer('/player/api/cart/remove', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: pid }) });
      await safePost('/player/api/cart/add', { productId: pid, quantity: newQty });
      loadCart();
    } catch { flash('Failed to update quantity', true); }
  };

  const clearCart = async () => {
    if (!window.confirm('Clear entire cart?')) return;
    try {
      const res = await fetchAsPlayer('/player/api/cart/clear', { method: 'DELETE' });
      if (res.ok) { setCart([]); flash('Cart cleared'); }
    } catch { /* ignore */ }
  };

  /* ─── Purchase Flow ─── */
  const openPurchaseModal = (mode, product) => {
    setPurchaseModal({ mode, product: product || null });
    setPurchaseStep('confirm');
    setPurchaseError('');
  };

  const closePurchaseModal = () => {
    setPurchaseModal(null);
    setPurchaseStep('confirm');
    setPurchaseError('');
  };

  const executePurchase = async () => {
    if (!purchaseModal) return;
    setPurchaseStep('processing');
    setPurchaseError('');

    try {
      await new Promise(r => setTimeout(r, 600));

      if (purchaseModal.mode === 'buyNow' && purchaseModal.product) {
        const product = purchaseModal.product;
        const discount = discountPercentage > 0 ? (product.price * discountPercentage) / 100 : 0;
        const finalPrice = Number((product.price - discount).toFixed(2));
        const res = await safePost('/player/api/buy', { price: finalPrice, buyer: playerName, college: playerCollege, productId: product._id });
        const data = await res.json();
        if (data.success && typeof data.walletBalance === 'number') setWalletBalance(Math.min(data.walletBalance, MAX_WALLET_BALANCE));
        if (!res.ok && !data.success) throw new Error(data.message || data.error || 'Purchase failed');
        setPurchaseStep('success');
        flash(data.message || 'Purchase successful!');
        loadStore();
        dispatch(fetchProducts('player'));
        setTimeout(() => { closePurchaseModal(); setView('Delivery'); loadOrders(); }, 1800);
      } else if (purchaseModal.mode === 'cart') {
        if (!cart.length) throw new Error('Cart is empty');
        const res = await safePost('/player/api/orders', { fromCart: true });
        if (res.ok) {
          const data = await res.json();
          setWalletBalance(Math.min(data.walletBalance ?? walletBalance, MAX_WALLET_BALANCE));
          setPurchaseStep('success');
          flash('Order placed successfully!');
          setCart([]);
          dispatch(fetchProducts('player'));
          setTimeout(() => { closePurchaseModal(); setView('Delivery'); loadOrders(); }, 1800);
        } else {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.message || 'Checkout failed');
        }
      }
    } catch (e) {
      setPurchaseStep('error');
      setPurchaseError(e.message || 'Something went wrong');
    }
  };

  /* ─── Order Actions ─── */
  const cancelOrder = async (orderId) => {
    if (!window.confirm('Cancel this order?')) return;
    try {
      const res = await safePost(`/player/api/orders/${orderId}/cancel`, {});
      if (res.ok) {
        const data = await res.json();
        if (data.walletBalance != null) setWalletBalance(Math.min(data.walletBalance, MAX_WALLET_BALANCE));
        flash('Order cancelled');
        loadOrders();
      } else {
        const d = await res.json().catch(() => ({}));
        flash(d.message || 'Cancel failed', true);
      }
    } catch (e) { flash(e.message || 'Cancel failed', true); }
  };

  const viewTracking = async (orderId) => {
    try {
      const res = await fetchAsPlayer(`/player/api/orders/${orderId}/tracking`);
      if (res.ok) {
        const data = await res.json();
        setTrackingOrder(data);
      }
    } catch { /* ignore */ }
  };

  /* ─── Product Helpers ─── */
  const getProductImages = (product) => {
    return Array.from(new Set([
      ...(Array.isArray(product?.image_urls)
        ? product.image_urls
        : (typeof product?.image_urls === 'string'
            ? product.image_urls.split(',').map((s) => s.trim())
            : [])),
      product?.image_url,
      product?.imageUrl,
      product?.image
    ].filter(Boolean)));
  };

  const openProductReviews = async (product) => {
    if (!product?._id) return;
    setSelectedProductForReviews(product);
    setReviewsLoading(true);
    setReviewForm({ rating: 5, comment: '' });
    try {
      const res = await fetchAsPlayer(`/player/api/reviews/${product._id}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to load reviews');
      setReviewsData({
        reviews: Array.isArray(data.reviews) ? data.reviews : [],
        avgRating: Number(data.avgRating || 0),
        totalReviews: Number(data.totalReviews || 0)
      });
    } catch (e) {
      flash(e?.data?.error || e?.message || 'Failed to load reviews', true);
      setReviewsData({ reviews: [], avgRating: 0, totalReviews: 0 });
    } finally { setReviewsLoading(false); }
  };

  const submitProductReview = async () => {
    if (!selectedProductForReviews?._id) return;
    setReviewSubmitting(true);
    try {
      const res = await safePost('/player/api/reviews', {
        product_id: selectedProductForReviews._id,
        rating: Number(reviewForm.rating),
        comment: reviewForm.comment
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || data.message || 'Failed to submit review');
      flash(data.message || 'Review submitted');
      await openProductReviews(selectedProductForReviews);
      await dispatch(fetchProducts('player'));
    } catch (e) {
      flash(e?.data?.error || e?.message || 'Failed to submit review', true);
    } finally { setReviewSubmitting(false); }
  };

  /* ─── Computed ─── */
  const filteredProducts = (productsList || []).filter(p =>
    (p?.availability ?? 0) > 0 &&
    (!filter.category || String(p.category || '').toLowerCase() === filter.category.toLowerCase()) &&
    (!filter.search || String(p.name || '').toLowerCase().includes(filter.search.toLowerCase()))
  );

  const cartTotal = cart.reduce((sum, item) => {
    const disc = discountPercentage > 0 ? (item.price * discountPercentage) / 100 : 0;
    return sum + ((item.price - disc) * (item.quantity || 1));
  }, 0);

  const filteredOrders = orders.filter(o => {
    if (orderFilter !== 'all' && (o.status || 'pending') !== orderFilter) return false;
    if (orderSearch) {
      const q = orderSearch.toLowerCase();
      const matchId = (o._id || '').toLowerCase().includes(q);
      const matchItem = (o.items || []).some(i => (i.name || '').toLowerCase().includes(q));
      if (!matchId && !matchItem) return false;
    }
    return true;
  });

  const deliveryOrders = orders.filter(o =>
    ['pending', 'processing', 'packed', 'shipped'].includes(o.status || 'pending')
  );

  const orderStats = {
    total: orders.length,
    pending: orders.filter(o => (o.status || 'pending') === 'pending').length,
    processing: orders.filter(o => o.status === 'processing').length,
    packed: orders.filter(o => o.status === 'packed').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
  };

  const renderPrice = (price) => {
    if (discountPercentage > 0) {
      const disc = (price * discountPercentage) / 100;
      return (
        <div>
          <span style={{ textDecoration: 'line-through', opacity: 0.6, marginRight: '0.5rem' }}>₹{price}</span>
          <span style={{ color: 'var(--sea-green)', fontWeight: 'bold' }}>₹{(price - disc).toFixed(2)}</span>
          <span style={{ fontSize: '0.8rem', marginLeft: '0.3rem', color: 'var(--sea-green)' }}>(-{discountPercentage}%)</span>
        </div>
      );
    }
    return <span style={{ fontWeight: 'bold' }}>₹{price}</span>;
  };

  const getPurchaseTotal = () => {
    if (!purchaseModal) return 0;
    if (purchaseModal.mode === 'buyNow' && purchaseModal.product) {
      const p = purchaseModal.product;
      const disc = discountPercentage > 0 ? (p.price * discountPercentage) / 100 : 0;
      return Number((p.price - disc).toFixed(2));
    }
    return cartTotal;
  };

  const activeNav = NAV_ITEMS.find(n => n.key === view) || NAV_ITEMS[0];

  return (
    <div>
      <style>{`
        .page{ font-family:'Playfair Display', serif; background-color:var(--page-bg); color:var(--text-color); min-height:100vh; padding:2rem; }
        .store-wrap{ max-width:1200px; margin:0 auto; }
        .store-header{ display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1rem; margin-bottom:1.5rem; }
        .store-title{ font-family:'Cinzel',serif; color:var(--sea-green); margin:0; font-size:2rem; }

        /* ─── Dropdown Nav ─── */
        .nav-dropdown{ position:relative; z-index:100; }
        .nav-trigger{ display:flex; align-items:center; gap:0.75rem; padding:0.75rem 1.25rem; background:var(--card-bg); border:2px solid var(--card-border); border-radius:12px; cursor:pointer; font-family:'Cinzel',serif; font-weight:bold; font-size:1rem; color:var(--text-color); transition:all 0.2s; min-width:200px; justify-content:space-between; }
        .nav-trigger:hover{ border-color:var(--sea-green); }
        .nav-trigger.open{ border-color:var(--sea-green); border-radius:12px 12px 0 0; }
        .nav-trigger i.chevron{ transition:transform 0.3s; font-size:0.75rem; }
        .nav-trigger.open i.chevron{ transform:rotate(180deg); }
        .nav-menu{ position:absolute; top:100%; left:0; right:0; background:var(--card-bg); border:2px solid var(--sea-green); border-top:none; border-radius:0 0 12px 12px; overflow:hidden; box-shadow:0 8px 24px rgba(0,0,0,0.2); }
        .nav-option{ display:flex; align-items:center; gap:0.75rem; padding:0.75rem 1.25rem; cursor:pointer; font-family:'Cinzel',serif; font-weight:bold; font-size:0.95rem; transition:all 0.15s; color:var(--text-color); border:none; background:none; width:100%; text-align:left; }
        .nav-option:hover{ background:rgba(46,139,87,0.12); color:var(--sea-green); }
        .nav-option.active{ background:rgba(46,139,87,0.18); color:var(--sea-green); }
        .nav-option .nav-badge{ margin-left:auto; background:#e74c3c; color:#fff; border-radius:10px; padding:0.1rem 0.5rem; font-size:0.7rem; min-width:20px; text-align:center; }

        /* ─── Status Dropdown ─── */
        .status-dropdown{ position:relative; display:inline-block; }
        .status-trigger{ display:flex; align-items:center; gap:0.5rem; padding:0.5rem 1rem; background:var(--card-bg); border:2px solid var(--card-border); border-radius:10px; cursor:pointer; font-family:'Cinzel',serif; font-weight:bold; font-size:0.85rem; color:var(--text-color); transition:all 0.2s; }
        .status-trigger:hover{ border-color:var(--sea-green); }
        .status-menu{ position:absolute; top:calc(100% + 4px); left:0; min-width:180px; background:var(--card-bg); border:2px solid var(--sea-green); border-radius:10px; overflow:hidden; box-shadow:0 6px 20px rgba(0,0,0,0.2); z-index:50; }
        .status-option{ display:flex; align-items:center; gap:0.6rem; padding:0.6rem 1rem; cursor:pointer; font-size:0.85rem; transition:all 0.15s; color:var(--text-color); border:none; background:none; width:100%; text-align:left; }
        .status-option:hover{ background:rgba(46,139,87,0.12); color:var(--sea-green); }
        .status-option.active{ background:rgba(46,139,87,0.18); color:var(--sea-green); font-weight:bold; }

        .card{ background:var(--card-bg); border:1px solid var(--card-border); border-radius:12px; padding:1.25rem; margin-bottom:1rem; }
        .products-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(250px,1fr)); gap:1.25rem; margin-bottom:1.5rem; }
        .product-card{ background:var(--card-bg); border:1px solid var(--card-border); border-radius:12px; padding:1.25rem; transition:transform 0.2s, box-shadow 0.2s; }
        .product-card:hover{ transform:translateY(-3px); box-shadow:0 6px 20px rgba(0,0,0,0.1); }
        .product-img{ width:100%; height:160px; object-fit:cover; border-radius:8px; background:rgba(46,139,87,0.05); display:flex; align-items:center; justify-content:center; margin-bottom:0.75rem; overflow:hidden; }
        .product-img img{ width:100%; height:100%; object-fit:cover; }
        .product-name{ font-family:'Cinzel',serif; color:var(--sea-green); margin:0 0 0.3rem 0; font-size:1.05rem; }
        .btn{ background:var(--sea-green); color:var(--on-accent); border:none; padding:0.5rem 1rem; border-radius:8px; cursor:pointer; font-family:'Cinzel',serif; font-weight:bold; font-size:0.85rem; transition:all 0.2s; }
        .btn:hover{ filter:brightness(1.1); }
        .btn.secondary{ background:var(--sky-blue); color:var(--on-accent); }
        .btn.danger{ background:#e74c3c; }
        .btn.ghost{ background:transparent; color:var(--sea-green); border:1px solid var(--card-border); }
        .btn-row{ display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.75rem; }
        .wallet-bar{ background:var(--sea-green); color:var(--on-accent); padding:1rem 1.5rem; border-radius:12px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1rem; margin-bottom:1.5rem; }
        .wallet-balance{ font-size:1.3rem; font-weight:bold; font-family:'Cinzel',serif; }
        .wallet-add-btn{ background:#B8860B; color:#fff; border:none; padding:0.5rem 1rem; border-radius:8px; cursor:pointer; font-family:'Cinzel',serif; font-weight:bold; }

        .cart-item{ display:flex; align-items:center; gap:1rem; padding:0.75rem 0; border-bottom:1px solid var(--card-border); }
        .cart-item:last-child{ border-bottom:none; }
        .order-card{ background:var(--card-bg); border:1px solid var(--card-border); border-radius:12px; padding:1.25rem; margin-bottom:1rem; }
        .order-header{ display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.75rem; }
        .order-status{ padding:0.25rem 0.75rem; border-radius:20px; font-size:0.8rem; font-weight:bold; }
        .status-pending{ background:rgba(255,193,7,0.2); color:#ffc107; }
        .status-cancelled{ background:rgba(231,76,60,0.15); color:#e74c3c; }
        .status-delivered{ background:rgba(52,152,219,0.15); color:#3498db; }
        .status-processing{ background:rgba(243,156,18,0.15); color:#f39c12; }
        .status-packed{ background:rgba(23,162,184,0.2); color:#17a2b8; }
        .status-shipped{ background:rgba(155,89,182,0.15); color:#9b59b6; }
        .suggestion-row{ display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:1rem; margin-bottom:1.5rem; }
        .suggest-card{ background:var(--card-bg); border:1px solid var(--card-border); border-radius:10px; padding:1rem; text-align:center; cursor:pointer; transition:transform 0.2s, box-shadow 0.2s; }
        .suggest-card:hover{ transform:translateY(-2px); box-shadow:0 4px 12px rgba(0,0,0,0.1); }
        .section-title{ font-family:'Cinzel',serif; color:var(--sea-green); margin:0 0 1rem 0; font-size:1.15rem; }
        .alert{ padding:0.75rem 1rem; border-radius:8px; margin-bottom:1rem; }
        .alert-success{ background:rgba(46,139,87,0.12); color:#2E8B57; border:1px solid rgba(46,139,87,0.2); }
        .alert-error{ background:rgba(231,76,60,0.12); color:#e74c3c; border:1px solid rgba(231,76,60,0.2); }
        .thumb-row{ display:flex; gap:0.35rem; margin-top:0.45rem; overflow-x:auto; padding-bottom:0.2rem; }
        .thumb-btn{ width:38px; height:38px; object-fit:cover; border-radius:6px; border:1px solid var(--card-border); cursor:pointer; flex-shrink:0; }
        .thumb-btn.active{ border:2px solid var(--sea-green); }
        .review-modal{ position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.55); display:flex; align-items:center; justify-content:center; z-index:1003; }
        .review-content{ background:var(--card-bg); border-radius:14px; padding:1.25rem; max-width:700px; width:95%; max-height:85vh; overflow:auto; border:1px solid var(--card-border); }
        .review-list-item{ padding:0.75rem 0; border-bottom:1px solid var(--card-border); }
        .review-list-item:last-child{ border-bottom:none; }

        /* ─── Tracking Modal ─── */
        .tracking-modal{ position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:1002; }
        .tracking-content{ background:var(--card-bg); border-radius:15px; padding:2rem; max-width:500px; width:90%; border:1px solid var(--card-border); }
        .tracking-step{ display:flex; gap:1rem; align-items:flex-start; margin-bottom:1rem; position:relative; }
        .tracking-dot{ width:16px; height:16px; border-radius:50%; background:var(--card-border); flex-shrink:0; margin-top:2px; border:3px solid var(--card-border); }
        .tracking-dot.active{ background:var(--sea-green); border-color:var(--sea-green); }

        /* ─── Purchase Modal ─── */
        .purchase-overlay{ position:fixed; inset:0; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:1005; padding:1rem; }
        .purchase-modal{ background:var(--card-bg); border:1px solid var(--card-border); border-radius:18px; max-width:480px; width:100%; box-shadow:0 20px 60px rgba(0,0,0,0.4); overflow:hidden; }
        .purchase-header{ background:linear-gradient(135deg, rgba(46,139,87,0.15), rgba(46,139,87,0.05)); padding:1.25rem 1.5rem; border-bottom:1px solid var(--card-border); display:flex; align-items:center; justify-content:space-between; }
        .purchase-body{ padding:1.5rem; }
        .purchase-item{ display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0; border-bottom:1px solid rgba(128,128,128,0.15); font-size:0.9rem; }
        .purchase-item:last-child{ border-bottom:none; }
        .purchase-total{ display:flex; justify-content:space-between; align-items:center; padding:1rem 0 0 0; margin-top:0.5rem; border-top:2px solid var(--sea-green); font-family:'Cinzel',serif; font-weight:bold; font-size:1.15rem; }
        .purchase-wallet{ display:flex; justify-content:space-between; align-items:center; padding:0.75rem 1rem; margin:1rem 0; border-radius:10px; background:rgba(46,139,87,0.08); border:1px solid rgba(46,139,87,0.2); font-size:0.9rem; }
        .purchase-btn{ width:100%; padding:0.85rem; border:none; border-radius:12px; font-family:'Cinzel',serif; font-weight:bold; font-size:1rem; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; justify-content:center; gap:0.5rem; }
        .purchase-btn.confirm{ background:linear-gradient(135deg, #2d6a4f, #40916c); color:#fff; }
        .purchase-btn.confirm:hover{ filter:brightness(1.1); }
        .purchase-btn:disabled{ opacity:0.6; cursor:not-allowed; }

        /* ─── Delivery Cards ─── */
        .delivery-card{ background:var(--card-bg); border:1px solid var(--card-border); border-radius:12px; padding:1.25rem; margin-bottom:1rem; border-left:4px solid var(--sea-green); }
        .delivery-progress{ display:flex; align-items:center; gap:0.25rem; margin:0.75rem 0; }
        .delivery-step-dot{ width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.65rem; font-weight:bold; color:#fff; flex-shrink:0; }
        .delivery-step-line{ flex:1; height:3px; border-radius:2px; background:var(--card-border); }
        .delivery-step-line.active{ background:var(--sea-green); }

        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .fade-in{ animation:fadeIn 0.3s ease; }

        /* ─── Lightbox ─── */
        .lightbox-overlay{ position:fixed; inset:0; background:rgba(0,0,0,0.92); display:flex; align-items:center; justify-content:center; z-index:2000; }
        .lightbox-inner{ position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; padding:1rem; box-sizing:border-box; }
        .lightbox-img-wrap{ display:flex; align-items:center; justify-content:center; flex:1; width:100%; overflow:hidden; cursor:zoom-in; }
        .lightbox-img-wrap.zoomed{ cursor:zoom-out; }
        .lightbox-img{ max-width:90vw; max-height:75vh; object-fit:contain; border-radius:8px; transition:transform 0.2s; user-select:none; }
        .lightbox-close{ position:absolute; top:1rem; right:1rem; background:rgba(255,255,255,0.12); border:none; color:#fff; width:40px; height:40px; border-radius:50%; font-size:1.1rem; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background 0.2s; z-index:10; }
        .lightbox-close:hover{ background:rgba(255,255,255,0.25); }
        .lightbox-arrow{ position:absolute; top:50%; transform:translateY(-50%); background:rgba(255,255,255,0.12); border:none; color:#fff; width:44px; height:44px; border-radius:50%; font-size:1.1rem; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background 0.2s; z-index:10; }
        .lightbox-arrow:hover{ background:rgba(255,255,255,0.25); }
        .lightbox-arrow.prev{ left:1rem; }
        .lightbox-arrow.next{ right:1rem; }
        .lightbox-zoom-bar{ display:flex; align-items:center; gap:0.6rem; margin-top:0.75rem; }
        .lightbox-zoom-btn{ background:rgba(255,255,255,0.12); border:none; color:#fff; width:36px; height:36px; border-radius:50%; font-size:1rem; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background 0.2s; }
        .lightbox-zoom-btn:hover{ background:rgba(255,255,255,0.25); }
        .lightbox-zoom-btn:disabled{ opacity:0.35; cursor:default; }
        .lightbox-dots{ display:flex; gap:0.4rem; margin-top:0.6rem; }
        .lightbox-dot{ width:8px; height:8px; border-radius:50%; background:rgba(255,255,255,0.3); cursor:pointer; transition:background 0.2s; border:none; padding:0; }
        .lightbox-dot.active{ background:#fff; }
        .lightbox-counter{ color:rgba(255,255,255,0.6); font-size:0.8rem; margin-top:0.35rem; }
      `}</style>

      <div className="page">
      <div className="store-wrap">
        {/* ─── Header ─── */}
        <div className="store-header">
          <h1 className="store-title"><i className="fas fa-store" style={{ marginRight: '0.75rem' }} />ChessHive Store</h1>

          {/* Dropdown Navigation */}
          <div className="nav-dropdown" ref={navRef}>
            <button
              className={`nav-trigger ${navOpen ? 'open' : ''}`}
              onClick={() => setNavOpen(!navOpen)}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <i className={activeNav.icon} style={{ color: 'var(--sea-green)' }} />
                {activeNav.label}
              </span>
              <i className="fas fa-chevron-down chevron" />
            </button>
            {navOpen && (
              <div className="nav-menu fade-in">
                {NAV_ITEMS.map(item => (
                  <button
                    key={item.key}
                    className={`nav-option ${view === item.key ? 'active' : ''}`}
                    onClick={() => { setView(item.key); setNavOpen(false); }}
                  >
                    <i className={item.icon} />
                    {item.label}
                    {item.key === 'Cart' && cart.length > 0 && (
                      <span className="nav-badge">{cart.length}</span>
                    )}
                    {item.key === 'Delivery' && deliveryOrders.length > 0 && (
                      <span className="nav-badge" style={{ background: 'var(--sea-green)' }}>{deliveryOrders.length}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {successMsg && <div className="alert alert-success">{successMsg}</div>}
        {errorMsg && <div className="alert alert-error">{errorMsg}</div>}

        {/* ─── Wallet Bar ─── */}
        <div className="wallet-bar">
          <div>
            <div className="wallet-balance">💰 ₹{walletBalance.toLocaleString('en-IN')}</div>
            {subscription && <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>Plan: {subscription.plan} ({discountPercentage}% off)</div>}
            <div style={{ fontSize: '0.72rem', opacity: 0.7 }}>Max balance: ₹{MAX_WALLET_BALANCE.toLocaleString('en-IN')}</div>
          </div>
          <button
            className="wallet-add-btn"
            onClick={() => setShowPayment(true)}
            disabled={walletBalance >= MAX_WALLET_BALANCE}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <i className="fas fa-credit-card" />
            {walletBalance >= MAX_WALLET_BALANCE ? 'Limit Reached' : 'Add Funds'}
          </button>
        </div>

        {showPayment && (
          <PaymentGatewayModal
            walletBalance={walletBalance}
            onClose={() => setShowPayment(false)}
            onSuccess={(newBal) => { setWalletBalance(Math.min(newBal, MAX_WALLET_BALANCE)); flash('Funds added successfully!'); }}
          />
        )}

        {/* ═══════════════ STORE VIEW ═══════════════ */}
        {view === 'Store' && (
          <div className="fade-in">
            {!subscription && (
              <div className="card" style={{ textAlign: 'center' }}>
                <p>Subscribe for store discounts!</p>
                <button className="btn" onClick={() => navigate('/player/subscription')}>Subscribe Now</button>
              </div>
            )}

            {/* Most Ordered */}
            {suggestions.mostOrdered.length > 0 && (
              <>
                <h3 className="section-title"><i className="fas fa-fire" style={{ color: '#e74c3c' }} /> Most Ordered</h3>
                <div className="suggestion-row">
                  {suggestions.mostOrdered.slice(0, 6).map((s, i) => (
                    <div key={i} className="suggest-card" onClick={() => setFilter({ ...filter, search: s.name || s._id })}>
                      <div style={{ fontSize: '1.5rem', marginBottom: '0.3rem' }}>🔥</div>
                      <div style={{ fontWeight: 'bold', color: 'var(--sea-green)' }}>{s.name || s._id}</div>
                      <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{s.count} orders</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Suggestions for You */}
            {suggestions.suggested.length > 0 && (
              <>
                <h3 className="section-title"><i className="fas fa-lightbulb" style={{ color: '#f39c12' }} /> Suggestions For You</h3>
                <div className="suggestion-row">
                  {suggestions.suggested.slice(0, 6).map((s, i) => (
                    <div key={i} className="suggest-card" onClick={() => setFilter({ ...filter, search: s.name })}>
                      <div style={{ fontSize: '1.5rem', marginBottom: '0.3rem' }}>💡</div>
                      <div style={{ fontWeight: 'bold' }}>{s.name}</div>
                      {renderPrice(s.price)}
                    </div>
                  ))}
                </div>
              </>
            )}

            <SearchFilter search={filter.search} category={filter.category} categories={[...new Set(productsList.map(p => p.category).filter(Boolean))]} onChange={setFilter} />

            {loading ? <p style={{ textAlign: 'center' }}>Loading products...</p> : (
              <div className="products-grid">
                {filteredProducts.length === 0 ? (
                  <div className="card" style={{ textAlign: 'center', gridColumn: '1/-1' }}>No products available.</div>
                ) : filteredProducts.map((product) => {
                  const images = getProductImages(product);
                  const selected = Math.min(productImageIndex[product._id] || 0, Math.max(images.length - 1, 0));
                  const currentImage = images[selected] || '';
                  return (
                    <div key={product._id} className="product-card">
                      <div className="product-img"
                      style={{ cursor: images.length > 0 ? 'zoom-in' : 'default' }}
                      onClick={() => images.length > 0 && setLightbox({ images, index: selected, zoom: 1 })}>
                        {currentImage
                          ? <img src={currentImage} alt={product.name} onError={e => { e.target.style.display = 'none'; }} />
                          : <i className="fas fa-box-open" style={{ fontSize: '3rem', color: 'var(--sea-green)', opacity: 0.3 }} />}
                      </div>
                      {images.length > 1 && (
                        <div className="thumb-row">
                          {images.map((img, idx) => (
                            <img
                              key={`${product._id}-${idx}`}
                              src={img}
                              alt={`${product.name}-${idx + 1}`}
                              className={`thumb-btn ${idx === selected ? 'active' : ''}`}
                              onClick={() => setProductImageIndex((prev) => ({ ...prev, [product._id]: idx }))}
                            />
                          ))}
                        </div>
                      )}
                      <h4 className="product-name">{product.name}</h4>
                      <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.3rem' }}>{product.category}</div>
                      <div style={{ marginBottom: '0.3rem' }}>{renderPrice(product.price)}</div>
                      <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.35rem' }}>Available: {product.availability}</div>
                      {images.length > 1 && (
                        <div style={{ fontSize: '0.78rem', opacity: 0.75, marginBottom: '0.35rem' }}>
                          {images.length} images available
                        </div>
                      )}
                      <div className="btn-row">
                        <button className="btn" onClick={() => openPurchaseModal('buyNow', product)}>
                          <i className="fas fa-bolt" /> Buy Now
                        </button>
                        <button className="btn ghost" onClick={() => addToCart(product)}>
                          <i className="fas fa-cart-plus" /> Add to Cart
                        </button>
                        <button className="btn secondary" onClick={() => openProductReviews(product)}>
                          <i className="fas fa-star" /> Reviews
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ CART VIEW ═══════════════ */}
        {view === 'Cart' && (
          <div className="card fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 className="section-title" style={{ margin: 0 }}><i className="fas fa-shopping-cart" /> Your Cart ({cart.length} {cart.length === 1 ? 'item' : 'items'})</h3>
              {cart.length > 0 && <button className="btn danger" onClick={clearCart} style={{ fontSize: '0.8rem' }}><i className="fas fa-trash-alt" /> Clear All</button>}
            </div>

            {cartLoading ? <p>Loading cart...</p> : cart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 2rem', opacity: 0.7 }}>
                <i className="fas fa-shopping-cart" style={{ fontSize: '3rem', marginBottom: '1rem', display: 'block', color: 'var(--sea-green)', opacity: 0.4 }} />
                <div style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Your cart is empty</div>
                <div style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>Browse the store and add items to get started</div>
                <button className="btn" onClick={() => setView('Store')}><i className="fas fa-store" /> Go to Store</button>
              </div>
            ) : (
              <>
                {cart.map((item, i) => {
                  const qty = item.quantity || 1;
                  const pid = item.productId;
                  return (
                    <div key={i} className="cart-item" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 0', borderBottom: i < cart.length - 1 ? '1px solid var(--card-border)' : 'none' }}>
                      <div style={{ width: 60, height: 60, borderRadius: 10, overflow: 'hidden', background: 'rgba(46,139,87,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {item.image ? <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none'; }} /> : <i className="fas fa-box-open" style={{ color: 'var(--sea-green)', opacity: 0.4, fontSize: '1.5rem' }} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', color: 'var(--sea-green)', marginBottom: '0.25rem' }}>{item.name || 'Product'}</div>
                        <div style={{ fontSize: '0.85rem', marginBottom: '0.4rem' }}>{renderPrice(item.price || 0)}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button className="btn ghost" style={{ padding: '0.2rem 0.6rem', fontSize: '0.85rem', minWidth: 32 }} onClick={() => updateCartQty(pid, qty - 1)}>-</button>
                          <span style={{ fontWeight: 'bold', minWidth: 24, textAlign: 'center' }}>{qty}</span>
                          <button className="btn ghost" style={{ padding: '0.2rem 0.6rem', fontSize: '0.85rem', minWidth: 32 }} onClick={() => updateCartQty(pid, qty + 1)}>+</button>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>
                          ₹{((item.price || 0) * qty * (1 - discountPercentage / 100)).toFixed(2)}
                        </div>
                        <button className="btn danger" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }} onClick={() => removeFromCart(pid)}>
                          <i className="fas fa-trash" /> Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
                <div style={{ borderTop: '2px solid var(--sea-green)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                  {discountPercentage > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--sea-green)' }}>
                      <span>Subscription Discount</span>
                      <span>-{discountPercentage}%</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 'bold', fontFamily: "'Cinzel', serif" }}>
                      Total: ₹{cartTotal.toFixed(2)}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn ghost" onClick={() => setView('Store')}>Continue Shopping</button>
                      <button className="btn" onClick={() => openPurchaseModal('cart')} style={{ padding: '0.7rem 1.5rem' }}>
                        <i className="fas fa-credit-card" /> Checkout
                      </button>
                    </div>
                  </div>

                </div>
              </>
            )}
          </div>
        )}

        {/* ═══════════════ ORDERS VIEW ═══════════════ */}
        {view === 'Orders' && (
          <div className="fade-in">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
              <h3 className="section-title" style={{ margin: 0 }}><i className="fas fa-receipt" /> Order History</h3>

              {/* Status Filter Dropdown */}
              <div className="status-dropdown" ref={orderStatusRef}>
                <button className="status-trigger" onClick={() => setOrderStatusOpen(!orderStatusOpen)}>
                  <i className={(ORDER_STATUSES.find(s => s.key === orderFilter) || ORDER_STATUSES[0]).icon} />
                  {(ORDER_STATUSES.find(s => s.key === orderFilter) || ORDER_STATUSES[0]).label}
                  {orderFilter !== 'all' && <span style={{ background: 'var(--sea-green)', color: '#fff', borderRadius: 8, padding: '0.1rem 0.4rem', fontSize: '0.7rem', marginLeft: '0.25rem' }}>{filteredOrders.length}</span>}
                  <i className="fas fa-chevron-down" style={{ fontSize: '0.7rem', marginLeft: '0.25rem' }} />
                </button>
                {orderStatusOpen && (
                  <div className="status-menu fade-in">
                    {ORDER_STATUSES.map(s => (
                      <button
                        key={s.key}
                        className={`status-option ${orderFilter === s.key ? 'active' : ''}`}
                        onClick={() => { setOrderFilter(s.key); setOrderStatusOpen(false); }}
                      >
                        <i className={s.icon} />
                        {s.label}
                        <span style={{ marginLeft: 'auto', opacity: 0.6, fontSize: '0.8rem' }}>
                          {s.key === 'all' ? orderStats.total : (orderStats[s.key] || 0)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Order Search */}
            {orders.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <input
                  type="search"
                  placeholder="Search orders by ID or product name..."
                  value={orderSearch}
                  onChange={e => setOrderSearch(e.target.value)}
                  style={{
                    width: '100%', padding: '0.65rem 1rem', borderRadius: 10,
                    border: '2px solid var(--card-border)', background: 'var(--card-bg)',
                    color: 'var(--text-color)', fontSize: '0.9rem', boxSizing: 'border-box'
                  }}
                />
              </div>
            )}

            {ordersLoading ? <p>Loading orders...</p> : orders.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem', opacity: 0.7 }}>
                <i className="fas fa-box-open" style={{ fontSize: '3rem', marginBottom: '1rem', display: 'block', color: 'var(--sea-green)', opacity: 0.4 }} />
                <div style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No orders yet</div>
                <div style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>Your purchases will appear here</div>
                <button className="btn" onClick={() => setView('Store')}><i className="fas fa-store" /> Browse Store</button>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '2rem', opacity: 0.7 }}>
                No orders match your filter
              </div>
            ) : filteredOrders.map(order => (
              <div key={order._id} className="order-card">
                <div className="order-header">
                  <div>
                    <div style={{ fontWeight: 'bold', fontFamily: "'Cinzel', serif", color: 'var(--sea-green)' }}>
                      Order #{(order._id || '').slice(-8).toUpperCase()}
                    </div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                      {order.createdAt ? new Date(order.createdAt).toLocaleString('en-IN') : ''}
                    </div>
                  </div>
                  <span className={`order-status status-${(order.status || 'pending').toLowerCase()}`}>
                    {(order.status || 'pending').charAt(0).toUpperCase() + (order.status || 'pending').slice(1)}
                  </span>
                </div>
                <div style={{ background: 'rgba(46,139,87,0.03)', borderRadius: 8, padding: '0.5rem 0.75rem', marginBottom: '0.5rem' }}>
                  {(order.items || []).map((item, j) => (
                    <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', padding: '0.35rem 0', borderBottom: j < (order.items || []).length - 1 ? '1px solid var(--card-border)' : 'none' }}>
                      <span>{item.name || 'Product'} <span style={{ opacity: 0.6 }}>×{item.quantity || 1}</span></span>
                      <span style={{ fontWeight: 'bold' }}>₹{((item.price || 0) * (item.quantity || 1)).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '1.05rem', fontFamily: "'Cinzel', serif" }}>Total: ₹{(order.total || 0).toFixed(2)}</div>
                  <div className="btn-row" style={{ margin: 0 }}>
                    {order.status !== 'cancelled' && order.status !== 'delivered' && (
                      <button className="btn danger" style={{ fontSize: '0.8rem' }} onClick={() => cancelOrder(order._id)}>
                        <i className="fas fa-times-circle" /> Cancel
                      </button>
                    )}
                    <button className="btn ghost" style={{ fontSize: '0.8rem' }} onClick={() => viewTracking(order._id)}>
                      <i className="fas fa-truck" /> Track
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══════════════ DELIVERY VIEW ═══════════════ */}
        {view === 'Delivery' && (
          <div className="fade-in">
            <h3 className="section-title"><i className="fas fa-truck" /> Active Deliveries</h3>

            {ordersLoading ? <p>Loading deliveries...</p> : deliveryOrders.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem', opacity: 0.7 }}>
                <i className="fas fa-truck" style={{ fontSize: '3rem', marginBottom: '1rem', display: 'block', color: 'var(--sea-green)', opacity: 0.4 }} />
                <div style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No active deliveries</div>
                <div style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>Orders in transit will appear here</div>
                <button className="btn" onClick={() => setView('Store')}><i className="fas fa-store" /> Browse Store</button>
              </div>
            ) : deliveryOrders.map(order => {
              const steps = [
                { key: 'pending',    label: 'Placed',     icon: 'fas fa-clipboard-check' },
                { key: 'processing', label: 'Processing', icon: 'fas fa-cog' },
                { key: 'packed',     label: 'Packed',     icon: 'fas fa-box' },
                { key: 'shipped',    label: 'Shipped',    icon: 'fas fa-shipping-fast' },
                { key: 'delivered',  label: 'Delivered',  icon: 'fas fa-check-double' },
              ];
              const statusOrder = ['pending', 'processing', 'packed', 'shipped', 'delivered'];
              const currentIdx = statusOrder.indexOf(order.status || 'pending');

              return (
                <div key={order._id} className="delivery-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', fontFamily: "'Cinzel', serif", color: 'var(--sea-green)', fontSize: '1.05rem' }}>
                        Order #{(order._id || '').slice(-8).toUpperCase()}
                      </div>
                      <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                        {order.createdAt ? new Date(order.createdAt).toLocaleString('en-IN') : ''}
                      </div>
                    </div>
                    <span className={`order-status status-${(order.status || 'pending').toLowerCase()}`}>
                      {(order.status || 'pending').charAt(0).toUpperCase() + (order.status || 'pending').slice(1)}
                    </span>
                  </div>

                  {/* Items Summary */}
                  <div style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: '0.5rem' }}>
                    {(order.items || []).map(i => i.name || 'Item').join(', ')}
                    {' '}<span style={{ fontWeight: 'bold' }}>₹{(order.total || 0).toFixed(2)}</span>
                  </div>

                  {/* Delivery Progress Bar */}
                  <div className="delivery-progress">
                    {steps.map((step, i) => (
                      <div key={step.key} style={{ display: 'contents' }}>
                        <div
                          className="delivery-step-dot"
                          style={{
                            background: i <= currentIdx ? 'var(--sea-green)' : 'var(--card-border)',
                          }}
                          title={step.label}
                        >
                          <i className={step.icon} />
                        </div>
                        {i < steps.length - 1 && (
                          <div className={`delivery-step-line ${i < currentIdx ? 'active' : ''}`} />
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.75rem' }}>
                    {steps.map(s => <span key={s.key}>{s.label}</span>)}
                  </div>

                  <div className="btn-row" style={{ margin: 0 }}>
                    <button className="btn ghost" style={{ fontSize: '0.8rem' }} onClick={() => viewTracking(order._id)}>
                      <i className="fas fa-map-marker-alt" /> Track Details
                    </button>
                    {order.status !== 'cancelled' && order.status !== 'delivered' && (
                      <button className="btn danger" style={{ fontSize: '0.8rem' }} onClick={() => cancelOrder(order._id)}>
                        <i className="fas fa-times-circle" /> Cancel Order
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {/* ─── Image Lightbox ─── */}
{lightbox && (
  <div
    className="lightbox-overlay"
    onClick={() => setLightbox(null)}
  >
    <div className="lightbox-inner" onClick={e => e.stopPropagation()}>
      {/* Close */}
      <button className="lightbox-close" onClick={() => setLightbox(null)}>
        <i className="fas fa-times" />
      </button>

      {/* Prev Arrow */}
      {lightbox.images.length > 1 && (
        <button
          className="lightbox-arrow prev"
          onClick={() => setLightbox(lb => ({ ...lb, index: (lb.index - 1 + lb.images.length) % lb.images.length, zoom: 1 }))}
        >
          <i className="fas fa-chevron-left" />
        </button>
      )}

      {/* Image */}
      <div
        className={`lightbox-img-wrap${lightbox.zoom > 1 ? ' zoomed' : ''}`}
        onClick={() => setLightbox(lb => ({ ...lb, zoom: lb.zoom > 1 ? 1 : 2.2 }))}
      >
        <img
          src={lightbox.images[lightbox.index]}
          alt={`Image ${lightbox.index + 1}`}
          className="lightbox-img"
          style={{ transform: `scale(${lightbox.zoom})` }}
          draggable={false}
        />
      </div>

      {/* Next Arrow */}
      {lightbox.images.length > 1 && (
        <button
          className="lightbox-arrow next"
          onClick={() => setLightbox(lb => ({ ...lb, index: (lb.index + 1) % lb.images.length, zoom: 1 }))}
        >
          <i className="fas fa-chevron-right" />
        </button>
      )}

      {/* Zoom controls */}
      <div className="lightbox-zoom-bar">
        <button
          className="lightbox-zoom-btn"
          onClick={() => setLightbox(lb => ({ ...lb, zoom: Math.max(1, +(lb.zoom - 0.5).toFixed(1)) }))}
          disabled={lightbox.zoom <= 1}
        ><i className="fas fa-search-minus" /></button>
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem', minWidth: 36, textAlign: 'center' }}>
          {Math.round(lightbox.zoom * 100)}%
        </span>
        <button
          className="lightbox-zoom-btn"
          onClick={() => setLightbox(lb => ({ ...lb, zoom: Math.min(4, +(lb.zoom + 0.5).toFixed(1)) }))}
          disabled={lightbox.zoom >= 4}
        ><i className="fas fa-search-plus" /></button>
      </div>

      {/* Dot indicators */}
      {lightbox.images.length > 1 && (
        <div className="lightbox-dots">
          {lightbox.images.map((_, i) => (
            <button
              key={i}
              className={`lightbox-dot ${i === lightbox.index ? 'active' : ''}`}
              onClick={() => setLightbox(lb => ({ ...lb, index: i, zoom: 1 }))}
            />
          ))}
        </div>
      )}
      <div className="lightbox-counter">
        {lightbox.images.length > 1 ? `${lightbox.index + 1} / ${lightbox.images.length}` : ''}
      </div>
    </div>
  </div>
)}

        {/* ─── Purchase Confirmation Modal ─── */}
        {purchaseModal && purchaseStep !== 'gateway' && (
          <div className="purchase-overlay" onClick={e => { if (e.target === e.currentTarget && purchaseStep !== 'processing') closePurchaseModal(); }}>
            <div className="purchase-modal fade-in">
              <div className="purchase-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <i className="fas fa-shield-alt" style={{ color: 'var(--sea-green)', fontSize: '1.2rem' }} />
                  <div>
                    <div style={{ fontFamily: "'Cinzel', serif", fontWeight: 'bold', color: 'var(--sea-green)' }}>
                      {purchaseStep === 'confirm' ? 'Confirm Purchase' : purchaseStep === 'processing' ? 'Processing...' : purchaseStep === 'success' ? 'Success!' : 'Payment Failed'}
                    </div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>Secure checkout</div>
                  </div>
                </div>
                {purchaseStep !== 'processing' && (
                  <button onClick={closePurchaseModal} className="btn ghost" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
                    <i className="fas fa-times" />
                  </button>
                )}
              </div>

              <div className="purchase-body">
                {/* ── Confirm Step ── */}
                {purchaseStep === 'confirm' && (
                  <>
                    <div style={{ marginBottom: '0.5rem', fontSize: '0.85rem', opacity: 0.7, fontFamily: "'Cinzel', serif" }}>
                      {purchaseModal.mode === 'buyNow' ? 'Direct Purchase' : `Cart Checkout (${cart.length} items)`}
                    </div>

                    {purchaseModal.mode === 'buyNow' && purchaseModal.product && (
                      <div className="purchase-item">
                        <div>
                          <div style={{ fontWeight: 'bold' }}>{purchaseModal.product.name}</div>
                          <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{purchaseModal.product.category}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          {discountPercentage > 0 && (
                            <div style={{ textDecoration: 'line-through', opacity: 0.5, fontSize: '0.8rem' }}>₹{purchaseModal.product.price}</div>
                          )}
                          <div style={{ fontWeight: 'bold', color: 'var(--sea-green)' }}>₹{getPurchaseTotal().toFixed(2)}</div>
                        </div>
                      </div>
                    )}

                    {purchaseModal.mode === 'cart' && cart.map((item, i) => {
                      const qty = item.quantity || 1;
                      const itemTotal = (item.price || 0) * qty * (1 - discountPercentage / 100);
                      return (
                        <div key={i} className="purchase-item">
                          <div>
                            <div style={{ fontWeight: 'bold' }}>{item.name || 'Product'}</div>
                            <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>Qty: {qty}</div>
                          </div>
                          <div style={{ fontWeight: 'bold' }}>₹{itemTotal.toFixed(2)}</div>
                        </div>
                      );
                    })}

                    {discountPercentage > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', fontSize: '0.85rem', color: 'var(--sea-green)' }}>
                        <span><i className="fas fa-tag" /> Subscription Discount</span>
                        <span>-{discountPercentage}%</span>
                      </div>
                    )}

                    <div className="purchase-total">
                      <span>Total</span>
                      <span style={{ color: 'var(--sea-green)' }}>₹{getPurchaseTotal().toFixed(2)}</span>
                    </div>

                    <div className="purchase-wallet">
                      <span><i className="fas fa-wallet" style={{ marginRight: '0.4rem' }} /> Wallet Balance</span>
                      <span style={{ fontWeight: 'bold', color: walletBalance >= getPurchaseTotal() ? 'var(--sea-green)' : '#e74c3c' }}>
                        ₹{walletBalance.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <button
                      className="purchase-btn confirm"
                      onClick={() => setPurchaseStep('gateway')}
                    >
                      <i className="fas fa-credit-card" /> Proceed to Payment Gateway
                    </button>
                  </>
                )}

                {/* ── Processing Step ── */}
                {purchaseStep === 'processing' && (
                  <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                    <div style={{ width: 56, height: 56, border: '4px solid var(--card-border)', borderTop: '4px solid var(--sea-green)', borderRadius: '50%', margin: '0 auto 1.25rem', animation: 'spin 1s linear infinite' }} />
                    <div style={{ fontFamily: "'Cinzel', serif", fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--sea-green)', marginBottom: '0.5rem' }}>Processing Payment</div>
                    <div style={{ fontSize: '0.85rem', opacity: 0.6 }}>Please wait while we complete your purchase...</div>
                  </div>
                )}

                {/* ── Success Step ── */}
                {purchaseStep === 'success' && (
                  <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(46,139,87,0.15)', border: '3px solid var(--sea-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                      <i className="fas fa-check" style={{ fontSize: '1.8rem', color: 'var(--sea-green)' }} />
                    </div>
                    <div style={{ fontFamily: "'Cinzel', serif", fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--sea-green)', marginBottom: '0.4rem' }}>Purchase Successful!</div>
                    <div style={{ fontSize: '0.85rem', opacity: 0.6 }}>Redirecting to delivery tracking...</div>
                  </div>
                )}

                {/* ── Error Step ── */}
                {purchaseStep === 'error' && (
                  <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(231,76,60,0.12)', border: '3px solid #e74c3c', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                      <i className="fas fa-times" style={{ fontSize: '1.8rem', color: '#e74c3c' }} />
                    </div>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#e74c3c', marginBottom: '0.4rem' }}>Purchase Failed</div>
                    <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '1rem' }}>{purchaseError}</div>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <button className="btn" onClick={() => setPurchaseStep('confirm')}>
                        <i className="fas fa-redo" /> Try Again
                      </button>
                      <button className="btn ghost" onClick={closePurchaseModal}>Close</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── Payment Gateway Step (inside purchase flow) ─── */}
        {purchaseModal && purchaseStep === 'gateway' && (
          <PaymentGatewayModal
            walletBalance={walletBalance}
            onClose={() => setPurchaseStep('confirm')}
            onSuccess={(newBal) => {
              setWalletBalance(Math.min(newBal, MAX_WALLET_BALANCE));
              // Funds added → now place the order (deducts from wallet)
              executePurchase();
            }}
          />
        )}

        {/* ─── Product Reviews Modal ─── */}
        {selectedProductForReviews && (
          <div className="review-modal" onClick={() => setSelectedProductForReviews(null)}>
            <div className="review-content" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontFamily: "'Cinzel', serif", color: 'var(--sea-green)', margin: 0 }}>
                  <i className="fas fa-star" /> Reviews: {selectedProductForReviews.name}
                </h3>
                <button className="btn ghost" onClick={() => setSelectedProductForReviews(null)}>Close</button>
              </div>

              <div style={{ marginBottom: '0.85rem', fontSize: '0.9rem', opacity: 0.8 }}>
                Average: <strong>{reviewsData.avgRating.toFixed(1)}</strong> / 5 ({reviewsData.totalReviews} reviews)
              </div>

              {reviewsLoading ? (
                <p>Loading reviews...</p>
              ) : (
                reviewsData.reviews.length === 0
                  ? <p>No reviews yet.</p>
                  : (
                    <div style={{ marginBottom: '1rem' }}>
                      {reviewsData.reviews.map((r, idx) => (
                        <div key={idx} className="review-list-item">
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                            <strong>{r.user_name || 'User'}</strong>
                            <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>{r.review_date ? new Date(r.review_date).toLocaleDateString('en-IN') : ''}</span>
                          </div>
                          <div style={{ color: '#f2b01e', margin: '0.25rem 0' }}>
                            {[...Array(5)].map((_, i) => <i key={i} className="fas fa-star" style={{ opacity: i < Number(r.rating || 0) ? 1 : 0.3 }} />)}
                          </div>
                          <div style={{ fontSize: '0.9rem' }}>{r.comment || 'No comment'}</div>
                        </div>
                      ))}
                    </div>
                  )
              )}

              <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: '0.9rem' }}>
                {!selectedProductForReviews.comments_enabled ? (
                  <div style={{ opacity: 0.8 }}>
                    Coordinator has disabled reviews for this product.
                  </div>
                ) : !selectedProductForReviews.canReview ? (
                  <div style={{ opacity: 0.8 }}>
                    Only players who bought this product can submit a review.
                  </div>
                ) : (
                  <>
                    <h4 style={{ margin: '0 0 0.6rem 0', color: 'var(--sea-green)' }}>Write / Update Your Review</h4>
                    <div style={{ display: 'grid', gap: '0.6rem' }}>
                      <label style={{ display: 'grid', gap: '0.25rem' }}>
                        <span>Rating</span>
                        <select
                          value={reviewForm.rating}
                          onChange={(e) => setReviewForm((prev) => ({ ...prev, rating: Number(e.target.value) }))}
                          style={{ padding: '0.45rem', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-color)' }}
                        >
                          <option value={5}>5 - Excellent</option>
                          <option value={4}>4 - Good</option>
                          <option value={3}>3 - Average</option>
                          <option value={2}>2 - Poor</option>
                          <option value={1}>1 - Bad</option>
                        </select>
                      </label>
                      <label style={{ display: 'grid', gap: '0.25rem' }}>
                        <span>Comment</span>
                        <textarea
                          rows={3}
                          value={reviewForm.comment}
                          onChange={(e) => setReviewForm((prev) => ({ ...prev, comment: e.target.value }))}
                          placeholder="Share your experience with this product"
                          style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-color)' }}
                        />
                      </label>
                      <button className="btn" onClick={submitProductReview} disabled={reviewSubmitting}>
                        {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── Tracking Modal ─── */}
        {trackingOrder && (
          <div className="tracking-modal" onClick={() => setTrackingOrder(null)}>
            <div className="tracking-content" onClick={e => e.stopPropagation()}>
              <h3 style={{ fontFamily: "'Cinzel', serif", color: 'var(--sea-green)', marginBottom: '1.5rem' }}>
                <i className="fas fa-truck" /> Order Tracking
              </h3>
              {(trackingOrder.steps || [
                { label: 'Order Placed', done: true },
                { label: 'Processing', done: !['pending', 'cancelled'].includes(trackingOrder.status) },
                { label: 'Packed', done: ['packed', 'shipped', 'delivered'].includes(trackingOrder.status) },
                { label: 'Shipped', done: trackingOrder.status === 'shipped' || trackingOrder.status === 'delivered' },
                { label: 'Delivered', done: trackingOrder.status === 'delivered' }
              ]).map((step, i, arr) => (
                <div key={i} className="tracking-step">
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div className={`tracking-dot ${step.done ? 'active' : ''}`} />
                    {i < arr.length - 1 && <div style={{ width: 2, height: 24, marginTop: 2, background: step.done ? 'var(--sea-green)' : 'var(--card-border)' }} />}
                  </div>
                  <div>
                    <div style={{ fontWeight: step.done ? 'bold' : 'normal', color: step.done ? 'var(--sea-green)' : 'var(--text-color)' }}>{step.label}</div>
                    {step.date && <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{new Date(step.date).toLocaleString('en-IN')}</div>}
                  </div>
                </div>
              ))}
              <button className="btn" style={{ marginTop: '1rem', width: '100%' }} onClick={() => setTrackingOrder(null)}>Close</button>
            </div>
          </div>
        )}
      </div>
      <button type="button" className="back-to-dashboard" onClick={() => navigate('/player/player_dashboard')}>
        <i className="fas fa-arrow-left" /> Back to Dashboard
      </button>
      </div>
    </div>
  );
}

export default PlayerStore;
