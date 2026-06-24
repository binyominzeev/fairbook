-- CreateTable
CREATE TABLE "FeedGroup" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "FeedGroup_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeedGroupFeedSource" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "feedGroupId" TEXT NOT NULL,
  "feedSourceId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeedGroupFeedSource_feedGroupId_fkey"
    FOREIGN KEY ("feedGroupId") REFERENCES "FeedGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FeedGroupFeedSource_feedSourceId_fkey"
    FOREIGN KEY ("feedSourceId") REFERENCES "FeedSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FeedGroup_userId_name_key" ON "FeedGroup"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "FeedGroupFeedSource_feedGroupId_feedSourceId_key" ON "FeedGroupFeedSource"("feedGroupId", "feedSourceId");

-- CreateIndex
CREATE INDEX "FeedGroupFeedSource_feedSourceId_idx" ON "FeedGroupFeedSource"("feedSourceId");
