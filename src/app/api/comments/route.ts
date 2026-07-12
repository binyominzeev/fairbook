import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { recomputePostScore } from "@/lib/feed-ranking";
import { prisma } from "@/lib/prisma";
import { analyzeComment, moderateComment } from "@/lib/ai";
import { createCommentNotifications } from "@/lib/notifications";
import { getCommentInsightsEnabled } from "@/lib/app-config";

const MAX_COMMENT_REPLY_DEPTH = 6;

function buildModerationMessage(moderation: Awaited<ReturnType<typeof moderateComment>>) {
  if (moderation.source === "fallback") {
    return `Moderation issue: ${moderation.diagnostic ?? moderation.reasonShort}. Comment is visible only to you until this is fixed.`;
  }

  if (moderation.status === "visible") {
    return "Comment accepted.";
  }

  return `Comment filtered: ${moderation.reasonShort}. Only you can see it.`;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  const sessionUserId = session?.userId ?? "";
  const { searchParams } = new URL(request.url);
  const postId = searchParams.get("postId");

  if (!postId) {
    return Response.json({ error: "postId is required." }, { status: 400 });
  }

  const visibilityWhere = session
    ? {
        OR: [
          { moderationStatus: "visible" as const },
          { authorId: session.userId },
        ],
      }
    : { moderationStatus: "visible" as const };

  const comments = await prisma.comment.findMany({
    where: {
      postId,
      ...visibilityWhere,
    },
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { id: true, slug: true, name: true, avatarUrl: true } },
      analysis: true,
      likes: session
        ? { where: { userId: session.userId }, select: { id: true }, take: 1 }
        : false,
      _count: { select: { likes: true } },
      replies: {
        where: visibilityWhere,
        include: {
          author: { select: { id: true, slug: true, name: true, avatarUrl: true } },
          analysis: true,
          likes: session
            ? { where: { userId: session.userId }, select: { id: true }, take: 1 }
            : false,
          _count: { select: { likes: true } },
          replies: {
            where: visibilityWhere,
            include: {
              author: { select: { id: true, slug: true, name: true, avatarUrl: true } },
              analysis: true,
              likes: session
                ? { where: { userId: session.userId }, select: { id: true }, take: 1 }
                : false,
              _count: { select: { likes: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      authorId: true,
      moderationStatus: true,
      community: {
        select: {
          isPrivate: true,
          members: {
            where: { userId: sessionUserId },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!post) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }

  if (post.moderationStatus === "author_only" && post.authorId !== session?.userId) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }

  if (post.community?.isPrivate) {
    const memberRows = Array.isArray(post.community.members) ? post.community.members : [];
    if (memberRows.length === 0) {
      return Response.json({ error: "Post not found." }, { status: 404 });
    }
  }

  // Return only top-level comments (parentId is null); replies are nested
  const topLevel = comments.filter((c) => c.parentId === null);
  return Response.json({ comments: topLevel });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { postId, parentId, content, preModeration } = await request.json();

  if (!postId || !content?.trim()) {
    return Response.json(
      { error: "postId and content are required." },
      { status: 400 }
    );
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      authorId: true,
      community: {
        select: {
          isPrivate: true,
          members: {
            where: { userId: session.userId },
            select: { id: true },
            take: 1,
          },
        },
      },
      moderationStatus: true,
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
  });
  if (!post) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }

  if (post.community?.isPrivate && post.community.members.length === 0) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }

  if (post.moderationStatus === "author_only" && post.authorId !== session.userId) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }

  let parentContent: string | undefined;
  let parentCommentAuthorId: string | undefined;
  if (parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: parentId },
      select: { id: true, postId: true, content: true, authorId: true, parentId: true },
    });
    if (!parent || parent.postId !== postId) {
      return Response.json({ error: "Parent comment not found." }, { status: 404 });
    }

    let parentDepth = 0;
    let currentParentId: string | null = parent.id;
    while (currentParentId) {
      if (parentDepth >= MAX_COMMENT_REPLY_DEPTH) {
        return Response.json(
          { error: "Reply thread is too deep. Please reply higher in the thread." },
          { status: 400 }
        );
      }

      const ancestorRow: { parentId: string | null } | null = await prisma.comment.findUnique({
        where: { id: currentParentId },
        select: { parentId: true },
      });
      parentDepth += 1;
      currentParentId = ancestorRow?.parentId ?? null;
    }

    parentContent = parent.content;
    parentCommentAuthorId = parent.authorId;
  }

  const sharedContent = [
    post.sharedTitle,
    post.sharedDescription,
    post.sharedSource,
    post.sharedUrl,
    post.sharedPost?.content,
    post.sharedPost?.sharedTitle,
    post.sharedPost?.sharedDescription,
    post.sharedPost?.sharedSource,
    post.sharedPost?.sharedUrl,
  ]
    .filter(Boolean)
    .join("\n");

  let moderation = null;
  if (
    preModeration &&
    typeof preModeration === "object" &&
    preModeration.moderation &&
    preModeration.content === content
  ) {
    moderation = preModeration.moderation;
  } else {
    moderation = await moderateComment({
      postContent: post.content ?? undefined,
      sharedContent: sharedContent || undefined,
      parentComment: parentContent,
      commentContent: content,
    });
  }

  const comment = await prisma.comment.create({
    data: {
      postId,
      authorId: session.userId,
      parentId: parentId ?? null,
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
      likes: { where: { userId: session.userId }, select: { id: true }, take: 1 },
      _count: { select: { likes: true } },
    },
  });

  await recomputePostScore(postId);

  if (moderation.status === "visible") {
    void createCommentNotifications({
      actorId: session.userId,
      postId,
      commentId: comment.id,
      parentCommentAuthorId,
    });
  }

  const commentInsightsEnabled = await getCommentInsightsEnabled();
  if (commentInsightsEnabled) {
    // Analyze asynchronously — don't block the response
    (async () => {
      try {
        // Collect thread context for better analysis
        const siblings = await prisma.comment.findMany({
          where: { postId, id: { not: comment.id } },
          orderBy: { createdAt: "asc" },
          take: 10,
          include: { author: { select: { name: true } } },
        });
        const context = siblings
          .map((c) => `${c.author.name}: ${c.content}`)
          .join("\n");

        const analysis = await analyzeComment(content, context || undefined);
        await prisma.commentAnalysis.create({
          data: {
            commentId: comment.id,
            positiveSignals: JSON.stringify(analysis.positiveSignals),
            negativeSignals: JSON.stringify(analysis.negativeSignals),
            neutralSignals: JSON.stringify(analysis.neutralSignals),
            explanation: analysis.explanation,
          },
        });
      } catch {
        // Analysis failure is non-fatal
      }
    })();
  }

  return Response.json(
    {
      comment,
      moderation,
      message: buildModerationMessage(moderation),
    },
    { status: 201 }
  );
}
