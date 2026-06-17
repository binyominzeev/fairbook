import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeComment, moderateComment } from "@/lib/ai";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { postId, parentId, content } = await request.json();
  if (!postId || !content?.trim()) {
    return Response.json({ error: "postId and content are required." }, { status: 400 });
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      content: true,
      sharedTitle: true,
      sharedDescription: true,
      sharedSource: true,
      sharedUrl: true,
      sharedPost: { select: { content: true, sharedTitle: true, sharedDescription: true, sharedSource: true, sharedUrl: true } },
    },
  });
  if (!post) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }

  let parentContent: string | undefined;
  if (parentId) {
    const parent = await prisma.comment.findUnique({ where: { id: parentId }, select: { postId: true, content: true } });
    if (!parent || parent.postId !== postId) {
      return Response.json({ error: "Parent comment not found." }, { status: 404 });
    }
    parentContent = parent.content;
  }

  const sharedContent = [
    post.sharedTitle,
    post.sharedDescription,
    post.sharedSource,
    post.sharedUrl,
    post.sharedPost?.content,
    post.sharedPost?.sharedTitle,
    post.sharedPost?.sharedDescription,
    post.sharedPost?.sharedSource,
    post.sharedPost?.sharedUrl,
  ]
    .filter(Boolean)
    .join("\n");

  const moderation = await moderateComment({
    postContent: post.content ?? undefined,
    sharedContent: sharedContent || undefined,
    parentComment: parentContent,
    commentContent: content,
  });

  // Also run discourse analysis (useful feedback for the user)
  let analysis = null;
  try {
    const siblings = await prisma.comment.findMany({ where: { postId }, orderBy: { createdAt: "asc" }, take: 10, include: { author: { select: { name: true } } } });
    const context = siblings.map((c) => `${c.author.name}: ${c.content}`).join("\n");
    analysis = await analyzeComment(content, context || undefined);
  } catch {
    analysis = null;
  }

  return Response.json({ moderation, analysis });
}
