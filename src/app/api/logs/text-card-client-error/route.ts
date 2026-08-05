import { appendFile, mkdir } from "fs/promises";
import path from "path";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

const LOG_RELATIVE_PATH = path.join("logs", "text-card-client-errors.log");
const MAX_FIELD_LENGTH = 2000;

type Payload = {
  referenceId?: unknown;
  event?: unknown;
  step?: unknown;
  message?: unknown;
  stack?: unknown;
  httpStatus?: unknown;
  responseContentType?: unknown;
  responseSnippet?: unknown;
  file?: unknown;
  details?: unknown;
};

function toSafeString(value: unknown, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }
  return value.slice(0, MAX_FIELD_LENGTH);
}

function toSafeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return value.slice(0, MAX_FIELD_LENGTH);
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    if (depth >= 2) {
      return `[array:${value.length}]`;
    }

    return value.slice(0, 20).map((item) => normalizeValue(item, depth + 1));
  }

  if (typeof value === "object") {
    if (depth >= 2) {
      return "[object]";
    }

    const entries = Object.entries(value as Record<string, unknown>).slice(0, 30);
    const normalized: Record<string, unknown> = {};

    for (const [key, raw] of entries) {
      normalized[key.slice(0, 64)] = normalizeValue(raw, depth + 1);
    }

    return normalized;
  }

  return String(value).slice(0, MAX_FIELD_LENGTH);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return Response.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const logEntry = {
    at: new Date().toISOString(),
    userId: session.userId,
    referenceId: toSafeString(payload.referenceId, "unknown"),
    event: toSafeString(payload.event, "unknown"),
    step: toSafeString(payload.step, "unknown"),
    message: toSafeString(payload.message, "unknown"),
    stack: toSafeString(payload.stack, ""),
    httpStatus: toSafeNumber(payload.httpStatus),
    responseContentType: toSafeString(payload.responseContentType, ""),
    responseSnippet: toSafeString(payload.responseSnippet, ""),
    file: normalizeValue(payload.file),
    details: normalizeValue(payload.details),
  };

  const absoluteLogPath = path.join(process.cwd(), LOG_RELATIVE_PATH);
  await mkdir(path.dirname(absoluteLogPath), { recursive: true });
  await appendFile(absoluteLogPath, `${JSON.stringify(logEntry)}\n`, "utf8");

  return Response.json({ ok: true }, { status: 201 });
}
