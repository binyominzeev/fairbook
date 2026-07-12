import Navbar from "@/components/Navbar";
import NotificationsPanel from "@/components/NotificationsPanel";
import { getSession } from "@/lib/auth";
import { partitionNotificationsByVisibility } from "@/lib/notification-visibility";
import { buildPostPermalinkPath } from "@/lib/post-permalink";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function NotificationsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, slug: true, name: true, avatarUrl: true },
  });
  if (!user) redirect("/login");

  const rows = await prisma.notification.findMany({
    where: { recipientId: session.userId },
    orderBy: [{ createdAt: "desc" }],
    take: 81,
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

  const rowsWithRecipient = rows.map((item) => ({
    ...item,
    recipientId: session.userId,
  }));

  const { visibleItems: visibleRows, staleNotificationIds } =
    await partitionNotificationsByVisibility(rowsWithRecipient, async (ids) => {
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

  const hasMoreVisible = visibleRows.length > 30;
  const hasMoreRaw = rows.length > 80;
  const pageRows = hasMoreVisible ? visibleRows.slice(0, 30) : visibleRows;
  const initialItems = pageRows.map((item) => ({
    ...item,
    createdAt: item.createdAt.toISOString(),
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
  }));

  const initialNextCursor = hasMoreVisible
    ? initialItems[initialItems.length - 1]?.id ?? null
    : hasMoreRaw
      ? rows[rows.length - 1]?.id ?? null
      : null;

  return (
    <>
      <Navbar user={user} />
      <div className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-4 text-lg font-semibold text-slate-900">Notifications</h1>
        <NotificationsPanel
          initialNotifications={initialItems}
          initialNextCursor={initialNextCursor}
        />
      </div>
    </>
  );
}
