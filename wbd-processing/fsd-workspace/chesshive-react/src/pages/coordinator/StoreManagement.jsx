import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProducts, addProduct } from '../../features/products/productsSlice';
import SearchFilter from '../../components/SearchFilter';

// React conversion of views/coordinator/store_management.html

const VISIBLE_COUNT = 8;

function StoreManagement() {
  const dispatch = useDispatch();
  const productState = useSelector((s) => s.products || {});
  const [visible, setVisible] = useState(VISIBLE_COUNT);

  const [form, setForm] = useState({
    productName: '',
    productCategory: '',
    productPrice: '',
    productImage: '',
    availability: ''
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [message, setMessage] = useState(null); // { type: 'success'|'error', text: string }

  const [filter, setFilter] = useState({ search: '', category: '' });
  const productsList = useMemo(() => productState.products || [], [productState.products]);
  const filteredProducts = useMemo(() => {
    return productsList.filter((p) => {
      if ((Number(p.availability) || 0) <= 0) return false;
      if (filter.category && String(p.category || '').toLowerCase() !== String(filter.category || '').toLowerCase()) return false;
      if (filter.search) {
        const s = filter.search.toLowerCase();
        return String(p.name || '').toLowerCase().includes(s) || String(p.category || '').toLowerCase().includes(s);
      }
      return true;
    });
  }, [productsList, filter]);

  const showMessage = (text, type = 'success') => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  useEffect(() => {
    // Fetch products via Redux slice on mount
    dispatch(fetchProducts('coordinator'));
    setVisible(VISIBLE_COUNT);
  }, [dispatch]);

  const validate = () => {
    const errors = {};
    const name = form.productName.trim();
    const category = form.productCategory.trim();
    const price = parseFloat(form.productPrice);
    const imageUrl = form.productImage.trim();
    const availability = parseInt(form.availability);

    // Name
    if (!name) errors.productName = 'Product name is required.';
    else if (name.length < 3) errors.productName = 'Product name must be at least 3 characters long.';
    else if (!/^[a-zA-Z0-9\s\-&]+$/.test(name)) errors.productName = 'Only letters, numbers, spaces, hyphens, and & are allowed.';

    // Category
    if (!category) errors.productCategory = 'Product category is required.';
    else if (category.length < 3) errors.productCategory = 'Product category must be at least 3 characters long.';
    else if (!/^[a-zA-Z0-9\s\-&]+$/.test(category)) errors.productCategory = 'Only letters, numbers, spaces, hyphens, and & are allowed.';

    // Price
    if (isNaN(price)) errors.productPrice = 'Price is required.';
    else if (price < 0) errors.productPrice = 'Price cannot be negative.';

    // Image
    const isValidImg =
      imageUrl.startsWith('http://') ||
      imageUrl.startsWith('https://') ||
      (imageUrl.startsWith('data:image/') && imageUrl.includes(';base64,'));
    if (!imageUrl) errors.productImage = 'Image URL is required.';
    else if (!isValidImg) errors.productImage = 'Provide a valid http/https URL or data:image base64 string.';

    // Availability
    if (isNaN(availability)) errors.availability = 'Availability is required';
    else if (availability < 0) errors.availability = 'Availability cannot be negative.';
    else if (availability > 1000) errors.availability = 'Availability cannot exceed 1000.';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      showMessage('Please correct the errors in the form.', 'error');
      return;
    }
    const payload = {
      productName: form.productName.trim(),
      productCategory: form.productCategory.trim(),
      price: parseFloat(form.productPrice),
      imageUrl: form.productImage.trim(),
      availability: parseInt(form.availability)
    };
    try {
      const resultAction = await dispatch(addProduct({
        name: payload.productName,
        category: payload.productCategory,
        price: payload.price,
        imageUrl: payload.imageUrl,
        availability: payload.availability,
      }));
      if (addProduct.rejected.match(resultAction)) throw new Error(resultAction.payload?.message || 'Failed to add product');
      await dispatch(fetchProducts('coordinator'));
      setForm({ productName: '', productCategory: '', productPrice: '', productImage: '', availability: '' });
      showMessage('Product added successfully!', 'success');
    } catch (err) {
      console.error('POST error:', err);
      showMessage(`Failed to add product: ${err.message}`, 'error');
    }
  };

  const styles = {
    root: { fontFamily: 'Playfair Display, serif', backgroundColor: '#FFFDD0', minHeight: '100vh', padding: '2rem' },
    container: { maxWidth: 1200, margin: '0 auto' },
    h2: { fontFamily: 'Cinzel, serif', fontSize: '2.5rem', color: '#2E8B57', marginBottom: '2rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' },
    card: { background: 'var(--card-bg)', borderRadius: 15, padding: '2rem', boxShadow: 'none', marginBottom: '2rem', border: '1px solid var(--card-border)' },
    label: { fontFamily: 'Cinzel, serif', color: '#2E8B57', marginBottom: 8, display: 'block' },
    input: (hasError) => ({ width: '100%', padding: '0.8rem', border: `2px solid ${hasError ? '#c62828' : '#2E8B57'}`, borderRadius: 8, fontFamily: 'Playfair Display, serif' }),
    error: { color: '#c62828', fontSize: '0.9rem', marginTop: 4 },
    btn: { background: '#2E8B57', color: '#fff', border: 'none', padding: '1rem', borderRadius: 8, cursor: 'pointer', fontFamily: 'Cinzel, serif', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '2rem', marginTop: '2rem' },
    cardProd: { background: 'var(--card-bg)', borderRadius: 15, overflow: 'hidden', boxShadow: 'none', border: '1px solid var(--card-border)' },
    imgWrap: { width: '100%', height: 200, overflow: 'hidden' },
    img: { width: '100%', height: '100%', objectFit: 'cover' },
    info: { padding: '1.5rem' },
    price: { color: '#2E8B57', fontWeight: 'bold', marginBottom: 8 },
    available: { color: '#666' },
    moreWrap: { textAlign: 'center', margin: '2rem 0', display: 'flex', justifyContent: 'center', gap: '1rem' },
    moreBtn: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#87CEEB', color: '#2E8B57', textDecoration: 'none', padding: '0.8rem 1.5rem', borderRadius: 8, fontFamily: 'Cinzel, serif', fontWeight: 'bold', cursor: 'pointer', border: 'none' },
    backRow: { textAlign: 'right', marginTop: '2rem' },
    backLink: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#2E8B57', color: '#fff', textDecoration: 'none', padding: '0.8rem 1.5rem', borderRadius: 8, fontFamily: 'Cinzel, serif', fontWeight: 'bold' },
    empty: { textAlign: 'center', padding: '2rem', color: 'var(--sea-green)', fontStyle: 'italic', background: 'var(--card-bg)', borderRadius: 15, boxShadow: 'none', marginTop: '2rem', border: '1px solid var(--card-border)' },
    msg: (type) => ({ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: 8, color: type === 'success' ? '#1b5e20' : '#c62828', background: type === 'success' ? 'rgba(76,175,80,0.15)' : 'rgba(198,40,40,0.15)' })
  };

  // Utility for safe image URLs
  const getImgSrc = (imgSrc) => {
    let isValid = false;
    if (imgSrc && (imgSrc.startsWith('http://') || imgSrc.startsWith('https://'))) isValid = true;
    else if (imgSrc && imgSrc.startsWith('data:image/') && imgSrc.includes(';base64,') && imgSrc.length > 100) isValid = true;
    return isValid ? imgSrc : '/images/placeholder.jpg';
  };

  return (
    <div style={styles.root}>
      <div style={styles.container}>
        <h2 style={styles.h2}><span role="img" aria-label="bag">🛍️</span> Store Management</h2>

        <div style={styles.card}>
          {message && (
            <div style={styles.msg(message.type)}>
              <i className={`fas ${message.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`} aria-hidden="true" /> {message.text}
            </div>
          )}
          <form onSubmit={onSubmit}>
            <div>
              <label style={styles.label}><i className="fas fa-tag" aria-hidden="true"></i> Product Name:</label>
              <input
                style={styles.input(!!fieldErrors.productName)}
                type="text"
                value={form.productName}
                onChange={(e) => setForm({ ...form, productName: e.target.value })}
                required
              />
              {fieldErrors.productName && <div style={styles.error}>{fieldErrors.productName}</div>}
            </div>
            <div>
              <label style={styles.label}><i className="fas fa-tag" aria-hidden="true"></i> Product Category:</label>
              <input
                style={styles.input(!!fieldErrors.productCategory)}
                type="text"
                value={form.productCategory}
                onChange={(e) => setForm({ ...form, productCategory: e.target.value })}
                required
              />
              {fieldErrors.productCategory && <div style={styles.error}>{fieldErrors.productCategory}</div>}
            </div>
            <div>
              <label style={styles.label}><i className="fas fa-rupee-sign" aria-hidden="true"></i> Price:</label>
              <input
                style={styles.input(!!fieldErrors.productPrice)}
                type="number"
                step="0.01"
                value={form.productPrice}
                onChange={(e) => setForm({ ...form, productPrice: e.target.value })}
                required
              />
              {fieldErrors.productPrice && <div style={styles.error}>{fieldErrors.productPrice}</div>}
            </div>
            <div>
              <label style={styles.label}><i className="fas fa-image" aria-hidden="true"></i> Image URL:</label>
              <input
                style={styles.input(!!fieldErrors.productImage)}
                type="text"
                value={form.productImage}
                onChange={(e) => setForm({ ...form, productImage: e.target.value })}
                required
              />
              {fieldErrors.productImage && <div style={styles.error}>{fieldErrors.productImage}</div>}
            </div>
            <div>
              <label style={styles.label}><i className="fas fa-boxes" aria-hidden="true"></i> Availability:</label>
              <input
                style={styles.input(!!fieldErrors.availability)}
                type="number"
                value={form.availability}
                onChange={(e) => setForm({ ...form, availability: e.target.value })}
                required
              />
              {fieldErrors.availability && <div style={styles.error}>{fieldErrors.availability}</div>}
            </div>
            <button type="submit" style={styles.btn}>
              <i className="fas fa-plus-circle" aria-hidden="true"></i> Add Product
            </button>
          </form>
        </div>

        <h2 style={styles.h2}><span aria-hidden="true">🛍️</span> Products List</h2>

        <SearchFilter search={filter.search} category={filter.category} categories={[...new Set(productsList.map(p => p.category).filter(Boolean))]} onChange={setFilter} />

        {productState.loading && <div className="loading">Loading products…</div>}
        {!productState.loading && productState.error && (
          <div style={styles.empty}><i className="fas fa-box-open" aria-hidden="true"></i> {productState.error}</div>
        )}
        {!productState.loading && !productState.error && filteredProducts.length === 0 && (
          <div style={styles.empty}><i className="fas fa-box-open" aria-hidden="true"></i> No products available.</div>
        )}

        {!productState.loading && !productState.error && filteredProducts.length > 0 && (
          <>
            <div style={styles.grid}>
              {filteredProducts.slice(0, visible).map((p, idx) => (
                <div key={(p._id || idx) + ''} style={styles.cardProd}>
                  <div style={styles.imgWrap}>
                    <img src={getImgSrc(p.image_url || p.imageUrl)} alt={p.name} onError={(e)=>{ e.currentTarget.src='/images/placeholder.jpg'; e.currentTarget.alt='Image not available'; }} style={styles.img} />
                  </div>
                  <div style={styles.info}>
                    <h4 style={{ fontFamily: 'Cinzel, serif', color: '#2E8B57', marginBottom: '0.5rem', fontSize: '1.2rem' }}>{p.name}</h4>
                    <h4 style={{ fontFamily: 'Cinzel, serif', color: '#2E8B57', marginBottom: '0.5rem', fontSize: '1rem' }}>{p.category}</h4>
                    <p style={styles.price}><i className="fas fa-rupee-sign" aria-hidden="true"></i> {p.price}</p>
                    <p style={styles.available}><i className="fas fa-box" aria-hidden="true"></i> Available: {p.availability}</p>
                  </div>
                </div>
              ))}
            </div>
            <div style={styles.moreWrap}>
              {visible < filteredProducts.length && (
                <button style={styles.moreBtn} onClick={() => setVisible((v) => v + VISIBLE_COUNT)}>
                  <i className="fas fa-chevron-down" aria-hidden="true"></i> More
                </button>
              )}
              {visible > VISIBLE_COUNT && (
                <button style={styles.moreBtn} onClick={() => setVisible(VISIBLE_COUNT)}>
                  <i className="fas fa-chevron-up" aria-hidden="true"></i> Hide
                </button>
              )}
            </div>
          </>
        )}

        <div style={styles.backRow}>
          <Link to="/coordinator/coordinator_dashboard" style={styles.backLink}>
            <i className="fas fa-arrow-left" aria-hidden="true"></i> Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export default StoreManagement;
