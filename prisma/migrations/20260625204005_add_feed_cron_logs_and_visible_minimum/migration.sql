-- CreateTable
CREATE TABLE "FeedCronRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'success',
    "startedAt" DATETIME NOT NULL,
    "finishedAt" DATETIME NOT NULL,
    "processedFeedCount" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "notModifiedCount" INTEGER NOT NULL DEFAULT 0,
    "deletedCount" INTEGER NOT NULL DEFAULT 0,
    "visibleCount" INTEGER NOT NULL DEFAULT 0,
    "hiddenCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "FeedCronRunEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "feedSourceId" TEXT,
    "feedTitle" TEXT NOT NULL,
    "addedCount" INTEGER NOT NULL DEFAULT 0,
    "removedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "visibleCount" INTEGER NOT NULL DEFAULT 0,
    "notModified" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'success',
    "message" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeedCronRunEntry_runId_fkey" FOREIGN KEY ("runId") REFERENCES "FeedCronRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FeedCronRunEntry_feedSourceId_fkey" FOREIGN KEY ("feedSourceId") REFERENCES "FeedSource" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FeedCronRun_finishedAt_idx" ON "FeedCronRun"("finishedAt");

-- CreateIndex
CREATE INDEX "FeedCronRun_kind_finishedAt_idx" ON "FeedCronRun"("kind", "finishedAt");

-- CreateIndex
CREATE INDEX "FeedCronRunEntry_runId_idx" ON "FeedCronRunEntry"("runId");

-- CreateIndex
CREATE INDEX "FeedCronRunEntry_feedSourceId_idx" ON "FeedCronRunEntry"("feedSourceId");
