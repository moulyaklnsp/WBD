
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import productsReducer from '../features/products/productsSlice';
import salesReducer from '../features/sales/salesSlice';
import notificationsReducer from '../features/notifications/notificationsSlice';

// Configure the Redux store. Additional reducers can be added to the
// `reducer` object as new feature slices are created.
export const store = configureStore({
	reducer: {
		auth: authReducer,
		products: productsReducer,
		sales: salesReducer,
		notifications: notificationsReducer,
	},
});

export default store;

