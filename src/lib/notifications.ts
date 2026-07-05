import { prisma } from "@/lib/prisma";

export const NOTIFICATION_TYPE_REPLY = "comment_reply";
export const NOTIFICATION_TYPE_FOLLOWED_COMMENT = "followed_user_commented";
export const NOTIFICATION_TYPE_POST_LIKE = "post_liked";
export const NOTIFICATION_TYPE_COMMENT_LIKE = "comment_liked";

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
        type_recipientId_targetKey: {
          type,
          recipientId,
          targetKey: commentId,
        },
      },
      create: {
        recipientId,
        actorId,
        type,
        targetKey: commentId,
        postId,
        commentId,
      },
      update: {
        actorId,
        postId,
        commentId,
        isRead: false,
      },
    });
  });

  if (writes.length > 0) {
    await prisma.$transaction(writes);
  }
}

export async function createPostLikeNotification(input: {
  actorId: string;
  recipientId: string;
  postId: string;
}) {
  const { actorId, recipientId, postId } = input;
  if (actorId === recipientId) return;

  await prisma.notification.upsert({
    where: {
      type_recipientId_targetKey: {
        type: NOTIFICATION_TYPE_POST_LIKE,
        recipientId,
        targetKey: `${postId}:${actorId}`,
      },
    },
    create: {
      recipientId,
      actorId,
      type: NOTIFICATION_TYPE_POST_LIKE,
      targetKey: `${postId}:${actorId}`,
      postId,
      commentId: null,
      isRead: false,
    },
    update: {
      actorId,
      postId,
      commentId: null,
      isRead: false,
      createdAt: new Date(),
    },
  });
}

export async function createCommentLikeNotification(input: {
  actorId: string;
  recipientId: string;
  postId: string;
  commentId: string;
}) {
  const { actorId, recipientId, postId, commentId } = input;
  if (actorId === recipientId) return;

  await prisma.notification.upsert({
    where: {
      type_recipientId_targetKey: {
        type: NOTIFICATION_TYPE_COMMENT_LIKE,
        recipientId,
        targetKey: `${commentId}:${actorId}`,
      },
    },
    create: {
      recipientId,
      actorId,
      type: NOTIFICATION_TYPE_COMMENT_LIKE,
      targetKey: `${commentId}:${actorId}`,
      postId,
      commentId,
      isRead: false,
    },
    update: {
      actorId,
      postId,
      commentId,
      isRead: false,
      createdAt: new Date(),
    },
  });
}
