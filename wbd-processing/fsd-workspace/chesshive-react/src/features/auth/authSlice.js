import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// Thunk: send login OTP
export const login = createAsyncThunk('auth/login', async (credentials, thunkAPI) => {
	try {
		const backendBase = 'http://localhost:3000';
		const res = await fetch(`${backendBase}/api/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(credentials),
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok) return thunkAPI.rejectWithValue(data);
		return data; // { success: true, message: 'OTP sent...' }
	} catch (err) {
		return thunkAPI.rejectWithValue({ message: err.message || 'Network error' });
	}
});

// Thunk: verify login OTP
export const verifyLoginOtp = createAsyncThunk('auth/verifyLoginOtp', async ({ email, otp }, thunkAPI) => {
	try {
		const res = await fetch('/api/verify-login-otp', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, otp }),
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok) return thunkAPI.rejectWithValue(data);
		return data; // { success: true, redirectUrl }
	} catch (err) {
		return thunkAPI.rejectWithValue({ message: err.message || 'Network error' });
	}
});

// Thunk: send signup OTP
export const signup = createAsyncThunk('auth/signup', async (signupData, thunkAPI) => {
	try {
		const res = await fetch('/api/signup', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(signupData),
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok) return thunkAPI.rejectWithValue(data);
		return data; // { success: true, message: 'OTP sent...' }
	} catch (err) {
		return thunkAPI.rejectWithValue({ message: err.message || 'Network error' });
	}
});

// Thunk: verify signup OTP
export const verifySignupOtp = createAsyncThunk('auth/verifySignupOtp', async ({ email, otp }, thunkAPI) => {
	try {
		const res = await fetch('/api/verify-signup-otp', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, otp }),
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok) return thunkAPI.rejectWithValue(data);
		return data; // { success: true, redirectUrl }
	} catch (err) {
		return thunkAPI.rejectWithValue({ message: err.message || 'Network error' });
	}
});

// Thunk: fetch current session from server to rehydrate store on app start
export const fetchSession = createAsyncThunk('auth/fetchSession', async (_, thunkAPI) => {
	try {
		const res = await fetch('/api/session');
		const data = await res.json().catch(() => ({}));
		if (!res.ok) return thunkAPI.rejectWithValue(data);
		return data; // expected { userEmail, userRole, username }
	} catch (err) {
		return thunkAPI.rejectWithValue({ message: err.message || 'Network error' });
	}
});

const initialState = {
	user: null,
	loading: false,
	otpSent: false,
	previewUrl: null,
	redirectUrl: null,
	error: null,
	restoreInfo: null,
};

const authSlice = createSlice({
	name: 'auth',
	initialState,
	reducers: {
		setUser(state, action) {
			state.user = action.payload;
		},
		logout(state) {
			state.user = null;
		},
		clearError(state) {
			state.error = null;
		}
	},
	extraReducers: (builder) => {
		builder
			.addCase(login.pending, (s) => { s.loading = true; s.error = null; })
			.addCase(login.fulfilled, (s, a) => {
				s.loading = false;
				if (a.payload && a.payload.success) {
					s.otpSent = true;
					s.previewUrl = a.payload.previewUrl || null;
				}
			})
			.addCase(login.rejected, (s, a) => {
				s.loading = false;
				s.error = a.payload?.message || a.error?.message;
				if (a.payload && a.payload.restoreRequired) {
					s.restoreInfo = {
						userId: a.payload.deletedUserId,
						role: a.payload.deletedUserRole,
						message: a.payload.message || 'Account deleted'
					};
				} else {
					s.restoreInfo = null;
				}
			})

			.addCase(verifyLoginOtp.pending, (s) => { s.loading = true; s.error = null; })
			.addCase(verifyLoginOtp.fulfilled, (s, a) => {
				s.loading = false;
				s.otpSent = false;
				s.previewUrl = null;
				s.redirectUrl = a.payload?.redirectUrl || null;
				// User will be redirected, no need to set user here
			})
			.addCase(verifyLoginOtp.rejected, (s, a) => { s.loading = false; s.error = a.payload?.message || a.error?.message; })

			.addCase(signup.pending, (s) => { s.loading = true; s.error = null; })
			.addCase(signup.fulfilled, (s, a) => {
				s.loading = false;
				if (a.payload && a.payload.success) {
					s.otpSent = true;
					s.previewUrl = a.payload.previewUrl || null;
				}
			})
			.addCase(signup.rejected, (s, a) => { s.loading = false; s.error = a.payload?.message || a.error?.message; })

			.addCase(verifySignupOtp.pending, (s) => { s.loading = true; s.error = null; })
			.addCase(verifySignupOtp.fulfilled, (s, a) => {
				s.loading = false;
				s.otpSent = false;
				s.previewUrl = null;
				s.redirectUrl = a.payload?.redirectUrl || null;
			})
			.addCase(verifySignupOtp.rejected, (s, a) => { s.loading = false; s.error = a.payload?.message || a.error?.message; })

			// session rehydrate
			.addCase(fetchSession.pending, (s) => { s.loading = true; s.error = null; })
			.addCase(fetchSession.fulfilled, (s, a) => {
				s.loading = false;
				if (a.payload && a.payload.userEmail) {
					s.user = { email: a.payload.userEmail, role: a.payload.userRole, username: a.payload.username };
				} else {
					s.user = null;
				}
			})
			.addCase(fetchSession.rejected, (s, a) => { s.loading = false; /* ignore fetch errors for now */ });
	}
});

export const { setUser, logout, clearError } = authSlice.actions;
export default authSlice.reducer;

