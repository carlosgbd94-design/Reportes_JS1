/**
 * sw.js — Service Worker SIREVAQ
 * Estrategia: Network-first con timeout + caché como respaldo robusto.
 * Funciona correctamente con WiFi, datos móviles y offline.
 * Versión: 2026.2
 */

const CACHE_NAME = 'js1-reportes-v2026-30';

// Activos estáticos a cachear en la instalación
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css?v=2026.56',
  './mobile.css?v=2026.24',
  './main.js?v=2026.49',
  './mobile.js?v=2026.23',
  './rda_calculator.js?v=2026.14',
  './rda_parser.js?v=2026.14',
  './rda_ui.js?v=2026.15',
  './site.webmanifest',
  './favicon.svg',
  './favicon.ico',
  './favicon-96x96.png',
  './apple-touch-icon.png',
  './web-app-manifest-192x192.png',
  './web-app-manifest-512x512.png',
];

// ── INSTALACIÓN: Pre-cachear activos estáticos ──────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando y cacheando activos estáticos...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // addAll falla si algún recurso no carga. Usamos Promise.all con .catch()
      // para que la instalación siempre tenga éxito aunque un recurso falle.
      return Promise.all(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[SW] No se pudo cachear: ${url}`, err);
          })
        )
      );
    }).then(() => {
      console.log('[SW] Instalación completa. Activando inmediatamente...');
      return self.skipWaiting();
    })
  );
});

// ── ACTIVACIÓN: Limpiar cachés obsoletas ────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activado. Limpiando cachés antiguas...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log(`[SW] Eliminando caché obsoleta: ${name}`);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

/**
 * Fetch con timeout para no bloquear indefinidamente en redes lentas.
 * En datos móviles, la promesa puede quedarse sin resolver, así que
 * competimos con un timer para caer en caché lo antes posible.
 */
function fetchWithTimeout(request, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error('[SW] Timeout de red'));
    }, timeoutMs);

    fetch(request, { signal: controller.signal })
      .then((response) => {
        clearTimeout(timer);
        resolve(response);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Busca en caché usando URL normalizada (sin query params si no hay match exacto).
 * Esto resuelve el problema de keys con ?v=XXXX vs sin versión.
 */
async function matchFromCache(cache, request) {
  // 1. Intento exacto
  let response = await cache.match(request);
  if (response) return response;

  // 2. Intento ignorando query string (útil para activos versionados)
  response = await cache.match(request, { ignoreSearch: true });
  if (response) return response;

  // 3. Para navegación: buscar index.html por URL absoluta
  if (request.mode === 'navigate') {
    // Construir URL absoluta de index.html relativa al SW scope
    const indexUrl = new URL('./index.html', self.registration.scope).href;
    response = await cache.match(indexUrl);
    if (response) return response;

    // Último intento: buscar con ignoreSearch también
    response = await cache.match(new URL('./', self.registration.scope).href);
    if (response) return response;
  }

  return null;
}

// ── FETCH: Estrategia Network-First con timeout + caché robusta ──────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignorar solicitudes a Supabase, CDNs, y extensiones del navegador
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('cdn.jsdelivr.net') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('unpkg.com') ||
    url.hostname.includes('raw.githubusercontent.com') ||
    url.hostname.includes('sentry-cdn.com') ||
    url.hostname.includes('sentry.io') ||
    url.hostname.includes('posthog.com') ||
    url.protocol === 'chrome-extension:'
  ) {
    return; // Dejar que el navegador maneje estas peticiones directamente
  }

  // Solo manejar solicitudes GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetchWithTimeout(event.request, 8000)
      .then((networkResponse) => {
        // Si la red responde bien, actualizar caché y devolver respuesta
        if (networkResponse && networkResponse.ok) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch((err) => {
        console.warn(`[SW] Red no disponible (${err.message}), usando caché: ${url.pathname}`);
        // Sin red o timeout: servir desde caché con matching robusto
        return caches.open(CACHE_NAME).then(async (cache) => {
          const cachedResponse = await matchFromCache(cache, event.request);
          if (cachedResponse) {
            console.log(`[SW] Sirviendo desde caché: ${url.pathname}`);
            return cachedResponse;
          }
          // Si no hay caché disponible, respuesta de error amigable
          if (event.request.mode === 'navigate') {
            // Intentar buscar index.html en cualquier caché disponible
            const allCaches = await caches.keys();
            for (const cacheName of allCaches) {
              const c = await caches.open(cacheName);
              const r = await c.match(new URL('./index.html', self.registration.scope).href);
              if (r) return r;
            }
          }
          return new Response('', { status: 408, statusText: 'Sin conexión' });
        });
      })
  );
});
