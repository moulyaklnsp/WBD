import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import AnimatedSidebar from '../../components/AnimatedSidebar';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import { motion } from 'framer-motion';
import { coordinatorLinks } from '../../constants/coordinatorLinks';
import { fetchAsCoordinator, safePut } from '../../utils/fetchWithRole';
import { fetchProducts } from '../../features/products/productsSlice';
import '../../styles/playerNeoNoir.css';
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






export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const productState = useSelector((s) => s.products || {});

  const [product, setProduct] = useState(null);
  const [productLoading, setProductLoading] = useState(true);

  // Analytics state
  const [productAnalyticsDetails, setProductAnalyticsDetails] = useState(null);
  const [productAnalyticsLoading, setProductAnalyticsLoading] = useState(false);
  const [productAnalyticsError, setProductAnalyticsError] = useState('');

  // Edit state
  const [editForm, setEditForm] = useState({ name: '', category: '', price: '', availability: '', description: '' });
  const [editImageFiles, setEditImageFiles] = useState([]);
  const [editImagePreviews, setEditImagePreviews] = useState([]);
  const [editRemovePublicIds, setEditRemovePublicIds] = useState([]);
  const [editRemoveUrls, setEditRemoveUrls] = useState([]);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  useEffect(() => {
    // ensure products list is available
    if (!productState.products || productState.products.length === 0) {
      dispatch(fetchProducts('coordinator'));
    }
  }, [dispatch, productState.products]);

  useEffect(() => {
    const p = (productState.products || []).find((x) => String(x._id) === String(id));
    if (p) {
      setProduct(p);
      setProductLoading(false);
      setEditForm({ name: p.name || '', category: p.category || '', price: p.price != null ? String(p.price) : '', availability: p.availability != null ? String(p.availability) : '', description: p.description || '' });
    } else {
      setProduct(null);
      setProductLoading(false);
    }
  }, [productState.products, id]);

  const showMessage = (text, type = 'success') => {
    if (type === 'error') window.alert(`Error: ${text}`); else window.alert(text);
  };

  const getProductImages = useCallback((product) => {
    return Array.from(new Set([
      ...(Array.isArray(product?.image_urls) ? product.image_urls : (typeof product?.image_urls === 'string' ? product.image_urls.split(',').map((s) => s.trim()) : [])),
      product?.image_url,
      product?.imageUrl,
      product?.image
    ].filter(Boolean)));
  }, []);

  const mapProductAnalyticsPayload = useCallback((payload, fallback = {}) => {
    const dateWiseSales = Array.isArray(payload?.dateWiseSales)
      ? payload.dateWiseSales.map((entry, idx) => ({
          date: entry?.date || `Unknown-${idx + 1}`,
          unitsSold: Number(entry?.unitsSold ?? entry?.units ?? entry?.sold ?? 0),
          revenue: Number(entry?.revenue ?? entry?.totalRevenue ?? 0)
        }))
      : [];

    return {
      product: { _id: payload?.product?._id || fallback._id || '', name: payload?.product?.name || payload?.productName || fallback.name || 'Product' },
      unitsSold: Number(payload?.unitsSold ?? payload?.totalSales ?? payload?.sold ?? 0),
      totalRevenue: Number(payload?.totalRevenue ?? payload?.revenue ?? 0),
      dateWiseSales
    };
  }, []);

  const fetchProductAnalyticsDetails = useCallback(async (productContext) => {
    const productId = String(productContext?._id || '').trim();
    if (!productId) return;
    setProductAnalyticsDetails(null);
    setProductAnalyticsLoading(true);
    setProductAnalyticsError('');
    try {
      const res = await fetchAsCoordinator(`/coordinator/api/store/analytics/products/${productId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load data.');
      setProductAnalyticsDetails(mapProductAnalyticsPayload(data, productContext));
    } catch (e) {
      console.error(e);
      setProductAnalyticsError('Failed to load analytics');
    } finally {
      setProductAnalyticsLoading(false);
    }
  }, [mapProductAnalyticsPayload]);

  const getPublicIdForImage = (product, img) => {
    if (!product) return '';
    const urls = Array.isArray(product.image_urls) ? product.image_urls : (typeof product.image_urls === 'string' ? product.image_urls.split(',').map(s => s.trim()) : []);
    const pubIds = Array.isArray(product.image_public_ids) ? product.image_public_ids : (product.image_public_id ? [product.image_public_id] : []);
    const idx = urls.findIndex(u => String(u).trim() === String(img).trim());
    if (idx >= 0 && pubIds[idx]) return pubIds[idx];
    if (String(product.image_url || '').trim() === String(img).trim()) return product.image_public_id || '';
    return '';
  };

  const toggleRemoveImage = (productArg, img) => {
    const pubId = getPublicIdForImage(productArg, img);
    if (pubId) {
      setEditRemovePublicIds((prev) => (prev.includes(pubId) ? prev.filter(p => p !== pubId) : [...prev, pubId]));
    } else {
      setEditRemoveUrls((prev) => (prev.includes(img) ? prev.filter(u => u !== img) : [...prev, img]));
    }
  };

  const handleEditFiles = (e) => {
    const files = Array.from(e.target.files || []);
    setEditImageFiles(files);
    setEditImagePreviews(files.map((f) => URL.createObjectURL(f)));
  };

  const saveProductUpdate = async () => {
    if (!product) return;
    setEditLoading(true);
    setEditError('');
    try {
      let res;
      if ((editImageFiles || []).length === 0 && (editRemovePublicIds || []).length === 0 && (editRemoveUrls || []).length === 0) {
        const payload = {
          name: editForm.name || '',
          category: editForm.category || '',
          price: editForm.price || '',
          availability: editForm.availability || '',
          description: editForm.description || ''
        };
        res = await safePut(`/coordinator/api/store/products/${product._id}`, payload);
      } else {
        const fd = new FormData();
        fd.append('name', editForm.name || '');
        fd.append('category', editForm.category || '');
        fd.append('price', editForm.price || '');
        fd.append('availability', editForm.availability || '');
        if (editForm.description != null) fd.append('description', editForm.description);
        if (editRemovePublicIds.length > 0) fd.append('removeImagePublicIds', editRemovePublicIds.join(','));
        if (editRemoveUrls.length > 0) fd.append('removeImageUrls', editRemoveUrls.join(','));
        for (const f of editImageFiles) fd.append('files', f);
        res = await fetchAsCoordinator(`/coordinator/api/store/products/${product._id}`, { method: 'PUT', body: fd });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Request failed with status ${res.status}`);
      showMessage('Product updated');
      await dispatch(fetchProducts('coordinator'));
      navigate('/coordinator/store_management');
    } catch (err) {
      console.error('Update failed', err);
      setEditError(err.message || 'Update failed');
    } finally {
      setEditLoading(false);
    }
  };

  const confirmDeleteProduct = async (productId) => {
    if (!productId) return;
    if (!window.confirm('Delete this product? This cannot be undone.')) return;
    try {
      const res = await fetchAsCoordinator(`/coordinator/api/store/products/${productId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete product');
      showMessage('Product deleted');
      await dispatch(fetchProducts('coordinator'));
      navigate('/coordinator/store_management');
    } catch (err) {
      showMessage(err.message || 'Delete failed', 'error');
    }
  };

  useEffect(() => {
    if (product) fetchProductAnalyticsDetails({ _id: product._id, name: product.name });
  }, [product, fetchProductAnalyticsDetails]);

  const [isDark, toggleTheme] = usePlayerTheme();

  return (
    <div style={{ minHeight: '100vh' }}>
      <style>{` .content-top-right { position: fixed; top: 18px; right: 18px; z-index: 1001; display:flex; gap:12px; align-items:center; } `}</style>
      <AnimatedSidebar links={coordinatorLinks} logo={<i className="fas fa-chess" />} title="ChessHive" />
      <div className="content-top-right">
        <motion.button onClick={toggleTheme} className="btn-primary" style={{ width: 40, height: 40, padding: 0, justifyContent: 'center' }}>
          <i className={isDark ? 'fas fa-sun' : 'fas fa-moon'} />
        </motion.button>
      </div>
      <div style={{ marginLeft: 0, padding: '2rem' }}>
        <button className="btn ghost" onClick={() => navigate('/coordinator/store_management')} style={{ marginBottom: '1rem' }}>Back to Store</button>
        <h1 style={{ marginBottom: '1rem' }}>{product ? product.name : 'Product'}</h1>

        {productLoading ? <p>Loading product...</p> : !product ? (
          <p>Product not found.</p>
        ) : (
          <div className="product-detail" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'stretch' }}>
            <section className="product-analytics-card">
              <h3>Analytics</h3>
              {productAnalyticsLoading ? <p>Loading analytics...</p> : productAnalyticsError ? (
                <div style={{ color: '#c62828' }}>{productAnalyticsError}</div>
              ) : productAnalyticsDetails ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div className="stat-card">
                      <div className="stat-label">Units Sold</div>
                      <div className="stat-val">{Number(productAnalyticsDetails.unitsSold || 0)}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Revenue</div>
                      <div className="stat-val">₹{Number(productAnalyticsDetails.totalRevenue || 0).toFixed(2)}</div>
                    </div>
                    <div style={{ marginLeft: 'auto' }}>
                      <button className="btn ghost" onClick={() => fetchProductAnalyticsDetails(product)} style={{ padding: '0.45rem 0.7rem' }}>Refresh</button>
                    </div>
                  </div>

                  <div style={{ height: 300 }}>
                    <Line data={{ labels: (productAnalyticsDetails.dateWiseSales || []).map(e => e.date), datasets: [{ label: 'Revenue', data: (productAnalyticsDetails.dateWiseSales || []).map(e => Number(e.revenue || 0)), borderColor: 'var(--sea-green)', backgroundColor: 'rgba(46,139,87,0.18)', tension: 0.3 }] }} options={{ responsive: true, maintainAspectRatio: false }} />
                  </div>

                  <div style={{ height: 300 }}>
                    <Bar data={{ labels: (productAnalyticsDetails.dateWiseSales || []).map(e => e.date), datasets: [{ label: 'Units Sold', data: (productAnalyticsDetails.dateWiseSales || []).map(e => Number(e.unitsSold || 0)), backgroundColor: 'rgba(29,126,168,0.65)' }] }} options={{ responsive: true, maintainAspectRatio: false }} />
                  </div>
                </div>
              ) : <p>No analytics available.</p>}
            </section>

            <section className="product-edit-section">
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '1rem' }}>
                <h3 style={{ marginBottom: '0.5rem' }}>Edit Product</h3>
              <label className="form-label">Name</label>
              <input className="form-input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              <label className="form-label" style={{ marginTop: '0.5rem' }}>Category</label>
              <input className="form-input" value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} />
              <label className="form-label" style={{ marginTop: '0.5rem' }}>Price</label>
              <input className="form-input" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} />
              <label className="form-label" style={{ marginTop: '0.5rem' }}>Stock</label>
              <input className="form-input" value={editForm.availability} onChange={(e) => setEditForm({ ...editForm, availability: e.target.value })} />
              <label className="form-label" style={{ marginTop: '0.5rem' }}>Description</label>
              <textarea className="form-input" style={{ minHeight: 120 }} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />

              <label className="form-label" style={{ marginTop: '0.5rem' }}>Existing Images</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                {getProductImages(product).map((img, idx) => {
                  const pubId = getPublicIdForImage(product, img) || '';
                  const marked = (pubId && editRemovePublicIds.includes(pubId)) || editRemoveUrls.includes(img);
                  return (
                    <div key={`${product._id}-${idx}`} style={{ position: 'relative' }}>
                      <img src={img} alt={`img-${idx}`} style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 8, border: marked ? '2px solid rgba(198,40,40,0.9)' : '1px solid var(--card-border)' }} />
                      <button type="button" onClick={() => toggleRemoveImage(product, img)} style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: 6, padding: '0.15rem 0.35rem', cursor: 'pointer' }}>
                        {marked ? 'Undo' : 'Remove'}
                      </button>
                    </div>
                  );
                })}
              </div>

              <label className="form-label">Upload New Images</label>
              <input type="file" accept="image/*" multiple onChange={handleEditFiles} className="form-input" />
              {editImagePreviews.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  {editImagePreviews.map((url, i) => (
                    <img key={i} src={url} alt={`new-${i}`} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8 }} />
                  ))}
                </div>
              )}

              {editError && <div style={{ color: '#c62828', marginTop: '0.5rem' }}>{editError}</div>}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.8rem' }}>
                <button className="btn-primary" onClick={saveProductUpdate} disabled={editLoading}>{editLoading ? 'Saving...' : 'Save'}</button>
                <button className="btn danger" onClick={() => confirmDeleteProduct(product._id)} disabled={editLoading}>Delete</button>
                <button className="btn ghost" onClick={() => navigate('/coordinator/store_management')} disabled={editLoading}>Cancel</button>
              </div>
            </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
