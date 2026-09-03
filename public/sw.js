// public/sw.js — minimal, hand-written service worker for PWA installability
// and a basic offline app-shell. Deliberately NOT using Workbox to keep this
// simple and easy to reason about; upgrade to vite-plugin-pwa later if you
// need more sophisticated caching (runtime API caching, background sync, etc).

const CACHE_NAME = 'skyup-wa-shell-v2'; // bumped so the old (buggy) cache-first cache is discarded
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

// Network-first for the app shell (index.html and the navigation request that
// loads it) — this is what was silently serving a stale build with an old
// baked-in VITE_BACKEND_URL even after redeploying, since Vite's hashed JS
// filename changes on every real build but a cache-first index.html doesn't
// know to fetch that new filename. Fall back to cache only if actually
// offline. Hashed static assets (JS/CSS with a content hash in the filename)
// are still safe to cache-first below, since their URL only ever changes
// when their content does.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET') return; // never cache mutations

  if (url.pathname.startsWith('/api') || url.hostname !== self.location.hostname) {
    return; // let API/cross-origin requests go straight to network, uncached
  }

  const isNavigation = event.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html';

  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request).then(cached => cached || new Response('', {status: 503, statusText: 'Offline'}))),
    );
    return;
  }

  // Static assets (hashed JS/CSS, icons, etc.) — cache-first is safe here.
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).catch(() => new Response('', {status: 503, statusText: 'Offline'}));
    }),
  );
});
