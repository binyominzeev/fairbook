"use client";

const VISITOR_KEY_STORAGE = "fairbook_traffic_visitor_key";
const SESSION_ID_STORAGE = "fairbook_traffic_session_id";
const SESSION_LAST_SEEN_STORAGE = "fairbook_traffic_session_last_seen";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const FEED_TRACK_BATCH_SIZE = 20;
const FEED_TRACK_FLUSH_DELAY_MS = 500;

type TrackSource = "profile_card" | "feed_card" | "post_detail";

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

export function createAnonymousPostViewTracker() {
  const trackedPostIds = new Set<string>();
  const pendingPostIds = new Set<string>();
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  function flush() {
    const postIds = Array.from(pendingPostIds);
    if (postIds.length === 0) {
      return;
    }

    pendingPostIds.clear();
    const now = Date.now();
    const body = {
      sessionId: getSessionId(now),
      visitorKey: getVisitorKey(),
      eventType: "page_view" as const,
      path: `${window.location.pathname}${window.location.search}`,
      postIds,
      referrer: document.referrer || null,
    };

    void fetch("/api/traffic/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      keepalive: true,
      body: JSON.stringify(body),
    }).catch(() => {
      // Ignore transient tracking failures.
    });
  }

  function queue(postId: string) {
    if (trackedPostIds.has(postId)) {
      return;
    }

    trackedPostIds.add(postId);
    pendingPostIds.add(postId);

    if (pendingPostIds.size >= FEED_TRACK_BATCH_SIZE) {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      flush();
      return;
    }

    if (!flushTimer) {
      flushTimer = setTimeout(() => {
        flushTimer = null;
        flush();
      }, FEED_TRACK_FLUSH_DELAY_MS);
    }
  }

  function dispose() {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    flush();
  }

  return { queue, dispose };
}

export function createRegisteredPostViewTracker(source: TrackSource) {
  const trackedPostIds = new Set<string>();
  const pendingPostIds = new Set<string>();
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  function flush() {
    const postIds = Array.from(pendingPostIds);
    if (postIds.length === 0) {
      return;
    }

    pendingPostIds.clear();
    void fetch("/api/posts/views/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      keepalive: true,
      body: JSON.stringify({ postIds, source }),
    }).catch(() => {
      // Ignore transient tracking failures.
    });
  }

  function queue(postId: string) {
    if (trackedPostIds.has(postId)) {
      return;
    }

    trackedPostIds.add(postId);
    pendingPostIds.add(postId);

    if (pendingPostIds.size >= FEED_TRACK_BATCH_SIZE) {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      flush();
      return;
    }

    if (!flushTimer) {
      flushTimer = setTimeout(() => {
        flushTimer = null;
        flush();
      }, FEED_TRACK_FLUSH_DELAY_MS);
    }
  }

  function dispose() {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    flush();
  }

  return { queue, dispose };
}
