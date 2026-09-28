import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function StatCard({ label, value, bg, color }) {
  return (
    <View style={[s.card, { backgroundColor: bg }]}>
      <Text style={s.label}>{label}</Text>
      <Text style={[s.value, { color }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { flex: 1, padding: 8, borderRadius: 8, marginHorizontal: 2, alignItems: 'center' },
  label: { fontSize: 9.5, color: '#555', fontWeight: 'bold', textAlign: 'center' },
  value: { fontSize: 15, fontWeight: 'bold', marginTop: 3 },
});
