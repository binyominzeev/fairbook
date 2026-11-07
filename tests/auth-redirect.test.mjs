import assert from "node:assert/strict";
import { test } from "node:test";
import { loginHref, safeReturnTo } from "../src/lib/auth-redirect.ts";

test("login links preserve local paths, query strings and fragments", () => {
  const path = "/groups/example/2026/01/post?x=1#comment";
  const url = new URL(loginHref(path, true), "https://fairbook.invalid");
  assert.equal(url.searchParams.get("mode"), "register");
  assert.equal(url.searchParams.get("returnTo"), path);
  assert.equal(safeReturnTo(path), path);
  assert.equal(loginHref(), "/login");
});

test("unsafe return destinations never leave the site", () => {
  for (const value of ["https://evil.test", "//evil.test", "/\\evil.test", "/\n/evil.test", "/..//evil.test", "javascript:alert(1)", null]) {
    assert.equal(safeReturnTo(value), null);
    assert.equal(loginHref(value), "/login");
  }
});
