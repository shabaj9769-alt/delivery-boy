import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import StatCard from './StatCard';
import { colors } from '../theme/colors';
import { formatTime, round2 } from '../utils/helpers';

export default function DeliveredSection({ deliveredToday, cashToday, onlineToday }) {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <TouchableOpacity onPress={() => setOpen(!open)} style={s.toggleHdr}>
        <Text style={s.toggleTxt}>✅ Delivered Today ({deliveredToday.length}) {open ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {open && (
        <View>
          <View style={s.statsRow}>
            <StatCard label="Cash Collected" value={`₹${round2(cashToday)}`} bg={colors.primarySoft} color={colors.primary} />
            <StatCard label="Online (prepaid)" value={`₹${round2(onlineToday)}`} bg="#f3e5f5" color="#6a1b9a" />
          </View>
          {deliveredToday.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={{ color: '#888', fontSize: 12 }}>No deliveries completed yet today.</Text>
            </View>
          ) : (
            deliveredToday.map(ord => (
              <View key={ord.id} style={s.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={s.orderId}>✅ #{ord.id.slice(-6)}</Text>
                  <Text style={s.orderTotal}>₹{ord.total}</Text>
                </View>
                <Text style={s.custName}>{ord.name}</Text>
                <Text style={s.meta}>Delivered: {formatTime(ord.deliveredAt || ord.timestamp)}</Text>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  toggleHdr: { backgroundColor: colors.success, padding: 12, borderRadius: 8, marginTop: 6, marginBottom: 10 },
  toggleTxt: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  emptyBox: { backgroundColor: '#fff', padding: 16, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: colors.primaryLight },
  card: { backgroundColor: '#fff', padding: 12, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#a5d6a7', elevation: 1 },
  orderId: { fontWeight: 'bold', color: colors.primary, fontSize: 13 },
  orderTotal: { fontWeight: 'bold', color: colors.success, fontSize: 13 },
  custName: { fontSize: 13, fontWeight: 'bold', color: '#222', marginTop: 6 },
  meta: { fontSize: 10.5, color: '#777', marginTop: 3 },
});
