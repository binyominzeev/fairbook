import webpush from "web-push";
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
import { buildPostPermalinkPath } from "@/lib/post-permalink";

let vapidConfigured = false;

function ensureVapidConfig() {
  if (vapidConfigured) return true;

  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    return false;
  }

  const contact = process.env.EMAIL_FROM || "noreply@fairbook.local";
  const subject = contact.startsWith("mailto:") ? contact : `mailto:${contact}`;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

type NotificationRow = {
  id: string;
  recipientId: string;
  type: string;
  actor: {
    name: string;
  };
  post: {
    id: string;
    permalinkSlug: string | null;
    createdAt: Date;
    content: string | null;
    sharedTitle: string | null;
    author: {
      id: string;
      slug: string | null;
    };
    community: {
      id: string;
      permalinkSlug: string | null;
    } | null;
  } | null;
  community: {
    id: string;
    permalinkSlug: string | null;
    name: string;
  } | null;
  comment: {
    id: string;
    content: string;
  } | null;
};

type PushPayload = {
  title: string;
  body: string;
  url: string;
  notificationId: string;
  type: string;
};

function toNotificationBody(item: NotificationRow): string {
  const actor = item.actor.name;

  if (item.type === NOTIFICATION_TYPE_REPLY) {
    return `${actor} replied to your comment`;
  }

  if (item.type === NOTIFICATION_TYPE_FOLLOWED_COMMENT) {
    return `${actor} commented on a post`;
  }

  if (item.type === NOTIFICATION_TYPE_POST_SUBSCRIBED_COMMENT) {
    return `${actor} commented on a post you follow`;
  }

  if (item.type === NOTIFICATION_TYPE_POST_LIKE) {
    return `${actor} liked your post`;
  }

  if (item.type === NOTIFICATION_TYPE_COMMENT_LIKE) {
    return `${actor} liked your comment`;
  }

  if (item.type === NOTIFICATION_TYPE_GROUP_INVITE) {
    return `${actor} invited you to a group`;
  }

  if (item.type === NOTIFICATION_TYPE_GROUP_NEW_POST) {
    return `${actor} posted in your group`;
  }

  if (item.type === NOTIFICATION_TYPE_GROUP_JOIN_REQUEST) {
    return `${actor} requested to join your group`;
  }

  if (item.type === NOTIFICATION_TYPE_GROUP_JOIN_APPROVED) {
    return `${actor} approved your join request`;
  }

  if (item.type === NOTIFICATION_TYPE_GROUP_INVITE_ACCEPTED) {
    return `${actor} accepted your group invite`;
  }

  if (item.type === NOTIFICATION_TYPE_FOLLOWED_USER_NEW_POST) {
    return `${actor} posted something new`;
  }

  return `${actor} sent an update`;
}

function toNotificationContext(item: NotificationRow): string {
  if (item.type === NOTIFICATION_TYPE_POST_LIKE) {
    return item.post?.sharedTitle?.trim() || item.post?.content?.trim() || "Open notification";
  }

  if (item.type === NOTIFICATION_TYPE_COMMENT_LIKE || item.type === NOTIFICATION_TYPE_REPLY) {
    return item.comment?.content?.trim() || "Open notification";
  }

  if (
    item.type === NOTIFICATION_TYPE_FOLLOWED_COMMENT ||
    item.type === NOTIFICATION_TYPE_POST_SUBSCRIBED_COMMENT
  ) {
    return item.comment?.content?.trim() || item.post?.sharedTitle?.trim() || item.post?.content?.trim() || "Open notification";
  }

  if (item.type === NOTIFICATION_TYPE_GROUP_INVITE || item.type === NOTIFICATION_TYPE_GROUP_JOIN_REQUEST) {
    return item.community?.name ? `Group: ${item.community.name}` : "Open notification";
  }

  if (
    item.type === NOTIFICATION_TYPE_GROUP_JOIN_APPROVED ||
    item.type === NOTIFICATION_TYPE_GROUP_INVITE_ACCEPTED ||
    item.type === NOTIFICATION_TYPE_GROUP_NEW_POST
  ) {
    return item.post?.sharedTitle?.trim() || item.post?.content?.trim() || item.community?.name || "Open notification";
  }

  if (item.type === NOTIFICATION_TYPE_FOLLOWED_USER_NEW_POST) {
    return item.post?.sharedTitle?.trim() || item.post?.content?.trim() || "Open post";
  }

  return "Open notification";
}

