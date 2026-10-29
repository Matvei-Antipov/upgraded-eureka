import axios from 'axios';

export const TOKEN_KEY = 'usof_token';

/**
 * Single axios instance for the whole app.
 * - adds the JWT from localStorage to every request;
 * - reports expired / invalid tokens (HTTP 401) to the store.
 */
const api = axios.create({ baseURL: '/api' });

let unauthorizedHandler = null;

export const setUnauthorizedHandler = (handler) => {
  unauthorizedHandler = handler;
};

export const getStoredToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const sentToken = Boolean(error.config?.headers?.Authorization);
    if (error.response?.status === 401 && sentToken && unauthorizedHandler) {
      unauthorizedHandler();
    }
    return Promise.reject(error);
  }
);

export const parseJwt = (token) => {
  try {
    if (!token || token.split('.').length !== 3) return null;
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
};

export const isTokenExpired = (token) => {
  const payload = parseJwt(token);
  if (!payload) return true;
  if (!payload.exp) return false;
  return payload.exp * 1000 <= Date.now();
};

/**
 * Normalised, serialisable error object used as `rejectWithValue` payload.
 * `key` is a translation key, `detail` is the raw message from the API.
 */
export const toApiError = (error, key) => ({
  key,
  detail: error?.response?.data?.error || error?.response?.data?.message || null,
  status: error?.response?.status || null,
  network: !error?.response,
});

export default api;
