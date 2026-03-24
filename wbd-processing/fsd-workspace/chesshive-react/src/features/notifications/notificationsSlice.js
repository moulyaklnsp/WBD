import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export const fetchNotifications = createAsyncThunk('notifications/fetchNotifications', async (_, thunkAPI) => {
  try {
    const res = await fetch('/api/notifications', { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return thunkAPI.rejectWithValue(data);
    return data.notifications || [];
  } catch (err) {
    return thunkAPI.rejectWithValue({ message: err.message || 'Network error' });
  }
});

export const markNotificationRead = createAsyncThunk('notifications/markRead', async (id, thunkAPI) => {
  try {
    const res = await fetch('/api/notifications/mark-read', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ id })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return thunkAPI.rejectWithValue(data);
    return id;
  } catch (err) {
    return thunkAPI.rejectWithValue({ message: err.message || 'Network error' });
  }
});

const initialState = { items: [], loading: false, error: null };

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    clearNotifications(state) { state.items = []; state.error = null; }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(fetchNotifications.fulfilled, (s, a) => { s.loading = false; s.items = a.payload || []; })
      .addCase(fetchNotifications.rejected, (s, a) => { s.loading = false; s.error = a.payload?.message || a.error?.message; })

      .addCase(markNotificationRead.pending, (s) => { s.error = null; })
      .addCase(markNotificationRead.fulfilled, (s, a) => { s.items = s.items.map(n => n._id === a.payload ? { ...n, read: true } : n); })
      .addCase(markNotificationRead.rejected, (s, a) => { s.error = a.payload?.message || a.error?.message; });
  }
});

export const { clearNotifications } = notificationsSlice.actions;
export default notificationsSlice.reducer;
