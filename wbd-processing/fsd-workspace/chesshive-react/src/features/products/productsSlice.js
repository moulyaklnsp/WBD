import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// mode: 'coordinator' | 'player' (defaults to 'coordinator')
export const fetchProducts = createAsyncThunk('products/fetchProducts', async (mode = 'coordinator', thunkAPI) => {
  try {
    const route = mode === 'player' ? '/player/api/store' : '/coordinator/api/store/products';
    const res = await fetch(route, { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return thunkAPI.rejectWithValue(data);
    // normalize: if player route returns object with products field
    if (mode === 'player') return { products: Array.isArray(data.products) ? data.products : [], meta: data };
    return { products: Array.isArray(data.products) ? data.products : data };
  } catch (err) {
    return thunkAPI.rejectWithValue({ message: err.message || 'Network error' });
  }
});

export const addProduct = createAsyncThunk('products/addProduct', async (payload, thunkAPI) => {
  try {
    const res = await fetch('/coordinator/api/store/addproducts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        // canonical
        name: payload.name,
        category: payload.category,
        price: payload.price,
        imageUrl: payload.imageUrl,
        availability: payload.availability,
        // legacy/alternate keys for backend flexibility
        productName: payload.name,
        productCategory: payload.category,
        image_url: payload.imageUrl,
        stock: payload.availability,
      }),
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
