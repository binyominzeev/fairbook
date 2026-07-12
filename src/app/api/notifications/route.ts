import { getSession } from "@/lib/auth";
import { partitionNotificationsByVisibility } from "@/lib/notification-visibility";
import { buildPostPermalinkPath } from "@/lib/post-permalink";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");

  const notifications = await prisma.notification.findMany({
    where: { recipientId: session.userId },
    orderBy: [{ createdAt: "desc" }],
    take: 81,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      actor: { select: { id: true, slug: true, name: true, avatarUrl: true } },
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
              isPrivate: true,
              members: {
                where: { userId: session.userId },
                select: { id: true },
                take: 1,
              },
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
          parentId: true,
          authorId: true,
          moderationStatus: true,
        },
      },
    },
  });

  const notificationsWithRecipient = notifications.map((item) => ({
    ...item,
    recipientId: session.userId,
  }));

  const { visibleItems: visibleNotifications, staleNotificationIds } =
    await partitionNotificationsByVisibility(notificationsWithRecipient, async (ids) => {
      if (ids.length === 0) return [];
      return prisma.comment.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          parentId: true,
          authorId: true,
          moderationStatus: true,
        },
      });
    });

  if (staleNotificationIds.length > 0) {
    await prisma.notification.deleteMany({
      where: {
        recipientId: session.userId,
        id: { in: staleNotificationIds },
      },
    });
  }

  const hasMoreVisible = visibleNotifications.length > 30;
  const hasMoreRaw = notifications.length > 80;
  const pageItems = hasMoreVisible
    ? visibleNotifications.slice(0, 30)
    : visibleNotifications;
  const nextCursor = hasMoreVisible
    ? pageItems[pageItems.length - 1]?.id ?? null
    : hasMoreRaw
      ? notifications[notifications.length - 1]?.id ?? null
      : null;

  return Response.json({
    notifications: pageItems.map((item) => ({
      ...item,
      post: item.post
        ? {
            ...item.post,
            permalinkPath: buildPostPermalinkPath({
              author: item.post.author,
              community: item.post.community,
              createdAt: item.post.createdAt,
              slug: item.post.permalinkSlug,
              postId: item.post.id,
            }),
            previewText: item.post.sharedTitle ?? item.post.content,
            targetPath: `${buildPostPermalinkPath({
              author: item.post.author,
              community: item.post.community,
              createdAt: item.post.createdAt,
              slug: item.post.permalinkSlug,
              postId: item.post.id,
            })}${item.comment?.id ? `#comment-${item.comment.id}` : ""}`,
          }
        : null,
      community: item.community
        ? {
            ...item.community,
            targetPath: `/groups/${item.community.permalinkSlug ?? item.community.id}`,
          }
        : null,
    })),
    nextCursor,
  });
}
