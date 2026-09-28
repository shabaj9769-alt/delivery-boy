import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { API_BASE } from '../config/constants';
import { authFetch, getToken } from './api';

const GUARD = 'push_crash_guard';

export async function registerBoyPushToken(boyKey) {
  if (Platform.OS === 'web') return;
  // Remote push tokens are NOT supported inside Expo Go / Snack since SDK 53.
  if (Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient') {
    console.log('Skipping push token registration - remote push needs a real build, not Expo Go/Snack.');
    return;
  }

  // Crash guard: a native crash can't be caught by try/catch. We write a marker
  // before each risky step and clear it at the end. If the marker is still there
  // on the next launch, the last attempt crashed, so we skip push registration
  // and tell you which step it was.
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

  const done = () => AsyncStorage.removeItem(GUARD).catch(() => {});
  try {
    // expo-notifications is loaded lazily so a native problem in it can never
    // crash the app before the login screen.
    await AsyncStorage.setItem(GUARD, 'import');
    const Notifications = require('expo-notifications');
    await AsyncStorage.setItem(GUARD, 'handler');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
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
    if (!Device.isDevice) { await done(); return; }
    await AsyncStorage.setItem(GUARD, 'permission');
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') { await done(); return; }
    await AsyncStorage.setItem(GUARD, 'token');

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
    });
    await AsyncStorage.setItem(GUARD, 'save-token');
    if (tokenData?.data && boyKey) {
      await authFetch(API_BASE + '/delivery-partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ action: 'updateBoyPushToken', boyId: boyKey, pushToken: tokenData.data })
      }).catch(() => {});
    }
    await done();
  } catch (e) {
    console.log('Push registration error:', e);
    await done();
  }
}
