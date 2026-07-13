CREATE TABLE "PushSubscription" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "userAgent" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "PushSubscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PushSubscription_endpoint_key"
  ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_userId_isActive_idx"
  ON "PushSubscription"("userId", "isActive");

CREATE TABLE "PushNotificationPreference" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "PushNotificationPreference_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PushNotificationPreference_userId_type_key"
  ON "PushNotificationPreference"("userId", "type");
CREATE INDEX "PushNotificationPreference_type_isEnabled_idx"
  ON "PushNotificationPreference"("type", "isEnabled");
