import { ACTIVE_STATUSES } from '../config/constants';

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// An Online order can only be marked Delivered once the SERVER has verified
// the payment. Never trust deliveryStatus text for this - customers can write
// that field themselves.
export const isPaymentVerified = (ord) => ord.payment !== 'Online' || ord.paymentVerified === true;

export function isSameDay(ts, ref) {
  if (!ts) return false;
  const a = new Date(Number(ts));
  return a.getFullYear() === ref.getFullYear() && a.getMonth() === ref.getMonth() && a.getDate() === ref.getDate();
}

export function formatTime(ts) {
  if (!ts) return '';
  try {
    return new Date(Number(ts)).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true
    });
  } catch (e) { return ''; }
}

export function computeStats(orders) {
  const today = new Date();
  const activeOrders = orders.filter(o => ACTIVE_STATUSES.includes(o.deliveryStatus));
  const deliveredToday = orders.filter(
    o => o.deliveryStatus === 'Delivered' && isSameDay(o.deliveredAt || o.timestamp, today)
  );
  let cashToday = 0, onlineToday = 0;
  deliveredToday.forEach(o => {
    const val = Number(o.total || 0);
    if (o.payment === 'Online') onlineToday += val; else cashToday += val;
  });
  return { activeOrders, deliveredToday, cashToday, onlineToday };
}
