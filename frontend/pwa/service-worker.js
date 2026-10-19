// Only a public offline notice is stored here. API responses, accounts,
// school records, documents and payment requests are never cached or queued.
const CACHE_PREFIX = 'assakina-offline-';
const CACHE_NAME = CACHE_PREFIX + '__BUILD_VERSION__';
const OFFLINE_URL = '/offline.html';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.add(new Request(OFFLINE_URL, { cache: 'reload', credentials: 'omit' }))));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || request.mode !== 'navigate' || url.origin !== self.location.origin) return;
  if (/^\/(api|auth|realms|admin|resources)(\/|$)/.test(url.pathname)) return;
  event.respondWith(fetch(request).catch(async () => {
    const cache = await caches.open(CACHE_NAME);
    return (await cache.match(OFFLINE_URL)) || Response.error();
  }));
});
