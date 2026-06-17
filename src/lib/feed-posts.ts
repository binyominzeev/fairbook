import { createHash } from "crypto";
import { Prisma } from "@/generated/prisma/client";
import { filterViolentFeedPostsForUser } from "@/lib/feed-content-filter";
import {
  buildPostInclude,
  serializePost,
  type SerializedPost,
} from "@/lib/post-presentation";
import { prisma } from "@/lib/prisma";

export const FEED_PAGE_SIZE = 20;
const OWN_POST_PENALTY = 18;
const REPEATED_AUTHOR_PENALTY = 6;
const RERANK_JITTER_RANGE = 8;

type FeedPostRecord = Prisma.PostGetPayload<{
  include: ReturnType<typeof buildPostInclude>;
}>;

function seededNormalizedValue(seed: string) {
  const digest = createHash("sha256").update(seed).digest();
  const value = digest.readUInt32BE(0);
  return value / 0xffffffff;
}

function rerankFirstFeedPage(posts: FeedPostRecord[], viewerId: string) {
  const remaining = [...posts];
  const ordered: FeedPostRecord[] = [];
  const repeatedAuthorCounts = new Map<string, number>();

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const [index, post] of remaining.entries()) {
      const repeatCount = repeatedAuthorCounts.get(post.authorId) ?? 0;
      const ownPenalty = post.authorId === viewerId ? OWN_POST_PENALTY : 0;
      const repeatPenalty = repeatCount * REPEATED_AUTHOR_PENALTY;
      const jitter =
        (seededNormalizedValue(`${viewerId}:${post.id}`) * 2 - 1) * RERANK_JITTER_RANGE;
      const adjustedScore = (post.score ?? 0) - ownPenalty - repeatPenalty + jitter;

      if (adjustedScore > bestScore) {
        bestIndex = index;
        bestScore = adjustedScore;
        continue;
      }

      if (
        adjustedScore === bestScore &&
        post.createdAt.getTime() > remaining[bestIndex].createdAt.getTime()
      ) {
        bestIndex = index;
      }
    }

    const [selected] = remaining.splice(bestIndex, 1);
    ordered.push(selected);
    const post = selected;
    repeatedAuthorCounts.set(post.authorId, (repeatedAuthorCounts.get(post.authorId) ?? 0) + 1);
  }

  return ordered;
}

export async function getFeedPage({
  viewerId,
  hideViolentFeed,
  cursor,
}: {
  viewerId: string;
  hideViolentFeed: boolean;
  cursor?: string | null;
}): Promise<{ posts: SerializedPost[]; nextCursor: string | null }> {
  const following = await prisma.connection.findMany({
    where: { followerId: viewerId },
    select: { followingId: true },
  });
  const authorIds = [viewerId, ...following.map((connection) => connection.followingId)];
  const postInclude = buildPostInclude(viewerId);

  // Load user's tag filter preferences
  const userPrefs = await prisma.user.findUnique({ where: { id: viewerId }, select: { tagFilterMode: true, tagFilterTags: true } });
  const filterMode = userPrefs?.tagFilterMode ?? null;
  const filterTagIds: string[] = userPrefs?.tagFilterTags ? JSON.parse(userPrefs.tagFilterTags) : [];

  const chunkSize = hideViolentFeed ? 60 : FEED_PAGE_SIZE + 1;
  const collected: FeedPostRecord[] = [];
  let nextDbCursor = cursor ?? null;
  let exhausted = false;

  while (collected.length < FEED_PAGE_SIZE + 1 && !exhausted) {
    const batch = (await prisma.post.findMany({
      where: {
        AND: [
          { authorId: { in: authorIds } },
          {
            OR: [{ authorId: viewerId }, { moderationStatus: "visible" }],
          },
          {
            OR: [{ feedSourceId: null }, { isFeedVisible: true }],
          },
        ],
      },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      include: postInclude,
      take: chunkSize,
      ...(nextDbCursor ? { cursor: { id: nextDbCursor }, skip: 1 } : {}),
    })) as FeedPostRecord[];

    if (batch.length < chunkSize) {
      exhausted = true;
    }

    if (batch.length === 0) {
      break;
    }

    collected.push(...filterViolentFeedPostsForUser(batch, hideViolentFeed));
    nextDbCursor = batch[batch.length - 1]?.id ?? null;
  }

  const hasMore = collected.length > FEED_PAGE_SIZE;
  const items = hasMore ? collected.slice(0, FEED_PAGE_SIZE) : collected;
  const orderedItems = cursor ? items : rerankFirstFeedPage(items, viewerId);

  // Apply user tag filtering (whitelist/blacklist) if configured
  let filteredOrdered = orderedItems;
  if (filterMode === "whitelist" && filterTagIds.length > 0) {
    filteredOrdered = orderedItems.filter((p) => p.postTags?.some((pt) => filterTagIds.includes(pt.tag.id)));
  } else if (filterMode === "blacklist" && filterTagIds.length > 0) {
    filteredOrdered = orderedItems.filter((p) => !p.postTags?.some((pt) => filterTagIds.includes(pt.tag.id)));
  }

  return {
    posts: filteredOrdered.map(serializePost),
    nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
  };
}