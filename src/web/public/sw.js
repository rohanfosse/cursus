// ─── Service Worker — Cursus PWA ─────────────────────────────────────────────
// Stratégie : Cache-First pour les assets statiques, Network-First pour les API

const CACHE_NAME = 'cursus-v1'

// Assets à précacher lors de l'installation
const PRECACHE_URLS = [
  '/',
  '/index.html',
]

// ── Installation : précache des assets essentiels ────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  // Activer immédiatement sans attendre la fermeture des anciens onglets
  self.skipWaiting()
})

// ── Activation : nettoyage des anciens caches ────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  )
  // Prendre le contrôle de tous les onglets ouverts
  self.clients.claim()
})

// ── Fetch : stratégie hybride ────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Ignorer les requêtes non-GET
  if (request.method !== 'GET') return

  // Ignorer les WebSockets et extensions Chrome
  if (url.protocol === 'ws:' || url.protocol === 'wss:' || url.protocol === 'chrome-extension:') return

  // API calls → Network-First (essayer le réseau, fallback cache)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cacher les GET API réussis pour le mode offline
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // Assets statiques → Cache-First (cache, sinon réseau)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached

      return fetch(request).then((response) => {
        // Ne cacher que les réponses réussies et same-origin
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
    })
  )
})
