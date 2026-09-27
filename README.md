# Manor Mart - Delivery Partner App

A new Expo/React Native app for delivery partners, built to match the existing
Manor Mart Customer app and Admin app.

## How it authenticates

Login goes through the **already-existing** backend route
`POST /api/delivery-partners` with `{ action: 'boyLogin', phone, secretCode }`
(see `lib/handlers/delivery.js` in the `manormart-pay` backend). That route
returns a real Firebase ID token carrying `{ deliveryBoy: true, boyKey }`
custom claims - the same pattern the Admin app uses for its PIN login.

- The ID token is kept **in memory only** (`BOY_TOKEN`), never written to disk.
- Only the long-lived `refreshToken` is persisted (AsyncStorage), so the app
  can silently sign the partner back in on next open via
  `POST /api/admin-refresh` (a generic Firebase refresh-token exchange - it
  works for any valid refresh token, not just admin ones).
- If the admin blocks the partner's account, or a request comes back
  401/403, the app clears the session and returns to the login screen.

## How it reads/writes orders

There is currently **no Vercel proxy route** for a delivery partner to read or
update orders (`/api/orders-manager` only accepts admin tokens or a
customer's own session for writes). So, exactly like the Admin app, this app
talks to the Firebase Realtime Database **directly**, using the ID token as
the `?auth=` query parameter:

- `GET  {FIREBASE_DB}/orders.json?auth=<idToken>` - polled every 8s, filtered
  client-side to orders where `assignedBoy`/`deliveryBoyPhone` matches this
  partner.
- `PATCH {FIREBASE_DB}/orders/{id}.json?auth=<idToken>` - sets
  `deliveryStatus` to `Out for Delivery` / `Delivered`.
- `GET {FIREBASE_DB}/deliveryBoys/{boyKey}/status.json?auth=<idToken>` -
  checked each poll so a mid-shift block by the admin takes effect quickly.

**⚠️ Prerequisite you need to check:** this only works if your Firebase
Realtime Database security rules actually grant a `deliveryBoy: true` token
read access to `orders` and write access to the `deliveryStatus` (and
`outForDeliveryAt`/`deliveredAt`) fields - ideally scoped so a partner can
only touch orders assigned to their own `boyKey`/name, not everyone's. This
app can't grant that itself; if requests get rejected, that's the first place
to look.

## Safety rules carried over from the Admin app

- **Payment safety**: an Online order can only be marked *Delivered* once the
  server has verified payment (`paymentVerified === true`). The button is
  disabled and a warning is shown otherwise - this mirrors the exact same
  rule in the Admin app, since `deliveryStatus` text can be written by the
  customer and should never be trusted for this.
- **New-task alert**: vibration + siren sound when a new order gets assigned,
  same behavior/asset as the Admin app's order alert (skipped on first load
  so opening the app doesn't ring for everything already sitting there).

## Before you build

1. Run `eas init` (or set it manually) to get **this app's own** EAS
   `projectId`, then replace `REPLACE_WITH_YOUR_EAS_PROJECT_ID` in:
   - `app.json` → `expo.extra.eas.projectId`
   - `App.js` → the `Notifications.getExpoPushTokenAsync({ projectId: ... })` call
   (Skipping this means push notifications silently fail on any real build -
   this is the same bug that was just fixed in the Admin app.)
2. Add real icons/splash images under `assets/` (referenced in `app.json` but
   not included here).
3. `npm install`, then `npx expo start` to run in Expo Go, or
   `eas build --profile preview --platform android` for an installable APK.

## Project structure

```
App.js          - the whole app (login, active deliveries, today's summary)
app.json        - Expo config
eas.json        - EAS build profiles
index.js        - Expo entry point
package.json    - dependencies (matches the SDK 54 used by the other apps)
```
