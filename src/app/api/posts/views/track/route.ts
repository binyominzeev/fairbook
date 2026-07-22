import { canViewerAccessCommunity } from "@/lib/community-visibility";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type TrackSource = "profile_card" | "feed_card" | "post_detail";

type Payload = {
  postIds?: unknown;
  source?: unknown;
};

const MAX_POST_IDS = 40;

function sanitizePostIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const deduped = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    deduped.add(trimmed.slice(0, 64));
    if (deduped.size >= MAX_POST_IDS) break;
  }

  return Array.from(deduped);
}

function sanitizeSource(value: unknown): TrackSource | null {
  if (value === "profile_card" || value === "feed_card" || value === "post_detail") {
    return value;
  }

  return null;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as Payload;
  const source = sanitizeSource(payload.source);
  const requestedPostIds = sanitizePostIds(payload.postIds);

  if (!source) {
    return Response.json({ error: "Invalid source." }, { status: 400 });
  }

  if (requestedPostIds.length === 0) {
    return Response.json({ ok: true, tracked: 0 });
  }

  const posts = await prisma.post.findMany({
    where: { id: { in: requestedPostIds } },
    select: {
      id: true,
      authorId: true,
      moderationStatus: true,
      community: {
        select: {
          isPrivate: true,
          members: {
            where: { userId: session.userId },
            select: { role: true },
            take: 1,
          },
        },
      },
    },
  });

  const trackablePostIds = posts
    .filter((post) => {
      if (post.authorId === session.userId) {
        return false;
      }

      if (post.moderationStatus === "author_only") {
        return false;
      }

      return canViewerAccessCommunity(post.community);
    })
    .map((post) => post.id);

  if (trackablePostIds.length === 0) {
    return Response.json({ ok: true, tracked: 0 });
  }

  await prisma.$transaction(
    trackablePostIds.map((postId) =>
      prisma.postUniqueView.upsert({
        where: {
          postId_viewerId: {
            postId,
            viewerId: session.userId,
          },
        },
        create: {
          postId,
          viewerId: session.userId,
        },
        update: {},
      })
    )
  );

  return Response.json({ ok: true, tracked: trackablePostIds.length, source });
}
