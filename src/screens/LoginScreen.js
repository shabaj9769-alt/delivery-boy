import React from 'react';
import { SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';
import { lockStyles } from './SplashScreen';

export default function LoginScreen({
  phoneInput, onPhoneChange, codeInput, onCodeChange, loggingIn, onLogin
}) {
  return (
    <SafeAreaView style={s.con}>
      <Text style={s.icon}>🚴</Text>
      <Text style={s.title}>MANOR MART</Text>
      <Text style={s.subtitle}>Delivery Partner Login</Text>
      <TextInput
        style={s.input} placeholder="10-digit Mobile Number" placeholderTextColor={colors.primaryLight}
        keyboardType="numeric" maxLength={10} value={phoneInput} onChangeText={onPhoneChange}
      />
      <TextInput
        style={s.input} placeholder="Secret Access Code" placeholderTextColor={colors.primaryLight}
        secureTextEntry value={codeInput} onChangeText={onCodeChange}
      />
      <TouchableOpacity style={[s.btn, loggingIn && { opacity: 0.6 }]} onPress={onLogin} disabled={loggingIn}>
        <Text style={s.btnTxt}>{loggingIn ? 'Logging In...' : '🔐 Login'}</Text>
      </TouchableOpacity>
      <Text style={s.hint}>
        Don't have a code? Ask your store admin to register you as a delivery partner.
      </Text>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ...lockStyles,
  input: { width: '85%', backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff', borderWidth: 1, borderColor: '#ffb74d', padding: 12, borderRadius: 8, fontSize: 14, marginBottom: 12 },
  btn: { width: '85%', backgroundColor: '#fff', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 6 },
  btnTxt: { color: colors.primary, fontWeight: 'bold', fontSize: 14 },
  hint: { fontSize: 10.5, color: colors.primaryLight, textAlign: 'center', marginTop: 16 },
});
