// Тимур-Бей: гра працює і без інтернету (офлайн-режим). Онлайн — коли є зв'язок із сервером.
const CACHE = 'timur-bay-v1';
const FILES = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  const key = (u.pathname === '/' || u.pathname === '/index.html') ? '/' : u.pathname;
  // спочатку свіжа версія з сервера (щоб оновлення приходили одразу), без інтернету — збережена
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(key, c)); } return r; })
    .catch(() => caches.match(key)));
});
