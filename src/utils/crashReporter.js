import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'last_js_error';

// Debug aid: if a JS error kills the app, save it so the next launch can show it.
export function installCrashReporter() {
  try {
    const prev = global.ErrorUtils && global.ErrorUtils.getGlobalHandler && global.ErrorUtils.getGlobalHandler();
    if (global.ErrorUtils) {
      global.ErrorUtils.setGlobalHandler((error, isFatal) => {
        const msg = String((error && (error.stack || error.message)) || error).slice(0, 900);
        AsyncStorage.setItem(KEY, msg)
          .catch(() => {})
          .finally(() => { if (prev) prev(error, isFatal); });
      });
    }
  } catch (e) {}
}

export function showLastCrash() {
  AsyncStorage.getItem(KEY).then((err) => {
    if (err) {
      AsyncStorage.removeItem(KEY).catch(() => {});
      Alert.alert('Last crash (JS error)', err);
    }
  }).catch(() => {});
}
