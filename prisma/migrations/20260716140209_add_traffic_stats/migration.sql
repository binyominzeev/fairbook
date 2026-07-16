-- CreateTable
CREATE TABLE "TrafficSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "visitorKeyHash" TEXT NOT NULL,
    "userId" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "entryPath" TEXT NOT NULL,
    "referrer" TEXT,
    "pageViewCount" INTEGER NOT NULL DEFAULT 0,
    "activeMsTotal" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrafficSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrafficEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "eventType" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "routeType" TEXT NOT NULL,
    "contentType" TEXT,
    "postId" TEXT,
    "activeMs" INTEGER,
    "referrer" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrafficEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrafficSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrafficEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TrafficEvent_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TrafficSession_visitorKeyHash_startedAt_idx" ON "TrafficSession"("visitorKeyHash", "startedAt");

-- CreateIndex
CREATE INDEX "TrafficSession_userId_startedAt_idx" ON "TrafficSession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "TrafficSession_startedAt_idx" ON "TrafficSession"("startedAt");

-- CreateIndex
CREATE INDEX "TrafficEvent_createdAt_idx" ON "TrafficEvent"("createdAt");

-- CreateIndex
CREATE INDEX "TrafficEvent_eventType_createdAt_idx" ON "TrafficEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "TrafficEvent_routeType_createdAt_idx" ON "TrafficEvent"("routeType", "createdAt");

-- CreateIndex
CREATE INDEX "TrafficEvent_sessionId_createdAt_idx" ON "TrafficEvent"("sessionId", "createdAt");
