const SW_VERSION = "v2";
const STATIC_CACHE = `fairbook-static-${SW_VERSION}`;
const PAGE_CACHE = `fairbook-pages-${SW_VERSION}`;
const IMAGE_CACHE = `fairbook-images-${SW_VERSION}`;

const OFFLINE_URL = "/offline";
const PUBLIC_PAGE_PATHS = new Set([
  "/",
  "/about",
  "/data-policy",
  "/login",
  "/register",
  OFFLINE_URL,
]);

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/",
  "/about",
  "/login",
  "/register",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/android-chrome-192x192.png",
  "/android-chrome-512x512.png",
  "/apple-touch-icon.png",
];

const STATIC_PATHS = new Set([
  "/manifest.webmanifest",
  "/favicon.ico",
  "/android-chrome-192x192.png",
  "/android-chrome-512x512.png",
  "/apple-touch-icon.png",
]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(PRECACHE_URLS);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC_CACHE, PAGE_CACHE, IMAGE_CACHE]);
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  // Never intercept Next.js internals. Caching HMR/runtime chunks can cause
  // stale chunk responses and reload loops in dev.
  if (url.pathname.startsWith("/_next/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(request, url));
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(handleApiGetRequest(request, url));
    return;
  }

  if (isStaticAssetRequest(request, url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (request.destination === "image") {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
  }
});

async function handleNavigationRequest(request, url) {
  const isPublicPage = PUBLIC_PAGE_PATHS.has(url.pathname);

  try {
    const networkResponse = await fetch(request);

    if (isPublicPage && networkResponse.ok) {
      const cache = await caches.open(PAGE_CACHE);
      await cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch {
    if (isPublicPage) {
      const cachedPage = await caches.match(request);
      if (cachedPage) {
        return cachedPage;
      }
    }

    return (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

async function handleApiGetRequest(request, url) {
  if (url.pathname.startsWith("/api/auth/") || url.pathname.startsWith("/api/uploads/")) {
    return fetch(request);
  }

  // Keep API data authoritative and avoid long-lived user-specific cache.
  return fetch(request);
}

function isStaticAssetRequest(request, url) {
  if (STATIC_PATHS.has(url.pathname)) {
    return true;
  }

  return request.destination === "script" || request.destination === "style" || request.destination === "font";
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  const networkResponse = await fetch(request);
  if (networkResponse.ok) {
    await cache.put(request, networkResponse.clone());
  }
  return networkResponse;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  const networkPromise = fetch(request)
    .then(async (networkResponse) => {
      if (networkResponse.ok) {
        await cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => null);

  if (cachedResponse) {
    return cachedResponse;
  }

  const networkResponse = await networkPromise;
  return networkResponse || Response.error();
}

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let payload = null;
      try {
        payload = event.data?.json?.() ?? null;
      } catch {
        payload = null;
      }

      const title = typeof payload?.title === "string" ? payload.title : "fairbook";
      const body = typeof payload?.body === "string" ? payload.body : "New notification";
      const url = typeof payload?.url === "string" ? payload.url : "/notifications";

      await self.registration.showNotification(title, {
        body,
        tag: typeof payload?.notificationId === "string" ? payload.notificationId : undefined,
        data: { url },
        icon: "/android-chrome-192x192.png",
        badge: "/android-chrome-192x192.png",
      });
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    (async () => {
      const targetUrl = new URL(
        typeof event.notification.data?.url === "string" ? event.notification.data.url : "/notifications",
        self.location.origin
      ).toString();

      const clientsList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of clientsList) {
        if ("focus" in client) {
          await client.focus();
        }
        if ("navigate" in client) {
          await client.navigate(targetUrl);
          return;
        }
      }

      await self.clients.openWindow(targetUrl);
    })()
  );
});