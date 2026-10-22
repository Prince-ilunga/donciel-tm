/* ─────────────────────────────────────────────────────────────
   DONCIEL TM — Service Worker (minimal et sûr)
   - cache 'donciel-v1'
   - cache-first  : GET /_next/static/* et /icons/*
   - network-first: le reste (fallback cache hors ligne)
   - ignore : non-GET, cross-origin, /api/*
   ───────────────────────────────────────────────────────────── */
const CACHE = 'donciel-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Suppression des vieux caches
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/')
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // On n'intercepte que les GET même origine, hors API
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // ── Cache-first pour les assets immuables ──
  if (isStaticAsset(url)) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res && res.ok) {
          const cache = await caches.open(CACHE);
          cache.put(req, res.clone());
        }
        return res;
      } catch (err) {
        const fallback = await caches.match(req);
        if (fallback) return fallback;
        return new Response('', { status: 504, statusText: 'Offline' });
      }
    })());
    return;
  }

  // ── Network-first pour le reste (pages, etc.) ──
  event.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res && res.ok && res.type === 'basic') {
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
      }
      return res;
    } catch (err) {
      const cached = await caches.match(req);
      if (cached) return cached;
      if (req.mode === 'navigate') {
        const shell = await caches.match('/app');
        if (shell) return shell;
      }
      return new Response('', { status: 504, statusText: 'Offline' });
    }
  })());
});
