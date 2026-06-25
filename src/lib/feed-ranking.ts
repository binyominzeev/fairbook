import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

const MIN_VISIBLE_FEED_POSTS = 100;
const TARGET_VISIBLE_FEED_POSTS = 150;
const MIN_OPTIONAL_FEED_SCORE = 20;
const MIN_RECENT_POSTS_PER_FEED_TO_KEEP = 30;

export type FeedVisibilityFeedStat = {
  feedSourceId: string;
  feedTitle: string;
  totalCount: number;
  visibleCount: number;
  hiddenCount: number;
  deletedCount: number;
};

export type FeedVisibilityResult = {
  visibleCount: number;
  hiddenCount: number;
  deletedCount: number;
  feedStats: FeedVisibilityFeedStat[];
};

function roundScore(value: number) {
  return Math.round(value * 100) / 100;
}

export function normalizeUrl(input: string | null | undefined) {
  if (!input?.trim()) return null;

  try {
    const url = new URL(input.trim());
    url.hash = "";

    const removableParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "utm_id",
      "gclid",
      "fbclid",
      "mc_cid",
      "mc_eid",
      "ref",
    ];

    for (const key of removableParams) {
      url.searchParams.delete(key);
    }

    const queryEntries = [...url.searchParams.entries()].sort(([left], [right]) =>
      left.localeCompare(right)
    );
    url.search = "";
    for (const [key, value] of queryEntries) {
      url.searchParams.append(key, value);
    }

    if (url.pathname.endsWith("/") && url.pathname !== "/") {
      url.pathname = url.pathname.slice(0, -1);
    }

    return url.toString();
  } catch {
    return input.trim();
  }
}

export function hashFeedValue(input: string | null | undefined) {
  if (!input?.trim()) return null;
  return createHash("sha256").update(input.trim().toLowerCase()).digest("hex");
}

export function calculatePostScore(params: {
  createdAt: Date;
  freshnessDate?: Date;
  sourceWeight?: number | null;
  commentCount?: number;
}) {
  const freshnessDate = params.freshnessDate ?? params.createdAt;
  const ageMs = Date.now() - freshnessDate.getTime();
  const ageHours = Math.max(0, ageMs / (1000 * 60 * 60));

  const freshnessScore = roundScore(Math.max(0, 120 - ageHours * 2.5));
  const sourceScore = roundScore((params.sourceWeight ?? 1) * 20);
  const engagementScore = roundScore(Math.min((params.commentCount ?? 0) * 4, 40));
  const score = roundScore(freshnessScore + sourceScore + engagementScore);

  return {
    score,
    freshnessScore,
    sourceScore,
    engagementScore,
  };
}

async function loadPostScoreContext(postId: string) {
  const [post, visibleCommentCount] = await Promise.all([
    prisma.post.findUnique({
      where: { id: postId },
      include: {
        feedSource: { select: { sourceWeight: true } },
      },
    }),
    prisma.comment.count({
      where: { postId, moderationStatus: "visible" },
    }),
  ]);

  if (!post) return null;

  return {
    ...post,
    visibleCommentCount,
  };
}

export async function recomputePostScore(postId: string) {
  const post = await loadPostScoreContext(postId);
  if (!post) return null;

  const nextScore = calculatePostScore({
    createdAt: post.createdAt,
    freshnessDate: post.feedSourceId ? post.fetchedAt : post.createdAt,
    sourceWeight: post.feedSource?.sourceWeight,
    commentCount: post.visibleCommentCount,
  });

  return prisma.post.update({
    where: { id: postId },
    data: {
      ...nextScore,
      lastScoredAt: new Date(),
    },
  });
}

export async function recomputePostScores(postIds: string[]) {
  const uniqueIds = [...new Set(postIds)];
  for (const postId of uniqueIds) {
    await recomputePostScore(postId);
  }
}

export async function recomputePostsForFeedSource(feedSourceId: string) {
  const posts = await prisma.post.findMany({
    where: { feedSourceId },
    select: { id: true },
  });

  await recomputePostScores(posts.map((post) => post.id));
}

export async function recomputeAllPostScores() {
  const posts = await prisma.post.findMany({
    select: { id: true },
  });

  await recomputePostScores(posts.map((post) => post.id));
}

