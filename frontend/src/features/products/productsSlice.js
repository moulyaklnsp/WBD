import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

function normalizeProduct(product = {}) {
  const imageUrls = Array.from(new Set([
    ...(Array.isArray(product.image_urls)
      ? product.image_urls
      : (typeof product.image_urls === 'string'
          ? product.image_urls.split(',').map((s) => s.trim())
          : [])),
    product.image_url,
    product.imageUrl,
    product.image
  ].filter(Boolean)));

  const id = product?._id?.toString ? product._id.toString() : String(product?._id || '');

  return {
    ...product,
    description: product.description || product.desc || product.productDescription || '',
    _id: id,
    image_urls: imageUrls,
    image_url: product.image_url || imageUrls[0] || '',
    imageUrl: product.imageUrl || imageUrls[0] || '',
    image: product.image || imageUrls[0] || '',
    comments_enabled: !!product.comments_enabled,
    canReview: !!product.canReview
  };
}

// mode: 'coordinator' | 'player' (defaults to 'coordinator')
export const fetchProducts = createAsyncThunk('products/fetchProducts', async (mode = 'coordinator', thunkAPI) => {
  try {
    const route = mode === 'player' ? '/player/api/store' : '/coordinator/api/store/products';
    const res = await fetch(route, { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return thunkAPI.rejectWithValue(data);
    // normalize: if player route returns object with products field
    if (mode === 'player') {
      const products = Array.isArray(data.products) ? data.products.map(normalizeProduct) : [];
      return { products, meta: data };
    }
    const products = Array.isArray(data.products) ? data.products.map(normalizeProduct) : (Array.isArray(data) ? data.map(normalizeProduct) : []);
    return { products };
  } catch (err) {
    return thunkAPI.rejectWithValue({ message: err.message || 'Network error' });
  }
});

export const addProduct = createAsyncThunk('products/addProduct', async (payload, thunkAPI) => {
  try {
    const imageFiles = Array.isArray(payload.imageFiles) ? payload.imageFiles.filter(Boolean) : [];
    const hasFile = imageFiles.length > 0 || !!payload.imageFile;
    const body = hasFile ? (() => {
      const fd = new FormData();
      fd.append('productName', payload.name ?? '');
      fd.append('productCategory', payload.category ?? '');
      fd.append('price', String(payload.price ?? ''));
      fd.append('availability', String(payload.availability ?? ''));
      if (payload.imageUrls && Array.isArray(payload.imageUrls)) {
        fd.append('imageUrls', payload.imageUrls.join(','));
      }
      if (imageFiles.length > 0) {
        imageFiles.forEach((file) => fd.append('images', file));
      } else if (payload.imageFile) {
        fd.append('image', payload.imageFile);
      }
      return fd;
    })() : JSON.stringify({
      // canonical
      name: payload.name,
      category: payload.category,
      price: payload.price,
      imageUrl: payload.imageUrl,
      imageUrls: payload.imageUrls,
      availability: payload.availability,
      // legacy/alternate keys for backend flexibility
      productName: payload.name,
      productCategory: payload.category,
      image_url: payload.imageUrl,
      stock: payload.availability,
    });

    const res = await fetch('/coordinator/api/store/addproducts', {
      method: 'POST',
      headers: hasFile ? undefined : { 'Content-Type': 'application/json' },
      credentials: 'include',
      body,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return thunkAPI.rejectWithValue(data);
    return data;
  } catch (err) {
    return thunkAPI.rejectWithValue({ message: err.message || 'Network error' });
  }
});

const initialState = {
  products: [],
  loading: false,
  error: null,
  meta: null,
};

const productsSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(fetchProducts.fulfilled, (s, a) => { s.loading = false; s.products = a.payload.products || []; s.meta = a.payload.meta || null; })
      .addCase(fetchProducts.rejected, (s, a) => { s.loading = false; s.error = a.payload?.message || a.error?.message || 'Failed to load products'; })

      .addCase(addProduct.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(addProduct.fulfilled, (s, a) => { s.loading = false; /* caller should refetch */ })
      .addCase(addProduct.rejected, (s, a) => { s.loading = false; s.error = a.payload?.message || a.error?.message || 'Failed to add product'; });
  }
});

export default productsSlice.reducer;
