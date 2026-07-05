-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "hideViolentFeed" BOOLEAN NOT NULL DEFAULT false,
    "isPage" BOOLEAN NOT NULL DEFAULT false,
    "managedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tagFilterMode" TEXT,
    "tagFilterTags" TEXT,
    "profileActivityViewMode" TEXT NOT NULL DEFAULT 'normal',
    "feedSortMode" TEXT NOT NULL DEFAULT 'current',
    CONSTRAINT "User_managedById_fkey" FOREIGN KEY ("managedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("avatarUrl", "bio", "createdAt", "email", "hideViolentFeed", "id", "isPage", "managedById", "name", "passwordHash", "profileActivityViewMode", "slug", "tagFilterMode", "tagFilterTags") SELECT "avatarUrl", "bio", "createdAt", "email", "hideViolentFeed", "id", "isPage", "managedById", "name", "passwordHash", "profileActivityViewMode", "slug", "tagFilterMode", "tagFilterTags" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_slug_key" ON "User"("slug");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
