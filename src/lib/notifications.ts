import { prisma } from "@/lib/prisma";

export const NOTIFICATION_TYPE_REPLY = "comment_reply";
export const NOTIFICATION_TYPE_FOLLOWED_COMMENT = "followed_user_commented";

export async function createCommentNotifications(input: {
  actorId: string;
  postId: string;
  commentId: string;
  parentCommentAuthorId?: string | null;
}) {
  const { actorId, postId, commentId, parentCommentAuthorId } = input;

  const recipientIds = new Set<string>();

  if (parentCommentAuthorId && parentCommentAuthorId !== actorId) {
    recipientIds.add(parentCommentAuthorId);
  }

  const followers = await prisma.connection.findMany({
    where: { followingId: actorId },
    select: { followerId: true },
  });

  for (const follower of followers) {
    if (follower.followerId !== actorId) {
      recipientIds.add(follower.followerId);
    }
  }

  const writes = [...recipientIds].map((recipientId) => {
    const type =
      recipientId === parentCommentAuthorId
        ? NOTIFICATION_TYPE_REPLY
        : NOTIFICATION_TYPE_FOLLOWED_COMMENT;

    return prisma.notification.upsert({
      where: {
        type_recipientId_commentId: {
          type,
          recipientId,
          commentId,
        },
      },
      create: {
        recipientId,
        actorId,
        type,
        postId,
        commentId,
      },
      update: {
        actorId,
        postId,
        isRead: false,
      },
    });
  });

  if (writes.length > 0) {
    await prisma.$transaction(writes);
  }
}
