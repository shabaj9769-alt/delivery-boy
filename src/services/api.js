import { FIREBASE_DB } from '../config/constants';

// The ID token lives in memory only (never written to disk). Only the
// long-lived refreshToken is persisted (see services/session.js).
let BOY_TOKEN = '';
let onAuthRejected = null;

export const getToken = () => BOY_TOKEN;
export const setToken = (t) => { BOY_TOKEN = t || ''; };
export const setAuthRejectedHandler = (fn) => { onAuthRejected = fn; };

// fetch() that appends ?auth=<token> for Firebase DB urls and reports 401/403.
export const authFetch = (url, opts) => {
  const isDb = typeof url === 'string' && url.startsWith(FIREBASE_DB);
  const hadToken = isDb && !!BOY_TOKEN;
  if (hadToken) url += (url.includes('?') ? '&' : '?') + 'auth=' + encodeURIComponent(BOY_TOKEN);
  return fetch(url, opts).then((res) => {
    if (hadToken && (res.status === 401 || res.status === 403) && onAuthRejected) onAuthRejected();
    return res;
  });
};
