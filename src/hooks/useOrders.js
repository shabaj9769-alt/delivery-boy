import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { ACTIVE_STATUSES, POLL_INTERVAL_MS } from '../config/constants';
import { fetchAllOrders, fetchBoyStatus, patchOrder } from '../services/orders';
import { isPaymentVerified } from '../utils/helpers';

// Polls this partner's orders and exposes the delivery actions.
//   boyRef      - shared ref with the current partner's { key, name, phone }
//   onBlocked   - () => void        admin blocked this partner mid-session
//   onNewOrder  - () => void        a new order was assigned (ring the siren)
export default function useOrders({ boyRef, isAuthenticated, onBlocked, onNewOrder }) {
  const [orders, setOrders] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState('');
  const alertedIdsRef = useRef(null); // null until first successful load
  const cb = useRef({});
  cb.current = { onBlocked, onNewOrder };

  const isMine = (o) => {
    const { name, phone } = boyRef.current;
    return (name && o.assignedBoy === name) ||
      (phone && (o.deliveryBoyPhone === phone || o.assignedBoyPhone === phone));
  };

  const loadMyOrders = async () => {
    try {
      const data = await fetchAllOrders();
      if (!data || data.error) { setOrders([]); return; }
      const mine = Object.keys(data).map(k => ({ id: k, ...data[k] })).filter(isMine);

      // Alert on newly-assigned orders we haven't seen before (skip the very
      // first load so opening the app doesn't ring for orders already there).
      const activeIds = new Set(mine.filter(o => ACTIVE_STATUSES.includes(o.deliveryStatus)).map(o => o.id));
      if (alertedIdsRef.current === null) {
        alertedIdsRef.current = activeIds;
      } else {
        let hasNew = false;
        activeIds.forEach(id => { if (!alertedIdsRef.current.has(id)) hasNew = true; });
        alertedIdsRef.current = activeIds;
        if (hasNew && cb.current.onNewOrder) cb.current.onNewOrder();
      }

      // Detect if the admin blocked this partner mid-session.
      const status = await fetchBoyStatus(boyRef.current.key);
      if (status === 'Blocked') return cb.current.onBlocked && cb.current.onBlocked();

      mine.sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
      setOrders(mine);
    } catch (e) {
      // silent - next poll will retry
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(loadMyOrders, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const reset = () => { setOrders([]); alertedIdsRef.current = null; };

  const onManualRefresh = async () => {
    setRefreshing(true);
    await loadMyOrders();
    setRefreshing(false);
  };

  const updateOrder = (order, body) => {
    setBusyOrderId(order.id);
    patchOrder(order.id, body)
      .then(() => loadMyOrders())
      .catch(() => Alert.alert('Network Error', 'Could not update the order. Please try again.'))
      .finally(() => setBusyOrderId(''));
  };

  const startDelivery = (order) =>
    updateOrder(order, { deliveryStatus: 'Out for Delivery', outForDeliveryAt: Date.now() });

  const markDelivered = (order) => {
    if (!isPaymentVerified(order)) {
      return Alert.alert(
        '⛔ Payment Not Verified',
        'This is an online order and the payment has not been verified by the server yet. Please wait or contact the admin before marking it delivered.'
      );
    }
    Alert.alert(
      'Confirm Delivery',
      order.payment === 'Online'
        ? `Mark Order #${order.id.slice(-6)} as delivered?`
        : `Mark Order #${order.id.slice(-6)} as delivered? Make sure you have collected ₹${order.total} cash.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Delivered',
          onPress: () => updateOrder(order, { deliveryStatus: 'Delivered', deliveredAt: Date.now() })
        }
      ]
    );
  };

  return {
    orders, refreshing, busyOrderId,
    loadMyOrders, reset, onManualRefresh, startDelivery, markDelivered,
  };
}
