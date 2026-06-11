import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateSteelman } from "@/lib/ai";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { targetId, postId } = await request.json();

  if (!targetId || !postId) {
    return Response.json(
      { error: "targetId and postId are required." },
      { status: 400 }
    );
  }

  const [target, post] = await Promise.all([
    prisma.user.findUnique({ where: { id: targetId } }),
    prisma.post.findUnique({ where: { id: postId } }),
  ]);

  if (!target) {
    return Response.json({ error: "Target user not found." }, { status: 404 });
  }
  if (!post) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }

  // Collect target's comments on the post
  const comments = await prisma.comment.findMany({
    where: { postId, authorId: targetId },
    orderBy: { createdAt: "asc" },
    select: { content: true },
  });

  if (comments.length === 0) {
    return Response.json(
      { error: "Target user has no comments on this post." },
      { status: 400 }
    );
  }

  const summary = await generateSteelman(
    target.name,
    comments.map((c) => c.content)
  );

  const steelman = await prisma.steelmanRequest.create({
    data: {
      requesterId: session.userId,
      targetId,
      postId,
      summary,
      status: "pending",
    },
  });

  return Response.json({ steelman }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const postId = searchParams.get("postId");
  const forMe = searchParams.get("forMe"); // steelmans targeting me

  const where = postId
    ? { postId }
    : forMe
    ? { targetId: session.userId, status: "pending" }
    : { requesterId: session.userId };

  const steelmans = await prisma.steelmanRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      requester: { select: { id: true, name: true, avatarUrl: true } },
      target: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  return Response.json({ steelmans });
}
