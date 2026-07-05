import { createHash } from "crypto";
import { Prisma } from "@/generated/prisma/client";
import { filterViolentFeedPostsForUser } from "@/lib/feed-content-filter";
import {
  buildPostInclude,
  serializePost,
  type SerializedCommentPreview,
  type SerializedPost,
} from "@/lib/post-presentation";
import { prisma } from "@/lib/prisma";

export const FEED_PAGE_SIZE = 20;
const OWN_POST_PENALTY = 18;
const REPEATED_AUTHOR_PENALTY = 6;
const RERANK_JITTER_RANGE = 8;

export type FeedViewMode = "all" | "following" | "group";
export type FeedSortMode = "current" | "normal" | "weighted" | "likes" | "comments" | "time";

const DEFAULT_FEED_SORT_MODE: FeedSortMode = "current";

type FeedPostRecord = Prisma.PostGetPayload<{
  include: ReturnType<typeof buildPostInclude>;
}>;

function seededNormalizedValue(seed: string) {
  const digest = createHash("sha256").update(seed).digest();
  const value = digest.readUInt32BE(0);
  return value / 0xffffffff;
}

export function normalizeFeedSortMode(value: string | null | undefined): FeedSortMode {
  if (
    value === "normal" ||
    value === "weighted" ||
    value === "likes" ||
    value === "comments" ||
    value === "time"
  ) {
    return value;
  }

  return DEFAULT_FEED_SORT_MODE;
}

function buildFeedOrderBy(sortMode: FeedSortMode): Prisma.PostOrderByWithRelationInput[] {
  switch (sortMode) {
    case "normal":
      return [{ score: "desc" }, { createdAt: "desc" }, { id: "desc" }];
    case "weighted":
      return [
        { score: "desc" },
        { engagementScore: "desc" },
        { freshnessScore: "desc" },
        { createdAt: "desc" },
        { id: "desc" },
      ];
    case "likes":
      return [{ likes: { _count: "desc" } }, { createdAt: "desc" }, { id: "desc" }];
    case "comments":
      return [{ comments: { _count: "desc" } }, { createdAt: "desc" }, { id: "desc" }];
    case "time":
      return [{ createdAt: "desc" }, { id: "desc" }];
    case "current":
    default:
      return [{ score: "desc" }, { createdAt: "desc" }, { id: "desc" }];
  }
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
  feedSourceIds,
  query,
  sortMode = DEFAULT_FEED_SORT_MODE,
}: {
  viewerId: string;
  hideViolentFeed: boolean;
  cursor?: string | null;
  viewMode?: FeedViewMode;
  feedSourceIds?: string[];
  query?: string;
  sortMode?: FeedSortMode;
}): Promise<{ posts: SerializedPost[]; nextCursor: string | null }> {
  const trimmedQuery = query?.trim() ?? "";
  const groupFeedSourceIds = Array.from(
    new Set((feedSourceIds ?? []).filter((value) => typeof value === "string" && value.trim().length > 0))
  );

  const orderBy = buildFeedOrderBy(sortMode);
  if (viewMode === "group" && groupFeedSourceIds.length === 0) {
    return { posts: [], nextCursor: null };
  }

  const following =
    viewMode === "group"
      ? []
      : await prisma.connection.findMany({
          where: {
            followerId: viewerId,
            ...(viewMode === "following" ? { following: { isPage: false } } : {}),
          },
          select: { followingId: true },
        });
  const followingIds = following.map((connection) => connection.followingId);
  const authorIds = viewMode === "following" ? followingIds : [viewerId, ...followingIds];

  if (viewMode === "following" && followingIds.length === 0) {
    return { posts: [], nextCursor: null };
  }

  const queryWhere: Prisma.PostWhereInput | null = trimmedQuery
    ? {
        OR: [
          { content: { contains: trimmedQuery } },
          { sharedTitle: { contains: trimmedQuery } },
          { sharedDescription: { contains: trimmedQuery } },
          { sharedSource: { contains: trimmedQuery } },
          { author: { name: { contains: trimmedQuery } } },
          {
            postTags: {
              some: {
                tag: {
                  name: { contains: trimmedQuery },
                },
              },
            },
          },
        ],
      }
    : null;

  const followingWhere: Prisma.PostWhereInput = {
    AND: [
      ...(queryWhere ? [queryWhere] : []),
      {
        OR: [
          {
            authorId: { in: authorIds },
            feedSourceId: null,
            moderationStatus: "visible",
          },
          {
            feedSourceId: { not: null },
            isFeedVisible: true,
            moderationStatus: "visible",
            comments: {
              some: {
                authorId: { in: followingIds },
                moderationStatus: "visible",
              },
            },
          },
        ],
      },
      {
        hiddenBy: {
          none: {
            userId: viewerId,
          },
        },
      },
    ],
  };
  const groupedFeedWhere: Prisma.PostWhereInput = {
    AND: [
      ...(queryWhere ? [queryWhere] : []),
      {
        feedSourceId: { in: groupFeedSourceIds },
        isFeedVisible: true,
        moderationStatus: "visible",
      },
      {
        hiddenBy: {
          none: {
            userId: viewerId,
          },
        },
      },
    ],
  };
  const postInclude = buildPostInclude(viewerId);

  const chunkSize = hideViolentFeed ? 60 : FEED_PAGE_SIZE + 1;
  const collected: FeedPostRecord[] = [];
  let nextDbCursor = cursor ?? null;
  let exhausted = false;

  while (collected.length < FEED_PAGE_SIZE + 1 && !exhausted) {
    const batch = (await prisma.post.findMany({
      where:
        viewMode === "following"
          ? followingWhere
          : viewMode === "group"
            ? groupedFeedWhere
          : {
              AND: [
                ...(queryWhere ? [queryWhere] : []),
                { authorId: { in: authorIds } },
                {
                  OR: [{ authorId: viewerId }, { moderationStatus: "visible" }],
                },
                {
                  OR: [{ feedSourceId: null }, { isFeedVisible: true }],
                },
                {
                  hiddenBy: {
                    none: {
                      userId: viewerId,
                    },
                  },
                },
              ],
            },
          orderBy,
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
  const orderedItems =
    cursor || viewMode === "group" || sortMode !== "current"
      ? items
      : rerankFirstFeedPage(items, viewerId);

  const postIds = orderedItems.map((post) => post.id);
  const previewRows = postIds.length
    ? await prisma.comment.findMany({
        where: {
          postId: { in: postIds },
          moderationStatus: "visible",
          parentId: null,
        },
        orderBy: { createdAt: "desc" },
        take: FEED_PAGE_SIZE * 12,
        include: {
          author: { select: { id: true, slug: true, name: true, avatarUrl: true } },
        },
      })
    : [];

  const previewsByPostId = new Map<string, SerializedCommentPreview[]>();
  for (const row of previewRows) {
    const bucket = previewsByPostId.get(row.postId) ?? [];
    if (bucket.length >= 3) continue;
    bucket.push({
      id: row.id,
      content: row.content,
      createdAt: row.createdAt.toISOString(),
      author: row.author,
    });
    previewsByPostId.set(row.postId, bucket);
  }

  return {
    posts: orderedItems.map((post) => ({
      ...serializePost(post),
      commentPreviews: previewsByPostId.get(post.id) ?? [],
    })),
    nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
  };
}