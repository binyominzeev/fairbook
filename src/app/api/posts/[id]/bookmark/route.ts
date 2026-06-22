import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  ctx: RouteContext<"/api/posts/[id]/bookmark">
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

  const existingBookmark = await prisma.bookmarkedPost.findUnique({
    where: {
      postId_userId: {
        postId: id,
        userId: session.userId,
      },
    },
  });

  if (existingBookmark) {
    await prisma.bookmarkedPost.delete({ where: { id: existingBookmark.id } });
  } else {
    await prisma.bookmarkedPost.create({
      data: {
        postId: id,
        userId: session.userId,
      },
    });
  }

  return Response.json({ bookmarked: !existingBookmark });
}
