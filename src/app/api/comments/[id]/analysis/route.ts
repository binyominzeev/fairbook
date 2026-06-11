import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeComment } from "@/lib/ai";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/comments/[id]/analysis">
) {
  const { id } = await ctx.params;

  const analysis = await prisma.commentAnalysis.findUnique({
    where: { commentId: id },
  });

  if (!analysis) {
    return Response.json({ analysis: null });
  }

  return Response.json({
    analysis: {
      ...analysis,
      positiveSignals: JSON.parse(analysis.positiveSignals),
      negativeSignals: JSON.parse(analysis.negativeSignals),
      neutralSignals: JSON.parse(analysis.neutralSignals),
    },
  });
}

export async function POST(
  _req: Request,
  ctx: RouteContext<"/api/comments/[id]/analysis">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const comment = await prisma.comment.findUnique({
    where: { id },
    include: {
      post: { select: { id: true } },
    },
  });
  if (!comment) {
    return Response.json({ error: "Comment not found." }, { status: 404 });
  }

  // Delete existing analysis if present (re-analyze)
  await prisma.commentAnalysis.deleteMany({ where: { commentId: id } });

  const siblings = await prisma.comment.findMany({
    where: { postId: comment.postId, id: { not: id } },
    orderBy: { createdAt: "asc" },
    take: 10,
    include: { author: { select: { name: true } } },
  });
  const context = siblings
    .map((c) => `${c.author.name}: ${c.content}`)
    .join("\n");

  const result = await analyzeComment(comment.content, context || undefined);
  const analysis = await prisma.commentAnalysis.create({
    data: {
      commentId: id,
      positiveSignals: JSON.stringify(result.positiveSignals),
      negativeSignals: JSON.stringify(result.negativeSignals),
      neutralSignals: JSON.stringify(result.neutralSignals),
      explanation: result.explanation,
    },
  });

  return Response.json({
    analysis: {
      ...analysis,
      positiveSignals: result.positiveSignals,
      negativeSignals: result.negativeSignals,
      neutralSignals: result.neutralSignals,
    },
  });
}
