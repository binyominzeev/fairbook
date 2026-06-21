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

export type FeedViewMode = "all" | "following";

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
  viewMode = "all",
}: {
  viewerId: string;
  hideViolentFeed: boolean;
  cursor?: string | null;
  viewMode?: FeedViewMode;
}): Promise<{ posts: SerializedPost[]; nextCursor: string | null }> {
  const following = await prisma.connection.findMany({
    where: {
      followerId: viewerId,
      ...(viewMode === "following" ? { following: { isPage: false } } : {}),
    },
    select: { followingId: true },
  });
  const authorIds =
    viewMode === "following"
      ? following.map((connection) => connection.followingId)
      : [viewerId, ...following.map((connection) => connection.followingId)];
  const postInclude = buildPostInclude(viewerId);

  const chunkSize = hideViolentFeed ? 60 : FEED_PAGE_SIZE + 1;
  const collected: FeedPostRecord[] = [];
  let nextDbCursor = cursor ?? null;
  let exhausted = false;

  while (collected.length < FEED_PAGE_SIZE + 1 && !exhausted) {
    const batch = (await prisma.post.findMany({
      where: {
        AND: [
          { authorId: { in: authorIds } },
          ...(viewMode === "following"
            ? [{ moderationStatus: "visible" }]
            : [
                {
                  OR: [{ authorId: viewerId }, { moderationStatus: "visible" }],
                },
              ]),
          ...(viewMode === "following"
            ? [{ feedSourceId: null }]
            : [
                {
                  OR: [{ feedSourceId: null }, { isFeedVisible: true }],
                },
              ]),
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

  return {
    posts: orderedItems.map(serializePost),
    nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
  };
}