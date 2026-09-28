export const FIREBASE_DB = 'https://manorbiryani-default-rtdb.firebaseio.com/';
export const API_BASE = 'https://manormart-pay.vercel.app/api';

export const SESSION_KEY = 'manor_boy_session'; // { boyKey, phone, name, refreshToken }

// Steps an order goes through once it reaches this app.
export const ACTIVE_STATUSES = ['Assigned', 'Out for Delivery'];

export const POLL_INTERVAL_MS = 8000;
export const TOKEN_REFRESH_MS = 45 * 60 * 1000; // Firebase ID tokens last 1 hour

export const SIREN_URL = 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg';
export const SIREN_MAX_MS = 45000;
