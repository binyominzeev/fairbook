import { getSession } from "@/lib/auth";
import { buildVisibleCommunityPostWhere } from "@/lib/community-visibility";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/users/[id]/posts">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const communityVisibilityWhere =
    id === session.userId ? {} : buildVisibleCommunityPostWhere(session.userId);
  const posts = await prisma.post.findMany({
    where:
      id === session.userId
        ? { authorId: id }
        : {
            authorId: id,
            moderationStatus: "visible",
            ...communityVisibilityWhere,
          },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      author: { select: { id: true, slug: true, name: true, avatarUrl: true } },
      _count: { select: { comments: true } },
    },
  });

  return Response.json({ posts });
}
