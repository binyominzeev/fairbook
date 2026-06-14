-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "sharedPostId" TEXT,
    "communityId" TEXT,
    "score" REAL NOT NULL DEFAULT 0,
    "freshnessScore" REAL NOT NULL DEFAULT 0,
    "sourceScore" REAL NOT NULL DEFAULT 0,
    "engagementScore" REAL NOT NULL DEFAULT 0,
    "moderationStatus" TEXT NOT NULL DEFAULT 'visible',
    "moderationReason" TEXT,
    "moderationExplanation" TEXT,
    "moderatedAt" DATETIME,
    "mayContainViolence" BOOLEAN NOT NULL DEFAULT false,
    "isFeedVisible" BOOLEAN NOT NULL DEFAULT true,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastScoredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Post_feedSourceId_fkey" FOREIGN KEY ("feedSourceId") REFERENCES "FeedSource" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Post_sharedPostId_fkey" FOREIGN KEY ("sharedPostId") REFERENCES "Post" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Post_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Post" ("authorId", "communityId", "content", "createdAt", "engagementScore", "externalId", "feedSourceId", "fetchedAt", "freshnessScore", "id", "isFeedVisible", "lastScoredAt", "moderatedAt", "moderationExplanation", "moderationReason", "moderationStatus", "score", "sharedDescription", "sharedImageUrl", "sharedPostId", "sharedSource", "sharedTitle", "sharedUrl", "sourceScore", "titleHash", "urlHash") SELECT "authorId", "communityId", "content", "createdAt", "engagementScore", "externalId", "feedSourceId", "fetchedAt", "freshnessScore", "id", "isFeedVisible", "lastScoredAt", "moderatedAt", "moderationExplanation", "moderationReason", "moderationStatus", "score", "sharedDescription", "sharedImageUrl", "sharedPostId", "sharedSource", "sharedTitle", "sharedUrl", "sourceScore", "titleHash", "urlHash" FROM "Post";
DROP TABLE "Post";
ALTER TABLE "new_Post" RENAME TO "Post";
CREATE INDEX "Post_urlHash_idx" ON "Post"("urlHash");
CREATE INDEX "Post_titleHash_idx" ON "Post"("titleHash");
CREATE INDEX "Post_feedSourceId_isFeedVisible_idx" ON "Post"("feedSourceId", "isFeedVisible");
CREATE INDEX "Post_score_createdAt_idx" ON "Post"("score", "createdAt");
CREATE UNIQUE INDEX "Post_feedSourceId_externalId_key" ON "Post"("feedSourceId", "externalId");
CREATE UNIQUE INDEX "Post_authorId_sharedPostId_key" ON "Post"("authorId", "sharedPostId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
