// ============================================================
// GymFlow Service Worker — Offline First + Auto Update
// Incrementa CACHE_VERSION a cada deploy para forçar update
// ============================================================
const CACHE_VERSION = 'v1.3.0';
const STATIC_CACHE = `gymflow-static-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/gymflow/',
  '/gymflow/index.html',
  '/gymflow/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .catch(() => { }) // não falha se algum asset não existir
  );
  // NÃO chama skipWaiting aqui — espera confirmação do usuário
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
  if (event.data && event.data.type === 'SKIP_WAITING') {
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
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('cloudinary.com')
  ) return;

  // Navegação — network first, fallback cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(STATIC_CACHE)
            .then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match('/gymflow/index.html')
          .then(r => r || caches.match('/gymflow/'))
        )
    );
    return;
  }

  // Outros assets — cache first, revalida em background
  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request).then(response => {
        if (response && response.ok) {
          caches.open(STATIC_CACHE)
            .then(cache => cache.put(event.request, response.clone()));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

// Push notifications
self.addEventListener('push', event => {
  const data = event.data
    ? event.data.json()
    : { title: 'GymFlow', body: 'Hora do treino! 💪' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/gymflow/icon-192.png',
      badge: '/gymflow/icon-72.png',
      vibrate: [200, 100, 200],
      data: { url: '/gymflow/' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data
      ? event.notification.data.url
      : '/gymflow/')
  );
});