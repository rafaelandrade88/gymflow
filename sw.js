// ============================================================
// GymFlow Service Worker — Offline First + Auto Update
// Incrementa CACHE_VERSION a cada deploy para forçar update
// ============================================================
const CACHE_VERSION = 'v 1.1.1';
const STATIC_CACHE = `gymflow-static-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/index.html'
];

self.addEventListener('install', event => {
  // Novo SW instala e já fica em standby (skipWaiting só após confirmação do usuário)
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS))
  );
  // NÃO chama skipWaiting aqui — espera o usuário confirmar
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith('gymflow-') && key !== STATIC_CACHE)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Mensagem do app pedindo para aplicar update imediatamente
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Firebase e Google APIs — sempre network, nunca cache SW
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) return;

  // Navegação — network first, fallback cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Outros assets — cache first, revalida em background
  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request).then(response => {
        if (response.ok) {
          caches.open(STATIC_CACHE).then(cache => cache.put(event.request, response.clone()));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

// Push notifications
self.addEventListener('push', event => {
  const data = event.data?.json() || { title: 'GymFlow', body: 'Hora do treino! 💪' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body, icon: '/icon-192.png', badge: '/icon-72.png',
      vibrate: [200, 100, 200], data: { url: '/' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
});