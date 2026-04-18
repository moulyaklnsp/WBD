import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { Provider } from 'react-redux';
import { store } from './app/store';
import { fetchSession } from './features/auth/authSlice';
import { BrowserRouter } from 'react-router-dom';
import { getTabCount, MAX_TABS, isNewTab } from './utils/multiTabManager';

// Check tab count (supports up to 15 tabs)
const tabCount = getTabCount();
const isNew = isNewTab();
console.log(`ChessHive: Tab ${isNew ? 'opened' : 'refreshed'}, ${tabCount} active tab(s) (max: ${MAX_TABS})`);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);

// Rehydrate auth state from server session on app startup
// Only fetch session if this is a new tab or refresh (prevents overwriting on multi-tab scenarios)
if (isNew || tabCount <= 1) {
  store.dispatch(fetchSession());
} else {
  // For existing tabs, try to restore from sessionStorage first
  try {
    const storedUser = sessionStorage.getItem('chesshive_user');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      store.dispatch({ type: 'auth/setUser', payload: user });
    } else {
      // Fall back to server fetch if no stored session
      store.dispatch(fetchSession());
    }
  } catch (e) {
    store.dispatch(fetchSession());
  }
}
