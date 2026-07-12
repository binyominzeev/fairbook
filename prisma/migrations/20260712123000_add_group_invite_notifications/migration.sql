-- Notification model generalized for non-post targets (e.g. group invites).
CREATE TABLE "new_Notification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "recipientId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "targetKey" TEXT NOT NULL,
  "postId" TEXT,
  "communityId" TEXT,
  "commentId" TEXT,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_recipientId_fkey"
    FOREIGN KEY ("recipientId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Notification_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Notification_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Notification_communityId_fkey"
    FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Notification_commentId_fkey"
    FOREIGN KEY ("commentId") REFERENCES "Comment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_Notification" (
  "id",
  "recipientId",
  "actorId",
  "type",
  "targetKey",
  "postId",
  "commentId",
  "isRead",
  "createdAt"
)
SELECT
  "id",
  "recipientId",
  "actorId",
  "type",
  "targetKey",
  "postId",
  "commentId",
  "isRead",
  "createdAt"
FROM "Notification";

DROP TABLE "Notification";
ALTER TABLE "new_Notification" RENAME TO "Notification";

CREATE UNIQUE INDEX "Notification_type_recipientId_targetKey_key" ON "Notification"("type", "recipientId", "targetKey");
CREATE INDEX "Notification_recipientId_isRead_createdAt_idx" ON "Notification"("recipientId", "isRead", "createdAt");
CREATE INDEX "Notification_recipientId_createdAt_idx" ON "Notification"("recipientId", "createdAt");
CREATE INDEX "Notification_communityId_createdAt_idx" ON "Notification"("communityId", "createdAt");
