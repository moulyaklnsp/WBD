/**
 * Multi-Tab Manager for ChessHive
 * Enables 10+ concurrent tabs with data synchronization without overwriting
 */

// Generate unique tab ID
const TAB_ID = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const STORAGE_KEY = 'chesshive_active_tabs';
const MAX_TABS = 15; // Support up to 15 concurrent tabs
const TAB_EXPIRY_MS = 30000; // Consider tabs stale after 30 seconds of no heartbeat

// BroadcastChannel for cross-tab communication
let broadcastChannel = null;
const listeners = new Map();

// Initialize BroadcastChannel
function initBroadcastChannel() {
  if (typeof BroadcastChannel === 'undefined') {
    console.warn('BroadcastChannel not supported, falling back to localStorage events');
    return null;
  }
  
  if (!broadcastChannel) {
    broadcastChannel = new BroadcastChannel('chesshive_tabs');
    broadcastChannel.onmessage = handleBroadcastMessage;
  }
  return broadcastChannel;
}

// Handle incoming broadcast messages
function handleBroadcastMessage(event) {
  const { type, payload, sourceTabId } = event.data || {};
  
  // Ignore messages from self
  if (sourceTabId === TAB_ID) return;
  
  // Notify all registered listeners
  listeners.forEach((callback, key) => {
    if (key === type || key === '*') {
      callback({ type, payload, sourceTabId });
    }
  });
}

// Register active tab
function registerTab() {
  const tabs = getActiveTabs();
  const now = Date.now();
  
  // Clean stale tabs
  const activeTabs = tabs.filter(t => now - t.lastSeen < TAB_EXPIRY_MS);
  
  // Check if we've exceeded max tabs
  if (activeTabs.length >= MAX_TABS && !activeTabs.find(t => t.id === TAB_ID)) {
    console.warn(`Maximum ${MAX_TABS} tabs reached. Some features may be limited.`);
  }
  
  // Add or update current tab
  const existingIndex = activeTabs.findIndex(t => t.id === TAB_ID);
  const tabInfo = {
    id: TAB_ID,
    lastSeen: now,
    url: window.location.pathname,
    userRole: sessionStorage.getItem('chesshive_user') 
      ? JSON.parse(sessionStorage.getItem('chesshive_user'))?.role 
      : null
  };
  
  if (existingIndex >= 0) {
    activeTabs[existingIndex] = tabInfo;
  } else {
    activeTabs.push(tabInfo);
  }
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(activeTabs));
  } catch (e) {
    console.warn('Failed to save active tabs:', e);
  }
  
  return activeTabs.length;
}

// Get all active tabs
function getActiveTabs() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

// Get current tab count
function getTabCount() {
  const now = Date.now();
  const tabs = getActiveTabs();
  return tabs.filter(t => now - t.lastSeen < TAB_EXPIRY_MS).length;
}

// Unregister tab on close
function unregisterTab() {
  const tabs = getActiveTabs().filter(t => t.id !== TAB_ID);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
  } catch (e) {
    // Ignore errors during cleanup
  }
}

// Broadcast message to other tabs
function broadcast(type, payload) {
  const message = { type, payload, sourceTabId: TAB_ID, timestamp: Date.now() };
  
  if (broadcastChannel) {
    broadcastChannel.postMessage(message);
  }
  
  // Fallback for browsers without BroadcastChannel
  try {
    localStorage.setItem('chesshive_broadcast', JSON.stringify(message));
    localStorage.removeItem('chesshive_broadcast');
  } catch (e) {
    // Ignore storage errors
  }
}

// Subscribe to broadcast messages
function subscribe(type, callback) {
  const key = `${type}_${Math.random().toString(36).substr(2, 9)}`;
  listeners.set(key, callback);
  return () => listeners.delete(key);
}

