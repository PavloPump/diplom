// DeliveryCarGo Service Worker
const CACHE_VERSION = 'dcg-v6';
const STATIC_ASSETS = [
  './',
  './index.html',
  './login.html',
  './register.html',
  './app.js',
  './f7-custom.css',
  './f7-extended.css',
  './app.css',
  './auth.css',
  './framework7.min.css',
  './framework7.min.js',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first for API (PHP), cache-first for static assets
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never cache API or third-party POST endpoints
  if (url.pathname.includes('/api/') || url.pathname.endsWith('.php')) {
    return;
  }

  // Bypass cross-origin requests (DaData, Yandex, fonts CDN, etc.)
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
