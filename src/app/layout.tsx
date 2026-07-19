import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { Suspense } from "react";
import "./globals.css";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import TrafficTracker from "@/components/TrafficTracker";

export const metadata: Metadata = {
  title: "fairbook – discourse with dignity",
  description:
    "A social network for meaningful discussion, respectful disagreement, and accurate representation of opposing views.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const devCleanupScript = `
    (function () {
      var isLocalHost =
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1" ||
        location.hostname === "0.0.0.0";
      if (!isLocalHost || !("serviceWorker" in navigator)) {
        return;
      }

      navigator.serviceWorker
        .getRegistrations()
        .then(function (registrations) {
          return Promise.all(
            registrations.map(function (registration) {
              return registration.unregister();
            })
          );
        })
        .catch(function () {});

      if ("caches" in window) {
        caches
          .keys()
          .then(function (keys) {
            return Promise.all(
              keys.map(function (key) {
                return caches.delete(key);
              })
            );
          })
          .catch(function () {});
      }
    })();
  `;

  return (
    <html lang="en" className="h-full antialiased">
      {process.env.NODE_ENV !== "production" ? (
        <head>
          <Script
            id="fairbook-dev-sw-cleanup"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{ __html: devCleanupScript }}
          />
        </head>
      ) : null}
      <body className="min-h-full flex flex-col bg-slate-50 font-sans">
        <ServiceWorkerRegistration />
        <Suspense fallback={null}>
          <TrafficTracker />
        </Suspense>
        {children}
        <footer className="mt-auto border-t border-slate-200 bg-white/90 backdrop-blur-sm">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 text-sm text-slate-500 sm:px-6">
            <p>fairbook</p>
            <Link href="/about" className="transition-colors hover:text-slate-900">
              About
            </Link>
            <Link href="/child-safety" className="transition-colors hover:text-slate-900">
              Child Safety
            </Link>
            <Link href="/data-policy" className="transition-colors hover:text-slate-900">
              Data Policy
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
