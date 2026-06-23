// ─── TrackHab Service Worker ──────────────────────────────────────────
// Version: bump this string to force cache refresh on update
const CACHE_NAME = 'trackhab-v1';

// Files to cache on install
const PRECACHE_ASSETS = [
  './',
  './trackhab_final.html',
  './manifest.json',
  './icons/icon-48.png',
  './icons/icon-72.png',
  './icons/icon-96.png',
  './icons/icon-128.png',
  './icons/icon-144.png',
  './icons/icon-152.png',
  './icons/icon-192.png',
  './icons/icon-256.png',
  './icons/icon-512.png',
];

// ── Install: pre-cache all core assets ────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing…');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-caching assets');
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: clear old caches ─────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating…');
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: Cache-first strategy (works fully offline) ──────────────────
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests (YouTube, Google Fonts, etc.)
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    // For external resources use network-first, fallback silently
    event.respondWith(
      fetch(event.request).catch(() => new Response('', { status: 408 }))
    );
    return;
  }

  // Cache-first for same-origin assets
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Return cached version and update cache in background
        const fetchPromise = fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        }).catch(() => cached); // stay on cached if network fails
        return cached;
      }

      // Not in cache — fetch from network and cache it
      return fetch(event.request).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
          return networkResponse;
        }
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return networkResponse;
      }).catch(() => {
        // Offline fallback — serve the main app HTML
        return caches.match('./trackhab_final.html');
      });
    })
  );
});

// ── Background Sync (for future use) ──────────────────────────────────
self.addEventListener('sync', event => {
  console.log('[SW] Background sync:', event.tag);
});

// ── Push Notifications (for future use) ───────────────────────────────
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'TrackHab';
  const options = {
    body: data.body || 'Time to check your habits! ✦',
    icon: './icons/icon-192.png',
    badge: './icons/icon-96.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || './trackhab_final.html' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click ─────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || './trackhab_final.html')
  );
});
