import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeComment } from "@/lib/ai";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const postId = searchParams.get("postId");

  if (!postId) {
    return Response.json({ error: "postId is required." }, { status: 400 });
  }

  const comments = await prisma.comment.findMany({
    where: { postId },
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      analysis: true,
      replies: {
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
          analysis: true,
          replies: {
            include: {
              author: { select: { id: true, name: true, avatarUrl: true } },
              analysis: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  // Return only top-level comments (parentId is null); replies are nested
  const topLevel = comments.filter((c) => c.parentId === null);
  return Response.json({ comments: topLevel });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { postId, parentId, content } = await request.json();

  if (!postId || !content?.trim()) {
    return Response.json(
      { error: "postId and content are required." },
      { status: 400 }
    );
  }

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }

  if (parentId) {
    const parent = await prisma.comment.findUnique({ where: { id: parentId } });
    if (!parent || parent.postId !== postId) {
      return Response.json({ error: "Parent comment not found." }, { status: 404 });
    }
  }

  const comment = await prisma.comment.create({
    data: { postId, authorId: session.userId, parentId: parentId ?? null, content },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      analysis: true,
    },
  });

  // Analyze asynchronously — don't block the response
  (async () => {
    try {
      // Collect thread context for better analysis
      const siblings = await prisma.comment.findMany({
        where: { postId, id: { not: comment.id } },
        orderBy: { createdAt: "asc" },
        take: 10,
        include: { author: { select: { name: true } } },
      });
      const context = siblings
        .map((c) => `${c.author.name}: ${c.content}`)
        .join("\n");

      const analysis = await analyzeComment(content, context || undefined);
      await prisma.commentAnalysis.create({
        data: {
          commentId: comment.id,
          positiveSignals: JSON.stringify(analysis.positiveSignals),
          negativeSignals: JSON.stringify(analysis.negativeSignals),
          neutralSignals: JSON.stringify(analysis.neutralSignals),
          explanation: analysis.explanation,
        },
      });
    } catch {
      // Analysis failure is non-fatal
    }
  })();

  return Response.json({ comment }, { status: 201 });
}
