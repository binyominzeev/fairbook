-- AlterTable
ALTER TABLE "Community" ADD COLUMN "allowGuestView" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Community" ADD COLUMN "defaultPostVisibility" TEXT;
