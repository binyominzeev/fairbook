import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  ctx: RouteContext<"/api/posts/[id]/hide">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, authorId: true, moderationStatus: true },
  });

  if (!post) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }

  if (post.moderationStatus === "author_only" && post.authorId !== session.userId) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }

  const existingHidden = await prisma.hiddenPost.findUnique({
    where: {
      postId_userId: {
        postId: id,
        userId: session.userId,
      },
    },
  });

  if (existingHidden) {
    await prisma.hiddenPost.delete({ where: { id: existingHidden.id } });
  } else {
    await prisma.hiddenPost.create({
      data: {
        postId: id,
        userId: session.userId,
      },
    });
  }

  return Response.json({
    hidden: !existingHidden,
  });
}
