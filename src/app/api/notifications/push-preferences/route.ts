import { getSession } from "@/lib/auth";
import { isSupportedNotificationType } from "@/lib/notification-types";
import { prisma } from "@/lib/prisma";

type PushPreferenceBody = {
  type?: unknown;
  enabled?: unknown;
};

export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const rows = await prisma.pushNotificationPreference.findMany({
    where: {
      userId: session.userId,
      isEnabled: false,
    },
    select: {
      type: true,
      isEnabled: true,
    },
  });

  return Response.json({
    preferences: rows.map((row) => ({
      type: row.type,
      enabled: row.isEnabled,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as PushPreferenceBody;
  const type = typeof body.type === "string" ? body.type : "";
  const enabled = typeof body.enabled === "boolean" ? body.enabled : null;

  if (!isSupportedNotificationType(type)) {
    return Response.json({ error: "Unsupported notification type." }, { status: 400 });
  }

  if (enabled === null) {
    return Response.json({ error: "Missing enabled flag." }, { status: 400 });
  }

  const preference = await prisma.pushNotificationPreference.upsert({
    where: {
      userId_type: {
        userId: session.userId,
        type,
      },
    },
    create: {
      userId: session.userId,
      type,
      isEnabled: enabled,
    },
    update: {
      isEnabled: enabled,
    },
    select: {
      type: true,
      isEnabled: true,
    },
  });

  return Response.json({
    type: preference.type,
    enabled: preference.isEnabled,
  });
}
