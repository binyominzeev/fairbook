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
import { applyAuthorTopicColors } from "@/lib/topic-color-resolution";

export const FEED_PAGE_SIZE = 20;
const OWN_POST_PENALTY = 14;
const REPEATED_AUTHOR_PENALTY = 7;
const REPEATED_SOURCE_PENALTY = 6;
const FOLLOWED_AUTHOR_BONUS = 22;
const PAGE_AUTHOR_PENALTY = 4;
const OVERREPRESENTED_RSS_PENALTY = 11;
const OVERREPRESENTED_LOCAL_PENALTY = 8;
const RERANK_JITTER_RANGE = 7;
const RECENCY_MAX_HOURS = 72;

export type FeedViewMode = "all" | "following" | "group" | "bookmarks";

type FeedPostRecord = Prisma.PostGetPayload<{
  include: ReturnType<typeof buildPostInclude>;
}>;

function seededNormalizedValue(seed: string) {
  const digest = createHash("sha256").update(seed).digest();
  const value = digest.readUInt32BE(0);
  return value / 0xffffffff;
}

function rerankMixedFeedPage(
  posts: FeedPostRecord[],
  viewerId: string,
  followedAuthorIds: Set<string>
) {
  const now = Date.now();
  const remaining = [...posts];
  const ordered: FeedPostRecord[] = [];
  const repeatedAuthorCounts = new Map<string, number>();
  const repeatedSourceCounts = new Map<string, number>();
  let selectedRssCount = 0;

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const [index, post] of remaining.entries()) {
      const sourceKey = post.feedSourceId ? `rss:${post.feedSourceId}` : `local:${post.authorId}`;
      const repeatAuthorCount = repeatedAuthorCounts.get(post.authorId) ?? 0;
      const repeatSourceCount = repeatedSourceCounts.get(sourceKey) ?? 0;
      const ownPenalty = post.authorId === viewerId ? OWN_POST_PENALTY : 0;
      const authorRepeatPenalty = repeatAuthorCount * REPEATED_AUTHOR_PENALTY;
      const sourceRepeatPenalty = repeatSourceCount * REPEATED_SOURCE_PENALTY;
      const followedBonus =
        post.authorId !== viewerId && followedAuthorIds.has(post.authorId)
          ? FOLLOWED_AUTHOR_BONUS
          : 0;
      const pagePenalty = post.author.isPage ? PAGE_AUTHOR_PENALTY : 0;
      const recencyAnchor = post.feedSourceId ? post.fetchedAt : post.createdAt;
      const ageHours = Math.max(0, (now - recencyAnchor.getTime()) / 3_600_000);
      const recencyBoost = Math.max(0, RECENCY_MAX_HOURS - ageHours) * 0.35;
      const engagementBoost = Math.min(
        22,
        post._count.likes * 1.8 + post._count.comments * 2.4 + post._count.sharedBy * 2.0
      );
      const baseScore = (post.score ?? 0) * 0.5;
      const selectedCount = ordered.length;
      const rssShare = selectedCount > 0 ? selectedRssCount / selectedCount : 0;
      const isRssPost = Boolean(post.feedSourceId);
      const balancePenalty =
        isRssPost && rssShare > 0.55
          ? OVERREPRESENTED_RSS_PENALTY * (rssShare - 0.55)
          : !isRssPost && rssShare < 0.35
            ? OVERREPRESENTED_LOCAL_PENALTY * (0.35 - rssShare)
            : 0;
      const jitter =
        (seededNormalizedValue(`${viewerId}:${post.id}`) * 2 - 1) * RERANK_JITTER_RANGE;
      const adjustedScore =
        baseScore +
        recencyBoost +
        engagementBoost +
        followedBonus +
        jitter -
        ownPenalty -
        authorRepeatPenalty -
        sourceRepeatPenalty -
        pagePenalty -
        balancePenalty;

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
    repeatedAuthorCounts.set(selected.authorId, (repeatedAuthorCounts.get(selected.authorId) ?? 0) + 1);
    const selectedSourceKey = selected.feedSourceId
      ? `rss:${selected.feedSourceId}`
      : `local:${selected.authorId}`;
    repeatedSourceCounts.set(selectedSourceKey, (repeatedSourceCounts.get(selectedSourceKey) ?? 0) + 1);
    if (selected.feedSourceId) {
      selectedRssCount += 1;
    }
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
  topicId,
}: {
  viewerId: string;
  hideViolentFeed: boolean;
  cursor?: string | null;
  viewMode?: FeedViewMode;
  feedSourceIds?: string[];
  query?: string;
  topicId?: string;
}): Promise<{ posts: SerializedPost[]; nextCursor: string | null }> {
  const trimmedQuery = query?.trim() ?? "";
  const groupFeedSourceIds = Array.from(
    new Set((feedSourceIds ?? []).filter((value) => typeof value === "string" && value.trim().length > 0))
  );

  if (viewMode === "bookmarks") {
    const batch = await prisma.bookmarkedPost.findMany({
      where: {
        userId: viewerId,
        post: {
          AND: [
            ...(trimmedQuery
              ? [
                  {
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
                  },
                ]
              : []),
            ...(topicId ? [{ topicId }] : []),
          ],
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: FEED_PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        post: {
          include: buildPostInclude(viewerId),
        },
      },
    });

    const hasMore = batch.length > FEED_PAGE_SIZE;
    const items = hasMore ? batch.slice(0, FEED_PAGE_SIZE) : batch;
    const serialized = items.map((bookmark) => serializePost(bookmark.post as FeedPostRecord));
    const withTopicColors = await applyAuthorTopicColors(serialized);

    const postIds = withTopicColors.map((post) => post.id);
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
            author: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        })
      : [];
    const previewsByPostId = new Map<string, SerializedCommentPreview[]>();
    for (const row of previewRows) {
      const current = previewsByPostId.get(row.postId) ?? [];
      if (current.length >= 3) continue;
      current.push({
        id: row.id,
        content: row.content,
        createdAt: row.createdAt.toISOString(),
        author: {
          id: row.author.id,
          name: row.author.name,
          avatarUrl: row.author.avatarUrl,
        },
      });
      previewsByPostId.set(row.postId, current);
    }

    return {
      posts: withTopicColors.map((post) => ({
        ...post,
        commentPreviews: previewsByPostId.get(post.id) ?? [],
      })),
      nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
    };
  }

  const orderBy: Prisma.PostOrderByWithRelationInput[] = [
    { score: "desc" },
    { createdAt: "desc" },
    { id: "desc" },
  ];
  const topicWhere: Prisma.PostWhereInput | null = topicId
    ? {
        topicId,
      }
    : null;
  if (viewMode === "group" && groupFeedSourceIds.length === 0) {
    return { posts: [], nextCursor: null };
  }

  const following = await prisma.connection.findMany({
    where: {
      followerId: viewerId,
    },
    select: {
      followingId: true,
      following: {
        select: {
          isPage: true,
        },
      },
    },
  });
  const joinedCommunityMemberships = await prisma.communityMember.findMany({
    where: { userId: viewerId },
    select: { communityId: true },
  });
  const joinedCommunityIds = joinedCommunityMemberships.map((row) => row.communityId);
  const followingIds = following.map((connection) => connection.followingId);
  const followingUserIds = following
    .filter((connection) => !connection.following.isPage)
    .map((connection) => connection.followingId);
  const followedAuthorIds = new Set(followingIds);

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

  const allFeedWhere: Prisma.PostWhereInput = {
    AND: [
      ...(queryWhere ? [queryWhere] : []),
      ...(topicWhere ? [topicWhere] : []),
      joinedCommunityIds.length > 0
        ? { OR: [{ communityId: null }, { communityId: { in: joinedCommunityIds } }] }
        : { communityId: null },
      {
        OR: [
          { AND: [{ authorId: viewerId }, { feedSourceId: null }] },
          {
            AND: [
              { moderationStatus: "visible" },
              { feedSourceId: null },
            ],
          },
          {
            AND: [
              { moderationStatus: "visible" },
              { feedSourceId: { not: null } },
              { isFeedVisible: true },
            ],
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
  const followingFeedWhere: Prisma.PostWhereInput = {
    AND: [
      ...(queryWhere ? [queryWhere] : []),
      ...(topicWhere ? [topicWhere] : []),
      joinedCommunityIds.length > 0
        ? { OR: [{ communityId: null }, { communityId: { in: joinedCommunityIds } }] }
        : { communityId: null },
      {
        OR: [
          { AND: [{ authorId: viewerId }, { feedSourceId: null }] },
          {
            AND: [
              { moderationStatus: "visible" },
              { feedSourceId: null },
              { authorId: { in: followingUserIds } },
            ],
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
      ...(topicWhere ? [topicWhere] : []),
      joinedCommunityIds.length > 0
        ? { OR: [{ communityId: null }, { communityId: { in: joinedCommunityIds } }] }
        : { communityId: null },
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
        viewMode === "group"
          ? groupedFeedWhere
          : viewMode === "following"
            ? followingFeedWhere
            : allFeedWhere,
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
    viewMode === "all"
      ? rerankMixedFeedPage(items, viewerId, followedAuthorIds)
      : cursor || viewMode === "group"
      ? items
      : rerankMixedFeedPage(items, viewerId, followedAuthorIds);

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
          author: { select: { id: true, slug: true, name: true, avatarUrl: true, isPage: true } },
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

  const serializedPosts = orderedItems.map((post) => ({
    ...serializePost(post),
    authorIsFollowedByCurrentUser:
      post.authorId === viewerId || (!post.author.isPage && followedAuthorIds.has(post.authorId)),
    commentPreviews: previewsByPostId.get(post.id) ?? [],
  }));

  return {
    posts: await applyAuthorTopicColors(serializedPosts),
    nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
  };
}