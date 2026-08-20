import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/posts/[id]/appeal">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const requestText =
    typeof body?.requestText === "string" ? body.requestText.trim().slice(0, 2000) : "";

  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, authorId: true, moderationStatus: true },
  });

  if (!post) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }
  if (post.authorId !== session.userId) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }
  if (post.moderationStatus !== "author_only") {
    return Response.json({ error: "Only filtered posts can be appealed." }, { status: 400 });
  }

  const existingOpenAppeal = await prisma.postAppeal.findFirst({
    where: {
      postId: id,
      requesterId: session.userId,
      status: "open",
    },
    select: { id: true },
  });

  if (existingOpenAppeal) {
    return Response.json({ error: "An open appeal already exists for this post." }, { status: 409 });
  }

  const appeal = await prisma.postAppeal.create({
    data: {
      postId: id,
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
