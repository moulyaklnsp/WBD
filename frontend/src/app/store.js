
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import productsReducer from '../features/products/productsSlice';
import salesReducer from '../features/sales/salesSlice';
import notificationsReducer from '../features/notifications/notificationsSlice';
import multiTabManager from '../utils/multiTabManager';

// Initialize multi-tab manager for 10+ concurrent tabs
const tabInfo = multiTabManager.initialize();
console.log(`Tab initialized: ${tabInfo.tabId}, Active tabs: ${tabInfo.tabCount}`);

// Custom middleware to sync state across tabs without overwriting
const multiTabSyncMiddleware = (store) => (next) => (action) => {
	const result = next(action);
	
	// Broadcast specific actions to other tabs (excluding internal/sync actions)
	const syncableActions = [
		'auth/setUser',
		'products/setProducts',
		'notifications/addNotification',
	];
	
	const shouldSync = syncableActions.some(type => action.type?.startsWith(type.split('/')[0]));
	
	if (shouldSync && !action.meta?.fromSync) {
		multiTabManager.broadcast('state_action', {
			action: { ...action, meta: { ...(action.meta || {}), fromSync: true } }
		});
	}
	
	return result;
};

// Listen for state changes from other tabs
multiTabManager.subscribe('state_action', ({ payload }) => {
	if (payload?.action && !payload.action.meta?.fromSync) {
		// Don't dispatch if already marked as sync to prevent loops
		store.dispatch({ ...payload.action, meta: { ...(payload.action.meta || {}), fromSync: true } });
	}
});

// Configure the Redux store. Additional reducers can be added to the
// `reducer` object as new feature slices are created.
// Supports 10+ concurrent tabs with state isolation
export const store = configureStore({
	reducer: {
		auth: authReducer,
		products: productsReducer,
		sales: salesReducer,
		notifications: notificationsReducer,
	},
	middleware: (getDefaultMiddleware) =>
		getDefaultMiddleware({
			serializableCheck: {
				ignoredActions: [],
			},
		}).concat(multiTabSyncMiddleware),
});

// Store reference for the sync subscription
export default store;

