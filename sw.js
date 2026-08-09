/*
  GENGRAIL TCG — update-aware service worker
  -------------------------------------------
  Strategy:
  • Online: always ask the network for the newest app file.
  • Successful network responses refresh the offline cache.
  • Offline/network failure: fall back to the last cached copy.
  • Uses cache:'no-store' on same-origin app requests so iOS/Safari's HTTP
    cache cannot hand the service worker an older JS/CSS/HTML response.

  Normal GitHub updates to index.html, CSS or JS no longer require changing
  this cache name. Only edit this service worker again if its own logic changes.
*/

const CACHE = 'gengrail-runtime-v1';

const CORE = [
  './',
  './index.html',
  './manifest.json',
  './gengrail-theme.css',
  './gengrail-ebay.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(async cache => {
      // Prime each core asset independently so one failed request does not
      // prevent installation of the whole service worker.
      await Promise.allSettled(
        CORE.map(async url => {
          const response = await fetch(url, { cache: 'no-store' });
          if (response && response.ok) {
            await cache.put(url, response.clone());
          }
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE)
            .map(key => caches.delete(key))
        )
      ),
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;

  // Only handle ordinary GET requests.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Leave third-party requests alone.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      try {
        // Explicit no-store is important on iOS: the network request itself
        // must not be satisfied from Safari's older HTTP cache.
        const fresh = await fetch(request, { cache: 'no-store' });

        if (fresh && fresh.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(request, fresh.clone());
        }

        return fresh;
      } catch (error) {
        const cached = await caches.match(request, { ignoreSearch: true });

        if (cached) return cached;

        // For navigation requests, the cached app shell is the final fallback.
        if (request.mode === 'navigate') {
          return (
            (await caches.match('./index.html')) ||
            (await caches.match('./'))
          );
        }

        throw error;
      }
    })()
  );
});
