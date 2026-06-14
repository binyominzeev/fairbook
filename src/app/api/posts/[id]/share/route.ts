import { calculatePostScore } from "@/lib/feed-ranking";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  ctx: RouteContext<"/api/posts/[id]/share">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const sourcePost = await prisma.post.findUnique({
    where: { id },
    select: {
      id: true,
      _count: { select: { sharedBy: true } },
    },
  });

  if (!sourcePost) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }

  const existingShare = await prisma.post.findFirst({
    where: {
      authorId: session.userId,
      sharedPostId: id,
    },
    select: { id: true },
  });

  if (existingShare) {
    return Response.json({
      shared: true,
      postId: existingShare.id,
      shareCount: sourcePost._count.sharedBy,
    });
  }

  const createdAt = new Date();
  const nextScore = calculatePostScore({
    createdAt,
    sourceWeight: 1,
    commentCount: 0,
  });

  const sharedPost = await prisma.post.create({
    data: {
      authorId: session.userId,
      sharedPostId: id,
      createdAt,
      fetchedAt: createdAt,
      ...nextScore,
      lastScoredAt: createdAt,
    },
    select: { id: true },
  });

  const shareCount = await prisma.post.count({ where: { sharedPostId: id } });

  return Response.json(
    {
      shared: true,
      postId: sharedPost.id,
      shareCount,
    },
    { status: 201 }
  );
}