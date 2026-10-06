-- CreateTable
CREATE TABLE "UserNotificationMute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "mutedUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserNotificationMute_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserNotificationMute_mutedUserId_fkey" FOREIGN KEY ("mutedUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "UserNotificationMute_mutedUserId_idx" ON "UserNotificationMute"("mutedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "UserNotificationMute_userId_mutedUserId_key" ON "UserNotificationMute"("userId", "mutedUserId");
