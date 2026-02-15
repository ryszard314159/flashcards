import { CONFIG } from './config.js';

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

// INSTALL: Pre-cache assets
self.addEventListener('install', (e) => {
  // force move to 'active' state even if old SW exists
  self.skipWaiting(); 
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// ACTIVATE: Clean up old versions and take control
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim()) // Important: Take control of open tabs immediately
  );
});

// FETCH: Cache-first
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});

// MESSAGE: Trigger the update
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
