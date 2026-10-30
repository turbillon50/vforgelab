'use strict';

const CACHE_NAME = 'mia-shell-v2';
const SHELL_FILES = ['index.html', 'styles.css', 'premium.css', 'vedika-materials.css', 'app.js', 'icon.svg', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest'];
const shellUrls = new Set(SHELL_FILES.map((path) => new URL(path, self.registration.scope).href));
const shellIndex = new URL('index.html', self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll([...shellUrls])));
});

self.addEventListener('activate', (event) => {
  // Do not delete caches belonging to other apps hosted on the same origin.
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith('mia-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key)),
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  // API responses, tokens, chat history, telemetry and branches never enter Cache Storage.
  if (url.pathname.includes('/api/') || request.headers.has('x-sala-token')) return;
  const isNavigation = request.mode === 'navigate' && url.href.startsWith(self.registration.scope);
  if (!isNavigation && !shellUrls.has(url.href)) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok && !isNavigation) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      const cached = await caches.match(isNavigation ? shellIndex : request);
      return cached || Response.error();
    }
  })());
});
