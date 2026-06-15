import { calculatePostScore } from "@/lib/feed-ranking";
import { getSession } from "@/lib/auth";
import { moderatePost } from "@/lib/ai";
import { prisma } from "@/lib/prisma";

function buildModerationMessage(moderation: Awaited<ReturnType<typeof moderatePost>>) {
  if (moderation.source === "fallback") {
    return `Moderation issue: ${moderation.diagnostic ?? moderation.reasonShort}. Post is visible only to you until this is fixed.`;
  }

  if (moderation.status === "visible") {
    return "Share accepted.";
  }

  return `Post filtered: ${moderation.reasonShort}. Only you can see it.`;
}

export async function POST(
  req: Request,
  ctx: RouteContext<"/api/posts/[id]/share">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const payload = await req.json().catch(() => ({}));
  const shareContent =
    typeof payload?.content === "string" ? payload.content.trim() : "";

  const { id } = await ctx.params;
  const sourcePost = await prisma.post.findUnique({
    where: { id },
    select: {
      id: true,
      authorId: true,
      content: true,
      sharedTitle: true,
      sharedDescription: true,
      sharedSource: true,
      sharedUrl: true,
      moderationStatus: true,
      sharedPost: {
        select: {
          content: true,
          sharedTitle: true,
          sharedDescription: true,
          sharedSource: true,
          sharedUrl: true,
        },
      },
      _count: { select: { sharedBy: true } },
    },
  });

  if (!sourcePost) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }

  if (
    sourcePost.moderationStatus === "author_only" &&
    sourcePost.authorId !== session.userId
  ) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }

  const sharedContent = [
    sourcePost.content,
    sourcePost.sharedTitle,
    sourcePost.sharedDescription,
    sourcePost.sharedSource,
    sourcePost.sharedUrl,
    sourcePost.sharedPost?.content,
    sourcePost.sharedPost?.sharedTitle,
    sourcePost.sharedPost?.sharedDescription,
    sourcePost.sharedPost?.sharedSource,
    sourcePost.sharedPost?.sharedUrl,
  ]
    .filter(Boolean)
    .join("\n");

  const moderation = await moderatePost({
    postContent: shareContent || undefined,
    sharedContent: sharedContent || undefined,
  });

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
      moderation: { status: "visible", source: "rules" },
      message: "You already shared this post.",
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
      content: shareContent || null,
      sharedPostId: id,
      moderationStatus: moderation.status,
      moderationReason:
        moderation.status === "author_only" ? moderation.reasonShort : null,
      moderationExplanation:
        moderation.status === "author_only" ? moderation.explanation : null,
      moderatedAt: new Date(),
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
      moderation,
      message: buildModerationMessage(moderation),
    },
    { status: 201 }
  );
}