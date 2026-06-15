/// <reference lib="WebWorker" />
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

// Flashcards — cache-first
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/flashcards/'),
  new CacheFirst({
    cacheName: 'flashcards-cache',
    plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 86400 })],
  })
);

// Question bank — stale-while-revalidate
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/question-bank'),
  new StaleWhileRevalidate({
    cacheName: 'question-bank-cache',
    plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 43200 })],
  })
);

// SR drill
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/sr/due'),
  new NetworkFirst({
    cacheName: 'sr-cache',
    networkTimeoutSeconds: 5,
    plugins: [new ExpirationPlugin({ maxEntries: 5, maxAgeSeconds: 3600 })],
  })
);

// General API
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 10,
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 86400 })],
  })
);

// Push notification handler
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data: { title?: string; body?: string; icon?: string; badge?: string; url?: string } = {};
  try { data = event.data.json(); } catch { data = { title: 'ScoreForge', body: event.data.text() }; }

  const title = data.title ?? 'ScoreForge';
  const options: NotificationOptions = {
    body: data.body,
    icon: data.icon ?? '/icons/icon-192.png',
    badge: data.badge ?? '/icons/icon-192.png',
    data: { url: data.url ?? '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click — open / focus the target URL
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(c => c.url.includes(url));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});
