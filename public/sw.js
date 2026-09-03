// public/sw.js — minimal, hand-written service worker for PWA installability
// and a basic offline app-shell. Deliberately NOT using Workbox to keep this
// simple and easy to reason about; upgrade to vite-plugin-pwa later if you
// need more sophisticated caching (runtime API caching, background sync, etc).

const CACHE_NAME = 'skyup-wa-shell-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

// Network-first for API calls (always want fresh chat data), cache-first for
// the app shell (so the PWA still opens offline, even if the socket/API
// calls inside it then fail gracefully).
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET') return; // never cache mutations

  if (url.pathname.startsWith('/api') || url.hostname !== self.location.hostname) {
    return; // let API/cross-origin requests go straight to network, uncached
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request)),
  );
});
