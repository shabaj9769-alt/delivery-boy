import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';

export default function SirenBanner({ onStop }) {
  return (
    <TouchableOpacity onPress={onStop} activeOpacity={0.85} style={s.banner}>
      <Text style={s.title}>🔔 NEW TASK ASSIGNED!</Text>
      <Text style={s.sub}>Tap here to stop the alert</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  banner: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 999, elevation: 20, backgroundColor: colors.danger, paddingTop: 42, paddingBottom: 12, alignItems: 'center' },
  title: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  sub: { color: '#fff', fontSize: 11.5, marginTop: 2 },
});
