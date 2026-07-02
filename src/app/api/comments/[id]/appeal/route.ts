import { getSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/comments/[id]/appeal">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (isAdminEmail(session.email)) {
    return Response.json({ error: "Admin users do not need appeal flow." }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const requestText =
    typeof body?.requestText === "string" ? body.requestText.trim().slice(0, 2000) : "";

  const comment = await prisma.comment.findUnique({
    where: { id },
    select: { id: true, authorId: true, moderationStatus: true },
  });

  if (!comment) {
    return Response.json({ error: "Comment not found." }, { status: 404 });
  }
  if (comment.authorId !== session.userId) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }
  if (comment.moderationStatus !== "author_only") {
    return Response.json({ error: "Only filtered comments can be appealed." }, { status: 400 });
  }

  const existingOpenAppeal = await prisma.commentAppeal.findFirst({
    where: {
      commentId: id,
      requesterId: session.userId,
      status: "open",
    },
    select: { id: true },
  });

  if (existingOpenAppeal) {
    return Response.json({ error: "An open appeal already exists for this comment." }, { status: 409 });
  }

  const appeal = await prisma.commentAppeal.create({
    data: {
      commentId: id,
      requesterId: session.userId,
      requestText: requestText || null,
    },
    select: {
      id: true,
      status: true,
      requestText: true,
      createdAt: true,
    },
  });

  return Response.json({ appeal }, { status: 201 });
}
