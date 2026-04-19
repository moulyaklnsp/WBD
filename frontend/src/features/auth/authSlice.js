import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { loadDataSafely, clearStoredData } from '../../utils/multiTabManager';
import { storeTokens, clearTokens, getAccessToken, logoutUser } from '../../utils/tokenManager';

// Thunk: login (email + password, no OTP)
export const login = createAsyncThunk('auth/login', async (credentials, thunkAPI) => {
	try {
		const res = await fetch('/api/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(credentials),
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok) return thunkAPI.rejectWithValue(data);

		// Store JWT tokens (access + refresh)
		if (data.accessToken) {
			storeTokens({
				accessToken: data.accessToken,
				refreshToken: data.refreshToken,
				expiresIn: data.expiresIn,
				user: data.user
			});
		}

		// Store user info
		if (data.user) {
			loadDataSafely('chesshive_user', data.user, { overwrite: false, broadcast: false });
			try {
				localStorage.setItem('chesshive_user_backup', JSON.stringify(data.user));
			} catch (e) {
				console.warn('Failed to backup user:', e);
			}
		}

		// Legacy token storage for backward compatibility
		if (data.token) {
			sessionStorage.setItem('chesshive_token', data.token);
			localStorage.setItem('chesshive_token_backup', data.token);
		}

		return data; // { success: true, redirectUrl, user, accessToken, refreshToken, expiresIn }
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
		
		// Store JWT tokens (access + refresh)
		if (data.accessToken) {
			storeTokens({
				accessToken: data.accessToken,
				refreshToken: data.refreshToken,
				expiresIn: data.expiresIn,
				user: data.user
			});
		}
		
		// Store user info
		if (data.user) {
			loadDataSafely('chesshive_user', data.user, { overwrite: false, broadcast: false });
			try {
				localStorage.setItem('chesshive_user_backup', JSON.stringify(data.user));
			} catch (e) {
				console.warn('Failed to backup user:', e);
			}
		}
		
		return data; // { success: true, redirectUrl, accessToken, refreshToken, expiresIn, user }
	} catch (err) {
		return thunkAPI.rejectWithValue({ message: err.message || 'Network error' });
	}
});

// Thunk: request forgot password OTP
export const forgotPassword = createAsyncThunk('auth/forgotPassword', async ({ email }, thunkAPI) => {
	try {
		const res = await fetch('/api/forgot-password', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email }),
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok) return thunkAPI.rejectWithValue(data);
		return data; // { success: true, message: 'OTP sent...' }
	} catch (err) {
		return thunkAPI.rejectWithValue({ message: err.message || 'Network error' });
	}
});

// Thunk: verify forgot password OTP
export const verifyForgotPasswordOtp = createAsyncThunk('auth/verifyForgotPasswordOtp', async ({ email, otp }, thunkAPI) => {
	try {
		const res = await fetch('/api/verify-forgot-password-otp', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, otp }),
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok) return thunkAPI.rejectWithValue(data);
		return data; // { success: true, resetToken }
	} catch (err) {
		return thunkAPI.rejectWithValue({ message: err.message || 'Network error' });
	}
});

// Thunk: reset password
export const resetPassword = createAsyncThunk('auth/resetPassword', async ({ email, resetToken, newPassword, confirmPassword }, thunkAPI) => {
	try {
		const res = await fetch('/api/reset-password', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, resetToken, newPassword, confirmPassword }),
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok) return thunkAPI.rejectWithValue(data);
		return data; // { success: true, message: 'Password reset successful' }
	} catch (err) {
		return thunkAPI.rejectWithValue({ message: err.message || 'Network error' });
	}
});

// Thunk: fetch current session from server to rehydrate store on app start
export const fetchSession = createAsyncThunk('auth/fetchSession', async (_, thunkAPI) => {
	try {
		const headers = {};
		const accessToken = getAccessToken();
		if (accessToken) {
			headers['Authorization'] = `Bearer ${accessToken}`;
		}
		const res = await fetch('/api/session', { headers });
		const data = await res.json().catch(() => ({}));
		if (!res.ok) return thunkAPI.rejectWithValue(data);
		return data; // expected { userEmail, userRole, username, authenticated }
	} catch (err) {
		return thunkAPI.rejectWithValue({ message: err.message || 'Network error' });
	}
});

// Thunk: restore deleted account
export const restoreAccount = createAsyncThunk('auth/restoreAccount', async ({ id, email, password }, thunkAPI) => {
	try {
		const res = await fetch('/api/restore-account', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id, email, password }),
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok) return thunkAPI.rejectWithValue(data);
		return data; // { success: true, message, redirectUrl }
	} catch (err) {
		return thunkAPI.rejectWithValue({ message: err.message || 'Network error' });
	}
});

