import { getSession } from "@/lib/auth";
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
    take: 31,
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
        },
      },
      comment: { select: { id: true, content: true } },
    },
  });

  const hasMore = notifications.length > 30;
  const pageItems = hasMore ? notifications.slice(0, 30) : notifications;
  const nextCursor = hasMore ? pageItems[pageItems.length - 1]?.id ?? null : null;

  return Response.json({
    notifications: pageItems.map((item) => ({
      ...item,
      post: {
        ...item.post,
        permalinkPath: buildPostPermalinkPath({
          author: item.post.author,
          createdAt: item.post.createdAt,
          slug: item.post.permalinkSlug,
          postId: item.post.id,
        }),
        previewText: item.post.sharedTitle ?? item.post.content,
        targetPath: `${buildPostPermalinkPath({
          author: item.post.author,
          createdAt: item.post.createdAt,
          slug: item.post.permalinkSlug,
          postId: item.post.id,
        })}${item.comment?.id ? `#comment-${item.comment.id}` : ""}`,
      },
    })),
    nextCursor,
  });
}
