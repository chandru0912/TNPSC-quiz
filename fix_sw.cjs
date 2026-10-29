const fs = require('fs');
const c = fs.readFileSync('public/sw.js','utf8');
const neu = `const CACHE_NAME = 'tnpsc-hub-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.json'
];

// Install: pre-cache core static shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('PWA: Some static assets failed to pre-cache', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up older caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: bypass /api completely, cache-first for static assets, network-first for pages
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // CRITICAL: NEVER cache API requests or non-GET requests
  if (event.request.method !== 'GET' || requestUrl.pathname.startsWith('/api')) {
    return;
  }

  // Handle static assets and navigation
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch background update for cache
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.ok && networkResponse.status === 200 && networkResponse.type === 'basic') {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone())).catch(() => {});
          }
        }).catch(() => {/* Ignore network errors during background revalidation */});
        return cachedResponse;
      }

      return fetch(event.request).then((response) => {
        if (!response || !response.ok || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        try {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache).catch(() => {});
          }).catch(() => {});
        } catch (e) {
          // ignore
        }

        return response;
      }).catch(() => {
        // If offline and requesting an HTML page, return index.html
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/index.html').then(r => r || caches.match('/')).catch(() => undefined);
        }
        return undefined;
      });
    }).catch(() => {
      // Fallback to avoid "Failed to convert value to 'Response'"
      if (event.request.headers.get('accept')?.includes('text/html')) {
        return caches.match('/index.html').catch(() => undefined);
      }
      return undefined;
    })
  );
});
`;
fs.writeFileSync('public/sw.js', neu);
console.log('ok');
