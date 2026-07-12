-- Add slug support for community permalinks.
ALTER TABLE "Community" ADD COLUMN "permalinkSlug" TEXT;
CREATE UNIQUE INDEX "Community_permalinkSlug_key" ON "Community"("permalinkSlug");

-- Rebuild CommunityMember to add userId index and allow richer role enum values.
CREATE TABLE "new_CommunityMember" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "communityId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunityMember_communityId_fkey"
    FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CommunityMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_CommunityMember" ("id", "communityId", "userId", "role", "joinedAt")
SELECT "id", "communityId", "userId", "role", "joinedAt" FROM "CommunityMember";
DROP TABLE "CommunityMember";
ALTER TABLE "new_CommunityMember" RENAME TO "CommunityMember";
CREATE UNIQUE INDEX "CommunityMember_communityId_userId_key" ON "CommunityMember"("communityId", "userId");
CREATE INDEX "CommunityMember_userId_idx" ON "CommunityMember"("userId");

-- Add direct user invite flow (admin -> specific user, no invite links).
CREATE TABLE "CommunityInvite" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "communityId" TEXT NOT NULL,
  "inviterId" TEXT NOT NULL,
  "inviteeId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CommunityInvite_communityId_fkey"
    FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CommunityInvite_inviterId_fkey"
    FOREIGN KEY ("inviterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CommunityInvite_inviteeId_fkey"
    FOREIGN KEY ("inviteeId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CommunityInvite_communityId_inviteeId_key" ON "CommunityInvite"("communityId", "inviteeId");
CREATE INDEX "CommunityInvite_inviteeId_status_idx" ON "CommunityInvite"("inviteeId", "status");
