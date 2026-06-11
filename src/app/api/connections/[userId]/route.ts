import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  ctx: RouteContext<"/api/connections/[userId]">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { userId } = await ctx.params;
  if (userId === session.userId) {
    return Response.json({ error: "Cannot follow yourself." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    return Response.json({ error: "User not found." }, { status: 404 });
  }

  const existing = await prisma.connection.findUnique({
    where: { followerId_followingId: { followerId: session.userId, followingId: userId } },
  });
  if (existing) {
    return Response.json({ error: "Already following." }, { status: 409 });
  }

  await prisma.connection.create({
    data: { followerId: session.userId, followingId: userId },
  });

  return Response.json({ success: true }, { status: 201 });
}

export async function DELETE(
  _req: Request,
  ctx: RouteContext<"/api/connections/[userId]">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { userId } = await ctx.params;

  await prisma.connection.deleteMany({
    where: { followerId: session.userId, followingId: userId },
  });

  return Response.json({ success: true });
}
