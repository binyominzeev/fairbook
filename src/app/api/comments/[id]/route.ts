import { getSession } from "@/lib/auth";
import { analyzeComment, moderateComment } from "@/lib/ai";
import { getCommentInsightsEnabled } from "@/lib/app-config";
import { recomputePostScore } from "@/lib/feed-ranking";
import { prisma } from "@/lib/prisma";

function buildModerationMessage(moderation: Awaited<ReturnType<typeof moderateComment>>) {
  if (moderation.source === "fallback") {
    return `Moderation issue: ${moderation.diagnostic ?? moderation.reasonShort}. Comment is visible only to you until this is fixed.`;
  }

  if (moderation.status === "visible") {
    return "Comment updated.";
  }

  return `Comment updated and filtered: ${moderation.reasonShort}. Only you can see it.`;
}

async function loadModerationContext(commentId: string, postId: string) {
  const [post, parent] = await Promise.all([
    prisma.post.findUnique({
      where: { id: postId },
      select: {
        content: true,
        sharedTitle: true,
        sharedDescription: true,
        sharedSource: true,
        sharedUrl: true,
        sharedPost: {
          select: {
            content: true,
            sharedTitle: true,
            sharedDescription: true,
            sharedSource: true,
            sharedUrl: true,
          },
        },
      },
    }),
    prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        parent: {
          select: {
            content: true,
          },
        },
      },
    }),
  ]);

  const sharedContent = [
    post?.sharedTitle,
    post?.sharedDescription,
    post?.sharedSource,
    post?.sharedUrl,
    post?.sharedPost?.content,
    post?.sharedPost?.sharedTitle,
    post?.sharedPost?.sharedDescription,
    post?.sharedPost?.sharedSource,
    post?.sharedPost?.sharedUrl,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    postContent: post?.content ?? undefined,
    sharedContent: sharedContent || undefined,
    parentComment: parent?.parent?.content ?? undefined,
  };
}

async function refreshCommentAnalysis(commentId: string, postId: string, content: string) {
  const commentInsightsEnabled = await getCommentInsightsEnabled();
  if (!commentInsightsEnabled) {
    return;
  }

  try {
    const siblings = await prisma.comment.findMany({
      where: { postId, id: { not: commentId } },
      orderBy: { createdAt: "asc" },
      take: 10,
      include: { author: { select: { name: true } } },
    });

    const context = siblings.map((c) => `${c.author.name}: ${c.content}`).join("\n");
    const analysis = await analyzeComment(content, context || undefined);

    await prisma.commentAnalysis.deleteMany({ where: { commentId } });
    await prisma.commentAnalysis.create({
      data: {
        commentId,
        positiveSignals: JSON.stringify(analysis.positiveSignals),
        negativeSignals: JSON.stringify(analysis.negativeSignals),
        neutralSignals: JSON.stringify(analysis.neutralSignals),
        explanation: analysis.explanation,
      },
    });
  } catch {
    // Analysis failure is non-fatal
  }
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/comments/[id]">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const { content } = await request.json();

  if (!content?.trim()) {
    return Response.json({ error: "content is required." }, { status: 400 });
  }

  const comment = await prisma.comment.findUnique({
    where: { id },
    select: {
      id: true,
      postId: true,
      authorId: true,
    },
  });

  if (!comment) {
    return Response.json({ error: "Comment not found." }, { status: 404 });
  }

  if (comment.authorId !== session.userId) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const moderationContext = await loadModerationContext(id, comment.postId);
  const moderation = await moderateComment({
    ...moderationContext,
    commentContent: content,
  });

  const updatedComment = await prisma.comment.update({
    where: { id },
    data: {
      content,
      moderationStatus: moderation.status,
      moderationReason:
        moderation.status === "author_only" ? moderation.reasonShort : null,
      moderationExplanation:
        moderation.status === "author_only" ? moderation.explanation : null,
      moderatedAt: new Date(),
    },
    include: {
      author: { select: { id: true, slug: true, name: true, avatarUrl: true } },
      analysis: true,
    },
  });

  await recomputePostScore(comment.postId);

  void refreshCommentAnalysis(id, comment.postId, content);

  return Response.json({
    comment: updatedComment,
    moderation,
    message: buildModerationMessage(moderation),
  });
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/comments/[id]">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const comment = await prisma.comment.findUnique({
    where: { id },
    select: { id: true, authorId: true, postId: true },
  });

  if (!comment) {
    return Response.json({ error: "Comment not found." }, { status: 404 });
  }

  if (comment.authorId !== session.userId) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const allPostComments = await prisma.comment.findMany({
    where: { postId: comment.postId },
    select: { id: true, parentId: true },
  });

  const commentIdsToDelete = new Set<string>([id]);
  let added = true;
  while (added) {
    added = false;
    for (const postComment of allPostComments) {
      if (
        postComment.parentId &&
        commentIdsToDelete.has(postComment.parentId) &&
        !commentIdsToDelete.has(postComment.id)
      ) {
        commentIdsToDelete.add(postComment.id);
        added = true;
      }
    }
  }

  const ids = [...commentIdsToDelete];
  const depthById = new Map<string, number>();

  const getDepth = (commentId: string): number => {
    const cachedDepth = depthById.get(commentId);
    if (cachedDepth !== undefined) return cachedDepth;

    const current = allPostComments.find((postComment) => postComment.id === commentId);
    if (!current?.parentId || !commentIdsToDelete.has(current.parentId)) {
      depthById.set(commentId, 0);
      return 0;
    }

    const depth = getDepth(current.parentId) + 1;
    depthById.set(commentId, depth);
    return depth;
  };

  const idsByDescendingDepth = ids.sort((left, right) => getDepth(right) - getDepth(left));

  await prisma.$transaction([
    prisma.commentAnalysis.deleteMany({ where: { commentId: { in: ids } } }),
    ...idsByDescendingDepth.map((commentId) =>
      prisma.comment.delete({ where: { id: commentId } })
    ),
  ]);

  await recomputePostScore(comment.postId);

  return Response.json({ success: true, deletedCommentIds: ids });
}