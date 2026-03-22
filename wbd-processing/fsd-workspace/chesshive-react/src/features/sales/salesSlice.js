import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export const fetchMonthlySales = createAsyncThunk('sales/fetchMonthlySales', async (month = '', thunkAPI) => {
  try {
    const route = month ? `/organizer/api/sales/monthly?month=${month}` : '/organizer/api/sales/monthly';
    const res = await fetch(route, { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return thunkAPI.rejectWithValue(data);
    return data;
  } catch (err) {
    return thunkAPI.rejectWithValue({ message: err.message || 'Network error' });
  }
});

export const fetchYearlySales = createAsyncThunk('sales/fetchYearlySales', async (_, thunkAPI) => {
  try {
    const res = await fetch('/organizer/api/sales/yearly', { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return thunkAPI.rejectWithValue(data);
    return data;
  } catch (err) {
    return thunkAPI.rejectWithValue({ message: err.message || 'Network error' });
  }
});

const initialState = {
  monthly: { data: [], loading: false, error: null },
  yearly: { data: [], loading: false, error: null }
};

const salesSlice = createSlice({
  name: 'sales',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchMonthlySales.pending, (s) => { s.monthly.loading = true; s.monthly.error = null; })
      .addCase(fetchMonthlySales.fulfilled, (s, a) => { s.monthly.loading = false; s.monthly.data = a.payload || []; })
      .addCase(fetchMonthlySales.rejected, (s, a) => { s.monthly.loading = false; s.monthly.error = a.payload?.message || a.error?.message; })

      .addCase(fetchYearlySales.pending, (s) => { s.yearly.loading = true; s.yearly.error = null; })
      .addCase(fetchYearlySales.fulfilled, (s, a) => { s.yearly.loading = false; s.yearly.data = a.payload || []; })
      .addCase(fetchYearlySales.rejected, (s, a) => { s.yearly.loading = false; s.yearly.error = a.payload?.message || a.error?.message; });
  }
});

export default salesSlice.reducer;
