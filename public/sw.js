/* Bouck — service worker : la wishlist reste consultable sans réseau.
   - /wishlist : réseau d'abord (3,5 s max), sinon dernière copie enregistrée
   - /_next/static : mis en cache (fichiers immuables)
   - images (couvertures) : cache puis mise à jour en arrière-plan */
const STATIC = "bouck-static-v1";
const PAGES = "bouck-pages-v1"; // données personnelles : vidé à la connexion (voir RegisterSW / login)
const IMAGES = "bouck-img-v1";
const MAX_IMAGES = 250;
const NETWORK_TIMEOUT = 3500;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = [STATIC, PAGES, IMAGES];
      for (const key of await caches.keys()) if (!keep.includes(key)) await caches.delete(key);
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data === "clear-private" || data.type === "clear-private") {
    event.waitUntil(caches.delete(PAGES));
  } else if (data.type === "precache" && Array.isArray(data.urls)) {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(STATIC);
        for (const url of data.urls) {
          if (!(await cache.match(url))) {
            try {
              await cache.add(url);
            } catch {
              /* hors ligne : on réessaiera à la prochaine visite */
            }
          }
        }
      })()
    );
  }
});

async function wishlistPage(request) {
  const cache = await caches.open(PAGES);
  const network = fetch(request).then((response) => {
    if (response.ok && !response.redirected) cache.put("/wishlist", response.clone());
    return response;
  });
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), NETWORK_TIMEOUT));
  try {
    const fast = await Promise.race([network, timeout]);
    if (fast) return fast;
    // Réseau lent : on sert la copie si on l'a, la page se mettra à jour à la prochaine ouverture
    const cached = await cache.match("/wishlist");
    return cached || (await network);
  } catch {
    const cached = await cache.match("/wishlist");
    if (cached) return cached;
    return new Response("<h1>Hors ligne</h1><p>Ouvre la wishlist une fois avec du réseau pour l'enregistrer.</p>", {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function images(request) {
  const cache = await caches.open(IMAGES);
  const hit = await cache.match(request);
  const refresh = fetch(request)
    .then(async (response) => {
      if (response.ok || response.type === "opaque") {
        await cache.put(request, response.clone());
        const keys = await cache.keys();
        if (keys.length > MAX_IMAGES) await Promise.all(keys.slice(0, keys.length - MAX_IMAGES).map((k) => cache.delete(k)));
      }
      return response;
    })
    .catch(() => null);
  if (hit) return hit;
  return (await refresh) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (request.mode === "navigate" && url.origin === self.location.origin && url.pathname === "/wishlist") {
    event.respondWith(wishlistPage(request));
  } else if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC));
  } else if (request.destination === "image") {
    event.respondWith(images(request));
  }
});
