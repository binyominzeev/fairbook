import { getSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { loadCommentModerationContext } from "@/lib/comment-moderation-context";
import { getPromptContent } from "@/lib/ai-prompts";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!isAdminEmail(session.email)) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const [openAppeals, ownBlockedComments, moderationPrompt] = await Promise.all([
    prisma.commentAppeal.findMany({
      where: { status: "open" },
      orderBy: { createdAt: "desc" },
      include: {
        requester: { select: { id: true, name: true, email: true } },
        comment: {
          select: {
            id: true,
            content: true,
            moderationReason: true,
            moderationExplanation: true,
            moderationStatus: true,
            createdAt: true,
            author: { select: { id: true, name: true, email: true } },
            post: { select: { id: true, content: true } },
          },
        },
      },
      take: 40,
    }),
    prisma.comment.findMany({
      where: {
        authorId: session.userId,
        moderationStatus: "author_only",
      },
      orderBy: { createdAt: "desc" },
      include: {
        post: { select: { id: true, content: true } },
      },
      take: 20,
    }),
    getPromptContent("comment_moderation"),
  ]);

  const ownBlockedCommentIds = ownBlockedComments.map((comment) => comment.id);
  const openOwnAppealRows = ownBlockedCommentIds.length
    ? await prisma.commentAppeal.findMany({
        where: {
          commentId: { in: ownBlockedCommentIds },
          status: "open",
          requesterId: session.userId,
        },
        select: { commentId: true },
      })
    : [];
  const openOwnAppealSet = new Set(openOwnAppealRows.map((row) => row.commentId));

  const ownBlocked = ownBlockedComments.map((comment) => ({
    id: comment.id,
    content: comment.content,
    moderationReason: comment.moderationReason,
    moderationExplanation: comment.moderationExplanation,
    createdAt: comment.createdAt,
    post: comment.post,
    hasOpenAppeal: openOwnAppealSet.has(comment.id),
  }));

  const appealsWithContext = await Promise.all(
    openAppeals.map(async (appeal) => {
      const context = await loadCommentModerationContext(appeal.commentId);
      return {
        id: appeal.id,
        status: appeal.status,
        requestText: appeal.requestText,
        createdAt: appeal.createdAt,
        requester: appeal.requester,
        comment: appeal.comment,
        context: context
          ? {
              postContent: context.postContent,
              sharedContent: context.sharedContent,
              parentComment: context.parentComment,
            }
          : null,
      };
    })
  );

  return Response.json({
    moderationPrompt,
    openAppeals: appealsWithContext,
    ownBlockedComments: ownBlocked,
  });
}
