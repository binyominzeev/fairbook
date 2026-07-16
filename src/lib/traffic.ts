import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

export type TrafficEventType = "page_view" | "heartbeat" | "page_hide";

export type CollectTrafficInput = {
  sessionId: string;
  visitorKey: string;
  eventType: TrafficEventType;
  path: string;
  referrer?: string | null;
  activeMs?: number | null;
  postId?: string | null;
  userId?: string | null;
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizePath(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "/";

  try {
    const parsed = new URL(trimmed, "http://localhost");
    const path = parsed.pathname || "/";
    const query = parsed.search || "";
    const normalized = `${path}${query}`.slice(0, 256);
    return normalized || "/";
  } catch {
    const safe = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return safe.slice(0, 256);
  }
}

export function inferRouteType(path: string) {
  const pathname = path.split("?")[0] || "/";

  if (pathname === "/" || pathname.startsWith("/feed")) return "feed";
  if (pathname.startsWith("/post/")) return "post_detail";
  if (pathname.startsWith("/profile")) return "profile";
  if (pathname.startsWith("/groups")) return "groups";
  if (pathname.startsWith("/pages")) return "pages";
  if (pathname.startsWith("/notifications")) return "notifications";
  if (pathname.startsWith("/connections")) return "connections";
  return "other";
}

function inferPostIdFromPath(path: string) {
  const pathname = path.split("?")[0] || "";
  const match = pathname.match(/^\/post\/([^/]+)$/);
  return match?.[1] ?? null;
}

function normalizeSessionId(value: string) {
  const v = value.trim();
  if (!v) return "";
  return v.slice(0, 64);
}

function normalizeVisitorKey(value: string) {
  const v = value.trim();
  if (!v) return "";
  return v.slice(0, 128);
}

function normalizeOptionalString(value: string | null | undefined, maxLength: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

async function inferContentType(postId: string | null, routeType: string) {
  if (!postId || routeType !== "post_detail") {
    return null;
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      feedSourceId: true,
      isTextCard: true,
      communityId: true,
    },
  });

  if (!post) return null;

  if (post.isTextCard) return "text_card";
  if (post.communityId) return "group_post";
  if (post.feedSourceId) return "rss_post";
  return "local_post";
}

export async function collectTrafficEvent(input: CollectTrafficInput) {
  const sessionId = normalizeSessionId(input.sessionId);
  const visitorKey = normalizeVisitorKey(input.visitorKey);

  if (!sessionId || !visitorKey) {
    return { ok: false as const, error: "Invalid session data." };
  }

  const path = normalizePath(input.path);
  const routeType = inferRouteType(path);
  const postId = normalizeOptionalString(input.postId, 64) ?? inferPostIdFromPath(path);
  const contentType = await inferContentType(postId, routeType);
  const now = new Date();
  const activeMsRaw = Number.isFinite(input.activeMs ?? null) ? Number(input.activeMs) : 0;
  const activeMs = Math.max(0, Math.min(60_000, Math.floor(activeMsRaw)));
  const pageViewIncrement = input.eventType === "page_view" ? 1 : 0;
  const visitorSalt = process.env.TRAFFIC_VISITOR_SALT ?? "fairbook-traffic-salt";
  const visitorKeyHash = sha256(`${visitorSalt}:${visitorKey}`);
  const referrer = normalizeOptionalString(input.referrer, 512);

  await prisma.$transaction([
    prisma.trafficSession.upsert({
      where: { id: sessionId },
      create: {
        id: sessionId,
        visitorKeyHash,
        userId: input.userId ?? null,
        startedAt: now,
        lastSeenAt: now,
        endedAt: input.eventType === "page_hide" ? now : null,
        entryPath: path,
        referrer,
        pageViewCount: pageViewIncrement,
        activeMsTotal: activeMs,
      },
      update: {
        userId: input.userId ?? undefined,
        lastSeenAt: now,
        endedAt: input.eventType === "page_hide" ? now : undefined,
        pageViewCount: { increment: pageViewIncrement },
        activeMsTotal: { increment: activeMs },
      },
    }),
    prisma.trafficEvent.create({
      data: {
        sessionId,
        userId: input.userId ?? null,
        eventType: input.eventType,
        path,
        routeType,
        contentType,
        postId,
        activeMs: activeMs > 0 ? activeMs : null,
        referrer,
      },
    }),
  ]);

  return { ok: true as const };
}
