/* MARATU Admin Service Worker — offline + instant open */
const VERSION = 'maratu-admin-v21';
const STATIC_CACHE = 'static-' + VERSION;
const RUNTIME_CACHE = 'runtime-' + VERSION;

const PRECACHE = [
  '/login.html',
  '/admin.webmanifest',
  '/TRYJackAlpha-Regular.ttf',
  '/TRYClother-Regular.ttf',
  '/TRYClother-Bold.ttf',
  '/TRYClother-Black.ttf',
  '/favicon-v6.png',
  '/apple-touch-icon-v6.png',
  '/admin-icon-192-v6.png',
  '/admin-icon-512-v6.png',
  '/admin-corner.svg'
];

const API_HOST = 'maratu-api.raphaelnascimento.workers.dev';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(PRECACHE).catch((e) => console.warn('[sw] precache partial:', e))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
     .then(() => self.clients.matchAll({ type: 'window' }))
     .then((clients) => clients.forEach((c) => { try { c.navigate(c.url); } catch (e) {} }))
  );
});

/* HTML and JS: always hit the network fresh (bypass HTTP cache) so a new
   deploy is picked up immediately; fall back to cache only when offline. */
function freshFirst(req) {
  return fetch(req, { cache: 'no-store' }).then((resp) => {
    if (resp && resp.ok) {
      const clone = resp.clone();
      caches.open(RUNTIME_CACHE).then((c) => c.put(req, clone));
    }
    return resp;
  }).catch(() => caches.match(req).then((cached) => cached || caches.match('/login.html')));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;
  if (url.hostname === API_HOST) return;
  if (url.origin !== self.location.origin) return;

  const isHtml = /\/(admin|login)\.html$/.test(url.pathname) || url.pathname === '/admin.webmanifest';
  const isScript = /\.js$/.test(url.pathname);
  const isFont = /\.(ttf|woff2?|otf)$/.test(url.pathname);
  const isImg = /\.(png|jpg|jpeg|webp|svg|ico|gif|avif)$/.test(url.pathname);

  if (isHtml || isScript) {
    event.respondWith(freshFirst(req));
    return;
  }

  if (isFont || isImg) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((resp) => {
          if (resp && resp.ok) {
            const clone = resp.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, clone));
          }
          return resp;
        });
      })
    );
  }
});
