-- Add optional friendly slug for per-post permalinks.
ALTER TABLE "Post" ADD COLUMN "permalinkSlug" TEXT;

CREATE UNIQUE INDEX "Post_authorId_permalinkSlug_key" ON "Post"("authorId", "permalinkSlug");
