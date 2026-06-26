import { prisma } from "@/lib/prisma";
import type { FeedVisibilityResult } from "@/lib/feed-ranking";
import type { FeedSyncBatchResult } from "@/lib/rss";

const LOG_RETENTION_DAYS = 7;

async function pruneOldFeedCronRuns() {
  const cutoff = new Date(Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.feedCronRun.deleteMany({
    where: {
      finishedAt: {
        lt: cutoff,
      },
    },
  });
}

export async function recordFeedSyncCronRun({
  startedAt,
  result,
}: {
  startedAt: Date;
  result: FeedSyncBatchResult;
}) {
  const finishedAt = new Date();

  await prisma.feedCronRun.create({
    data: {
      kind: "sync",
      status: result.failedCount > 0 ? "partial" : "success",
      startedAt,
      finishedAt,
      processedFeedCount: result.processedFeedCount,
      importedCount: result.importedCount,
      skippedCount: result.skippedCount,
      notModifiedCount: result.notModifiedCount,
      visibleCount: result.visibility.visibleCount,
      hiddenCount: result.visibility.hiddenCount,
      failedCount: result.failedCount,
      entries: {
        create: result.feedResults.map((feed) => ({
          feedSourceId: feed.feedSourceId,
          feedTitle: feed.feedTitle,
          addedCount: feed.importedCount,
          removedCount: 0,
          skippedCount: feed.skippedCount,
          totalCount: feed.totalCount,
          visibleCount: feed.visibleCount,
          notModified: feed.notModified,
          status: feed.error ? "failed" : feed.notModified ? "not_modified" : "success",
          message: feed.error ?? null,
        })),
      },
    },
  });

  await pruneOldFeedCronRuns();
}

export async function recordFeedCleanupCronRun({
  startedAt,
  result,
}: {
  startedAt: Date;
  result: FeedVisibilityResult;
}) {
  const finishedAt = new Date();

  await prisma.feedCronRun.create({
    data: {
      kind: "cleanup",
      status: "success",
      startedAt,
      finishedAt,
      processedFeedCount: result.feedStats.length,
      deletedCount: result.deletedCount,
      visibleCount: result.visibleCount,
      hiddenCount: result.hiddenCount,
      entries: {
        create: result.feedStats.map((feed) => ({
          feedSourceId: feed.feedSourceId,
          feedTitle: feed.feedTitle,
          addedCount: 0,
          removedCount: feed.deletedCount,
          skippedCount: 0,
          totalCount: feed.totalCount,
          visibleCount: feed.visibleCount,
          notModified: false,
          status: "success",
        })),
      },
    },
  });

  await pruneOldFeedCronRuns();
}

export async function getRecentFeedCronRuns(limit = 20) {
  return prisma.feedCronRun.findMany({
    orderBy: [{ finishedAt: "desc" }],
    take: limit,
    include: {
      entries: {
        orderBy: [
          { removedCount: "desc" },
          { addedCount: "desc" },
          { feedTitle: "asc" },
        ],
      },
    },
  });
}