import { CONFIG } from '/src/config.js';

const CACHE_NAME = CONFIG.VERSION; 

const ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/src/app.js',
  '/src/state.js',
  '/src/config.js',
  '/manifest.json',
  '/icons/favicon.svg',
  '/sw.js'
];

// INSTALL: Pre-cache assets but do NOT skip waiting automatically
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// ACTIVATE: Clean up old versions
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// FETCH: Cache-first
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});

// MESSAGE: Trigger the update only when the user clicks the badge
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
