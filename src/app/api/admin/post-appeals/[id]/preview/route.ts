import { getSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { moderatePost } from "@/lib/ai";
import { loadPostModerationContext } from "@/lib/post-moderation-context";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/admin/post-appeals/[id]/preview">
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
  const prompt = typeof body?.prompt === "string" ? body.prompt : "";
  if (!prompt.trim() || prompt.length > 50000) {
    return Response.json({ error: "A valid moderation prompt is required." }, { status: 400 });
  }

  const appeal = await prisma.postAppeal.findUnique({
    where: { id },
    select: { id: true, postId: true, status: true },
  });
  if (!appeal) {
    return Response.json({ error: "Appeal not found." }, { status: 404 });
  }
  if (appeal.status !== "open") {
    return Response.json({ error: "Appeal is already resolved." }, { status: 400 });
  }

  const context = await loadPostModerationContext(appeal.postId);
  if (!context) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }

  const moderation = await moderatePost({
    postContent: context.postContent,
    sharedContent: context.sharedContent,
    moderationPrompt: prompt,
  });

  return Response.json({ moderation });
}