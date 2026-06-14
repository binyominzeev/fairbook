import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/posts/[id]">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await ctx.params;

  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      sharedPost: {
        select: {
          id: true,
          content: true,
          sharedUrl: true,
          sharedTitle: true,
          sharedDescription: true,
          sharedSource: true,
          sharedImageUrl: true,
          createdAt: true,
          author: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
      likes: { where: { userId: session.userId }, select: { id: true }, take: 1 },
      sharedBy: {
        where: { authorId: session.userId },
        select: { id: true },
        take: 1,
      },
      _count: { select: { comments: true, likes: true, sharedBy: true } },
      reflections: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!post) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }

  return Response.json({ post });
}

export async function DELETE(
  _req: Request,
  ctx: RouteContext<"/api/posts/[id]">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }
  if (post.authorId !== session.userId) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  await prisma.post.delete({ where: { id } });
  return Response.json({ success: true });
}
