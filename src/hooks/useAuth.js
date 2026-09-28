import { useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { TOKEN_REFRESH_MS } from '../config/constants';
import { setAuthRejectedHandler, setToken } from '../services/api';
import {
  clearSavedSession, loadSession, requestLogin, requestTokenRefresh, saveSession
} from '../services/session';
import { showLastCrash } from '../utils/crashReporter';

const EMPTY_BOY = { key: '', name: '', phone: '' };

// Login / logout / session restore / token refresh.
//   boyRef           - shared ref holding the current partner's identity
//   onSessionStart   - (boyKey) => void      called once authenticated
//   onTokenRefreshed - () => void            called after a silent re-auth
//   onLock           - () => void            called when the session is cleared
export default function useAuth({ boyRef, onSessionStart, onTokenRefreshed, onLock }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [boyName, setBoyName] = useState('');
  const [boyPhone, setBoyPhone] = useState('');

  const refreshTokenRef = useRef('');
  const authRetryingRef = useRef(false);
  // Always call the latest callbacks, even from async code started on an old render.
  const cb = useRef({});
  cb.current = { onSessionStart, onTokenRefreshed, onLock };

  // ---- bootstrap ----
  useEffect(() => {
    showLastCrash();
    restoreSession();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && refreshTokenRef.current) refreshBoyToken();
    });
    return () => sub.remove();
  }, []);

  // ---- periodic token refresh while logged in ----
  useEffect(() => {
    if (!isAuthenticated) return;
    const t = setInterval(() => { refreshBoyToken(); }, TOKEN_REFRESH_MS);
    return () => clearInterval(t);
  }, [isAuthenticated]);

  const setIdentity = (key, name, phone) => {
    boyRef.current = { key, name, phone };
    setBoyName(name);
    setBoyPhone(phone);
  };

  const restoreSession = async () => {
    try {
      const saved = await loadSession();
      if (!saved || !saved.refreshToken) return;
      refreshTokenRef.current = saved.refreshToken;
      setIdentity(saved.boyKey || '', saved.name || '', saved.phone || '');
      const ok = await refreshBoyToken();
      if (ok) startSession(saved.boyKey);
    } finally {
      setCheckingSession(false);
    }
  };

  const startSession = (key) => {
    setIsAuthenticated(true);
    setAuthRejectedHandler(async () => {
      // ID tokens expire hourly; try a silent refresh once before kicking the user out.
      if (authRetryingRef.current) return;
      authRetryingRef.current = true;
      const ok = await refreshBoyToken();
      authRetryingRef.current = false;
      if (ok) cb.current.onTokenRefreshed && cb.current.onTokenRefreshed();
      else lockApp('Your session has expired. Please log in again.');
    });
    cb.current.onSessionStart && cb.current.onSessionStart(key);
  };

  const refreshBoyToken = async () => {
    try {
      const d = await requestTokenRefresh(refreshTokenRef.current);
      setToken(d.idToken);
      if (d.refreshToken) {
        refreshTokenRef.current = d.refreshToken;
        const saved = (await loadSession()) || {};
        await saveSession({ ...saved, refreshToken: d.refreshToken });
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
      const { res, data: d } = await requestLogin(phone, code);
      if (res.status === 401) return Alert.alert('Login Failed', d.error || 'Invalid phone number or secret code.');
      if (!res.ok || !d.idToken) return Alert.alert('Login Failed', d.error || 'Something went wrong. Please try again.');
      if (d.boy && d.boy.status === 'Blocked') {
        return Alert.alert('Account Blocked', 'Your delivery account has been blocked by the admin. Please contact the store.');
      }

      const name = (d.boy && d.boy.name) || '';
      const boyPh = (d.boy && d.boy.phone) || phone;
      setToken(d.idToken);
      refreshTokenRef.current = d.refreshToken || '';
      setIdentity(d.boyKey || '', name, boyPh);
      await saveSession({ boyKey: d.boyKey || '', name, phone: boyPh, refreshToken: d.refreshToken || '' });
      setCodeInput('');
      startSession(d.boyKey);
    } catch (e) {
      Alert.alert('Network Error', 'Could not reach the server. Please check your internet connection.');
    } finally {
      setLoggingIn(false);
    }
  };

  const lockApp = (message) => {
    setToken('');
    refreshTokenRef.current = '';
    setAuthRejectedHandler(null);
    clearSavedSession();
    setIdentity('', '', '');
    setIsAuthenticated(false);
    cb.current.onLock && cb.current.onLock();
    if (message) Alert.alert('Session Ended', message);
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => lockApp() }
    ]);
  };

  return {
    isAuthenticated, checkingSession, loggingIn,
    phoneInput, setPhoneInput, codeInput, setCodeInput,
    boyName, boyPhone,
    handleLogin, handleLogout, lockApp,
  };
}
