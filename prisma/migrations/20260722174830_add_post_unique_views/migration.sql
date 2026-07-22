-- CreateTable
CREATE TABLE "PostUniqueView" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PostUniqueView_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PostUniqueView_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PostUniqueView_postId_idx" ON "PostUniqueView"("postId");

-- CreateIndex
CREATE INDEX "PostUniqueView_viewerId_idx" ON "PostUniqueView"("viewerId");

-- CreateIndex
CREATE UNIQUE INDEX "PostUniqueView_postId_viewerId_key" ON "PostUniqueView"("postId", "viewerId");
