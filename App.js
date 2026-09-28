// --- MANOR MART DELIVERY PARTNER APP ---
// Thin root component: wires the hooks together and picks which screen to show.
// See README.md for how auth and order sync work.
import React, { useRef } from 'react';
import useAuth from './src/hooks/useAuth';
import useOrders from './src/hooks/useOrders';
import useSiren from './src/hooks/useSiren';
import { registerBoyPushToken } from './src/services/push';
import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';

export default function App() {
  // Current partner's identity, shared by auth + orders (a ref so async code never sees stale values).
  const boyRef = useRef({ key: '', name: '', phone: '' });

  const siren = useSiren();

  const auth = useAuth({
    boyRef,
    onSessionStart: (key) => {
      orders.loadMyOrders();
      // Give the UI a moment to settle before touching native push code.
      setTimeout(() => registerBoyPushToken(key), 3000);
    },
    onTokenRefreshed: () => orders.loadMyOrders(),
    onLock: () => { orders.reset(); siren.stopSiren(); },
  });

  const orders = useOrders({
    boyRef,
    isAuthenticated: auth.isAuthenticated,
    onBlocked: () => auth.lockApp('Your account has been blocked by the admin.'),
    onNewOrder: siren.startSiren,
  });

  if (auth.checkingSession) return <SplashScreen />;

  if (!auth.isAuthenticated) {
    return (
      <LoginScreen
        phoneInput={auth.phoneInput} onPhoneChange={auth.setPhoneInput}
        codeInput={auth.codeInput} onCodeChange={auth.setCodeInput}
        loggingIn={auth.loggingIn} onLogin={auth.handleLogin}
      />
    );
  }

  return (
    <DashboardScreen
      boyName={auth.boyName} boyPhone={auth.boyPhone} onLogout={auth.handleLogout}
      isRinging={siren.isRinging} onStopSiren={siren.stopSiren}
      orders={orders.orders} refreshing={orders.refreshing} onRefresh={orders.onManualRefresh}
      busyOrderId={orders.busyOrderId}
      onStartDelivery={orders.startDelivery} onMarkDelivered={orders.markDelivered}
    />
  );
}
