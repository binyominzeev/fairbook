-- CreateTable
CREATE TABLE "BookmarkedPost" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "postId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookmarkedPost_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BookmarkedPost_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChildSafetyReport" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "reporterId" TEXT,
  "postId" TEXT,
  "targetUrl" TEXT,
  "reason" TEXT NOT NULL,
  "details" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" DATETIME,
  CONSTRAINT "ChildSafetyReport_reporterId_fkey"
    FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ChildSafetyReport_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "BookmarkedPost_postId_userId_key" ON "BookmarkedPost"("postId", "userId");

-- CreateIndex
CREATE INDEX "ChildSafetyReport_status_createdAt_idx" ON "ChildSafetyReport"("status", "createdAt");
