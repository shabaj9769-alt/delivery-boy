import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE, SESSION_KEY } from '../config/constants';

export async function loadSession() {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export async function saveSession(data) {
  try { await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(data)); } catch (e) {}
}

export async function clearSavedSession() {
  await AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
}

export async function requestLogin(phone, secretCode) {
  const res = await fetch(API_BASE + '/delivery-partners', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'boyLogin', phone, secretCode })
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

// Generic Firebase refresh endpoint (same one the Admin app uses).
export async function requestTokenRefresh(refreshToken) {
  const r = await fetch(API_BASE + '/admin-refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.idToken) throw new Error('refresh failed');
  return data;
}