const initialState = {
	user: null,
	loading: false,
	otpSent: false,
	pendingApproval: false,
	previewUrl: null,
	redirectUrl: null,
	error: null,
	restoreInfo: null,
	// Forgot password state
	forgotPasswordStep: 'email', // 'email' | 'otp' | 'reset' | 'success'
	resetToken: null,
	forgotPasswordEmail: null,
};

const authSlice = createSlice({
	name: 'auth',
	initialState,
	reducers: {
		setUser(state, action) {
			state.user = action.payload;
		},
		setCoordinatorApproved(state) {
			state.pendingApproval = false;
			state.otpSent = true;
		},
		setCoordinatorRejected(state) {
			state.pendingApproval = false;
			state.error = 'Signup request was rejected by an organizer.';
		},
		logout(state) {
			state.user = null;
			// Clear all stored auth data
			clearStoredData('chesshive_user');
			clearStoredData('chesshive_token');
			// Clear JWT tokens (access + refresh)
			clearTokens();
			try {
				sessionStorage.removeItem('chesshive_token');
				localStorage.removeItem('chesshive_user_backup');
				localStorage.removeItem('chesshive_token_backup');
			} catch (e) {
				console.warn('Failed to clear auth storage:', e);
			}
			// Server-side logout (revoke refresh token)
			logoutUser().catch(() => {});
		},
		clearError(state) {
			state.error = null;
		},
		resetForgotPassword(state) {
			state.forgotPasswordStep = 'email';
			state.resetToken = null;
			state.forgotPasswordEmail = null;
			state.error = null;
		},
		clearRestoreInfo(state) {
			state.restoreInfo = null;
			state.error = null;
		}
	},
	extraReducers: (builder) => {
		builder
			.addCase(login.pending, (s) => { s.loading = true; s.error = null; })
			.addCase(login.fulfilled, (s, a) => {
				s.loading = false;
				s.otpSent = false;
				s.previewUrl = null;
				s.restoreInfo = null;
				s.redirectUrl = a.payload?.redirectUrl || null;
			})
			.addCase(login.rejected, (s, a) => {
				s.loading = false;
				s.error = a.payload?.message || a.error?.message;
				s.otpSent = false;
				s.previewUrl = null;
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

			.addCase(signup.pending, (s) => { s.loading = true; s.error = null; })
			.addCase(signup.fulfilled, (s, a) => {
				s.loading = false;
				if (a.payload && a.payload.success) {
					if (a.payload.pendingApproval) {
						s.pendingApproval = true;
					} else {
						s.otpSent = true;
					}
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
					s.user = {
						email: a.payload.userEmail,
						role: a.payload.userRole,
						isSuperAdmin: !!a.payload.isSuperAdmin,
						username: a.payload.username
					};
				} else {
					s.user = null;
				}
			})
			.addCase(fetchSession.rejected, (s, a) => { s.loading = false; /* ignore fetch errors for now */ })

			// Forgot Password flow
			.addCase(forgotPassword.pending, (s) => { s.loading = true; s.error = null; })
			.addCase(forgotPassword.fulfilled, (s, a) => {
				s.loading = false;
				if (a.payload && a.payload.success) {
					s.forgotPasswordStep = 'otp';
					s.forgotPasswordEmail = a.meta?.arg?.email || null;
				}
			})
			.addCase(forgotPassword.rejected, (s, a) => { s.loading = false; s.error = a.payload?.message || a.error?.message; })

			.addCase(verifyForgotPasswordOtp.pending, (s) => { s.loading = true; s.error = null; })
			.addCase(verifyForgotPasswordOtp.fulfilled, (s, a) => {
				s.loading = false;
				if (a.payload && a.payload.success) {
					s.forgotPasswordStep = 'reset';
					s.resetToken = a.payload.resetToken || null;
				}
			})
			.addCase(verifyForgotPasswordOtp.rejected, (s, a) => { s.loading = false; s.error = a.payload?.message || a.error?.message; })

			.addCase(resetPassword.pending, (s) => { s.loading = true; s.error = null; })
			.addCase(resetPassword.fulfilled, (s, a) => {
				s.loading = false;
				if (a.payload && a.payload.success) {
					s.forgotPasswordStep = 'success';
				}
			})
			.addCase(resetPassword.rejected, (s, a) => { s.loading = false; s.error = a.payload?.message || a.error?.message; })

			// Restore account flow
			.addCase(restoreAccount.pending, (s) => { s.loading = true; s.error = null; })
			.addCase(restoreAccount.fulfilled, (s, a) => {
				s.loading = false;
				s.restoreInfo = null;
				s.redirectUrl = a.payload?.redirectUrl || null;
			})
			.addCase(restoreAccount.rejected, (s, a) => { s.loading = false; s.error = a.payload?.message || a.error?.message; });
	}
});

export const { setUser, logout, clearError, resetForgotPassword, clearRestoreInfo, setCoordinatorApproved, setCoordinatorRejected } = authSlice.actions;
export default authSlice.reducer;
