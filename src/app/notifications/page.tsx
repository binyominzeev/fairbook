import Navbar from "@/components/Navbar";
import NotificationsPanel from "@/components/NotificationsPanel";
import { getSession } from "@/lib/auth";
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
    take: 31,
    include: {
      actor: { select: { id: true, slug: true, name: true, avatarUrl: true } },
      post: {
        select: {
          id: true,
          permalinkSlug: true,
          createdAt: true,
          author: { select: { id: true, slug: true } },
        },
      },
      comment: { select: { id: true, content: true } },
    },
  });

  const hasMore = rows.length > 30;
  const initialItems = (hasMore ? rows.slice(0, 30) : rows).map((item) => ({
    ...item,
    createdAt: item.createdAt.toISOString(),
    post: {
      ...item.post,
      permalinkPath: buildPostPermalinkPath({
        author: item.post.author,
        createdAt: item.post.createdAt,
        slug: item.post.permalinkSlug,
        postId: item.post.id,
      }),
    },
  }));

  const initialNextCursor = hasMore ? initialItems[initialItems.length - 1]?.id ?? null : null;

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
