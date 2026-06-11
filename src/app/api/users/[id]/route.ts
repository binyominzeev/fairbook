import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/users/[id]">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      bio: true,
      avatarUrl: true,
      createdAt: true,
      _count: { select: { followers: true, following: true, posts: true } },
    },
  });

  if (!user) {
    return Response.json({ error: "User not found." }, { status: 404 });
  }

  const isFollowing = await prisma.connection.findUnique({
    where: { followerId_followingId: { followerId: session.userId, followingId: id } },
  });

  return Response.json({ user, isFollowing: !!isFollowing });
}
