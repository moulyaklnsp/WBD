import { TAB_ID, loadDataSafely, mergeData, getStoredData } from './multiTabManager';
import { getAccessToken, refreshAccessToken } from './tokenManager';

// Request queue to prevent duplicate concurrent requests
const pendingRequests = new Map();
const REQUEST_CACHE_TTL = 5000; // Cache successful responses for 5 seconds lto prevent duplicates

// Cache for preventing duplicate identical requests
const requestCache = new Map();

function getCacheKey(path, options) {
  const method = options?.method || 'GET';
  const body = options?.body || '';
  return `${method}:${path}:${body}`;
}

function mergeOptions(options, extraHeaders = {}) {
  const opts = options || {};
  const headers = { ...(opts.headers || {}), ...extraHeaders };
  
  // Attach JWT access token if available
  const accessToken = getAccessToken();
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  
  return {
    credentials: 'include',
    ...opts,
    headers: {
      ...headers,
      'X-Tab-ID': TAB_ID, // Include tab ID in requests for server-side tracking
    }
  };
}
async function enhancedFetch(path, options, config = {}) {
  const { 
    maxRetries = 2, 
    retryDelay = 1000,
    cacheResponse = false,
    mergeIntoStore = false,
    storeKey = null,
    mergeOptions: mergeOpts = { overwrite: false }
  } = config;
  
  const cacheKey = getCacheKey(path, options);
  const method = options?.method || 'GET';

  // Serve from cache
  if (method === 'GET' && cacheResponse) {
    const cached = requestCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < REQUEST_CACHE_TTL) {
      return cached.response.clone();
    }
  }

  // ✅ FIXED DEDUPLICATION
  if (method === 'GET' && pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey).then(res => res.clone());
  }

  const fetchWithRetry = async (retriesLeft) => {
    try {
      const response = await fetch(path, options);

      // ---- 401 TOKEN_EXPIRED ----
      if (response.status === 401) {
        const errorData = await response.clone().json().catch(() => ({}));

        if (errorData.code === 'TOKEN_EXPIRED') {
          const newToken = await refreshAccessToken();

          if (newToken) {
            const retryOptions = { ...options };
            retryOptions.headers = {
              ...(retryOptions.headers || {}),
              Authorization: `Bearer ${newToken}`
            };
            return fetch(path, retryOptions);
          }

          window.dispatchEvent(new CustomEvent('chesshive:session-expired', {
            detail: { message: errorData.message || 'Session expired' }
          }));
        }
      }

      // ---- 400 ----
      if (response.status === 400) {
        const errorData = await response.clone().json().catch(() => ({
          message: 'Bad Request'
        }));

        const error = new Error(errorData.error || errorData.message || 'Bad Request');
        error.status = 400;
        error.data = errorData;
        throw error;
      }

      // ---- Other 4xx ----
      if (response.status >= 400 && response.status < 500) {
        // Instead of throwing an error which causes React Error Boundary overlay
        // Let's resolve with the error response, or attach an error property
        // The calling code can check for !response.ok
        return response;
      }

      // ---- 5xx Retry ----
      if (response.status >= 500 && retriesLeft > 0) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return fetchWithRetry(retriesLeft - 1);
      }

      if (!response.ok) {
        const error = new Error(`Request failed with status ${response.status}`);
        error.status = response.status;
        throw error;
      }

      // ---- Cache Success ----
      if (method === 'GET' && cacheResponse) {
        requestCache.set(cacheKey, {
          response: response.clone(),
          timestamp: Date.now()
        });
      }

      // ---- Merge Into Store ----
      if (mergeIntoStore && storeKey) {
        const data = await response.clone().json().catch(() => null);
        if (data) {
          loadDataSafely(storeKey, data, mergeOpts);
        }
      }

      return response;

    } catch (err) {
      if (retriesLeft > 0 && !err.status) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return fetchWithRetry(retriesLeft - 1);
      }
      throw err;
    }
  };

  const promise = fetchWithRetry(maxRetries);

  if (method === 'GET') {
    pendingRequests.set(cacheKey, promise);
    promise.finally(() => {
      pendingRequests.delete(cacheKey);
    });
  }

  return promise;
}

// Fetch with data loading that prevents overwriting
export async function fetchAndMerge(path, options, storeKey, mergeOpts = {}) {
  const mergedOptions = mergeOptions(options);
  
  try {
    const response = await enhancedFetch(path, mergedOptions, {
      mergeIntoStore: true,
      storeKey,
      mergeOptions: { overwrite: false, ...mergeOpts }
    });
    
    return response;
  } catch (err) {
    console.error(`fetchAndMerge error for ${path}:`, err);
    throw err;
  }
}

// Load data from API without overwriting existing data
export async function loadWithoutOverwrite(path, options, existingData) {
  const mergedOptions = mergeOptions(options);
  
  try {
    const response = await enhancedFetch(path, mergedOptions, { cacheResponse: true });
    const newData = await response.json();
    
    // Merge new data with existing data without overwriting
    return mergeData(existingData, newData, { overwrite: false });
  } catch (err) {
    console.error(`loadWithoutOverwrite error for ${path}:`, err);
    // Return existing data if fetch fails
    return existingData;
  }
}

export function fetchAsAdmin(path, options) {
  return enhancedFetch(path, mergeOptions(options, { 'X-Role': 'admin' }), { cacheResponse: true });
}

export function fetchAsOrganizer(path, options) {
  return enhancedFetch(path, mergeOptions(options, { 'X-Role': 'organizer' }), { cacheResponse: true });
}

export function fetchAsCoordinator(path, options) {
  return enhancedFetch(path, mergeOptions(options, { 'X-Role': 'coordinator' }), { cacheResponse: true });
}

export function fetchAsPlayer(path, options) {
  return enhancedFetch(path, mergeOptions(options, { 'X-Role': 'player' }), { cacheResponse: true });
}

// Safe POST/PUT/PATCH that validates before sending
export function safePost(path, data, options = {}) {
  if (!data || typeof data !== 'object') {
    return Promise.reject(new Error('Invalid data: expected object'));
  }
  
  return enhancedFetch(path, mergeOptions({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    ...options
  }), { maxRetries: 1 }); // Don't retry POSTs aggressively
}

export function safePut(path, data, options = {}) {
  if (!data || typeof data !== 'object') {
    return Promise.reject(new Error('Invalid data: expected object'));
  }
  
  return enhancedFetch(path, mergeOptions({
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    ...options
  }), { maxRetries: 1 });
}

export function safePatch(path, data, options = {}) {
  if (!data || typeof data !== 'object') {
    return Promise.reject(new Error('Invalid data: expected object'));
  }
  
  return enhancedFetch(path, mergeOptions({
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    ...options
  }), { maxRetries: 1 });
}

// Clear request cache (useful when forcing refresh)
export function clearRequestCache() {
  requestCache.clear();
  pendingRequests.clear();
}

const fetchUtils = {
  fetchAsAdmin,
  fetchAsOrganizer,
  fetchAsCoordinator,
  fetchAsPlayer,
  fetchAndMerge,
  loadWithoutOverwrite,
  safePost,
  safePut,
  safePatch,
  clearRequestCache,
};

export default fetchUtils;
