-- AlterTable
ALTER TABLE "Post" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'members';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "defaultPostVisibility" TEXT NOT NULL DEFAULT 'members';
