//
// sw.js - Service Worker for Flashcards App
//
// VERSION to be updated by utils/update-version.sh to "YYYY-MM-DD.HHMM"
const VERSION = "2026-03-13.1749";

const CACHE_PREFIX = 'flashcards-';
const LEGACY_VERSION_CACHE_RE = /^\d{4}-\d{2}-\d{2}\.\d{4}$/;

if (!/^\d{4}-\d{2}-\d{2}\.\d{4}$/.test(VERSION)) {
  throw new Error(`sw: invalid VERSION '${VERSION}'`);
}

const CACHE_NAME = `${CACHE_PREFIX}${VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './help.html',
  './css/style.css',
  './src/app.js',
  './src/config.js',
  './src/io.js',
  './src/state.js',
  './src/srs.js',
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
      .then((cache) => cache.addAll(ASSETS))
      // TODO: make it noisy crash!
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
        keys
          .filter((key) => {
            if (key === CACHE_NAME) {
              return false;
            }
            // Remove both current-style and legacy caches.
            return key.startsWith(CACHE_PREFIX) || LEGACY_VERSION_CACHE_RE.test(key);
          })
          .map((key) => caches.delete(key))
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

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  const isCoreModule = requestUrl.pathname.endsWith('/src/app.js') || requestUrl.pathname.endsWith('/src/config.js');

    // If the request is for the HTML file, go to the network first
    // with a 5-second timeout to prevent hanging on slow networks
    if (event.request.mode === 'navigate') {
        event.respondWith(
      Promise.race([
        fetch(event.request),
        new Promise(resolve =>
          setTimeout(() => {
            caches.open(CACHE_NAME)
              .then((cache) => cache.match(event.request))
              .then((cached) => resolve(cached || caches.match('./index.html')))
              .catch(() => resolve(caches.match('./index.html')));
          }, 5000)
        )
      ]).catch(() => {
        return caches.open(CACHE_NAME)
          .then((cache) => cache.match(event.request))
          .then((cached) => cached || caches.match('./index.html'));
      })
        );
        return;
    }

      if (isCoreModule) {
        event.respondWith(
          fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'error') {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
              });
            }
            return networkResponse;
          }).catch(() => {
            return caches.open(CACHE_NAME)
              .then((cache) => cache.match(event.request));
          })
        );
        return;
      }

    // For everything else (JS, CSS, images), use cache-first
    // This ensures users see and interact with the version tag before new code loads
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => cache.match(event.request)).then((response) => {
            if (response) {
                return response;
            }
            // Not in cache, fetch from network and cache it
            return fetch(event.request).then((response) => {
                // Only cache successful responses
                if (!response || response.status !== 200 || response.type === 'error') {
                    return response;
                }
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });
                return response;
            });
        })
    );
});

// MESSAGE: Trigger the update only when the user clicks the version tag
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
