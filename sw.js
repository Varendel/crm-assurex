// Service worker minimal — sert uniquement à rendre le CRM installable comme une vraie
// application (PWA) et à donner un filet de secours hors-ligne pour l'ouverture de l'app.
// Stratégie réseau-prioritaire partout : le CRM travaille avec des données Supabase/Outlook
// en direct, donc on ne veut JAMAIS servir une version périmée du code (index.html + JS déjà
// versionnés via ?v=timestamp) tant qu'il y a du réseau. Le cache n'est qu'un filet de secours.
const CACHE_NAME = 'crm-assurex-shell-v1';
const SHELL_ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
  );
});