function resolveTargetPath(item: NotificationRow): string {
  if (item.post) {
    const permalink = buildPostPermalinkPath({
      author: item.post.author,
      community: item.post.community,
      createdAt: item.post.createdAt,
      slug: item.post.permalinkSlug,
      postId: item.post.id,
    });

    return item.comment?.id ? `${permalink}#comment-${item.comment.id}` : permalink;
  }

  if (item.community) {
    return `/groups/${item.community.permalinkSlug ?? item.community.id}`;
  }

  return "/notifications";
}

function buildPayload(item: NotificationRow): PushPayload {
  return {
    title: "fairbook",
    body: `${toNotificationBody(item)}\n${toNotificationContext(item)}`,
    url: resolveTargetPath(item),
    notificationId: item.id,
    type: item.type,
  };
}

export async function dispatchPushForNotificationIds(notificationIds: string[]) {
  if (notificationIds.length === 0) {
    return;
  }

  if (!ensureVapidConfig()) {
    return;
  }

  try {
    const notifications = await prisma.notification.findMany({
      where: { id: { in: notificationIds } },
      include: {
        actor: { select: { name: true } },
        post: {
          select: {
            id: true,
            permalinkSlug: true,
            createdAt: true,
            content: true,
            sharedTitle: true,
            author: { select: { id: true, slug: true } },
            community: {
              select: {
                id: true,
                permalinkSlug: true,
              },
            },
          },
        },
        community: {
          select: {
            id: true,
            permalinkSlug: true,
            name: true,
          },
        },
        comment: {
          select: {
            id: true,
            content: true,
          },
        },
      },
    });

    if (notifications.length === 0) {
      return;
    }

    const recipientIds = [...new Set(notifications.map((item) => item.recipientId))];
    const disabledPreferenceRows = await prisma.pushNotificationPreference.findMany({
      where: {
        userId: { in: recipientIds },
        type: { in: [...new Set(notifications.map((item) => item.type))] },
        isEnabled: false,
      },
      select: {
        userId: true,
        type: true,
      },
    });

    const disabledPreferenceSet = new Set(
      disabledPreferenceRows.map((row) => `${row.userId}::${row.type}`)
    );

    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        userId: { in: recipientIds },
        isActive: true,
      },
      select: {
        endpoint: true,
        p256dh: true,
        auth: true,
        userId: true,
      },
    });

    if (subscriptions.length === 0) {
      return;
    }

    const subscriptionsByUser = new Map<string, typeof subscriptions>();
    for (const subscription of subscriptions) {
      const current = subscriptionsByUser.get(subscription.userId) ?? [];
      current.push(subscription);
      subscriptionsByUser.set(subscription.userId, current);
    }

    const staleEndpoints = new Set<string>();

    for (const notification of notifications) {
      if (disabledPreferenceSet.has(`${notification.recipientId}::${notification.type}`)) {
        continue;
      }

      const recipientSubscriptions = subscriptionsByUser.get(notification.recipientId) ?? [];
      if (recipientSubscriptions.length === 0) {
        continue;
      }

      const payload = JSON.stringify(buildPayload(notification));

      for (const subscription of recipientSubscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
              },
            },
            payload,
            { TTL: 60 }
          );
        } catch (error) {
          const statusCode =
            typeof error === "object" && error && "statusCode" in error
              ? Number((error as { statusCode?: number }).statusCode)
              : 0;

          if (statusCode === 404 || statusCode === 410) {
            staleEndpoints.add(subscription.endpoint);
          }
        }
      }
    }

    if (staleEndpoints.size > 0) {
      await prisma.pushSubscription.updateMany({
        where: {
          endpoint: { in: [...staleEndpoints] },
        },
        data: {
          isActive: false,
        },
      });
    }
  } catch {
    // Keep notification delivery resilient even when push send fails.
  }
}
