/**
 * sw.js — Service Worker
 * Kasir AG · Rumah Herbal & Madu Murni Abdul Ghani
 * Cache-first strategy untuk penggunaan offline di Android.
 */

const CACHE = 'kasir-ag-v2';
const ASSETS = [
  '/kasir/',
  '/kasir/index.html',
  '/kasir/style.css',
  '/kasir/app.js',
  '/kasir/printer.js',
  '/kasir/manifest.json',
  '/kasir/icon-192.png',
  '/kasir/icon-512.png',
];

// Saat install: pre-cache semua aset
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Saat aktif: hapus cache lama
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: cache-first, lalu network
self.addEventListener('fetch', e => {
  // Hanya handle same-origin & GET
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith(self.location.origin)) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;

      return fetch(e.request).then(response => {
        // Cache response baru yang valid
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      }).catch(() => {
        // Fallback ke index.html saat offline (untuk navigasi)
        if (e.request.destination === 'document') {
          return caches.match('/kasir/index.html');
        }
      });
    })
  );
});
