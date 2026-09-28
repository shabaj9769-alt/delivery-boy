// --- MANOR MART DELIVERY PARTNER APP ---
// Talks to the same Vercel backend + Firebase project as the Customer and
// Admin apps. Login goes through /api/delivery-partners (boyLogin), which
// hands back a real Firebase ID token carrying { deliveryBoy: true, boyKey }
// custom claims - exactly like the Admin app's PIN login. From then on this
// app reads/writes the Firebase Realtime Database directly with that token
// as the `auth` query param, the same way the Admin app does. Firebase
// Security Rules (not part of this app) are what actually restrict a
// deliveryBoy-claim token to only the orders/fields it should touch - if
// reads/writes here get rejected, check those rules first.
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  ScrollView, Alert, SafeAreaView, Platform, Linking,
  AppState, Vibration, RefreshControl
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

const FIREBASE_DB = "https://manorbiryani-default-rtdb.firebaseio.com/";
const API_BASE = "https://manormart-pay.vercel.app/api";
const SESSION_KEY = 'manor_boy_session'; // { boyKey, phone, name, refreshToken }

// The ID token lives in memory only (never written to disk), same policy as
// the Admin app. Only the long-lived refreshToken is persisted, and it is
// only useful together with this specific backend to mint a fresh ID token.
let BOY_TOKEN = '';
let onAuthRejected = null;

const authFetch = (url, opts) => {
  const isDb = typeof url === 'string' && url.startsWith(FIREBASE_DB);
  const hadToken = isDb && !!BOY_TOKEN;
  if (hadToken) url += (url.includes('?') ? '&' : '?') + 'auth=' + encodeURIComponent(BOY_TOKEN);
  return fetch(url, opts).then((res) => {
    if (hadToken && (res.status === 401 || res.status === 403) && onAuthRejected) onAuthRejected();
    return res;
  });
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Steps an order goes through once it reaches this app.
const ACTIVE_STATUSES = ['Assigned', 'Out for Delivery'];

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Same payment-safety rule as the Admin app: an Online order can only be
// marked Delivered once the SERVER has verified the payment. Never trust
// deliveryStatus text for this - customers can write that field themselves.
const isPaymentVerified = (ord) => ord.payment !== 'Online' || ord.paymentVerified === true;

function isSameDay(ts, ref) {
  if (!ts) return false;
  const a = new Date(Number(ts));
  return a.getFullYear() === ref.getFullYear() && a.getMonth() === ref.getMonth() && a.getDate() === ref.getDate();
}

function formatTime(ts) {
  if (!ts) return '';
  try {
    return new Date(Number(ts)).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true
    });
  } catch (e) { return ''; }
}

