-- CreateTable
CREATE TABLE "FeedSyncState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nextCursor" INTEGER NOT NULL DEFAULT 0,
    "lastCleanupAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FeedSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pageId" TEXT NOT NULL,
    "rssUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "siteUrl" TEXT,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sourceWeight" REAL NOT NULL DEFAULT 1,
    "etag" TEXT,
    "lastModified" TEXT,
    "lastFetchedAt" DATETIME,
    "lastSuccessAt" DATETIME,
    "fetchErrorCount" INTEGER NOT NULL DEFAULT 0,
    "lastStatusCode" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FeedSource_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_FeedSource" ("createdAt", "description", "id", "imageUrl", "isActive", "lastFetchedAt", "pageId", "rssUrl", "siteUrl", "title", "updatedAt") SELECT "createdAt", "description", "id", "imageUrl", "isActive", "lastFetchedAt", "pageId", "rssUrl", "siteUrl", "title", "updatedAt" FROM "FeedSource";
DROP TABLE "FeedSource";
ALTER TABLE "new_FeedSource" RENAME TO "FeedSource";
CREATE UNIQUE INDEX "FeedSource_pageId_key" ON "FeedSource"("pageId");
CREATE UNIQUE INDEX "FeedSource_rssUrl_key" ON "FeedSource"("rssUrl");
CREATE TABLE "new_Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "authorId" TEXT NOT NULL,
    "feedSourceId" TEXT,
    "externalId" TEXT,
    "urlHash" TEXT,
    "titleHash" TEXT,
    "content" TEXT,
    "sharedUrl" TEXT,
    "sharedTitle" TEXT,
    "sharedDescription" TEXT,
    "sharedSource" TEXT,
    "sharedImageUrl" TEXT,
    "communityId" TEXT,
    "score" REAL NOT NULL DEFAULT 0,
    "freshnessScore" REAL NOT NULL DEFAULT 0,
    "sourceScore" REAL NOT NULL DEFAULT 0,
    "engagementScore" REAL NOT NULL DEFAULT 0,
    "isFeedVisible" BOOLEAN NOT NULL DEFAULT true,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastScoredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Post_feedSourceId_fkey" FOREIGN KEY ("feedSourceId") REFERENCES "FeedSource" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Post_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Post" ("authorId", "communityId", "content", "createdAt", "externalId", "feedSourceId", "id", "sharedDescription", "sharedImageUrl", "sharedSource", "sharedTitle", "sharedUrl") SELECT "authorId", "communityId", "content", "createdAt", "externalId", "feedSourceId", "id", "sharedDescription", "sharedImageUrl", "sharedSource", "sharedTitle", "sharedUrl" FROM "Post";
DROP TABLE "Post";
ALTER TABLE "new_Post" RENAME TO "Post";
CREATE INDEX "Post_urlHash_idx" ON "Post"("urlHash");
CREATE INDEX "Post_titleHash_idx" ON "Post"("titleHash");
CREATE INDEX "Post_feedSourceId_isFeedVisible_idx" ON "Post"("feedSourceId", "isFeedVisible");
CREATE INDEX "Post_score_createdAt_idx" ON "Post"("score", "createdAt");
CREATE UNIQUE INDEX "Post_feedSourceId_externalId_key" ON "Post"("feedSourceId", "externalId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
