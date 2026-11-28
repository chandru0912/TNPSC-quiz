const CACHE_NAME = 'tnpsc-hub-v8';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.json'
];

// Install: pre-cache core static shell and activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('PWA: Some static assets failed to pre-cache', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Allow frontend update recovery to immediately activate any waiting Service Worker
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Activate: clean up all older caches
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

// Fetch: bypass cross-origin, /api, and /version.json completely; Network-First for HTML; safe Cache-First for hashed assets
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // CRITICAL: NEVER intercept cross-origin requests, non-GET requests, /api routes, /version.json,
  // or Vite development server modules (/src/, /@vite/, /@fs/, /@react-refresh, /node_modules/)
  const isLocalDevHost =
    requestUrl.hostname === 'localhost' ||
    requestUrl.hostname === '127.0.0.1' ||
    requestUrl.hostname === '[::1]';
  const isViteDevModule =
    requestUrl.pathname.startsWith('/src/') ||
    requestUrl.pathname.startsWith('/@vite') ||
    requestUrl.pathname.startsWith('/@fs/') ||
    requestUrl.pathname.startsWith('/@id/') ||
    requestUrl.pathname.startsWith('/@react-refresh') ||
    requestUrl.pathname.startsWith('/node_modules/');

  if (
    isLocalDevHost ||
    isViteDevModule ||
    event.request.method !== 'GET' ||
    requestUrl.origin !== self.location.origin ||
    requestUrl.pathname.startsWith('/api') ||
    requestUrl.pathname === '/version.json'
  ) {
    return;
  }

  const isHtmlNavigation =
    event.request.mode === 'navigate' ||
    (event.request.headers.get('accept') || '').includes('text/html') ||
    requestUrl.pathname === '/' ||
    requestUrl.pathname === '/index.html';

  // Network-First for HTML navigation so new deployments are always picked up immediately
  if (isHtmlNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          }
          return networkResponse;
        })
        .catch(() => {
          return caches
            .match(event.request)
            .then((cached) => cached || caches.match('/index.html') || caches.match('/'));
        })
    );
    return;
  }

  // Cache-First for static assets (icons, manifest, hashed bundles)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((response) => {
        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        const isAssetScriptOrStyle = /\.(js|mjs|css)(\?|$)/i.test(requestUrl.pathname);

        // CRITICAL: Never cache HTML fallback responses (e.g. index.html) under .js/.css asset URLs
        if (
          !response ||
          !response.ok ||
          response.status !== 200 ||
          response.type !== 'basic' ||
          (isAssetScriptOrStyle && contentType.includes('text/html'))
        ) {
          return response;
        }

        try {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache).catch(() => {});
          }).catch(() => {});
        } catch {
          // ignore
        }

        return response;
      });
    })
  );
});
