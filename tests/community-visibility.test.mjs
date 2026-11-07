import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canViewerAccessCommunity,
  canViewerAccessCommunityPost,
} from "../src/lib/community-visibility.ts";

test("private group posts allow non-members only when unlisted", () => {
  const nonMember = { isPrivate: true, members: [] };
  for (const visibility of ["public", "members", "friends"]) {
    assert.equal(canViewerAccessCommunityPost(nonMember, visibility), false);
  }
  assert.equal(canViewerAccessCommunityPost(nonMember, "unlisted"), true);
  assert.equal(canViewerAccessCommunity(nonMember), false);
});

test("members retain access and ordinary public-group posts do not require membership", () => {
  for (const visibility of ["public", "members", "friends", "unlisted"]) {
    assert.equal(canViewerAccessCommunityPost({ isPrivate: true, members: [{}] }, visibility), true);
    assert.equal(canViewerAccessCommunityPost({ isPrivate: false, members: [{}] }, visibility), true);
  }
  assert.equal(canViewerAccessCommunityPost({ isPrivate: false, members: [] }, "public"), true);
  assert.equal(canViewerAccessCommunityPost({ isPrivate: false, members: [] }, "unlisted"), false);
});
