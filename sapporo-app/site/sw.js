// Offline cache. The whole app is one HTML file: serve it cache-first (stale-while-revalidate) so weak hotel wifi never leaves a blank screen.
const CACHE = 'sapporo-app-v1';
const SHELL = './index.html';
const ASSETS = [SHELL, './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // fonts and map links go straight to the network
  const key = e.request.mode === 'navigate' ? SHELL : e.request;
  e.respondWith(caches.open(CACHE).then(async c => {
    const cached = await c.match(key, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r && r.ok) c.put(key, r.clone()); return r; }).catch(() => null);
    if (cached) { e.waitUntil(net); return cached; }
    const r = await net; return r || (await c.match(SHELL)) || Response.error();
  }));
});
