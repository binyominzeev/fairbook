import { prisma } from "@/lib/prisma";
import {
  NOTIFICATION_TYPE_COMMENT_LIKE,
  NOTIFICATION_TYPE_FOLLOWED_COMMENT,
  NOTIFICATION_TYPE_FOLLOWED_USER_NEW_POST,
  NOTIFICATION_TYPE_GROUP_INVITE,
  NOTIFICATION_TYPE_GROUP_INVITE_ACCEPTED,
  NOTIFICATION_TYPE_GROUP_JOIN_APPROVED,
  NOTIFICATION_TYPE_GROUP_JOIN_REQUEST,
  NOTIFICATION_TYPE_GROUP_NEW_POST,
  NOTIFICATION_TYPE_POST_LIKE,
  NOTIFICATION_TYPE_POST_SUBSCRIBED_COMMENT,
  NOTIFICATION_TYPE_REPLY,
} from "@/lib/notification-types";
import { dispatchPushForNotificationIds } from "@/lib/push";

export async function createCommentNotifications(input: {
  actorId: string;
  postId: string;
  commentId: string;
  parentCommentAuthorId?: string | null;
}) {
  const { actorId, postId, commentId, parentCommentAuthorId } = input;

  const recipientTypes = new Map<string, string>();
  const typePriority: Record<string, number> = {
    [NOTIFICATION_TYPE_REPLY]: 3,
    [NOTIFICATION_TYPE_POST_SUBSCRIBED_COMMENT]: 2,
    [NOTIFICATION_TYPE_FOLLOWED_COMMENT]: 1,
  };

  const assignRecipientType = (recipientId: string, type: string) => {
    if (!recipientId || recipientId === actorId) return;
    const currentType = recipientTypes.get(recipientId);
    if (!currentType || (typePriority[type] ?? 0) > (typePriority[currentType] ?? 0)) {
      recipientTypes.set(recipientId, type);
    }
  };

  if (parentCommentAuthorId) {
    assignRecipientType(parentCommentAuthorId, NOTIFICATION_TYPE_REPLY);
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      authorId: true,
      community: {
        select: {
          id: true,
          isPrivate: true,
        },
      },
    },
  });

  if (!post) {
    return;
  }

  assignRecipientType(post.authorId, NOTIFICATION_TYPE_POST_SUBSCRIBED_COMMENT);

  const participantRows = await prisma.comment.findMany({
    where: { postId },
    select: { authorId: true },
    distinct: ["authorId"],
  });

  for (const participant of participantRows) {
    assignRecipientType(
      participant.authorId,
      NOTIFICATION_TYPE_POST_SUBSCRIBED_COMMENT
    );
  }

  const followers = await prisma.connection.findMany({
    where: { followingId: actorId },
    select: { followerId: true },
  });

  for (const follower of followers) {
    assignRecipientType(follower.followerId, NOTIFICATION_TYPE_FOLLOWED_COMMENT);
  }

  let candidateRecipientIds = [...recipientTypes.keys()];
  if (candidateRecipientIds.length === 0) {
    return;
  }

  if (post.community?.isPrivate) {
    const memberRows = await prisma.communityMember.findMany({
      where: {
        communityId: post.community.id,
        userId: { in: candidateRecipientIds },
      },
      select: { userId: true },
    });
    const memberIds = new Set(memberRows.map((row) => row.userId));
    candidateRecipientIds = candidateRecipientIds.filter((id) => memberIds.has(id));
  }

  if (candidateRecipientIds.length === 0) {
    return;
  }

  const unsubscribedRows = await prisma.postNotificationPreference.findMany({
    where: {
      postId,
      userId: { in: candidateRecipientIds },
      isSubscribed: false,
    },
    select: { userId: true },
  });
  const unsubscribedIds = new Set(unsubscribedRows.map((row) => row.userId));

  const recipientIds = candidateRecipientIds.filter((id) => !unsubscribedIds.has(id));
  if (recipientIds.length === 0) {
    return;
  }

  const writes = recipientIds.map((recipientId) => {
    const type = recipientTypes.get(recipientId) ?? NOTIFICATION_TYPE_POST_SUBSCRIBED_COMMENT;

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
    const records = await prisma.$transaction(writes);
    await dispatchPushForNotificationIds(records.map((record) => record.id));
  }
}

export async function createGroupPostNotifications(input: {
  actorId: string;
  communityId: string;
  postId: string;
}) {
  const { actorId, communityId, postId } = input;

  const memberRows = await prisma.communityMember.findMany({
    where: {
      communityId,
      userId: { not: actorId },
    },
    select: { userId: true },
  });

  if (memberRows.length === 0) {
    return;
  }

  const memberIds = memberRows.map((row) => row.userId);
  const unsubscribedRows = await prisma.communityNotificationPreference.findMany({
    where: {
      communityId,
      userId: { in: memberIds },
      isSubscribed: false,
    },
    select: { userId: true },
  });
  const unsubscribedIds = new Set(unsubscribedRows.map((row) => row.userId));

  const recipientIds = memberIds.filter((id) => !unsubscribedIds.has(id));
  if (recipientIds.length === 0) {
    return;
  }

  const writes = recipientIds.map((recipientId) =>
    prisma.notification.upsert({
      where: {
        type_recipientId_targetKey: {
          type: NOTIFICATION_TYPE_GROUP_NEW_POST,
          recipientId,
          targetKey: postId,
        },
      },
      create: {
        recipientId,
        actorId,
        type: NOTIFICATION_TYPE_GROUP_NEW_POST,
        targetKey: postId,
        communityId,
        postId,
        commentId: null,
        isRead: false,
      },
      update: {
        actorId,
        communityId,
        postId,
        commentId: null,
        isRead: false,
        createdAt: new Date(),
      },
    })
  );

  const records = await prisma.$transaction(writes);
  await dispatchPushForNotificationIds(records.map((record) => record.id));
}

