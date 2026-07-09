ALTER TABLE "AppConfig"
ADD COLUMN "hiddenTextCardFontIds" TEXT NOT NULL DEFAULT '[]';

ALTER TABLE "AppConfig"
ADD COLUMN "hiddenTextCardBackgroundIds" TEXT NOT NULL DEFAULT '[]';
