// src/services/notificationService.js
// ─────────────────────────────────────────────────────────────────────────────

//
//  This is the web equivalent of SkyUpWAFull's (React Native) notificationService.js.
//  @react-native-firebase/messaging + @notifee/react-native (native SDKs, no
//  browser equivalent) are replaced with Firebase's Web SDK + a service
//  worker (public/firebase-messaging-sw.js). The backend (fcmService.js) is
//  unchanged — the same FCM token format works for web, Android, and iOS;
//  only the CLIENT code that requests permission and retrieves the token
//  differs per platform.
// ─────────────────────────────────────────────────────────────────────────────

import {initializeApp} from 'firebase/app';
import {getMessaging, getToken, onMessage, isSupported} from 'firebase/messaging';
import {authAPI} from './apiService';
import {ROLES} from '../constants';

// Same Firebase project as the mobile apps (see FIREBASE_CONFIG note in README) —
// these values come from Firebase Console > Project Settings > Web app,
// NOT from google-services.json (that's Android-only). Register a Web app
// under the same project to get this config block.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// VAPID key: Firebase Console > Project Settings > Cloud Messaging >
// Web configuration > Web Push certificates. Required for browsers — has no
// mobile equivalent (mobile uses google-services.json / GoogleService-Info.plist instead).
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

let _messaging = null;
let _navigate = null;

export function setNavigate(fn) {
  _navigate = fn;
}

function navigateToConversation(data) {
  if (!_navigate || !data?.conversationId) return;
  _navigate(`/chat/${data.conversationId}`);
}

async function ensureServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  } catch (e) {
    console.warn('[Notifications] service worker registration failed:', e.message);
    return null;
  }
}

async function registerToken(role) {
  try {
    if (!_messaging) return;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[Notifications] permission not granted:', permission);
      return;
    }

    const swRegistration = await ensureServiceWorker();
    const token = await getToken(_messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration || undefined,
    });
    if (!token) return;

    const isAdmin = role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN;
    const payload = {fcmToken: token, platform: 'web'};
    if (isAdmin) {
      await authAPI.updateAdminDevice(payload);
    } else {
      await authAPI.updateDevice(payload);
    }
    console.log('[Notifications] web push token registered for role:', role);
  } catch (e) {
    console.warn('[Notifications] token registration failed:', e.message);
  }
}

// ── Public entry point — call once after login, once role is known ───────────
export async function setupNotifications(role) {
  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn('[Notifications] Push not supported in this browser.');
      return () => {};
    }
    if (!firebaseConfig.apiKey) {
      console.warn('[Notifications] Firebase web config missing — set VITE_FIREBASE_* env vars.');
      return () => {};
    }

    const app = initializeApp(firebaseConfig);
    _messaging = getMessaging(app);

    await registerToken(role);

    // Foreground messages: the service worker only shows a system
    // notification while the tab is backgrounded/closed. While the tab is
    // open and focused, Firebase hands the message to onMessage instead —
    // show it manually so foreground pushes aren't silently dropped.
    const unsubscribe = onMessage(_messaging, payload => {
      const {notification, data} = payload;
      if (!notification) return;
      if (Notification.permission === 'granted') {
        const n = new Notification(notification.title, {
          body: notification.body,
          icon: '/icons/icon-192.png',
          tag: data?.conversationId ? `wa_conv_${data.conversationId}` : undefined,
        });
        n.onclick = () => {
          window.focus();
          navigateToConversation(data);
        };
      }
    });

    return unsubscribe;
  } catch (e) {
    console.warn('[Notifications] setupNotifications failed:', e.message);
    return () => {};
  }
}
