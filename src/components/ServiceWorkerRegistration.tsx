"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    let cancelled = false;
    const globalWindow = window as Window & {
      __fairbookServiceWorkerCleanupDone?: boolean;
    };

    const unregisterServiceWorkers = async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));

      if ("caches" in window) {
        const cacheKeys = await window.caches.keys();
        await Promise.all(cacheKeys.map((cacheKey) => window.caches.delete(cacheKey)));
      }
    };

    const registerServiceWorker = async () => {
      try {
        if (process.env.NODE_ENV !== "production") {
          if (globalWindow.__fairbookServiceWorkerCleanupDone) {
            return;
          }

          globalWindow.__fairbookServiceWorkerCleanupDone = true;
          await unregisterServiceWorkers();
          return;
        }

        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });

        if (!cancelled) {
          await registration.update();
        }
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("Service worker registration failed", error);
        }
      }
    };

    void registerServiceWorker();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}