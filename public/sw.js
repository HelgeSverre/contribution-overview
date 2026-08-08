const CACHE_NAME = "contributions-v4";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    }),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  if (url.origin !== location.origin) return;
  if (url.pathname === "/data.json") return;

  const cacheUrl = new URL(event.request.url);
  if (cacheUrl.pathname === "/app") cacheUrl.pathname = "/app/";
  const cacheKey = cacheUrl.href;
  const fetched = fetch(event.request).then(async (response) => {
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(cacheKey, response.clone());
    }
    return response;
  });

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetched.catch(async (error) => {
        const cached = await caches.match(cacheKey);
        if (cached) return cached;
        throw error;
      }),
    );
    return;
  }

  event.waitUntil(fetched.then(() => undefined).catch(() => undefined));
  event.respondWith(caches.match(cacheKey).then((cached) => cached || fetched));
});
