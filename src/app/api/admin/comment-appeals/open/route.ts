import { getSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!isAdminEmail(session.email)) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const commentId = typeof body?.commentId === "string" ? body.commentId.trim() : "";
  const requestText =
    typeof body?.requestText === "string" ? body.requestText.trim().slice(0, 2000) : "";

  if (!commentId) {
    return Response.json({ error: "commentId is required." }, { status: 400 });
  }

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, authorId: true, moderationStatus: true },
  });
  if (!comment) {
    return Response.json({ error: "Comment not found." }, { status: 404 });
  }
  if (comment.authorId !== session.userId) {
    return Response.json({ error: "Only your own comments can be opened here." }, { status: 403 });
  }
  if (comment.moderationStatus !== "author_only") {
    return Response.json({ error: "Comment is not filtered." }, { status: 400 });
  }

  const existing = await prisma.commentAppeal.findFirst({
    where: {
      commentId,
      requesterId: session.userId,
      status: "open",
    },
    select: { id: true },
  });

  if (existing) {
    return Response.json({ error: "An open case already exists for this comment." }, { status: 409 });
  }

  const appeal = await prisma.commentAppeal.create({
    data: {
      commentId,
      requesterId: session.userId,
      requestText: requestText || "Admin self-review case",
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
    },
  });

  return Response.json({ appeal }, { status: 201 });
}