export async function createPostLikeNotification(input: {
  actorId: string;
  recipientId: string;
  postId: string;
}) {
  const { actorId, recipientId, postId } = input;
  if (actorId === recipientId) return;

  const record = await prisma.notification.upsert({
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

  await dispatchPushForNotificationIds([record.id]);
}

export async function createCommentLikeNotification(input: {
  actorId: string;
  recipientId: string;
  postId: string;
  commentId: string;
}) {
  const { actorId, recipientId, postId, commentId } = input;
  if (actorId === recipientId) return;

  const record = await prisma.notification.upsert({
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

  await dispatchPushForNotificationIds([record.id]);
}

export async function createGroupInviteNotification(input: {
  actorId: string;
  recipientId: string;
  communityId: string;
}) {
  const { actorId, recipientId, communityId } = input;
  if (actorId === recipientId) return;

  const record = await prisma.notification.upsert({
    where: {
      type_recipientId_targetKey: {
        type: NOTIFICATION_TYPE_GROUP_INVITE,
        recipientId,
        targetKey: communityId,
      },
    },
    create: {
      recipientId,
      actorId,
      type: NOTIFICATION_TYPE_GROUP_INVITE,
      targetKey: communityId,
      communityId,
      postId: null,
      commentId: null,
      isRead: false,
    },
    update: {
      actorId,
      communityId,
      postId: null,
      commentId: null,
      isRead: false,
      createdAt: new Date(),
    },
  });

  await dispatchPushForNotificationIds([record.id]);
}

export async function createGroupJoinRequestNotifications(input: {
  actorId: string;
  communityId: string;
}) {
  const { actorId, communityId } = input;

  const adminRows = await prisma.communityMember.findMany({
    where: {
      communityId,
      role: "admin",
      userId: { not: actorId },
    },
    select: { userId: true },
  });

  if (adminRows.length === 0) {
    return;
  }

  const writes = adminRows.map((admin) =>
    prisma.notification.upsert({
      where: {
        type_recipientId_targetKey: {
          type: NOTIFICATION_TYPE_GROUP_JOIN_REQUEST,
          recipientId: admin.userId,
          targetKey: `${communityId}:${actorId}`,
        },
      },
      create: {
        recipientId: admin.userId,
        actorId,
        type: NOTIFICATION_TYPE_GROUP_JOIN_REQUEST,
        targetKey: `${communityId}:${actorId}`,
        communityId,
        postId: null,
        commentId: null,
        isRead: false,
      },
      update: {
        actorId,
        communityId,
        postId: null,
        commentId: null,
        isRead: false,
        createdAt: new Date(),
      },
    })
  );

  const records = await prisma.$transaction(writes);
  await dispatchPushForNotificationIds(records.map((record) => record.id));
}

export async function createGroupJoinApprovedNotification(input: {
  actorId: string;
  recipientId: string;
  communityId: string;
}) {
  const { actorId, recipientId, communityId } = input;
  if (actorId === recipientId) return;

  const record = await prisma.notification.upsert({
    where: {
      type_recipientId_targetKey: {
        type: NOTIFICATION_TYPE_GROUP_JOIN_APPROVED,
        recipientId,
        targetKey: communityId,
      },
    },
    create: {
      recipientId,
      actorId,
      type: NOTIFICATION_TYPE_GROUP_JOIN_APPROVED,
      targetKey: communityId,
      communityId,
      postId: null,
      commentId: null,
      isRead: false,
    },
    update: {
      actorId,
      communityId,
      postId: null,
      commentId: null,
      isRead: false,
      createdAt: new Date(),
    },
  });

  await dispatchPushForNotificationIds([record.id]);
}

export async function createGroupInviteAcceptedNotification(input: {
  actorId: string;
  recipientId: string;
  communityId: string;
}) {
  const { actorId, recipientId, communityId } = input;
  if (actorId === recipientId) return;

  const record = await prisma.notification.upsert({
    where: {
      type_recipientId_targetKey: {
        type: NOTIFICATION_TYPE_GROUP_INVITE_ACCEPTED,
        recipientId,
        targetKey: `${communityId}:${actorId}`,
      },
    },
    create: {
      recipientId,
      actorId,
      type: NOTIFICATION_TYPE_GROUP_INVITE_ACCEPTED,
      targetKey: `${communityId}:${actorId}`,
      communityId,
      postId: null,
      commentId: null,
      isRead: false,
    },
    update: {
      actorId,
      communityId,
      postId: null,
      commentId: null,
      isRead: false,
      createdAt: new Date(),
    },
  });

  await dispatchPushForNotificationIds([record.id]);
}

export async function createFollowedUserPostNotifications(input: {
  actorId: string;
  postId: string;
}) {
  const { actorId, postId } = input;

  const followerRows = await prisma.connection.findMany({
    where: { followingId: actorId },
    select: { followerId: true },
  });

  if (followerRows.length === 0) {
    return;
  }

  const followerIds = followerRows.map((row) => row.followerId);

  const writes = followerIds.map((recipientId) =>
    prisma.notification.upsert({
      where: {
        type_recipientId_targetKey: {
          type: NOTIFICATION_TYPE_FOLLOWED_USER_NEW_POST,
          recipientId,
          targetKey: postId,
        },
      },
      create: {
        recipientId,
        actorId,
        type: NOTIFICATION_TYPE_FOLLOWED_USER_NEW_POST,
        targetKey: postId,
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
    })
  );

  const records = await prisma.$transaction(writes);
  await dispatchPushForNotificationIds(records.map((record) => record.id));
}
