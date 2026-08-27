const CACHE_VERSION = "clientloop-shell-v1";
const SAFE_SHELL_ASSETS = [
  "/offline",
  "/brand/app-icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(SAFE_SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function containsSecret(url) {
  const sensitiveKeys = ["t", "token", "signature", "x-amz-signature", "x-amz-credential"];
  return sensitiveKeys.some((key) => url.searchParams.has(key));
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    containsSecret(url) ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/portal/")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline")));
    return;
  }

  const isSafeStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/brand/app-icon.svg";

  if (!isSafeStaticAsset) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
