import { CONFIG } from './config.js';

// The Cache Name is tied to the version. 
// When this changes, the browser sees a "New" service worker.
const CACHE_NAME = CONFIG.VERSION; 

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './config.js',
  './manifest.json',
  './icons/favicon.svg'
];

// INSTALL: Fetch assets and save them in the new cache
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// ACTIVATE: Delete old caches from previous versions
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// FETCH: Serve from Cache first for speed (Offline support)
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});

// MESSAGE: Listen for the "SKIP_WAITING" command from script.js
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
