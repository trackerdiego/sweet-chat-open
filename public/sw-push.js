// Service Worker — Push Notifications + Offline Cache
const CACHE_NAME = 'vyrallab-v3';
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/favicon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  console.log('[sw] Installing v3...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[sw] Activating v3...');
  event.waitUntil((async () => {
    // Wipe old caches
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));

    // Force unsubscribe stale push subscription (created under old VAPID/SW)
    try {
      const oldSub = await self.registration.pushManager.getSubscription();
      if (oldSub) {
        await oldSub.unsubscribe();
        console.log('[sw] Unsubscribed stale push subscription');
      }
    } catch (e) {
      console.warn('[sw] Could not unsubscribe stale push:', e);
    }

    await self.clients.claim();
  })());
});

// Network First with cache fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || request.url.startsWith('chrome-extension')) return;
  if (request.url.includes('supabase.co')) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

self.addEventListener('push', (event) => {
  console.log('[sw] Push received');
  let data = { title: 'Vyral Lab', body: 'Você tem uma nova notificação!' };
  if (event.data) {
    try { data = event.data.json(); } catch (e) { data.body = event.data.text(); }
  }
  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(data.title || 'Vyral Lab', options));
});

self.addEventListener('notificationclick', (event) => {
  console.log('[sw] Notification clicked');
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
