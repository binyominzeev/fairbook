import { getSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { moderatePost } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import { loadPostModerationContext } from "@/lib/post-moderation-context";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/admin/post-appeals/[id]/rerun">
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

  const appeal = await prisma.postAppeal.findUnique({
    where: { id },
    select: {
      id: true,
      postId: true,
      status: true,
    },
  });

  if (!appeal) {
    return Response.json({ error: "Appeal not found." }, { status: 404 });
  }
  if (appeal.status !== "open") {
    return Response.json({ error: "Appeal is already resolved." }, { status: 400 });
  }

  const context = await loadPostModerationContext(appeal.postId);
  if (!context) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }

  const moderation = await moderatePost({
    postContent: context.postContent,
    sharedContent: context.sharedContent,
  });

  const appealStatus = moderation.status === "visible" ? "resolved_visible" : "resolved_rejected";

  const [updatedPost, updatedAppeal] = await prisma.$transaction([
    prisma.post.update({
      where: { id: context.post.id },
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
    prisma.postAppeal.update({
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
    post: updatedPost,
    appeal: updatedAppeal,
  });
}
