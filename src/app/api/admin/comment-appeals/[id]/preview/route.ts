import { getSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { moderateComment } from "@/lib/ai";
import { loadCommentModerationContext } from "@/lib/comment-moderation-context";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/admin/comment-appeals/[id]/preview">
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
  const prompt = typeof body?.prompt === "string" ? body.prompt : "";
  if (!prompt.trim() || prompt.length > 50000) {
    return Response.json({ error: "A valid moderation prompt is required." }, { status: 400 });
  }

  const appeal = await prisma.commentAppeal.findUnique({
    where: { id },
    select: { id: true, commentId: true, status: true },
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
    moderationPrompt: prompt,
  });

  return Response.json({ moderation });
}