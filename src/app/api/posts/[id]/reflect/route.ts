import { getSession } from "@/lib/auth";
import { getCommentInsightsEnabled } from "@/lib/app-config";
import { prisma } from "@/lib/prisma";
import { generateReflection } from "@/lib/ai";

export async function POST(
  _req: Request,
  ctx: RouteContext<"/api/posts/[id]/reflect">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const commentInsightsEnabled = await getCommentInsightsEnabled();
  if (!commentInsightsEnabled) {
    return Response.json(
      { error: "Reflection is currently disabled by admin." },
      { status: 403 }
    );
  }

  const { id } = await ctx.params;
  const post = await prisma.post.findUnique({
    where: { id },
    include: { author: { select: { name: true } } },
  });
  if (!post) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }

  const comments = await prisma.comment.findMany({
    where: { postId: id, moderationStatus: "visible" },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { name: true } } },
  });

  if (comments.length < 5) {
    return Response.json(
      { error: "Reflection requires at least 5 comments." },
      { status: 400 }
    );
  }

  const thread = [
    `Post by ${post.author.name}: ${post.content ?? post.sharedTitle ?? ""}`,
    ...comments.map((c) => `${c.author.name}: ${c.content}`),
  ].join("\n\n");

  const result = await generateReflection(thread);

  const reflection = await prisma.threadReflection.create({
    data: {
      postId: id,
      agreementAreas: JSON.stringify(result.agreementAreas),
      disagreementAreas: JSON.stringify(result.disagreementAreas),
      unresolvedQuestions: JSON.stringify(result.unresolvedQuestions),
      qualityObservations: JSON.stringify(result.qualityObservations),
    },
  });

  return Response.json({
    reflection: {
      ...reflection,
      agreementAreas: result.agreementAreas,
      disagreementAreas: result.disagreementAreas,
      unresolvedQuestions: result.unresolvedQuestions,
      qualityObservations: result.qualityObservations,
    },
  });
}
