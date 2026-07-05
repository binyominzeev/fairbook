import { getSession } from "@/lib/auth";
import { createCommentLikeNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  ctx: RouteContext<"/api/comments/[id]/like">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const comment = await prisma.comment.findUnique({
    where: { id },
    select: {
      id: true,
      postId: true,
      authorId: true,
      moderationStatus: true,
    },
  });

  if (!comment) {
    return Response.json({ error: "Comment not found." }, { status: 404 });
  }

  if (comment.moderationStatus === "author_only" && comment.authorId !== session.userId) {
    return Response.json({ error: "Comment not found." }, { status: 404 });
  }

  const existingLike = await prisma.commentLike.findUnique({
    where: {
      commentId_userId: {
        commentId: id,
        userId: session.userId,
      },
    },
  });

  if (existingLike) {
    await prisma.commentLike.delete({ where: { id: existingLike.id } });
  } else {
    await prisma.commentLike.create({
      data: {
        commentId: id,
        userId: session.userId,
      },
    });

    await createCommentLikeNotification({
      actorId: session.userId,
      recipientId: comment.authorId,
      postId: comment.postId,
      commentId: comment.id,
    });
  }

  const likeCount = await prisma.commentLike.count({ where: { commentId: id } });

  return Response.json({
    liked: !existingLike,
    likeCount,
  });
}
