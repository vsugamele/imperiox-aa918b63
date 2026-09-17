// Custom Service Worker for Web Push notifications.
// IMPORTANT: precaching is intentionally disabled to avoid serving stale SPA bundles
// after deploys (which made new routes like /gerenciador appear as 404).
// Push handlers below remain functional.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Drop any precache leftovers from previous versions.
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (_) {}
    await self.clients.claim();
  })());
});

// Network-first for navigations so users always get the latest index.html.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/index.html')));
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    try {
      data = { title: 'Imperio HQ', body: event.data ? event.data.text() : '' };
    } catch {
      data = { title: 'Imperio HQ', body: '' };
    }
  }

  const title = data.title || 'Imperio HQ';
  const targetUrl = data.url || '/';
  const options = {
    body: data.body || data.message || '',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    data: { url: targetUrl },
    tag: data.tag,
    renotify: Boolean(data.tag),
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rawUrl = (event.notification.data && event.notification.data.url) || '/';
  const url = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin && 'focus' in client) {
          if ('navigate' in client) client.navigate(url).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
