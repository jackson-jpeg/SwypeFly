// SoGoJet Service Worker — cache-first for assets, network-first for pages
const CACHE_NAME = 'sogojet-v2';
const STATIC_ASSETS = ['/', '/index.html'];

// Offline fallback HTML
const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>SoGoJet — Offline</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0F172A;color:#F8FAFC;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:32px}
    .c{text-align:center;max-width:360px}
    .icon{font-size:56px;margin-bottom:16px}
    h1{font-size:22px;font-weight:800;margin-bottom:8px}
    p{color:#94A3B8;font-size:14px;line-height:1.6;margin-bottom:24px}
    button{padding:12px 28px;border-radius:9999px;background:#38BDF8;border:none;color:#fff;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit}
  </style>
</head>
<body>
  <div class="c">
    <div class="icon">✈️</div>
    <h1>You're offline</h1>
    <p>It looks like you've lost your internet connection. Check your connection and try again to keep exploring destinations.</p>
    <button onclick="location.reload()">Try Again</button>
  </div>
</body>
</html>`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET and API calls
  if (event.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;

  // Cache-first for static assets (JS, CSS, images, fonts)
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|webp|svg|ico|woff2?)$/)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-first for HTML/pages, with offline fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Return offline fallback for navigation requests
          if (event.request.mode === 'navigate') {
            return new Response(OFFLINE_HTML, {
              headers: { 'Content-Type': 'text/html' },
            });
          }
          return caches.match('/');
        })
      )
  );
});
