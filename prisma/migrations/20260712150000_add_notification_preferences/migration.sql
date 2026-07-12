CREATE TABLE "CommunityNotificationPreference" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "communityId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "isSubscribed" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CommunityNotificationPreference_communityId_fkey"
    FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CommunityNotificationPreference_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CommunityNotificationPreference_communityId_userId_key"
  ON "CommunityNotificationPreference"("communityId", "userId");
CREATE INDEX "CommunityNotificationPreference_userId_idx"
  ON "CommunityNotificationPreference"("userId");
CREATE INDEX "CommunityNotificationPreference_communityId_isSubscribed_idx"
  ON "CommunityNotificationPreference"("communityId", "isSubscribed");

CREATE TABLE "PostNotificationPreference" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "postId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "isSubscribed" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "PostNotificationPreference_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PostNotificationPreference_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PostNotificationPreference_postId_userId_key"
  ON "PostNotificationPreference"("postId", "userId");
CREATE INDEX "PostNotificationPreference_userId_idx"
  ON "PostNotificationPreference"("userId");
CREATE INDEX "PostNotificationPreference_postId_isSubscribed_idx"
  ON "PostNotificationPreference"("postId", "isSubscribed");
