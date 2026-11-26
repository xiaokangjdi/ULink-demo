/* MT-Link offline cache.
 *
 * The app is a static Vite bundle plus two kinds of runtime data:
 *  - same-origin API JSON (pairs/users/match),
 *  - remote raster tiles.
 *
 * This worker is deliberately conservative:
 *  - navigations and API GETs are network-first, falling back to the cache;
 *  - hashed Vite assets and map tiles are cache-first;
 *  - POST /api/match is cached by an exact-body key, so a pair that worked online
 *    can still be opened when the backend is unavailable. No response is fabricated:
 *    a cache miss while offline returns an explicit 503 JSON error.
 *
 * It is registered only in production builds (see main.tsx), so HMR is unaffected.
 */
const VERSION = "mtlink-v1";
const SHELL = `${VERSION}-shell`;
const API = `${VERSION}-api`;
const TILES = `${VERSION}-tiles`;
const OFFLINE_PAGE = new URL("index.html", self.registration.scope).toString();

const isTileHost = (host) =>
  host.endsWith("tile.openstreetmap.de") ||
  host.endsWith("tile.openstreetmap.fr") ||
  host.endsWith("tile.openstreetmap.jp") ||
  host.endsWith("tile.openstreetmap.org") ||
  host.endsWith("arcgisonline.com");

const isApi = (url) => url.origin === self.location.origin && url.pathname.startsWith("/api/");
const isAsset = (url) =>
  url.origin === self.location.origin &&
  (url.pathname.startsWith("/assets/") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".webp") ||
    url.pathname.endsWith(".ico"));

const matchCacheKey = async (request) => {
  const body = await request.clone().text();
  return new Request(
    `${self.location.origin}/__mtlink_cache/match?body=${encodeURIComponent(body)}`,
    { method: "GET" },
  );
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) => cache.addAll([OFFLINE_PAGE]).catch(() => undefined)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("mtlink-") && !key.startsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // What-if / match POST: exact-body cache, network first.
  if (request.method === "POST" && isApi(url) && url.pathname.endsWith("/match")) {
    event.respondWith(
      (async () => {
        const key = await matchCacheKey(request);
        try {
          const response = await fetch(request);
          if (response.ok) {
            const cache = await caches.open(API);
            await cache.put(key, response.clone());
          }
          return response;
        } catch (error) {
          const cached = await caches.match(key);
          if (cached) return cached;
          return new Response(
            JSON.stringify({
              detail:
                "Offline: this pair has not been cached yet. Reconnect and run it once, then it is available offline.",
            }),
            { status: 503, headers: { "Content-Type": "application/json" } },
          );
        }
      })(),
    );
    return;
  }

  if (request.method !== "GET") return;

  // API GET: network first, then cached JSON.
  if (isApi(url)) {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            const cache = await caches.open(API);
            await cache.put(request, response.clone());
          }
          return response;
        } catch (error) {
          const cached = await caches.match(request);
          if (cached) return cached;
          return new Response(
            JSON.stringify({ detail: "Offline: this API response is not cached yet." }),
            { status: 503, headers: { "Content-Type": "application/json" } },
          );
        }
      })(),
    );
    return;
  }

  // Navigations: network first, then the cached shell.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            const cache = await caches.open(SHELL);
            await cache.put(request, response.clone());
          }
          return response;
        } catch (error) {
          const cached =
            (await caches.match(request)) ||
            (await caches.match(OFFLINE_PAGE)) ||
            (await caches.match("/"));
          return (
            cached ||
            new Response("MT-Link is offline and the app shell was not cached yet.", {
              status: 503,
              headers: { "Content-Type": "text/plain" },
            })
          );
        }
      })(),
    );
    return;
  }

  // Map tiles and static assets: cache first, revalidate opportunistically.
  if (request.destination === "image" && (isTileHost(url.host) || isAsset(url))) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok || response.type === "opaque") {
            const cache = await caches.open(TILES);
            await cache.put(request, response.clone());
          }
          return response;
        } catch (error) {
          return new Response("", { status: 504 });
        }
      })(),
    );
    return;
  }

  if (isAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(SHELL);
          await cache.put(request, response.clone());
        }
        return response;
      })(),
    );
  }
});
