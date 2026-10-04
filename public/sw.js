const CACHE_NAME = 'achadinhos-pwa-v4';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

// Manipulador de clique na notificação nativa do celular / navegador
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/minha-conta/pedidos';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if (client.url.includes(self.registration.scope)) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Manipulador de evento Push (Web Push padrão)
self.addEventListener('push', (event) => {
  let data = {
    title: 'Achadinhos Delivery 🛵',
    body: 'Atualização no seu pedido!',
    url: '/minha-conta/pedidos',
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/pwa-192x192.png',
    badge: '/icon.svg',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/minha-conta/pedidos' },
    tag: data.tag || 'achadinhos-alert',
  };

  event.waitUntil(self.registration.showNotification(data.title || 'Achadinhos Delivery 🛵', options));
});
