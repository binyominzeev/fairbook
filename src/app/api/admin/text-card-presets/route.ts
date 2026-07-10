import { getSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import {
  getTextCardPresetVisibility,
  setTextCardPresetVisibility,
} from "@/lib/app-config";

type VisibilityPayload = {
  hiddenFontIds?: unknown;
};

function normalizeIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

async function ensureAdmin() {
  const session = await getSession();
  if (!session) {
    return { error: Response.json({ error: "Not authenticated." }, { status: 401 }) };
  }

  if (!isAdminEmail(session.email)) {
    return { error: Response.json({ error: "Forbidden." }, { status: 403 }) };
  }

  return { session };
}

export async function GET() {
  const auth = await ensureAdmin();
  if (auth.error) return auth.error;

  const visibility = await getTextCardPresetVisibility();
  return Response.json(visibility);
}

export async function PATCH(request: Request) {
  const auth = await ensureAdmin();
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => ({}))) as VisibilityPayload;

  const hiddenFontIds = normalizeIds(body.hiddenFontIds);

  const visibility = await setTextCardPresetVisibility({ hiddenFontIds });

  return Response.json(visibility);
}
