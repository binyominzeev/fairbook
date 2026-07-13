import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SubscriptionBody = {
  endpoint?: unknown;
  keys?: {
    p256dh?: unknown;
    auth?: unknown;
  };
};

function normalizeSubscription(body: SubscriptionBody) {
  if (typeof body.endpoint !== "string" || !body.endpoint.trim()) {
    throw new Error("Missing endpoint.");
  }

  if (typeof body.keys?.p256dh !== "string" || !body.keys.p256dh.trim()) {
    throw new Error("Missing p256dh key.");
  }

  if (typeof body.keys?.auth !== "string" || !body.keys.auth.trim()) {
    throw new Error("Missing auth key.");
  }

  return {
    endpoint: body.endpoint.trim(),
    p256dh: body.keys.p256dh.trim(),
    auth: body.keys.auth.trim(),
  };
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as SubscriptionBody;

  try {
    const subscription = normalizeSubscription(body);

    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        userId: session.userId,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        userAgent: request.headers.get("user-agent"),
        isActive: true,
        lastSeenAt: new Date(),
      },
      create: {
        userId: session.userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        userAgent: request.headers.get("user-agent"),
        isActive: true,
        lastSeenAt: new Date(),
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid subscription." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { endpoint?: unknown };
  const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";

  if (!endpoint) {
    return Response.json({ error: "Missing endpoint." }, { status: 400 });
  }

  await prisma.pushSubscription.updateMany({
    where: {
      userId: session.userId,
      endpoint,
    },
    data: {
      isActive: false,
    },
  });

  return Response.json({ ok: true });
}
