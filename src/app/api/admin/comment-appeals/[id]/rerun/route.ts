import { getSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { moderateComment } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import { loadCommentModerationContext } from "@/lib/comment-moderation-context";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/admin/comment-appeals/[id]/rerun">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!isAdminEmail(session.email)) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const adminNote = typeof body?.adminNote === "string" ? body.adminNote.trim().slice(0, 2000) : "";

  const appeal = await prisma.commentAppeal.findUnique({
    where: { id },
    select: {
      id: true,
      commentId: true,
      status: true,
    },
  });

  if (!appeal) {
    return Response.json({ error: "Appeal not found." }, { status: 404 });
  }
  if (appeal.status !== "open") {
    return Response.json({ error: "Appeal is already resolved." }, { status: 400 });
  }

  const context = await loadCommentModerationContext(appeal.commentId);
  if (!context) {
    return Response.json({ error: "Comment not found." }, { status: 404 });
  }

  const moderation = await moderateComment({
    postContent: context.postContent,
    sharedContent: context.sharedContent,
    parentComment: context.parentComment,
    commentContent: context.comment.content,
  });

  const appealStatus = moderation.status === "visible" ? "resolved_visible" : "resolved_rejected";

  const [updatedComment, updatedAppeal] = await prisma.$transaction([
    prisma.comment.update({
      where: { id: context.comment.id },
      data: {
        moderationStatus: moderation.status,
        moderationReason: moderation.status === "author_only" ? moderation.reasonShort : null,
        moderationExplanation: moderation.status === "author_only" ? moderation.explanation : null,
        moderatedAt: new Date(),
      },
      select: {
        id: true,
        moderationStatus: true,
        moderationReason: true,
        moderationExplanation: true,
      },
    }),
    prisma.commentAppeal.update({
      where: { id: appeal.id },
      data: {
        status: appealStatus,
        reviewedById: session.userId,
        reviewedAt: new Date(),
        adminNote: adminNote || null,
      },
      select: {
        id: true,
        status: true,
        reviewedAt: true,
        adminNote: true,
      },
    }),
  ]);

  return Response.json({
    moderation,
    comment: updatedComment,
    appeal: updatedAppeal,
  });
}
