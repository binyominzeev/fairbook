"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    let cancelled = false;

    const registerServiceWorker = async () => {
      try {
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