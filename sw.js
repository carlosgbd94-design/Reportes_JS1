/**
 * sw.js — Service Worker SIREVAQ
 * Cache-first para activos estáticos. Garantiza disponibilidad offline.
 * Versión: 2026.1
 */

const CACHE_NAME = 'js1-reportes-v2026-24';

// Activos estáticos a cachear en la instalación
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css?v=2026.56',
  './mobile.css?v=2026.24',
  './main.js?v=2026.43',
  './mobile.js?v=2026.23',
  './rda_calculator.js?v=2026.14',
  './rda_parser.js?v=2026.14',
  './rda_ui.js?v=2026.14',
  './manifest.json',
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
      // addAll falla si algún recurso no carga. Usamos Promise.allSettled para ser resilientes.
      return Promise.allSettled(
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

// ── FETCH: Estrategia Network-First con caché como respaldo ─────────────────
// Para las llamadas a la API de Supabase (fetch externo), siempre usa la red.
// Para activos estáticos locales, intenta red primero y cae en caché si falla.
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
    // Estrategia: Network First → Caché como respaldo
    fetch(event.request)
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
      .catch(() => {
        // Sin red: servir desde caché
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            console.log(`[SW] Sirviendo desde caché offline: ${url.pathname}`);
            return cachedResponse;
          }
          // Último recurso: devolver index.html para navegación SPA
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('', { status: 404, statusText: 'Offline' });
        });
      })
  );
});
