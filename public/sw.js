const CACHE_NAME = 'civic-bunko-v1';
const NETWORK_TIMEOUT_MS = 3000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(['./', './manifest.webmanifest']).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

function canCacheRequest(request) {
  return request.method === 'GET' && !request.headers.has('Authorization');
}

function fetchWithTimeout(request, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Network timeout')), timeoutMs);
    fetch(request).then(
      (response) => {
        clearTimeout(timer);
        resolve(response);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  let networkResponse = null;

  try {
    networkResponse = await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);
    if (networkResponse && networkResponse.ok && canCacheRequest(request)) {
      await cache.put(request, networkResponse.clone());
      return networkResponse;
    }
  } catch {
    // 逾時或離線時退回快取
  }

  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  if (request.mode === 'navigate') {
    const scopeCached = await cache.match(self.registration.scope);
    if (scopeCached) {
      return scopeCached;
    }
  }

  return networkResponse || Response.error();
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response && response.ok && canCacheRequest(request)) {
    await cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(event) {
  const { request } = event;
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (
        response &&
        (response.ok || response.type === 'opaque') &&
        canCacheRequest(request)
      ) {
        return cache.put(request, response.clone()).then(() => response);
      }
      return response;
    })
    .catch(() => undefined);

  if (cached) {
    event.waitUntil(networkPromise);
    return cached;
  }

  const networkResponse = await networkPromise;
  return networkResponse || Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (request.headers.has('Authorization')) return;

  const url = new URL(request.url);
  if (url.hostname === 'api.github.com') return;

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(event));
    return;
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  const scopePath = new URL(self.registration.scope).pathname;
  const relPath = url.pathname.startsWith(scopePath)
    ? url.pathname.slice(scopePath.length)
    : url.pathname.replace(/^\//, '');

  if (request.mode === 'navigate' || relPath === 'version.json') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (
    relPath.startsWith('assets/') ||
    relPath.startsWith('icons/') ||
    relPath === 'manifest.webmanifest'
  ) {
    event.respondWith(cacheFirst(request));
  }
});
