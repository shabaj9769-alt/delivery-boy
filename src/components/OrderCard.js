import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import { formatTime, isPaymentVerified } from '../utils/helpers';

export default function OrderCard({ order, busy, onCall, onNavigate, onStart, onDeliver }) {
  const paid = isPaymentVerified(order);
  const online = order.payment === 'Online';

  return (
    <View style={s.card}>
      <View style={s.topRow}>
        <Text style={s.orderId}>ORDER #{order.id.slice(-6)}</Text>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.orderTotal}>₹{order.total}</Text>
          <View style={[s.payBadge, { backgroundColor: online ? '#e1bee7' : '#c8e6c9' }]}>
            <Text style={{ fontSize: 9, fontWeight: 'bold', color: online ? '#4a148c' : '#1b5e20' }}>
              {online ? '💳 Online' : '💵 COD'}
            </Text>
          </View>
        </View>
      </View>

      {formatTime(order.timestamp) ? <Text style={s.meta}>🕒 Placed: {formatTime(order.timestamp)}</Text> : null}

      <Text style={s.custName}>{order.name}</Text>
      <Text style={s.addr}>📍 {order.addr}</Text>
      <Text style={s.meta}>Shift: {order.deliveryShift || '-'} | {order.deliveryType || 'Normal'}</Text>

      {online && !paid && (
        <View style={s.warnBox}>
          <Text style={s.warnTxt}>⛔ Payment not verified yet - do not collect / dispatch until confirmed.</Text>
        </View>
      )}

      <View style={s.itemsBox}>
        {Object.values(order.items || {}).map((it, idx) => (
          <Text key={idx} style={{ fontSize: 10.5, color: '#333' }}>
            • {it.name} ({it.unit}) x {it.qty}
          </Text>
        ))}
      </View>

      <View style={{ flexDirection: 'row', marginTop: 8 }}>
        <TouchableOpacity onPress={() => onCall(order.phone)} style={[s.actionBtn, { backgroundColor: colors.success, marginRight: 6 }]}>
          <Text style={s.actionTxt}>📞 Call</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onNavigate(order)} style={[s.actionBtn, { backgroundColor: colors.info }]}>
          <Text style={s.actionTxt}>🧭 Navigate</Text>
        </TouchableOpacity>
      </View>

      {order.deliveryStatus === 'Assigned' ? (
        <TouchableOpacity
          onPress={() => onStart(order)} disabled={busy}
          style={[s.primaryBtn, { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }]}
        >
          <Text style={s.primaryTxt}>{busy ? 'Updating...' : '🚀 Start Delivery (Out for Delivery)'}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={() => onDeliver(order)} disabled={busy || !paid}
          style={[s.primaryBtn, { backgroundColor: paid ? colors.success : '#bdbdbd', opacity: busy ? 0.6 : 1 }]}
        >
          <Text style={s.primaryTxt}>{busy ? 'Updating...' : '✅ Mark as Delivered'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#fff', padding: 12, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: colors.primaryLight, elevation: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderId: { fontWeight: 'bold', color: colors.primary, fontSize: 13 },
  orderTotal: { fontWeight: 'bold', color: colors.success, fontSize: 13 },
  payBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 3 },
  meta: { fontSize: 10.5, color: '#777', marginTop: 3 },
  custName: { fontSize: 13, fontWeight: 'bold', color: '#222', marginTop: 6 },
  addr: { fontSize: 11.5, color: '#444', marginTop: 2 },
  warnBox: { backgroundColor: '#ffebee', padding: 8, borderRadius: 6, marginTop: 6, borderWidth: 1, borderColor: '#ef9a9a' },
  warnTxt: { fontSize: 10.5, fontWeight: 'bold', color: '#b71c1c' },
  itemsBox: { backgroundColor: colors.background, padding: 6, borderRadius: 6, marginTop: 6 },
  actionBtn: { flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  actionTxt: { color: '#fff', fontWeight: 'bold', fontSize: 11.5 },
  primaryBtn: { marginTop: 8, paddingVertical: 11, borderRadius: 6, alignItems: 'center' },
  primaryTxt: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
});
