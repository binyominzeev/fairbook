import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEFAULT_TAKE = 30;
const MAX_TAKE = 50;

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/posts/[id]/likes">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const requestedTake = Number(searchParams.get("take") ?? DEFAULT_TAKE);
  const take = Number.isFinite(requestedTake)
    ? Math.max(1, Math.min(MAX_TAKE, Math.floor(requestedTake)))
    : DEFAULT_TAKE;

  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, authorId: true, moderationStatus: true },
  });

  if (!post) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }

  if (post.moderationStatus === "author_only" && post.authorId !== session.userId) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }

  const rows = await prisma.postLike.findMany({
    where: { postId: id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      user: {
        select: {
          id: true,
          slug: true,
          name: true,
          avatarUrl: true,
        },
      },
    },
  });

  const hasMore = rows.length > take;
  const items = hasMore ? rows.slice(0, take) : rows;

  const totalCount = await prisma.postLike.count({ where: { postId: id } });

  return Response.json({
    likes: items.map((item) => ({
      id: item.id,
      createdAt: item.createdAt.toISOString(),
      user: item.user,
    })),
    nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
    totalCount,
  });
}
