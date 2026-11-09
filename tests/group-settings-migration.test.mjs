import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import Database from "better-sqlite3";

test("existing communities remain guest-disabled and retain their data", () => {
  const db = new Database(":memory:");
  try {
    db.exec('CREATE TABLE "Community" (id TEXT PRIMARY KEY, name TEXT NOT NULL, isPrivate BOOLEAN NOT NULL DEFAULT false)');
    db.exec("INSERT INTO Community (id, name, isPrivate) VALUES ('public', 'Public', 0), ('private', 'Private', 1)");
    db.exec(readFileSync(new URL("../prisma/migrations/20261109183000_group_guest_view_and_default_visibility/migration.sql", import.meta.url), "utf8"));
    assert.deepEqual(db.prepare("SELECT id, name, isPrivate, allowGuestView, defaultPostVisibility FROM Community ORDER BY id").all(), [
      { id: "private", name: "Private", isPrivate: 1, allowGuestView: 0, defaultPostVisibility: null },
      { id: "public", name: "Public", isPrivate: 0, allowGuestView: 0, defaultPostVisibility: null },
    ]);
  } finally {
    db.close();
  }
});
