// Service worker: keeps a copy of every file on the phone so the game runs offline.
// Strategy: always try the internet first so updates show up straight away; if
// there's no connection (or it takes over 3 seconds), use the saved copy instead.
// Bump VERSION whenever you change any file.
const VERSION = 'blox-v4';
const FILES = [
  './',
  './index.html',
  './style.css',
  './game.js',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];
const TIMEOUT_MS = 3000;

self.addEventListener('install', event => {
  // cache: 'reload' skips the browser's own short-term cache so we save the newest files
  event.waitUntil(
    caches.open(VERSION).then(cache => cache.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  event.respondWith(fromNetwork(req).catch(() => fromCache(req)));
});

async function fromNetwork(req) {
  const res = await Promise.race([
    fetch(req.url, { cache: 'no-cache' }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)),
  ]);
  if (!res.ok) throw new Error('bad response');
  const cache = await caches.open(VERSION);
  cache.put(req, res.clone());
  return res;
}

async function fromCache(req) {
  const cached = await caches.match(req, { ignoreSearch: true });
  return cached || Response.error();
}
