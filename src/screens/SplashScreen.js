import React from 'react';
import { SafeAreaView, StyleSheet, Text } from 'react-native';
import { colors } from '../theme/colors';

export default function SplashScreen() {
  return (
    <SafeAreaView style={s.con}>
      <Text style={s.icon}>🚴</Text>
      <Text style={s.title}>MANOR MART</Text>
      <Text style={s.subtitle}>Delivery Partner</Text>
    </SafeAreaView>
  );
}

export const lockStyles = {
  con: { flex: 1, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', padding: 25 },
  icon: { fontSize: 48, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', letterSpacing: 1 },
  subtitle: { fontSize: 13, color: colors.primaryLight, marginBottom: 24, marginTop: 2 },
};

const s = StyleSheet.create(lockStyles);
