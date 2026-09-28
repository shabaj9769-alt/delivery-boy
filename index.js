import { registerRootComponent } from 'expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from './App';

// Debug aid: if a JS error kills the app, save it so the next launch can show it.
try {
  const prev = global.ErrorUtils && global.ErrorUtils.getGlobalHandler && global.ErrorUtils.getGlobalHandler();
  if (global.ErrorUtils) {
    global.ErrorUtils.setGlobalHandler((error, isFatal) => {
      const msg = String((error && (error.stack || error.message)) || error).slice(0, 900);
      AsyncStorage.setItem('last_js_error', msg)
        .catch(() => {})
        .finally(() => { if (prev) prev(error, isFatal); });
    });
  }
} catch (e) {}

registerRootComponent(App);
