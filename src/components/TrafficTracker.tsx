"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const VISITOR_KEY_STORAGE = "fairbook_traffic_visitor_key";
const SESSION_ID_STORAGE = "fairbook_traffic_session_id";
const SESSION_LAST_SEEN_STORAGE = "fairbook_traffic_session_last_seen";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const HEARTBEAT_MS = 15 * 1000;

function randomId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getVisitorKey() {
  const existing = localStorage.getItem(VISITOR_KEY_STORAGE);
  if (existing) return existing;
  const created = randomId();
  localStorage.setItem(VISITOR_KEY_STORAGE, created);
  return created;
}

function getSessionId(now: number) {
  const existingId = localStorage.getItem(SESSION_ID_STORAGE);
  const lastSeenRaw = localStorage.getItem(SESSION_LAST_SEEN_STORAGE);
  const lastSeen = lastSeenRaw ? Number(lastSeenRaw) : 0;
  const stale = !lastSeen || now - lastSeen > SESSION_TIMEOUT_MS;

  const id = existingId && !stale ? existingId : randomId();
  localStorage.setItem(SESSION_ID_STORAGE, id);
  localStorage.setItem(SESSION_LAST_SEEN_STORAGE, String(now));
  return id;
}

function send(payload: {
  eventType: "page_view" | "heartbeat" | "page_hide";
  path: string;
  activeMs?: number;
}) {
  const now = Date.now();
  const body = {
    sessionId: getSessionId(now),
    visitorKey: getVisitorKey(),
    eventType: payload.eventType,
    path: payload.path,
    activeMs: payload.activeMs,
    referrer: document.referrer || null,
  };

  if (payload.eventType === "page_hide" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([JSON.stringify(body)], { type: "application/json" });
    navigator.sendBeacon("/api/traffic/collect", blob);
    return;
  }

  void fetch("/api/traffic/collect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    keepalive: true,
    body: JSON.stringify(body),
  }).catch(() => {
    // Ignore transient tracking errors.
  });
}

export default function TrafficTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const path = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!path || path.startsWith("/api/")) return;
    send({ eventType: "page_view", path });
  }, [path]);

  useEffect(() => {
    if (!path || path.startsWith("/api/")) return;

    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      send({ eventType: "heartbeat", path, activeMs: HEARTBEAT_MS });
    }, HEARTBEAT_MS);

    const onPageHide = () => {
      send({ eventType: "page_hide", path });
    };

    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [path]);

  return null;
}
