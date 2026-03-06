//
// sw.js - Service Worker for Flashcards App
//
// VERSION: 2026-03-06.1643
import { CONFIG } from './src/config.js';

const CACHE_NAME = CONFIG.VERSION; 

const ASSETS = [
  './',
  './index.html',
  './help.html',
  './css/style.css',
  './src/app.js',
  './src/config.js',
  './src/io.js',
  './src/state.js',
  './manifest.json',
  './icons/favicon.svg',
];

// INSTALL: Pre-cache assets but do NOT skip waiting automatically
// self.addEventListener('install', (e) => {
//   e.waitUntil(
//     caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
//   );
// });

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('sw: Opened cache');
        return cache.addAll(ASSETS);
      })
      .catch((err) => {
        // This will print to your CONSOLE if a file in ASSETS is 404ing
        console.error('sw: Service Worker installation failed: ', err);
      })
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
// self.addEventListener('fetch', (e) => {
//   e.respondWith(
//     caches.match(e.request).then((response) => response || fetch(e.request))
//   );
// });

// self.addEventListener('fetch', (e) => {
//   e.respondWith(
//     caches.match(e.request).then((cachedResponse) => {
//       // Fetch from network, but use cache if network fails
//       const fetchPromise = fetch(e.request).then((networkResponse) => {
//         // Update the cache with the new version
//         return caches.open(CACHE_NAME).then((cache) => {
//           cache.put(e.request, networkResponse.clone());
//           return networkResponse;
//         });
//       });
//       return cachedResponse || fetchPromise;
//     })
//   );
// });

// MESSAGE: Trigger the update only when the user clicks the badge
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
