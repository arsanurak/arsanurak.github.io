import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findMissingSlugs, findUnregisteredPages, parseRegistry } from "./check-slugs.ts";

function writeSite(pages: string[]): string {
  const root = mkdtempSync(join(tmpdir(), "slugs-"));
  for (const page of pages) {
    mkdirSync(join(root, page), { recursive: true });
    writeFileSync(join(root, page, "index.html"), "<!doctype html>");
  }
  return root;
}

test("every registered slug with a page passes", () => {
  const dist = writeSite(["case-studies/a", "case-studies/b"]);
  assert.deepEqual(findMissingSlugs(dist, ["a", "b"]), []);
});

test("a registered slug without a page is reported with its URL", () => {
  const dist = writeSite(["case-studies/a"]);
  assert.deepEqual(findMissingSlugs(dist, ["a", "renamed"]), [
    "renamed: no page at /case-studies/renamed/",
  ]);
});

test("the registry must be a list of unique lowercase slugs", () => {
  assert.deepEqual(parseRegistry('["a", "b-2"]'), ["a", "b-2"]);
  assert.throws(() => parseRegistry('{"a": 1}'), /list/);
  assert.throws(() => parseRegistry('["Bad Slug"]'), /Bad Slug/);
  assert.throws(() => parseRegistry('["a", "a"]'), /twice/);
});

test("a published case-study page missing from the registry is reported", () => {
  const dist = writeSite(["case-studies/a", "case-studies/new-one"]);
  assert.deepEqual(findUnregisteredPages(dist, ["a"]), [
    "new-one: /case-studies/new-one/ is published but not in the registry",
  ]);
  assert.deepEqual(findUnregisteredPages(writeSite([]), []), []);
});