// Merge data without overwriting - deep merge utility
function mergeData(existing, incoming, options = {}) {
  const { overwrite = false, arrayMerge = 'append' } = options;
  
  // If overwrite is explicitly requested, return incoming
  if (overwrite) return incoming;
  
  // Handle null/undefined
  if (incoming === null || incoming === undefined) return existing;
  if (existing === null || existing === undefined) return incoming;
  
  // Handle arrays
  if (Array.isArray(existing) && Array.isArray(incoming)) {
    if (arrayMerge === 'append') {
      // Append without duplicates (by id if present, otherwise by reference)
      const existingIds = new Set(existing.map(item => item?.id || item?._id || JSON.stringify(item)));
      const newItems = incoming.filter(item => {
        const itemId = item?.id || item?._id || JSON.stringify(item);
        return !existingIds.has(itemId);
      });
      return [...existing, ...newItems];
    }
    if (arrayMerge === 'replace') return incoming;
    if (arrayMerge === 'concat') return [...existing, ...incoming];
    return incoming;
  }
  
  // Handle objects
  if (typeof existing === 'object' && typeof incoming === 'object') {
    const result = { ...existing };
    for (const key of Object.keys(incoming)) {
      if (key in existing) {
        result[key] = mergeData(existing[key], incoming[key], options);
      } else {
        result[key] = incoming[key];
      }
    }
    return result;
  }
  
  // For primitives, keep existing unless it's falsy
  return existing || incoming;
}

// Safe data loader that prevents overwriting
function loadDataSafely(storageKey, newData, options = {}) {
  try {
    const existingRaw = sessionStorage.getItem(storageKey);
    const existing = existingRaw ? JSON.parse(existingRaw) : null;
    
    const merged = mergeData(existing, newData, options);
    sessionStorage.setItem(storageKey, JSON.stringify(merged));
    
    // Broadcast update to other tabs if needed
    if (options.broadcast !== false) {
      broadcast('data_update', { key: storageKey, data: merged });
    }
    
    return merged;
  } catch (e) {
    console.warn(`Failed to load data safely for ${storageKey}:`, e);
    return newData;
  }
}

// Get stored data
function getStoredData(storageKey, defaultValue = null) {
  try {
    const data = sessionStorage.getItem(storageKey);
    return data ? JSON.parse(data) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

// Clear stored data
function clearStoredData(storageKey) {
  try {
    sessionStorage.removeItem(storageKey);
    broadcast('data_clear', { key: storageKey });
  } catch (e) {
    // Ignore errors
  }
}

// Initialize tab management
function initialize() {
  initBroadcastChannel();
  registerTab();
  
  // Heartbeat to keep tab registered
  const heartbeatInterval = setInterval(() => {
    registerTab();
  }, 10000);
  
  // Listen for storage events (fallback for BroadcastChannel)
  window.addEventListener('storage', (event) => {
    if (event.key === 'chesshive_broadcast' && event.newValue) {
      try {
        const message = JSON.parse(event.newValue);
        if (message.sourceTabId !== TAB_ID) {
          handleBroadcastMessage({ data: message });
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  });
  
  // Clean up on tab close
  window.addEventListener('beforeunload', () => {
    clearInterval(heartbeatInterval);
    unregisterTab();
  });
  
  return {
    tabId: TAB_ID,
    tabCount: getTabCount()
  };
}

// Check if this is a new tab vs refresh
function isNewTab() {
  const sessionTabId = sessionStorage.getItem('chesshive_tab_id');
  if (sessionTabId) {
    return false; // This is a refresh of existing tab
  }
  sessionStorage.setItem('chesshive_tab_id', TAB_ID);
  return true;
}

export {
  TAB_ID,
  MAX_TABS,
  initialize,
  registerTab,
  unregisterTab,
  getActiveTabs,
  getTabCount,
  broadcast,
  subscribe,
  mergeData,
  loadDataSafely,
  getStoredData,
  clearStoredData,
  isNewTab
};

export default {
  TAB_ID,
  MAX_TABS,
  initialize,
  registerTab,
  unregisterTab,
  getActiveTabs,
  getTabCount,
  broadcast,
  subscribe,
  mergeData,
  loadDataSafely,
  getStoredData,
  clearStoredData,
  isNewTab
};
