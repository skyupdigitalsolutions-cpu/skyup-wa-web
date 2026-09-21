// public/firebase-messaging-sw.js
// ─────────────────────────────────────────────────────────────────────────────
// Handles push notifications while this tab/app is backgrounded or fully
// closed. Must be named exactly this and served from the site root (Firebase
// requirement) — Vite copies anything in /public to the build root as-is.
//
// NOTE: service workers cannot use import.meta.env (Vite env vars). The
// config values below are injected at BUILD TIME by vite-plugin-inject-sw
// OR can be filled in manually. See the build step in package.json / vite.config.js.
//
// If you are NOT using the build injection, fill every __VITE_*__ placeholder
// by hand with the actual values from your .env file, then redeploy.
// ─────────────────────────────────────────────────────────────────────────────

importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

// ── Config ───────────────────────────────────────────────────────────────────
// These placeholders are replaced at build time by scripts/inject-sw-env.js
// (see package.json "build" script). If you are running without that step,
// replace every __VITE_FIREBASE_*__ string below with the real value from
// your .env file — these values are NOT secret (they identify the Firebase
// project, not authenticate as it).
const firebaseConfig = {
  apiKey:            self.__FIREBASE_CONFIG__?.apiKey            || '__VITE_FIREBASE_API_KEY__',
  authDomain:        self.__FIREBASE_CONFIG__?.authDomain        || '__VITE_FIREBASE_AUTH_DOMAIN__',
  projectId:         self.__FIREBASE_CONFIG__?.projectId         || '__VITE_FIREBASE_PROJECT_ID__',
  storageBucket:     self.__FIREBASE_CONFIG__?.storageBucket     || '__VITE_FIREBASE_STORAGE_BUCKET__',
  messagingSenderId: self.__FIREBASE_CONFIG__?.messagingSenderId || '__VITE_FIREBASE_MESSAGING_SENDER_ID__',
  appId:             self.__FIREBASE_CONFIG__?.appId             || '__VITE_FIREBASE_APP_ID__',
};

// Guard: if the config is still un-filled placeholders, bail out cleanly
// rather than letting Firebase throw a cryptic error.
const configReady = !Object.values(firebaseConfig).some(v => !v || v.startsWith('__VITE_'));
if (!configReady) {
  console.error(
    '[firebase-messaging-sw] Firebase config placeholders not replaced — ' +
    'run the build script or fill in the values manually. Push will not work.',
  );
} else {
  firebase.initializeApp(firebaseConfig);

  const messaging = firebase.messaging();

  // ── Background message handler ──────────────────────────────────────────
  // fcmService.js's `webpush` block supplies title/body/icon/tag in the
  // notification field, so Firebase would show the notification automatically
  // in most browsers — but this explicit handler makes click-to-open reliable
  // across all browsers and gives us badge control.
  messaging.onBackgroundMessage(payload => {
    const {notification, data} = payload;
    const title = notification?.title || 'New WhatsApp message';
    const options = {
      body:  notification?.body || '',
      icon:  '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag:   data?.conversationId ? `wa_conv_${data.conversationId}` : undefined,
      // Store data on the notification so notificationclick can read it
      // without having to parse the URL. Explicitly spread so nothing is lost.
      data: { ...data },
    };
    self.registration.showNotification(title, options);

    // Best-effort badge: getNotifications() resolves BEFORE the new
    // notification above is listed (it was just posted but not yet
    // committed), so add 1 to account for the one we just showed.
    if ('setAppBadge' in self.navigator) {
      self.registration.getNotifications().then(existing => {
        self.navigator.setAppBadge(existing.length + 1).catch(() => {});
      });
    }
  });

  // ── notificationclose ───────────────────────────────────────────────────
  // Keep the badge in sync when the user swipes a notification away from
  // the tray without opening the app. getNotifications() here is called
  // AFTER the close event, so the dismissed notification is already gone
  // from the list — no offset needed.
  self.addEventListener('notificationclose', () => {
    if (!('setAppBadge' in self.navigator)) return;
    self.registration.getNotifications().then(remaining => {
      if (remaining.length > 0) {
        self.navigator.setAppBadge(remaining.length).catch(() => {});
      } else {
        self.navigator.clearAppBadge().catch(() => {});
      }
    });
  });

  // ── notificationclick ───────────────────────────────────────────────────
  // Open or focus the correct chat when the user taps the notification.
  //
  // FIX (Bug 6): the original code used `client.navigate(url)` which is
  // non-standard and NOT supported in Safari / older Chromium. The fix:
  //   1. First look for an already-open tab whose URL matches the target —
  //      just focus it so we don't open a duplicate.
  //   2. If there is an open tab but at the wrong URL, post a message so
  //      the React app can navigate in-process (avoids a full reload).
  //   3. If no tab is open, open a new one via clients.openWindow().
  self.addEventListener('notificationclick', event => {
    event.notification.close();

    const conversationId = event.notification.data?.conversationId;
    const targetPath = conversationId ? `/chat/${conversationId}` : '/';
    const targetUrl  = new URL(targetPath, self.location.origin).href;

    event.waitUntil(
      clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then(windowClients => {
          // 1. Already on exactly the right page — just focus.
          const exact = windowClients.find(c => c.url === targetUrl);
          if (exact) return exact.focus();

          // 2. App is open somewhere else — post a navigate message and
          //    focus that tab. The React app listens for this in
          //    notificationService.js and calls _navigate() in-process.
          const any = windowClients.find(c => c.url.startsWith(self.location.origin));
          if (any) {
            any.postMessage({ type: 'WA_NOTIFICATION_NAVIGATE', path: targetPath });
            return any.focus();
          }

          // 3. No open tab — open a new window.
          return clients.openWindow(targetUrl);
        }),
    );
  });
}
