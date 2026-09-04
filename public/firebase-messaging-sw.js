// public/firebase-messaging-sw.js
// ─────────────────────────────────────────────────────────────────────────────
// Handles push notifications while this tab/app is backgrounded or fully
// closed. Must be named exactly this and served from the site root (Firebase
// requirement) — Vite copies anything in /public to the build root as-is.
//
// NOTE: service workers can't use import.meta.env, so this config is
// duplicated from notificationService.js rather than imported. If you
// rotate Firebase config, update both places.
// ─────────────────────────────────────────────────────────────────────────────

importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

// These are safe to hardcode here — Firebase web config values are not
// secret (they identify the project, not authenticate as it). This file is
// static and served as-is from /public, so it CANNOT read Vite env
// variables — fill in the actual values below by hand, matching your
// VITE_FIREBASE_* values in .env exactly.
firebase.initializeApp({
  apiKey: 'REPLACE_ME',
  authDomain: 'REPLACE_ME',
  projectId: 'REPLACE_ME',
  storageBucket: 'REPLACE_ME',
  messagingSenderId: 'REPLACE_ME',
  appId: 'REPLACE_ME',
});

const messaging = firebase.messaging();

// fcmService.js's `webpush` block supplies title/body/icon/tag here directly —
// Firebase shows this automatically for background messages in most cases,
// but this handler makes the click-to-open behavior explicit and reliable.
messaging.onBackgroundMessage(payload => {
  const {notification, data} = payload;
  const title = notification?.title || 'New WhatsApp message';
  const options = {
    body: notification?.body || '',
    icon: '/icons/icon-192.png',
    tag: data?.conversationId ? `wa_conv_${data.conversationId}` : undefined,
    data,
  };
  self.registration.showNotification(title, options);

  // Best-effort icon badge while the app is fully closed. This can only
  // approximate "how many push notifications are currently showing" (via
  // getNotifications()) rather than the app's real unread count, since a
  // service worker has no access to Redux state — the foreground
  // BadgeManager component replaces this with the accurate total the
  // moment the app is actually opened.
  if ('setAppBadge' in self.navigator) {
    self.registration.getNotifications().then(notifications => {
      self.navigator.setAppBadge(notifications.length).catch(() => {});
    });
  }
});

// Keep the approximate badge count in sync as notifications are dismissed
// individually (e.g. swiped away from the notification tray) without ever
// opening the app.
self.addEventListener('notificationclose', () => {
  if (!('setAppBadge' in self.navigator)) return;
  self.registration.getNotifications().then(notifications => {
    if (notifications.length > 0) {
      self.navigator.setAppBadge(notifications.length).catch(() => {});
    } else {
      self.navigator.clearAppBadge().catch(() => {});
    }
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const conversationId = event.notification.data?.conversationId;
  const url = conversationId ? `/chat/${conversationId}` : '/';

  event.waitUntil(
    clients.matchAll({type: 'window', includeUncontrolled: true}).then(windowClients => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    }),
  );
});
