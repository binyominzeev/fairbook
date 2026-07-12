-- Keep schema aligned: this index is no longer defined in prisma/schema.prisma.
DROP INDEX IF EXISTS "Notification_communityId_createdAt_idx";
