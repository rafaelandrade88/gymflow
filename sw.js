// ============================================================
// GymFlow Service Worker — Offline First PWA
// ============================================================
const CACHE_NAME   = 'gymflow-v1';
const STATIC_CACHE = 'gymflow-static-v1';

// Assets que serão cacheados na instalação
const STATIC_ASSETS = [
  '/',
  '/index.html'
];

// ============================================================
// INSTALL — pré-cache dos assets estáticos
// ============================================================
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      console.log('[SW] Pre-caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ============================================================
// ACTIVATE — limpa caches antigos
// ============================================================
self.addEventListener('activate', event => {
  const allowedCaches = [CACHE_NAME, STATIC_CACHE];
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => !allowedCaches.includes(key))
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ============================================================
// FETCH — Stale While Revalidate para assets locais
//          Network first para Firebase (dados remotos)
// ============================================================
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Deixa Firebase/Google APIs passarem direto (sem cache SW)
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    return; // network-only para Firebase
  }

  // Navegação (HTML) — network first com fallback para cache
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

  // Outros assets — cache first com revalidação em background
  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

// ============================================================
// PUSH NOTIFICATIONS (estrutura base)
// ============================================================
self.addEventListener('push', event => {
  const data = event.data?.json() || { title: 'GymFlow', body: 'Hora do treino! 💪' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:  data.body,
      icon:  '/icon-192.png',
      badge: '/icon-72.png',
      vibrate: [200, 100, 200],
      data:  { url: '/' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
});
