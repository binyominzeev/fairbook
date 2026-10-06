import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/users/[id]/notification-mute">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const row = await prisma.userNotificationMute.findUnique({
    where: { userId_mutedUserId: { userId: session.userId, mutedUserId: id } },
    select: { id: true },
  });

  return Response.json({ muted: row !== null });
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/users/[id]/notification-mute">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (id === session.userId) {
    return Response.json({ error: "Cannot mute yourself." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as { muted?: unknown };
  if (typeof body.muted !== "boolean") {
    return Response.json({ error: "Missing muted flag." }, { status: 400 });
  }

  if (body.muted) {
    const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!target) {
      return Response.json({ error: "User not found." }, { status: 404 });
    }

    await prisma.userNotificationMute.upsert({
      where: { userId_mutedUserId: { userId: session.userId, mutedUserId: id } },
      create: { userId: session.userId, mutedUserId: id },
      update: {},
    });
  } else {
    await prisma.userNotificationMute.deleteMany({
      where: { userId: session.userId, mutedUserId: id },
    });
  }

  return Response.json({ muted: body.muted });
}
