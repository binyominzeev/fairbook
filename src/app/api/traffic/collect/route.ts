import { getSession } from "@/lib/auth";
import {
  collectTrafficEvent,
  collectTrafficEventsBatch,
  type TrafficEventType,
} from "@/lib/traffic";

type Payload = {
  sessionId?: unknown;
  visitorKey?: unknown;
  eventType?: unknown;
  path?: unknown;
  referrer?: unknown;
  activeMs?: unknown;
  postId?: unknown;
  postIds?: unknown;
};

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readNullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function readEventType(value: unknown): TrafficEventType | null {
  if (value === "page_view" || value === "heartbeat" || value === "page_hide") {
    return value;
  }
  return null;
}

function readActiveMs(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function readPostIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as Payload;
  const session = await getSession();

  const eventType = readEventType(payload.eventType);
  if (!eventType) {
    return Response.json({ error: "Invalid event type." }, { status: 400 });
  }

  const postIds = readPostIds(payload.postIds);

  if (postIds.length > 0) {
    const result = await collectTrafficEventsBatch({
      sessionId: readString(payload.sessionId),
      visitorKey: readString(payload.visitorKey),
      eventType,
      path: readString(payload.path),
      referrer: readNullableString(payload.referrer),
      activeMs: readActiveMs(payload.activeMs),
      postIds,
      userId: session?.userId ?? null,
    });

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 400 });
    }

    return Response.json({ ok: true, tracked: result.tracked });
  }

  const result = await collectTrafficEvent({
    sessionId: readString(payload.sessionId),
    visitorKey: readString(payload.visitorKey),
    eventType,
    path: readString(payload.path),
    referrer: readNullableString(payload.referrer),
    activeMs: readActiveMs(payload.activeMs),
    postId: readNullableString(payload.postId),
    userId: session?.userId ?? null,
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json({ ok: true });
}
