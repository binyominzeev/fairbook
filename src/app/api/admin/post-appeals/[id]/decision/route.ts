import { getSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { createModerationAppealNotification } from "@/lib/notifications";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/admin/post-appeals/[id]/decision">
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
  const decision = body?.decision;
  const adminNote = typeof body?.adminNote === "string" ? body.adminNote.trim().slice(0, 2000) : "";
  if (decision !== "accept" && decision !== "reject") {
    return Response.json({ error: "Decision must be accept or reject." }, { status: 400 });
  }

  const appeal = await prisma.postAppeal.findUnique({
    where: { id },
    select: {
      id: true,
      postId: true,
      requesterId: true,
      status: true,
    },
  });
  if (!appeal) {
    return Response.json({ error: "Appeal not found." }, { status: 404 });
  }
  if (appeal.status !== "open") {
    return Response.json({ error: "Appeal is already resolved." }, { status: 400 });
  }

  const accepted = decision === "accept";
  const decisionResult = await prisma.$transaction(async (transaction) => {
    const updatedCount = await transaction.postAppeal.updateMany({
      where: { id, status: "open" },
      data: {
        status: accepted ? "resolved_visible" : "resolved_rejected",
        reviewedById: session.userId,
        reviewedAt: new Date(),
        adminNote: adminNote || null,
      },
    });
    if (updatedCount.count !== 1) return null;

    const post = await transaction.post.update({
      where: { id: appeal.postId },
      data: {
        moderationStatus: accepted ? "visible" : "author_only",
        ...(accepted ? { moderationReason: null, moderationExplanation: null } : {}),
        moderatedAt: new Date(),
      },
      select: { id: true, moderationStatus: true },
    });
    const updatedAppeal = await transaction.postAppeal.findUniqueOrThrow({
      where: { id },
      select: { id: true, status: true, reviewedAt: true, adminNote: true },
    });
    return { post, appeal: updatedAppeal };
  });

  if (!decisionResult) {
    return Response.json({ error: "Appeal is already resolved." }, { status: 409 });
  }

  await createModerationAppealNotification({
    actorId: session.userId,
    recipientId: appeal.requesterId,
    appealId: appeal.id,
    decision: accepted ? "accepted" : "rejected",
    postId: appeal.postId,
  });

  return Response.json(decisionResult);
}