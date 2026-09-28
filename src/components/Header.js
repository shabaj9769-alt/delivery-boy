import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';

export default function Header({ name, phone, onLogout }) {
  return (
    <View style={s.hdr}>
      <View style={{ flex: 1 }}>
        <Text style={s.title}>🚴 {name || 'Delivery Partner'}</Text>
        <Text style={s.phone}>{phone}</Text>
      </View>
      <TouchableOpacity onPress={onLogout} style={s.logoutBtn}>
        <Text style={s.logoutTxt}>🚪 Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  hdr: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 12, paddingTop: 45, flexDirection: 'row', alignItems: 'center', elevation: 4 },
  title: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  phone: { color: colors.primaryLight, fontSize: 10.5, marginTop: 2 },
  logoutBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  logoutTxt: { color: '#fff', fontSize: 10.5, fontWeight: 'bold' },
});