export default function DeliveryBoyApp() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [codeInput, setCodeInput] = useState('');

  const [boyKey, setBoyKey] = useState('');
  const [boyName, setBoyName] = useState('');
  const [boyPhone, setBoyPhone] = useState('');

  const [orders, setOrders] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [isRinging, setIsRinging] = useState(false);

  const refreshTokenRef = useRef('');
  const alertedIdsRef = useRef(null); // null until first successful load
  const soundRef = useRef(null);
  const ringTimeoutRef = useRef(null);
  const vibeIntervalRef = useRef(null);
  const isRingingRef = useRef(false);

  // ---------------- Session bootstrap ----------------

  useEffect(() => {
    restoreSession();
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && refreshTokenRef.current) refreshBoyToken();
    });
    return () => appStateSub.remove();
  }, []);

  const restoreSession = async () => {
    try {
      const raw = await AsyncStorage.getItem(SESSION_KEY);
      if (!raw) { setCheckingSession(false); return; }
      const saved = JSON.parse(raw);
      if (!saved || !saved.refreshToken) { setCheckingSession(false); return; }
      refreshTokenRef.current = saved.refreshToken;
      setBoyKey(saved.boyKey || '');
      setBoyName(saved.name || '');
      setBoyPhone(saved.phone || '');
      const ok = await refreshBoyToken();
      if (ok) startSession(saved.boyKey);
    } catch (e) {
      // ignore, fall through to login screen
    } finally {
      setCheckingSession(false);
    }
  };

  const startSession = (key) => {
    setIsAuthenticated(true);
    onAuthRejected = () => lockApp('Your session has expired. Please log in again.');
    loadMyOrders();
    registerBoyPushToken(key);
  };

  const persistSession = async (data) => {
    try { await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(data)); } catch (e) {}
  };

  // Reuses the same generic Firebase refresh endpoint the Admin app uses -
  // it just exchanges any valid refreshToken for a new ID token, regardless
  // of whose token it is.
  const refreshBoyToken = async () => {
    try {
      const r = await fetch(API_BASE + '/admin-refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refreshTokenRef.current })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.idToken) throw new Error('refresh failed');
      BOY_TOKEN = d.idToken;
      if (d.refreshToken) {
        refreshTokenRef.current = d.refreshToken;
        const raw = await AsyncStorage.getItem(SESSION_KEY).catch(() => null);
        const saved = raw ? JSON.parse(raw) : {};
        await persistSession({ ...saved, refreshToken: d.refreshToken });
      }
      return true;
    } catch (e) {
      return false;
    }
  };

  const handleLogin = async () => {
    if (loggingIn) return;
    const phone = phoneInput.replace(/[^0-9]/g, '').trim();
    const code = codeInput.trim();
    if (phone.length !== 10) return Alert.alert('Invalid Phone', 'Please enter your registered 10-digit mobile number.');
    if (!code) return Alert.alert('Code Required', 'Please enter your secret access code (given by your admin).');

    setLoggingIn(true);
    try {
      const res = await fetch(API_BASE + '/delivery-partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'boyLogin', phone, secretCode: code })
      });
      const d = await res.json().catch(() => ({}));
      if (res.status === 401) return Alert.alert('Login Failed', d.error || 'Invalid phone number or secret code.');
      if (!res.ok || !d.idToken) return Alert.alert('Login Failed', d.error || 'Something went wrong. Please try again.');

      if (d.boy && d.boy.status === 'Blocked') {
        return Alert.alert('Account Blocked', 'Your delivery account has been blocked by the admin. Please contact the store.');
      }

      BOY_TOKEN = d.idToken;
      refreshTokenRef.current = d.refreshToken || '';
      setBoyKey(d.boyKey || '');
      setBoyName((d.boy && d.boy.name) || '');
      setBoyPhone((d.boy && d.boy.phone) || phone);
      await persistSession({
        boyKey: d.boyKey || '', name: (d.boy && d.boy.name) || '',
        phone: (d.boy && d.boy.phone) || phone, refreshToken: d.refreshToken || ''
      });
      setCodeInput('');
      startSession(d.boyKey);
    } catch (e) {
      Alert.alert('Network Error', 'Could not reach the server. Please check your internet connection.');
    } finally {
      setLoggingIn(false);
    }
  };

  const clearSession = async () => {
    BOY_TOKEN = '';
    refreshTokenRef.current = '';
    onAuthRejected = null;
    await AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
  };

  const lockApp = (message) => {
    clearSession();
    setIsAuthenticated(false);
    setOrders([]);
    alertedIdsRef.current = null;
    stopSiren();
    if (message) Alert.alert('Session Ended', message);
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => lockApp() }
    ]);
  };

  // ---------------- Orders polling ----------------

  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(loadMyOrders, 8000);
    return () => clearInterval(interval);
  }, [isAuthenticated, boyName, boyPhone, boyKey]);

  const myOrder = (o) =>
    o.assignedBoy === boyName ||
    o.deliveryBoyPhone === boyPhone ||
    o.assignedBoyPhone === boyPhone;

  const loadMyOrders = async () => {
    try {
      const res = await authFetch(FIREBASE_DB + 'orders.json');
      const data = await res.json().catch(() => null);
      if (!data || data.error) { setOrders([]); return; }
      const mine = Object.keys(data).map(k => ({ id: k, ...data[k] })).filter(myOrder);

      // Alert on newly-assigned orders we haven't seen before (skip the very
      // first load - alertedIdsRef starts null - so opening the app doesn't
      // ring for every order already sitting there).
      const activeIds = new Set(mine.filter(o => ACTIVE_STATUSES.includes(o.deliveryStatus)).map(o => o.id));
      if (alertedIdsRef.current === null) {
        alertedIdsRef.current = activeIds;
      } else {
        let hasNew = false;
        activeIds.forEach(id => { if (!alertedIdsRef.current.has(id)) hasNew = true; });
        alertedIdsRef.current = activeIds;
        if (hasNew) startSiren();
      }

      // Also detect if the admin blocked this partner mid-session.
      const statusRes = await authFetch(FIREBASE_DB + `deliveryBoys/${boyKey}/status.json`).catch(() => null);
      const status = statusRes ? await statusRes.json().catch(() => null) : null;
      if (status === 'Blocked') return lockApp('Your account has been blocked by the admin.');

      mine.sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
      setOrders(mine);
    } catch (e) {
      // silent - next poll will retry
    }
  };

  const onManualRefresh = async () => {
    setRefreshing(true);
    await loadMyOrders();
    setRefreshing(false);
  };

  // ---------------- Siren for new assignments ----------------

  const stopSiren = async () => {
    isRingingRef.current = false;
    if (ringTimeoutRef.current) { clearTimeout(ringTimeoutRef.current); ringTimeoutRef.current = null; }
    if (vibeIntervalRef.current) { clearInterval(vibeIntervalRef.current); vibeIntervalRef.current = null; }
    Vibration.cancel();
    setIsRinging(false);
    const snd = soundRef.current;
    soundRef.current = null;
    if (snd) {
      try { await snd.stopAsync(); } catch (e) {}
      try { await snd.unloadAsync(); } catch (e) {}
    }
  };

  const startSiren = async () => {
    if (isRingingRef.current) return;
    isRingingRef.current = true;
    setIsRinging(true);
    Vibration.vibrate(700);
    vibeIntervalRef.current = setInterval(() => Vibration.vibrate(700), 1500);
    ringTimeoutRef.current = setTimeout(stopSiren, 45000);
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true, shouldDuckAndroid: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg' },
        { shouldPlay: true, isLooping: true, volume: 1.0 }
      );
      if (!isRingingRef.current) { try { await sound.unloadAsync(); } catch (e) {} return; }
      soundRef.current = sound;
    } catch (e) {}
  };

  // ---------------- Push notifications ----------------

  const registerBoyPushToken = async (key) => {
    const bk = key || boyKey;
    if (Platform.OS === 'web') return;
    // Remote push tokens (getExpoPushTokenAsync) are NOT supported inside
    // Expo Go / Snack since SDK 53 - calling it there was crashing the app
    // right after login. Only attempt this in a real standalone/EAS build.
    if (Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient') {
      console.log('Skipping push token registration - remote push needs a real build, not Expo Go/Snack.');
      return;
    }
    // Crash guard: a native crash (e.g. missing Firebase config) can't be caught
    // by try/catch. We write a marker before each risky step and clear it at the
    // end. If the marker is still there on the next launch, the last attempt
    // crashed, so we skip push registration and tell you which step it was.
    const GUARD = 'push_crash_guard';
    try {
      const crashedAt = await AsyncStorage.getItem(GUARD);
      if (crashedAt) {
        console.log('Skipping push registration - previous attempt crashed at:', crashedAt);
        if (!crashedAt.startsWith('reported:')) {
          await AsyncStorage.setItem(GUARD, 'reported:' + crashedAt);
          Alert.alert('Push disabled', 'App crashed last time at step: ' + crashedAt + '. Push notifications are turned off. Send this step name to the developer.');
        }
        return;
      }
    } catch (e) {}
    try {
      await AsyncStorage.setItem(GUARD, 'channel');
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'New Task Alerts',
          importance: Notifications.AndroidImportance.MAX,
          sound: 'default',
          enableVibrate: true,
          vibrationPattern: [0, 700, 300, 700],
        });
      }
      if (!Device.isDevice) { await AsyncStorage.removeItem(GUARD).catch(() => {}); return; }
      await AsyncStorage.setItem(GUARD, 'permission');
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') { await AsyncStorage.removeItem(GUARD).catch(() => {}); return; }
      await AsyncStorage.setItem(GUARD, 'token');

      // EAS projectId (from app.json -> extra.eas.projectId), needed for
      // push token registration to work on real builds (outside Expo Go).
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
      });
      await AsyncStorage.setItem(GUARD, 'save-token');
      if (tokenData?.data && bk) {
        await authFetch(API_BASE + '/delivery-partners', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${BOY_TOKEN}` },
          body: JSON.stringify({ action: 'updateBoyPushToken', boyId: bk, pushToken: tokenData.data })
        }).catch(() => {});
      }
      await AsyncStorage.removeItem(GUARD).catch(() => {});
    } catch (e) {
      console.log('Push registration error:', e);
      await AsyncStorage.removeItem(GUARD).catch(() => {});
    }
  };

  // ---------------- Order actions ----------------

  const startDelivery = (order) => {
    setBusyOrderId(order.id);
    authFetch(FIREBASE_DB + `orders/${order.id}.json`, {
      method: 'PATCH',
      body: JSON.stringify({ deliveryStatus: 'Out for Delivery', outForDeliveryAt: Date.now() })
    }).then(() => loadMyOrders()).catch(() => {
      Alert.alert('Network Error', 'Could not update the order. Please try again.');
    }).finally(() => setBusyOrderId(''));
  };

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
          text: 'Yes, Delivered', onPress: () => {
            setBusyOrderId(order.id);
            authFetch(FIREBASE_DB + `orders/${order.id}.json`, {
              method: 'PATCH',
              body: JSON.stringify({ deliveryStatus: 'Delivered', deliveredAt: Date.now() })
            }).then(() => loadMyOrders()).catch(() => {
              Alert.alert('Network Error', 'Could not update the order. Please try again.');
            }).finally(() => setBusyOrderId(''));
          }
        }
      ]
    );
  };

  const callCustomer = (phone) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  const navigateToCustomer = async (order) => {
    try {
      let originParam = '';
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise(resolve => setTimeout(() => resolve(null), 6000))
        ]).catch(() => null);
        if (loc?.coords) originParam = `&origin=${loc.coords.latitude},${loc.coords.longitude}`;
      }
      const destination = (order.lat && order.lng)
        ? `${order.lat},${order.lng}`
        : encodeURIComponent(order.addr || '');
      const url = `https://www.google.com/maps/dir/?api=1${originParam}&destination=${destination}&travelmode=driving`;
      Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open Maps.'));
    } catch (e) {
      const destination = (order.lat && order.lng) ? `${order.lat},${order.lng}` : encodeURIComponent(order.addr || '');
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`).catch(() => {});
    }
  };

  // ---------------- Derived lists ----------------

  const today = new Date();
  const activeOrders = orders.filter(o => ACTIVE_STATUSES.includes(o.deliveryStatus));
  const deliveredToday = orders.filter(o => o.deliveryStatus === 'Delivered' && isSameDay(o.deliveredAt || o.timestamp, today));
  let cashToday = 0, onlineToday = 0;
  deliveredToday.forEach(o => {
    const val = Number(o.total || 0);
    if (o.payment === 'Online') onlineToday += val; else cashToday += val;
  });

  // ---------------- UI ----------------

  if (checkingSession) {
    return (
      <SafeAreaView style={s.lockCon}>
        <Text style={s.lockIcon}>🚴</Text>
        <Text style={s.lockTitle}>MANOR MART</Text>
        <Text style={s.lockSubtitle}>Delivery Partner</Text>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={s.lockCon}>
        <Text style={s.lockIcon}>🚴</Text>
        <Text style={s.lockTitle}>MANOR MART</Text>
        <Text style={s.lockSubtitle}>Delivery Partner Login</Text>
        <TextInput
          style={s.lockInput} placeholder="10-digit Mobile Number" placeholderTextColor="#ffe0b2"
          keyboardType="numeric" maxLength={10} value={phoneInput} onChangeText={setPhoneInput}
        />
        <TextInput
          style={s.lockInput} placeholder="Secret Access Code" placeholderTextColor="#ffe0b2"
          secureTextEntry value={codeInput} onChangeText={setCodeInput}
        />
        <TouchableOpacity style={[s.lockBtn, loggingIn && { opacity: 0.6 }]} onPress={handleLogin} disabled={loggingIn}>
          <Text style={s.lockBtnTxt}>{loggingIn ? 'Logging In...' : '🔐 Login'}</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 10.5, color: '#ffe0b2', textAlign: 'center', marginTop: 16 }}>
          Don't have a code? Ask your store admin to register you as a delivery partner.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.con}>
      {isRinging && (
        <TouchableOpacity onPress={stopSiren} activeOpacity={0.85} style={s.sirenBanner}>
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>🔔 NEW TASK ASSIGNED!</Text>
          <Text style={{ color: '#fff', fontSize: 11.5, marginTop: 2 }}>Tap here to stop the alert</Text>
        </TouchableOpacity>
      )}

      <View style={s.hdr}>
        <View style={{ flex: 1 }}>
          <Text style={s.ht}>🚴 {boyName || 'Delivery Partner'}</Text>
          <Text style={{ color: '#ffe0b2', fontSize: 10.5, marginTop: 2 }}>{boyPhone}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={s.logoutBtn}>
          <Text style={{ color: '#fff', fontSize: 10.5, fontWeight: 'bold' }}>🚪 Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.body}
        contentContainerStyle={{ paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onManualRefresh} colors={['#e65100']} />}
      >
        <View style={s.statsRow}>
          <View style={[s.statCard, { backgroundColor: '#fff3e0' }]}>
            <Text style={s.statLabel}>Active Tasks</Text>
            <Text style={[s.statVal, { color: '#e65100' }]}>{activeOrders.length}</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: '#e8f5e9' }]}>
            <Text style={s.statLabel}>Delivered Today</Text>
            <Text style={[s.statVal, { color: '#2e7d32' }]}>{deliveredToday.length}</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: '#fbe9e7' }]}>
            <Text style={s.statLabel}>Cash in Hand</Text>
            <Text style={[s.statVal, { color: '#d84315' }]}>₹{round2(cashToday)}</Text>
          </View>
        </View>

        <Text style={s.secTitle}>📦 My Active Deliveries ({activeOrders.length})</Text>
        {activeOrders.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={{ color: '#888', fontSize: 12 }}>No active deliveries assigned right now.</Text>
          </View>
        ) : (
          activeOrders.map(ord => {
            const paid = isPaymentVerified(ord);
            const isBusy = busyOrderId === ord.id;
            return (
              <View key={ord.id} style={s.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Text style={s.orderId}>ORDER #{ord.id.slice(-6)}</Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.orderTotal}>₹{ord.total}</Text>
                    <View style={[s.payBadge, { backgroundColor: ord.payment === 'Online' ? '#e1bee7' : '#c8e6c9' }]}>
                      <Text style={{ fontSize: 9, fontWeight: 'bold', color: ord.payment === 'Online' ? '#4a148c' : '#1b5e20' }}>
                        {ord.payment === 'Online' ? '💳 Online' : '💵 COD'}
                      </Text>
                    </View>
                  </View>
                </View>

                {formatTime(ord.timestamp) ? (
                  <Text style={s.metaText}>🕒 Placed: {formatTime(ord.timestamp)}</Text>
                ) : null}

                <Text style={s.custName}>{ord.name}</Text>
                <Text style={s.addrText}>📍 {ord.addr}</Text>
                <Text style={s.metaText}>Shift: {ord.deliveryShift || '-'} | {ord.deliveryType || 'Normal'}</Text>

                {ord.payment === 'Online' && !paid && (
                  <View style={s.warnBox}>
                    <Text style={{ fontSize: 10.5, fontWeight: 'bold', color: '#b71c1c' }}>
                      ⛔ Payment not verified yet - do not collect / dispatch until confirmed.
                    </Text>
                  </View>
                )}

                <View style={s.itemsBox}>
                  {Object.values(ord.items || {}).map((it, idx) => (
                    <Text key={idx} style={{ fontSize: 10.5, color: '#333' }}>
                      • {it.name} ({it.unit}) x {it.qty}
                    </Text>
                  ))}
                </View>

                <View style={{ flexDirection: 'row', marginTop: 8 }}>
                  <TouchableOpacity onPress={() => callCustomer(ord.phone)} style={[s.actionBtn, { backgroundColor: '#2e7d32', marginRight: 6 }]}>
                    <Text style={s.actionBtnTxt}>📞 Call</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => navigateToCustomer(ord)} style={[s.actionBtn, { backgroundColor: '#0288d1' }]}>
                    <Text style={s.actionBtnTxt}>🧭 Navigate</Text>
                  </TouchableOpacity>
                </View>

                {ord.deliveryStatus === 'Assigned' ? (
                  <TouchableOpacity
                    onPress={() => startDelivery(ord)} disabled={isBusy}
                    style={[s.primaryBtn, { backgroundColor: '#e65100', opacity: isBusy ? 0.6 : 1 }]}
                  >
                    <Text style={s.primaryBtnTxt}>{isBusy ? 'Updating...' : '🚀 Start Delivery (Out for Delivery)'}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => markDelivered(ord)} disabled={isBusy || (!paid)}
                    style={[s.primaryBtn, { backgroundColor: (!paid) ? '#bdbdbd' : '#2e7d32', opacity: isBusy ? 0.6 : 1 }]}
                  >
                    <Text style={s.primaryBtnTxt}>{isBusy ? 'Updating...' : '✅ Mark as Delivered'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}

        <TouchableOpacity onPress={() => setShowCompleted(!showCompleted)} style={s.toggleHdr}>
          <Text style={s.toggleHdrTxt}>✅ Delivered Today ({deliveredToday.length}) {showCompleted ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {showCompleted && (
          <View>
            <View style={s.statsRow}>
              <View style={[s.statCard, { backgroundColor: '#fff3e0' }]}>
                <Text style={s.statLabel}>Cash Collected</Text>
                <Text style={[s.statVal, { color: '#e65100' }]}>₹{round2(cashToday)}</Text>
              </View>
              <View style={[s.statCard, { backgroundColor: '#f3e5f5' }]}>
                <Text style={s.statLabel}>Online (prepaid)</Text>
                <Text style={[s.statVal, { color: '#6a1b9a' }]}>₹{round2(onlineToday)}</Text>
              </View>
            </View>
            {deliveredToday.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={{ color: '#888', fontSize: 12 }}>No deliveries completed yet today.</Text>
              </View>
            ) : (
              deliveredToday.map(ord => (
                <View key={ord.id} style={[s.card, { borderColor: '#a5d6a7' }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={s.orderId}>✅ #{ord.id.slice(-6)}</Text>
                    <Text style={s.orderTotal}>₹{ord.total}</Text>
                  </View>
                  <Text style={s.custName}>{ord.name}</Text>
                  <Text style={s.metaText}>Delivered: {formatTime(ord.deliveredAt || ord.timestamp)}</Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  lockCon: { flex: 1, backgroundColor: '#e65100', justifyContent: 'center', alignItems: 'center', padding: 25 },
  lockIcon: { fontSize: 48, marginBottom: 8 },
  lockTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', letterSpacing: 1 },
  lockSubtitle: { fontSize: 13, color: '#ffe0b2', marginBottom: 24, marginTop: 2 },
  lockInput: { width: '85%', backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff', borderWidth: 1, borderColor: '#ffb74d', padding: 12, borderRadius: 8, fontSize: 14, marginBottom: 12 },
  lockBtn: { width: '85%', backgroundColor: '#fff', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 6 },
  lockBtnTxt: { color: '#e65100', fontWeight: 'bold', fontSize: 14 },

  con: { flex: 1, backgroundColor: '#fff8f0' },
  hdr: { backgroundColor: '#e65100', paddingHorizontal: 14, paddingVertical: 12, paddingTop: 45, flexDirection: 'row', alignItems: 'center', elevation: 4 },
  ht: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  logoutBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  sirenBanner: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 999, elevation: 20, backgroundColor: '#d50000', paddingTop: 42, paddingBottom: 12, alignItems: 'center' },

  body: { flex: 1, padding: 10 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  statCard: { flex: 1, padding: 8, borderRadius: 8, marginHorizontal: 2, alignItems: 'center' },
  statLabel: { fontSize: 9.5, color: '#555', fontWeight: 'bold', textAlign: 'center' },
  statVal: { fontSize: 15, fontWeight: 'bold', marginTop: 3 },

  secTitle: { fontSize: 13, fontWeight: 'bold', color: '#e65100', marginBottom: 8 },
  emptyBox: { backgroundColor: '#fff', padding: 16, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#ffe0b2' },

  card: { backgroundColor: '#fff', padding: 12, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#ffe0b2', elevation: 1 },
  orderId: { fontWeight: 'bold', color: '#e65100', fontSize: 13 },
  orderTotal: { fontWeight: 'bold', color: '#2e7d32', fontSize: 13 },
  payBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 3 },
  metaText: { fontSize: 10.5, color: '#777', marginTop: 3 },
  custName: { fontSize: 13, fontWeight: 'bold', color: '#222', marginTop: 6 },
  addrText: { fontSize: 11.5, color: '#444', marginTop: 2 },
  warnBox: { backgroundColor: '#ffebee', padding: 8, borderRadius: 6, marginTop: 6, borderWidth: 1, borderColor: '#ef9a9a' },
  itemsBox: { backgroundColor: '#fff8f0', padding: 6, borderRadius: 6, marginTop: 6 },

  actionBtn: { flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  actionBtnTxt: { color: '#fff', fontWeight: 'bold', fontSize: 11.5 },
  primaryBtn: { marginTop: 8, paddingVertical: 11, borderRadius: 6, alignItems: 'center' },
  primaryBtnTxt: { color: '#fff', fontWeight: 'bold', fontSize: 12 },

  toggleHdr: { backgroundColor: '#2e7d32', padding: 12, borderRadius: 8, marginTop: 6, marginBottom: 10 },
  toggleHdrTxt: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
});
