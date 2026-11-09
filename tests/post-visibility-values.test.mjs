import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveRequestedVisibility } from "../src/lib/post-visibility-values.ts";

test("explicit audience overrides the group and profile defaults", () => {
  assert.deepEqual(resolveRequestedVisibility("friends", "public", "members"), {
    visibility: "friends", forcedPrivate: false,
  });
  assert.deepEqual(resolveRequestedVisibility("private", "public", "members"), {
    visibility: "members", forcedPrivate: true,
  });
});

test("group defaults precede profile defaults without changing existing fallback", () => {
  assert.equal(resolveRequestedVisibility("default", "members", "public").visibility, "public");
  assert.equal(resolveRequestedVisibility(undefined, "public", "unlisted").visibility, "unlisted");
  assert.equal(resolveRequestedVisibility("default", "friends", null).visibility, "friends");
  assert.equal(resolveRequestedVisibility("default", null, null).visibility, "members");
});
