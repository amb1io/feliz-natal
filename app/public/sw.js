const VERSION = "fn-offline-v1";
const ASSET_VERSION = "fn-assets-v1";
const OFFLINE_URL = "/offline.html";

const CORE_ROUTES = [
  "/",
  "/app",
  "/app/grupos",
  OFFLINE_URL
];

const STATIC_EXTENSIONS = [
  "js",
  "css",
  "json",
  "png",
  "jpg",
  "jpeg",
  "svg",
  "webp",
  "ico",
  "woff",
  "woff2"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(CORE_ROUTES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== VERSION && key !== ASSET_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const acceptHeader = request.headers.get("accept") || "";
  if (acceptHeader.includes("text/html")) {
    event.respondWith(networkFirst(request));
    return;
  }

  const url = new URL(request.url);
  const extension = url.pathname.split(".").pop();
  if (
    url.origin === self.location.origin &&
    extension &&
    STATIC_EXTENSIONS.includes(extension)
  ) {
    event.respondWith(assetCache(request));
    return;
  }

  event.respondWith(networkFallingBackToCache(request));
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "PRECACHE") {
    return;
  }

  const urls = Array.isArray(data.urls) ? data.urls : [];
  if (!urls.length) {
    return;
  }

  event.waitUntil(precacheRoutes(urls));
});

async function networkFirst(request) {
  const cache = await caches.open(VERSION);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    return cached || cache.match(OFFLINE_URL);
  }
}

async function assetCache(request) {
  const cache = await caches.open(ASSET_VERSION);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return cached;
  }
}

async function networkFallingBackToCache(request) {
  const cache = await caches.open(VERSION);
  try {
    return await fetch(request);
  } catch (err) {
    return cache.match(request);
  }
}

async function precacheRoutes(urls) {
  const cache = await caches.open(VERSION);
  await Promise.all(
    urls.map(async (url) => {
      try {
        const request = new Request(new URL(url, self.location.origin), {
          credentials: "include"
        });
        const response = await fetch(request);
        if (response && response.ok) {
          await cache.put(request, response.clone());
        }
      } catch (error) {
        console.warn("Falha ao pré-cachear rota", url, error);
      }
    })
  );
}
