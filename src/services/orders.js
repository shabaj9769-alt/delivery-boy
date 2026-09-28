import { FIREBASE_DB } from '../config/constants';
import { authFetch, getToken } from './api';

export async function fetchAllOrders() {
  const res = await authFetch(FIREBASE_DB + 'orders.json');
  return res.json().catch(() => null);
}

// Plain fetch on purpose: a rules rejection here must NOT log the user out.
export async function fetchBoyStatus(boyKey) {
  if (!boyKey) return null;
  const res = await fetch(
    FIREBASE_DB + `deliveryBoys/${boyKey}/status.json?auth=${encodeURIComponent(getToken())}`
  ).catch(() => null);
  return res && res.ok ? res.json().catch(() => null) : null;
}

export function patchOrder(orderId, body) {
  return authFetch(FIREBASE_DB + `orders/${orderId}.json`, {
    method: 'PATCH',
    body: JSON.stringify(body)
  });
}
