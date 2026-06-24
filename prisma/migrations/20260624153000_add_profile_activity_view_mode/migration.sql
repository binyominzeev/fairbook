-- Add per-user profile activity view mode preference
ALTER TABLE "User"
ADD COLUMN "profileActivityViewMode" TEXT NOT NULL DEFAULT 'normal';
