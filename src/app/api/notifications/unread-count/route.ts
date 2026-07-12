import { getSession } from "@/lib/auth";
import { partitionNotificationsByVisibility } from "@/lib/notification-visibility";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const rows = await prisma.notification.findMany({
    where: {
      recipientId: session.userId,
      isRead: false,
    },
    select: {
      id: true,
      recipientId: true,
      commentId: true,
      post: {
        select: {
          community: {
            select: {
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
      comment: {
        select: {
          id: true,
          parentId: true,
          authorId: true,
          moderationStatus: true,
        },
      },
    },
  });

  const { visibleItems, staleNotificationIds } = await partitionNotificationsByVisibility(
    rows,
    async (ids) => {
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
    }
  );

  if (staleNotificationIds.length > 0) {
    await prisma.notification.deleteMany({
      where: {
        recipientId: session.userId,
        id: { in: staleNotificationIds },
      },
    });
  }

  return Response.json({ unreadCount: visibleItems.length });
}
