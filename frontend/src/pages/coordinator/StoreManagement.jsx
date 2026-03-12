import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProducts, addProduct } from '../../features/products/productsSlice';
import '../../styles/playerNeoNoir.css';
import { motion } from 'framer-motion';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import AnimatedSidebar from '../../components/AnimatedSidebar';
import { coordinatorLinks } from '../../constants/coordinatorLinks';
import { fetchAsCoordinator } from '../../utils/fetchWithRole';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

const VISIBLE_COUNT = 8;

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

function StoreManagement() {
  const [isDark, toggleTheme] = usePlayerTheme();
  const dispatch = useDispatch();
  const productState = useSelector((s) => s.products || {});
  const [activeTab, setActiveTab] = useState('products');
  const [message, setMessage] = useState(null);

  // --- Products State ---
  const [visible, setVisible] = useState(VISIBLE_COUNT);
  const [form, setForm] = useState({
    productName: '',
    productCategory: '',
    productPrice: '',
    productImage: '',
    productImagesText: '',
    availability: ''
  });
  const [productImageFiles, setProductImageFiles] = useState([]);
  const [productImagePreviews, setProductImagePreviews] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [filter, setFilter] = useState({ search: '', category: '' });
  const [productImageIndex, setProductImageIndex] = useState({});

  // --- Orders State ---
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderFilter, setOrderFilter] = useState('all');
  const [orderSearch, setOrderSearch] = useState('');

  // --- Analytics State ---
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [selectedProductAnalytics, setSelectedProductAnalytics] = useState(null);
  const [productAnalyticsDetails, setProductAnalyticsDetails] = useState(null);
  const [productAnalyticsLoading, setProductAnalyticsLoading] = useState(false);
  const [productAnalyticsError, setProductAnalyticsError] = useState('');

  // --- Reviews State ---
  const [selectedProductForReviews, setSelectedProductForReviews] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  const showMessage = (text, type = 'success') => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  // Initial Load
  useEffect(() => {
    dispatch(fetchProducts('coordinator'));
  }, [dispatch]);

  // Tab change handler
  useEffect(() => {
    if (activeTab === 'orders') fetchOrders();
    if (activeTab === 'analytics') fetchAnalytics();
  }, [activeTab]);

  useEffect(() => {
    return () => {
      productImagePreviews.forEach((url) => {
        try { URL.revokeObjectURL(url); } catch {}
      });
    };
  }, [productImagePreviews]);

  // --- Products Logic ---
  const productsList = useMemo(() => productState.products || [], [productState.products]);
  const filteredProducts = useMemo(() => {
    return productsList.filter((p) => {
      // Show all including 0 availability for management
      if (filter.category && String(p.category || '').toLowerCase() !== String(filter.category || '').toLowerCase()) return false;
      if (filter.search) {
        const s = filter.search.toLowerCase();
        return String(p.name || '').toLowerCase().includes(s) || String(p.category || '').toLowerCase().includes(s);
      }
      return true;
    });
  }, [productsList, filter]);

  const getProductImages = useCallback((product) => {
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
  }, []);

  const validateProductForm = () => {
    const errors = {};
    const name = form.productName.trim();
    if (!name) errors.productName = 'Required';
    const price = parseFloat(form.productPrice);
    if (isNaN(price) || price < 0) errors.productPrice = 'Invalid price';
    const availability = parseInt(form.availability);
    if (isNaN(availability) || availability < 0) errors.availability = 'Invalid stock';
    const hasUrl = !!form.productImage.trim() || !!form.productImagesText.trim();
    const hasFile = productImageFiles.length > 0;
    if (!hasUrl && !hasFile) errors.productImage = 'Add at least one image URL or file';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!validateProductForm()) return;
    try {
      const resultAction = await dispatch(addProduct({
        name: form.productName,
        category: form.productCategory,
        price: parseFloat(form.productPrice),
        imageUrl: form.productImage,
        imageUrls: form.productImagesText
          ? form.productImagesText.split('\n').map((x) => x.trim()).filter(Boolean)
          : [],
        imageFiles: productImageFiles,
        availability: parseInt(form.availability),
      }));
      if (addProduct.rejected.match(resultAction)) throw new Error(resultAction.payload?.message || 'Failed');
      dispatch(fetchProducts('coordinator'));
      setForm({ productName: '', productCategory: '', productPrice: '', productImage: '', productImagesText: '', availability: '' });
      setProductImageFiles([]);
      setProductImagePreviews([]);
      showMessage('Product added!', 'success');
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const handleProductImageFiles = (e) => {
    const files = Array.from(e.target.files || []);
    setProductImageFiles(files);
    setProductImagePreviews(files.map((f) => URL.createObjectURL(f)));
  };

  const toggleReviewVisibility = async (productId) => {
    try {
      const res = await fetchAsCoordinator(`/coordinator/api/store/products/${productId}/toggle-comments`, { method: 'PATCH' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to toggle');
      dispatch(fetchProducts('coordinator'));
      showMessage('Review visibility updated', 'success');
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const normalizeOrderStatus = useCallback((status) => {
    const raw = String(status || '').toLowerCase().trim();
    if (!raw || raw === 'confirmed') return 'pending';
    return ['pending', 'processing', 'packed', 'shipped', 'delivered', 'cancelled'].includes(raw)
      ? raw
      : 'pending';
  }, []);

  const formatOrderStatus = useCallback((status) => {
    const normalized = normalizeOrderStatus(status);
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }, [normalizeOrderStatus]);

  const getNextOrderStatusOptions = useCallback((status) => {
    const normalized = normalizeOrderStatus(status);
    if (normalized === 'pending') return [
      { value: 'processing', label: 'Mark Processing' },
      { value: 'packed', label: 'Mark Packed' },
      { value: 'shipped', label: 'Mark Shipped' },
      { value: 'delivered', label: 'Mark Delivered' },
      { value: 'cancelled', label: 'Mark Cancelled' }
    ];
    if (normalized === 'processing') return [
      { value: 'packed', label: 'Mark Packed' },
      { value: 'shipped', label: 'Mark Shipped' },
      { value: 'delivered', label: 'Mark Delivered' },
      { value: 'cancelled', label: 'Mark Cancelled' }
    ];
    if (normalized === 'packed') return [
      { value: 'shipped', label: 'Mark Shipped' },
      { value: 'delivered', label: 'Mark Delivered' },
      { value: 'cancelled', label: 'Mark Cancelled' }
    ];
    if (normalized === 'shipped') return [
      { value: 'delivered', label: 'Mark Delivered' }
    ];
    return [];
  }, [normalizeOrderStatus]);

  // --- Orders Logic ---
  const fetchOrders = async () => {
    setOrdersLoading(true);
    try {
      const res = await fetchAsCoordinator('/coordinator/api/store/orders');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch orders');
      setOrders(data.orders || []);
    } catch (e) {
      console.error(e);
      setOrders([]);
      showMessage(e.message || 'Failed to fetch orders', 'error');
    } finally {
      setOrdersLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    if (!status) return;
    try {
      const res = await fetchAsCoordinator(`/coordinator/api/store/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');
      showMessage(`Order marked as ${formatOrderStatus(data.status || status)}`, 'success');
      await fetchOrders();
    } catch (e) {
      showMessage(e.message, 'error');
    }
  };

  // --- Analytics Logic ---
  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const res = await fetchAsCoordinator('/coordinator/api/store/analytics');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch analytics');
      setAnalytics(data);
    } catch (e) {
      console.error(e);
      setAnalytics(null);
      showMessage(e.message || 'Failed to fetch analytics', 'error');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const mapProductAnalyticsPayload = useCallback((payload, fallback = {}) => {
    const dateWiseSales = Array.isArray(payload?.dateWiseSales)
      ? payload.dateWiseSales.map((entry, idx) => ({
          date: entry?.date || `Unknown-${idx + 1}`,
          unitsSold: Number(entry?.unitsSold ?? entry?.units ?? entry?.sold ?? 0),
          revenue: Number(entry?.revenue ?? entry?.totalRevenue ?? 0)
        }))
      : [];

    return {
      product: {
        _id: payload?.product?._id || fallback._id || '',
        name: payload?.product?.name || payload?.productName || fallback.name || 'Product'
      },
      unitsSold: Number(payload?.unitsSold ?? payload?.totalSales ?? payload?.sold ?? 0),
      totalRevenue: Number(payload?.totalRevenue ?? payload?.revenue ?? 0),
      dateWiseSales
    };
  }, []);

  const fetchProductAnalyticsDetails = useCallback(async (productContext) => {
    const productId = String(productContext?._id || '').trim();
    if (!productId) {
      showMessage('Unable to load product details', 'error');
      return;
    }

    setSelectedProductAnalytics(productContext);
    setProductAnalyticsDetails(null);
    setProductAnalyticsLoading(true);
    setProductAnalyticsError('');

    try {
      const res = await fetchAsCoordinator(`/coordinator/api/store/analytics/products/${productId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load data. Please try again.');
      setProductAnalyticsDetails(mapProductAnalyticsPayload(data, productContext));
    } catch (error) {
      console.error(error);
      setProductAnalyticsError('Failed to load data. Please try again.');
    } finally {
      setProductAnalyticsLoading(false);
    }
  }, [mapProductAnalyticsPayload]);

  const openProductAnalytics = async (row) => {
    const productId = String(row?.product?._id || row?._id || '').trim();
    const productContext = {
      _id: productId,
      name: row?.product?.name || row?.name || 'Product'
    };
    await fetchProductAnalyticsDetails(productContext);
  };

  // --- Reviews Logic ---
  const fetchReviews = async (productId) => {
    setReviewsLoading(true);
    try {
      const res = await fetchAsCoordinator(`/coordinator/api/store/reviews?productId=${productId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch reviews');
      setReviews(data.reviews || []);
    } catch (e) {
      console.error(e);
      setReviews([]);
      showMessage(e.message || 'Failed to fetch reviews', 'error');
    } finally {
      setReviewsLoading(false);
    }
  };

  const openReviews = (product) => {
    setSelectedProductForReviews(product);
    fetchReviews(product._id);
  };

  const filteredOrders = useMemo(() => {
    const query = orderSearch.trim().toLowerCase();
    return (orders || []).filter((order) => {
      const status = normalizeOrderStatus(order.status);
      if (orderFilter !== 'all' && status !== orderFilter) return false;
      if (!query) return true;

      const shortId = String(order._id || '').slice(-8).toLowerCase();
      const fullId = String(order._id || '').toLowerCase();
      const customer = String(order?.user?.name || order?.user_email || '').toLowerCase();
      const itemNames = (order.items || [])
        .map((item) => String(item?.name || '').toLowerCase())
        .join(' ');

      return shortId.includes(query) || fullId.includes(query) || customer.includes(query) || itemNames.includes(query);
    });
  }, [orders, orderFilter, orderSearch, normalizeOrderStatus]);

  const orderStats = useMemo(() => ({
    total: (orders || []).length,
    pending: (orders || []).filter((o) => normalizeOrderStatus(o.status) === 'pending').length,
    processing: (orders || []).filter((o) => normalizeOrderStatus(o.status) === 'processing').length,
    packed: (orders || []).filter((o) => normalizeOrderStatus(o.status) === 'packed').length,
    shipped: (orders || []).filter((o) => normalizeOrderStatus(o.status) === 'shipped').length,
    delivered: (orders || []).filter((o) => normalizeOrderStatus(o.status) === 'delivered').length,
    cancelled: (orders || []).filter((o) => normalizeOrderStatus(o.status) === 'cancelled').length
  }), [orders, normalizeOrderStatus]);

  return (
    <div style={{ minHeight: '100vh' }}>
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; }
        body, #root { min-height: 100vh; }
        .page { font-family: 'Playfair Display', serif; background-color: var(--page-bg); min-height: 100vh; display:flex; color: var(--text-color); }
        .content { flex-grow:1; margin-left:0; padding:2rem; }
        h1 { font-family:'Cinzel', serif; color:var(--sea-green); margin-bottom:1.5rem; font-size:2.5rem; display:flex; align-items:center; gap:1rem; }
        .tabs { display:flex; gap:1rem; margin-bottom:2rem; border-bottom:1px solid var(--card-border); padding-bottom:1rem; }
        .tab-btn { background:none; border:none; color:var(--text-color); font-family:'Cinzel', serif; font-size:1.1rem; cursor:pointer; padding:0.5rem 1rem; border-radius:8px; transition:all 0.3s ease; opacity:0.7; }
        .tab-btn:hover { background:rgba(var(--sea-green-rgb), 0.1); opacity:1; }
        .tab-btn.active { background:var(--sea-green); color:var(--on-accent); opacity:1; }
        .updates-section { background:var(--card-bg); border-radius:15px; padding:2rem; margin-bottom:2rem; border:1px solid var(--card-border); }
        .form-group { margin-bottom: 1rem; }
        .form-label { font-family:'Cinzel', serif; color:var(--sea-green); margin-bottom:8px; display:block; }
        .form-input { width:100%; padding:0.8rem; border:2px solid var(--sea-green); border-radius:8px; font-family:'Playfair Display', serif; background:var(--card-bg); color:var(--text-color); }
        .btn-primary { background:var(--sea-green); color:var(--on-accent); border:none; padding:0.8rem 1.5rem; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; display:inline-flex; align-items:center; gap:0.5rem; }
        .message { margin-bottom:1rem; padding:0.75rem 1rem; border-radius:8px; }
        .message.success { color:#1b5e20; background:rgba(76,175,80,0.15); }
        .message.error { color:#c62828; background:rgba(198,40,40,0.15); }
        .products-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:1.5rem; }
        .product-card { background:var(--card-bg); border-radius:12px; overflow:hidden; border:1px solid var(--card-border); transition:transform 0.3s; }
        .product-card:hover { transform:translateY(-5px); }
        .order-table { width:100%; border-collapse:collapse; margin-top:1rem; }
        .order-table th, .order-table td { padding:1rem; text-align:left; border-bottom:1px solid var(--card-border); }
        .order-table th { color:var(--sea-green); font-family:'Cinzel', serif; }
        .status-badge { padding:0.3rem 0.8rem; border-radius:20px; font-size:0.8rem; font-weight:bold; text-transform:uppercase; }
        .status-pending { background:rgba(255,193,7,0.2); color:#ffc107; }
        .status-confirmed { background:rgba(255,193,7,0.2); color:#ffc107; }
        .status-processing { background:rgba(23,162,184,0.2); color:#17a2b8; }
        .status-packed { background:rgba(23,162,184,0.2); color:#17a2b8; }
        .status-shipped { background:rgba(0,123,255,0.2); color:#007bff; }
        .status-delivered { background:rgba(40,167,69,0.2); color:#28a745; }
        .status-cancelled { background:rgba(198,40,40,0.2); color:#c62828; }
        .analytics-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:2rem; }
        .analytics-table { width:100%; border-collapse:collapse; margin-top:1rem; }
        .analytics-table th, .analytics-table td { padding:0.9rem; border-bottom:1px solid var(--card-border); text-align:left; }
        .analytics-table th { color:var(--sea-green); font-family:'Cinzel', serif; }
        .stat-card { background:rgba(var(--sea-green-rgb), 0.05); padding:1.5rem; border-radius:12px; border:1px solid rgba(var(--sea-green-rgb), 0.2); text-align:center; }
        .stat-val { font-size:2rem; font-weight:bold; color:var(--sea-green); margin:0.5rem 0; }
        .review-modal { position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.8); z-index:2000; display:flex; justify-content:center; alignItems:center; padding:2rem; }
        .review-content { background:var(--card-bg); padding:2rem; borderRadius:15px; width:100%; max-width:600px; max-height:80vh; overflow-y:auto; position:relative; }
        .analytics-detail-content { background:var(--card-bg); padding:2rem; border-radius:15px; width:100%; max-width:900px; max-height:85vh; overflow-y:auto; position:relative; }
      `}</style>

      <div className="page player-neo">
        <AnimatedSidebar links={coordinatorLinks} logo={<i className="fas fa-chess" />} title="ChessHive" />

        <div style={{ position: 'fixed', top: 18, right: 18, zIndex: 1001, display: 'flex', gap: '12px', alignItems: 'center' }}>
          <motion.button onClick={toggleTheme} className="btn-primary" style={{ width: 40, height: 40, padding: 0, justifyContent: 'center' }}>
            <i className={isDark ? 'fas fa-sun' : 'fas fa-moon'} />
          </motion.button>
        </div>

        <div className="content">
          <h1><i className="fas fa-store" /> Store Management</h1>

          {message && <div className={`message ${message.type}`}>{message.text}</div>}

          <div className="tabs">
            <select 
              value={activeTab} 
              onChange={(e) => setActiveTab(e.target.value)}
              style={{
                background: 'var(--card-bg)',
                border: '2px solid var(--sea-green)',
                borderRadius: '8px',
                color: 'var(--text-color)',
                fontFamily: "'Cinzel', serif",
                fontSize: '1.1rem',
                padding: '0.5rem 1rem',
                cursor: 'pointer',
                minWidth: '200px'
              }}
            >
              <option value="products">Products</option>
              <option value="orders">Orders</option>
              <option value="analytics">Analytics</option>
              <option value="reviews">Reviews</option>
            </select>
          </div>

          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === 'products' && (
              <div className="updates-section">
                <h3>Add New Product</h3>
                <form onSubmit={handleAddProduct} style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Name</label>
                    <input className="form-input" value={form.productName} onChange={e => setForm({ ...form, productName: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <input className="form-input" value={form.productCategory} onChange={e => setForm({ ...form, productCategory: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Price</label>
                    <input className="form-input" type="number" step="0.01" value={form.productPrice} onChange={e => setForm({ ...form, productPrice: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Stock</label>
                    <input className="form-input" type="number" value={form.availability} onChange={e => setForm({ ...form, availability: e.target.value })} required />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Primary Image URL (optional)</label>
                    <input className="form-input" value={form.productImage} onChange={e => setForm({ ...form, productImage: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Additional Image URLs (one per line, optional)</label>
                    <textarea
                      className="form-input"
                      rows={3}
                      value={form.productImagesText}
                      onChange={e => setForm({ ...form, productImagesText: e.target.value })}
                      placeholder="https://.../img1.jpg&#10;https://.../img2.jpg"
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Upload Product Photos (multiple allowed)</label>
                    <input className="form-input" type="file" accept="image/*" multiple onChange={handleProductImageFiles} />
                    {!!fieldErrors.productImage && <div style={{ color: '#c62828', marginTop: 4, fontSize: '0.85rem' }}>{fieldErrors.productImage}</div>}
                    {productImagePreviews.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
                        {productImagePreviews.map((url, i) => (
                          <img key={i} src={url} alt={`preview-${i}`} style={{ width: 72, height: 72, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--card-border)' }} />
                        ))}
                      </div>
                    )}
                  </div>
                  <button type="submit" className="btn-primary" style={{ gridColumn: '1 / -1' }}>Add Product</button>
                </form>

                <h3 style={{ marginTop: '2rem' }}>Product List</h3>
                <div style={{ margin: '1rem 0' }}>
                  <input placeholder="Search..." value={filter.search} onChange={e => setFilter({ ...filter, search: e.target.value })} className="form-input" style={{ maxWidth: '300px' }} />
                </div>
                <div className="products-grid">
                  {filteredProducts.map((p) => {
                    const images = getProductImages(p);
                    const selected = Math.min(productImageIndex[p._id] || 0, Math.max(images.length - 1, 0));
                    const currentImage = images[selected] || '/images/placeholder.jpg';
                    return (
                    <div
                      key={p._id}
                      className="product-card"
                      onClick={() => openProductAnalytics(p)}
                      style={{ cursor: 'pointer' }}
                      title="Click to view product analytics"
                    >
                      <img
                        src={currentImage}
                        alt={p.name}
                        style={{ width: '100%', height: '150px', objectFit: 'cover' }}
                      />
                      {images.length > 1 && (
                        <div style={{ display: 'flex', gap: '0.35rem', padding: '0.5rem 0.5rem 0', overflowX: 'auto' }}>
                          {images.map((img, idx) => (
                            <img
                              key={`${p._id}-${idx}`}
                              src={img}
                              alt={`${p.name}-${idx + 1}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setProductImageIndex((prev) => ({ ...prev, [p._id]: idx }));
                              }}
                              style={{
                                width: 42,
                                height: 42,
                                objectFit: 'cover',
                                borderRadius: 6,
                                border: idx === selected ? '2px solid var(--sea-green)' : '1px solid var(--card-border)',
                                cursor: 'pointer',
                                flexShrink: 0
                              }}
                            />
                          ))}
                        </div>
                      )}
                      <div style={{ padding: '1rem' }}>
                        <h4 style={{ color: 'var(--sea-green)', marginBottom: '0.5rem' }}>{p.name}</h4>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                          <span>{'\u20B9'}{p.price}</span>
                          <span>Stock: {p.availability}</span>
                        </div>
                        {images.length > 1 && (
                          <div style={{ fontSize: '0.78rem', opacity: 0.75, marginBottom: '0.5rem' }}>
                            {images.length} images available
                          </div>
                        )}
                        <div style={{ fontSize: '0.78rem', opacity: 0.75, marginBottom: '0.5rem' }}>
                          Click card to view full product stats
                        </div>
                        <button
                          className="btn-primary"
                          style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleReviewVisibility(p._id);
                          }}
                        >
                          {p.comments_enabled ? 'Disable Reviews' : 'Enable Reviews'}
                        </button>
                      </div>
                    </div>
                  );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'orders' && (
              <div className="updates-section">
                <h3>Order Management</h3>
                {!ordersLoading && orders.length > 0 && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.65rem', marginTop: '1rem' }}>
                      {[
                        { label: 'All', key: 'all', count: orderStats.total },
                        { label: 'Pending', key: 'pending', count: orderStats.pending },
                        { label: 'Processing', key: 'processing', count: orderStats.processing },
                        { label: 'Packed', key: 'packed', count: orderStats.packed },
                        { label: 'Shipped', key: 'shipped', count: orderStats.shipped },
                        { label: 'Delivered', key: 'delivered', count: orderStats.delivered },
                        { label: 'Cancelled', key: 'cancelled', count: orderStats.cancelled }
                      ].map((entry) => (
                        <button
                          key={entry.key}
                          type="button"
                          onClick={() => setOrderFilter(entry.key)}
                          style={{
                            background: orderFilter === entry.key ? 'rgba(var(--sea-green-rgb, 27, 94, 63), 0.15)' : 'var(--card-bg)',
                            border: orderFilter === entry.key ? '2px solid var(--sea-green)' : '1px solid var(--card-border)',
                            borderRadius: 10,
                            color: 'var(--text-color)',
                            padding: '0.6rem 0.5rem',
                            cursor: 'pointer',
                            fontFamily: "'Playfair Display', serif"
                          }}
                        >
                          <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>{entry.count}</div>
                          <div style={{ fontSize: '0.78rem', opacity: 0.85 }}>{entry.label}</div>
                        </button>
                      ))}
                    </div>
                    <div style={{ marginTop: '0.85rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <input
                        className="form-input"
                        type="search"
                        value={orderSearch}
                        onChange={(e) => setOrderSearch(e.target.value)}
                        placeholder="Search by order ID, customer, or product..."
                        style={{ maxWidth: '420px' }}
                      />
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => {
                          setOrderFilter('all');
                          setOrderSearch('');
                        }}
                        style={{ padding: '0.55rem 0.8rem' }}
                      >
                        Clear Filters
                      </button>
                      <div style={{ fontSize: '0.85rem', opacity: 0.75 }}>
                        Showing {filteredOrders.length} of {orders.length} orders
                      </div>
                    </div>
                  </>
                )}
                {ordersLoading ? <p>Loading orders...</p> : (
                  orders.length === 0 ? <p>No orders found.</p> : (
                    filteredOrders.length === 0 ? <p>No orders match the selected filters.</p> : (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="order-table">
                        <thead>
                          <tr>
                            <th>Order ID</th>
                            <th>Customer</th>
                            <th>Date</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredOrders.map(o => {
                            const status = normalizeOrderStatus(o.status);
                            const nextOptions = getNextOrderStatusOptions(status);
                            return (
                              <tr key={o._id}>
                                <td>{String(o._id || '').slice(-8).toUpperCase()}</td>
                                <td>{o.user ? o.user.name : o.user_email}</td>
                                <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                                <td>{'\u20B9'}{Number(o.coordinatorAmount ?? o.totalAmount ?? o.total ?? 0).toFixed(2)}</td>
                                <td><span className={`status-badge status-${status}`}>{formatOrderStatus(status)}</span></td>
                                <td>
                                  {nextOptions.length > 0 ? (
                                    <select
                                      className="form-input"
                                      style={{ padding: '0.4rem', width: 'auto' }}
                                      onChange={(e) => updateOrderStatus(o._id, e.target.value)}
                                      value=""
                                    >
                                      <option value="" disabled>Update Status</option>
                                      {nextOptions.map((opt) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span style={{ opacity: 0.75, fontSize: '0.85rem' }}>No actions</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    )
                  )
                )}
              </div>
            )}

            {activeTab === 'analytics' && (
              <div className="updates-section">
                <h3>Store Analytics</h3>
                {analyticsLoading ? <p>Loading analytics...</p> : (
                  !analytics ? <p>No data available.</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                      <div className="analytics-grid">
                        <div className="stat-card">
                          <h3>Total Revenue</h3>
                          <div className="stat-val">{'\u20B9'}{Number(analytics.totalRevenue || 0).toFixed(2)}</div>
                        </div>
                        <div className="stat-card">
                          <h3>Most Sold Product</h3>
                          <div className="stat-val" style={{ fontSize: '1.2rem' }}>{analytics.mostSoldProduct?.product?.name || 'N/A'}</div>
                          <div>{analytics.mostSoldProduct?.totalSold || 0} sold</div>
                        </div>
                      </div>

                      <div className="analytics-grid">
                        <div style={{ height: '300px' }}>
                          <h4 style={{ textAlign: 'center', marginBottom: '1rem' }}>Monthly Revenue</h4>
                          <Line data={{
                            labels: (analytics.monthlyRevenue || []).map(m => `${m?._id?.month || 0}/${m?._id?.year || 0}`),
                            datasets: [{
                              label: 'Revenue',
                              data: (analytics.monthlyRevenue || []).map(m => Number(m?.revenue || 0)),
                              borderColor: '#2E8B57',
                              backgroundColor: 'rgba(46,139,87,0.2)',
                              tension: 0.4
                            }]
                          }} options={{ responsive: true, maintainAspectRatio: false }} />
                        </div>
                        <div style={{ height: '300px' }}>
                          <h4 style={{ textAlign: 'center', marginBottom: '1rem' }}>Product Sales</h4>
                          <Bar data={{
                            labels: (analytics.productRevenue || []).map(p => p?.product?.name || 'Unknown'),
                            datasets: [{
                              label: 'Sold Count',
                              data: (analytics.productRevenue || []).map(p => Number(p?.sold || 0)),
                              backgroundColor: 'rgba(54, 162, 235, 0.6)'
                            }]
                          }} options={{ responsive: true, maintainAspectRatio: false }} />
                        </div>
                      </div>

                    </div>
                  )
                )}
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="updates-section">
                <h3>Manage Reviews</h3>
                <p>Select a product to view its reviews.</p>
                <div className="products-grid" style={{ marginTop: '1rem' }}>
                  {productsList.map(p => (
                    <div key={p._id} className="product-card" onClick={() => openReviews(p)} style={{ cursor: 'pointer' }}>
                      <div style={{ padding: '1rem', textAlign: 'center' }}>
                        <h4 style={{ color: 'var(--sea-green)' }}>{p.name}</h4>
                        <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Click to view reviews</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {selectedProductAnalytics && (
        <div className="review-modal">
          <div className="analytics-detail-content">
            <button
              onClick={() => {
                setSelectedProductAnalytics(null);
                setProductAnalyticsDetails(null);
                setProductAnalyticsError('');
              }}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-color)', fontSize: '1.5rem', cursor: 'pointer' }}
            >
              <i className="fas fa-times" />
            </button>
            <h3 style={{ marginBottom: '1rem' }}>Product Analytics: {selectedProductAnalytics.name}</h3>
            {productAnalyticsLoading ? (
              <p>Loading product analytics...</p>
            ) : productAnalyticsError ? (
              <div style={{ border: '1px solid rgba(198, 40, 40, 0.35)', background: 'rgba(198, 40, 40, 0.08)', padding: '1rem', borderRadius: 10 }}>
                <p style={{ color: '#c62828', marginBottom: '0.75rem' }}>{productAnalyticsError}</p>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => fetchProductAnalyticsDetails(selectedProductAnalytics)}
                >
                  <i className="fas fa-rotate-right" /> Retry
                </button>
              </div>
            ) : !productAnalyticsDetails ? (
              <div style={{ border: '1px solid var(--card-border)', background: 'rgba(var(--sea-green-rgb, 27, 94, 63), 0.04)', padding: '1rem', borderRadius: 10 }}>
                <p style={{ marginBottom: '0.75rem' }}>No analytics data available for this product.</p>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => fetchProductAnalyticsDetails(selectedProductAnalytics)}
                >
                  <i className="fas fa-rotate-right" /> Retry
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="analytics-grid" style={{ gap: '1rem' }}>
                  <div className="stat-card">
                    <h4>Units Sold</h4>
                    <div className="stat-val">{Number(productAnalyticsDetails.unitsSold || 0)}</div>
                  </div>
                  <div className="stat-card">
                    <h4>Total Revenue</h4>
                    <div className="stat-val">{'\u20B9'}{Number(productAnalyticsDetails.totalRevenue || 0).toFixed(2)}</div>
                  </div>
                </div>

                <div style={{ height: 280 }}>
                  <h4 style={{ marginBottom: '0.75rem', textAlign: 'center' }}>Revenue Trend</h4>
                  <Line
                    data={{
                      labels: (productAnalyticsDetails.dateWiseSales || []).map((entry) => entry.date),
                      datasets: [
                        {
                          label: 'Revenue',
                          data: (productAnalyticsDetails.dateWiseSales || []).map((entry) => Number(entry.revenue || 0)),
                          borderColor: '#2E8B57',
                          backgroundColor: 'rgba(46,139,87,0.2)',
                          tension: 0.3
                        }
                      ]
                    }}
                    options={{ responsive: true, maintainAspectRatio: false }}
                  />
                </div>

                <div style={{ height: 280 }}>
                  <h4 style={{ marginBottom: '0.75rem', textAlign: 'center' }}>Date-wise Units Sold</h4>
                  <Bar
                    data={{
                      labels: (productAnalyticsDetails.dateWiseSales || []).map((entry) => entry.date),
                      datasets: [
                        {
                          label: 'Units Sold',
                          data: (productAnalyticsDetails.dateWiseSales || []).map((entry) => Number(entry.unitsSold || 0)),
                          backgroundColor: 'rgba(29, 126, 168, 0.65)'
                        }
                      ]
                    }}
                    options={{ responsive: true, maintainAspectRatio: false }}
                  />
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Units Sold</th>
                        <th>Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(productAnalyticsDetails.dateWiseSales || []).length === 0 ? (
                        <tr><td colSpan={3}>No date-wise sales available.</td></tr>
                      ) : (
                        (productAnalyticsDetails.dateWiseSales || []).map((entry) => (
                          <tr key={entry.date}>
                            <td>{entry.date}</td>
                            <td>{Number(entry.unitsSold || 0)}</td>
                            <td>{'\u20B9'}{Number(entry.revenue || 0).toFixed(2)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedProductForReviews && (
        <div className="review-modal">
          <div className="review-content">
            <button
              onClick={() => setSelectedProductForReviews(null)}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-color)', fontSize: '1.5rem', cursor: 'pointer' }}
            >
              <i className="fas fa-times" />
            </button>
            <h3>Reviews: {selectedProductForReviews.name}</h3>
            {reviewsLoading ? <p>Loading...</p> : (
              reviews.length === 0 ? <p>No reviews visible.</p> : (
                <div style={{ marginTop: '1rem' }}>
                  {reviews.map((r, i) => (
                    <div key={i} style={{ borderBottom: '1px solid var(--card-border)', padding: '1rem 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong>{r.user_name || 'User'}</strong>
                        <span>{new Date(r.review_date).toLocaleDateString()}</span>
                      </div>
                      <div style={{ color: 'gold', margin: '0.3rem 0' }}>
                        {[...Array(5)].map((_, si) => <i key={si} className={`fas fa-star ${si < r.rating ? '' : 'opt-50'}`} style={{ opacity: si < r.rating ? 1 : 0.3 }} />)}
                      </div>
                      <p>{r.comment}</p>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default StoreManagement;







