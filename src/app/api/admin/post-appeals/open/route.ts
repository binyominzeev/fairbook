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
  const postId = typeof body?.postId === "string" ? body.postId.trim() : "";
  const requestText =
    typeof body?.requestText === "string" ? body.requestText.trim().slice(0, 2000) : "";

  if (!postId) {
    return Response.json({ error: "postId is required." }, { status: 400 });
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, moderationStatus: true },
  });
  if (!post) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }
  if (post.authorId !== session.userId) {
    return Response.json({ error: "Only your own posts can be opened here." }, { status: 403 });
  }
  if (post.moderationStatus !== "author_only") {
    return Response.json({ error: "Post is not filtered." }, { status: 400 });
  }

  const existing = await prisma.postAppeal.findFirst({
    where: {
      postId,
      requesterId: session.userId,
      status: "open",
    },
    select: { id: true },
  });

  if (existing) {
    return Response.json({ error: "An open case already exists for this post." }, { status: 409 });
  }

  const appeal = await prisma.postAppeal.create({
    data: {
      postId,
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