function summarizeFeedPostCounts(
  posts: Array<{ feedSourceId: string | null; isFeedVisible: boolean }>
) {
  const summary = new Map<string, { totalCount: number; visibleCount: number }>();

  for (const post of posts) {
    if (!post.feedSourceId) continue;

    const current = summary.get(post.feedSourceId) ?? {
      totalCount: 0,
      visibleCount: 0,
    };
    current.totalCount += 1;
    if (post.isFeedVisible) {
      current.visibleCount += 1;
    }
    summary.set(post.feedSourceId, current);
  }

  return summary;
}

export async function refreshVisibleFeedPosts(): Promise<FeedVisibilityResult> {
  const [feedSources, importedPosts, importedPostsByRecency, beforePosts] = await Promise.all([
    prisma.feedSource.findMany({
      select: { id: true, title: true },
    }),
    prisma.post.findMany({
      where: { feedSourceId: { not: null } },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      select: { id: true, score: true },
    }),
    prisma.post.findMany({
      where: { feedSourceId: { not: null } },
      orderBy: [
        { feedSourceId: "asc" },
        { fetchedAt: "desc" },
        { createdAt: "desc" },
      ],
      select: { id: true, feedSourceId: true },
    }),
    prisma.post.findMany({
      where: { feedSourceId: { not: null } },
      select: { feedSourceId: true, isFeedVisible: true },
    }),
  ]);

  const recentKeepIds: string[] = [];
  const feedKeptCount = new Map<string, number>();

  for (const post of importedPostsByRecency) {
    if (!post.feedSourceId) continue;

    const currentCount = feedKeptCount.get(post.feedSourceId) ?? 0;
    if (currentCount >= MIN_RECENT_POSTS_PER_FEED_TO_KEEP) {
      continue;
    }

    recentKeepIds.push(post.id);
    feedKeptCount.set(post.feedSourceId, currentCount + 1);
  }

  const rankedVisibleIds = importedPosts
    .filter((post, index) => {
      if (index < MIN_VISIBLE_FEED_POSTS) return true;
      return index < TARGET_VISIBLE_FEED_POSTS && post.score >= MIN_OPTIONAL_FEED_SCORE;
    })
    .map((post) => post.id);

  const protectedVisibleIds = new Set([...rankedVisibleIds, ...recentKeepIds]);
  const undeletableIds = new Set(protectedVisibleIds);
  const undeletableIdList =
    undeletableIds.size > 0 ? [...undeletableIds] : ["__none__"];
  const protectedVisibleIdList =
    protectedVisibleIds.size > 0 ? [...protectedVisibleIds] : ["__none__"];

  const [deleted] = await prisma.$transaction([
    prisma.post.deleteMany({
      where: {
        feedSourceId: { not: null },
        id: { notIn: undeletableIdList },
        likes: { none: {} },
        bookmarkedBy: { none: {} },
        sharedBy: { none: {} },
        comments: { none: {} },
      },
    }),
    prisma.post.updateMany({
      where: { feedSourceId: { not: null } },
      data: { isFeedVisible: false },
    }),
    prisma.post.updateMany({
      where: { id: { in: protectedVisibleIdList } },
      data: { isFeedVisible: true },
    }),
    prisma.post.updateMany({
      where: {
        feedSourceId: { not: null },
        OR: [
          { likes: { some: {} } },
          { sharedBy: { some: {} } },
          { comments: { some: { moderationStatus: "visible" } } },
        ],
      },
      data: { isFeedVisible: true },
    }),
  ]);

  const afterPosts = await prisma.post.findMany({
    where: { feedSourceId: { not: null } },
    select: { feedSourceId: true, isFeedVisible: true },
  });

  const beforeSummary = summarizeFeedPostCounts(beforePosts);
  const afterSummary = summarizeFeedPostCounts(afterPosts);

  const feedStats: FeedVisibilityFeedStat[] = feedSources
    .map((feed) => {
      const before = beforeSummary.get(feed.id) ?? { totalCount: 0, visibleCount: 0 };
      const after = afterSummary.get(feed.id) ?? { totalCount: 0, visibleCount: 0 };
      const deletedCount = Math.max(0, before.totalCount - after.totalCount);

      return {
        feedSourceId: feed.id,
        feedTitle: feed.title,
        totalCount: after.totalCount,
        visibleCount: after.visibleCount,
        hiddenCount: Math.max(0, after.totalCount - after.visibleCount),
        deletedCount,
      };
    })
    .sort((left, right) => left.feedTitle.localeCompare(right.feedTitle));

  const visibleCount = afterPosts.filter((post) => post.isFeedVisible).length;
  const hiddenCount = afterPosts.length - visibleCount;

  return {
    visibleCount,
    hiddenCount,
    deletedCount: deleted.count,
    feedStats,
  };
}