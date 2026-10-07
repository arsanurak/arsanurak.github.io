import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Tests run the guard the way CI and `npm run check` do: as a command against a
// built site, observing only its exit code and output. Every term here is a
// throwaway sample.
const SCRIPT = resolve(import.meta.dirname, "check-publish-guard.ts");
const SAMPLE_LIST = "# sample denylist\nExamplecorp\nwidget-tracker.example\n\n099 555 0123\n";

function writeSite(files: Record<string, string | Buffer>): string {
  const root = mkdtempSync(join(tmpdir(), "publish-guard-"));
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, "dist", path);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

const page = (body: string) =>
  `<!doctype html><html lang="en"><head><title>t</title></head><body>${body}</body></html>`;

function guard(root: string, env: Record<string, string> = {}) {
  const result = spawnSync(process.execPath, [SCRIPT, "dist"], {
    cwd: root,
    encoding: "utf8",
    env: { PATH: process.env.PATH ?? "", ...env },
  });
  return { status: result.status, output: result.stdout + result.stderr };
}

const withList = { PUBLISH_GUARD_DENYLIST: SAMPLE_LIST };

test("a clean site passes", () => {
  const root = writeSite({ "index.html": page("<p>Platform work at a payments company.</p>") });
  const { status } = guard(root, withList);
  assert.equal(status, 0);
});

test("a denylisted term fails the check without echoing the term", () => {
  const root = writeSite({
    "index.html": page("<p>ok</p>"),
    "case-studies/one/index.html": page("<p>At Examplecorp we moved services.</p>"),
  });
  const { status, output } = guard(root, withList);
  assert.equal(status, 1);
  assert.match(output, /case-studies\/one\/index\.html/);
  assert.match(output, /entry 1\b/);
  assert.doesNotMatch(output, /examplecorp/i);
});

test("matching is case-insensitive and covers every text asset, not just pages", () => {
  const root = writeSite({
    "index.html": page("<p>ok</p>"),
    "sitemap-0.xml": "<urlset><url><loc>https://WIDGET-Tracker.Example/a</loc></url></urlset>",
    "_astro/diagram.svg": "<svg><text>EXAMPLECORP</text></svg>",
    "robots.txt": "User-agent: *",
  });
  const { status, output } = guard(root, withList);
  assert.equal(status, 1);
  assert.match(output, /sitemap-0\.xml: matches denylist entry 2/);
  assert.match(output, /_astro\/diagram\.svg: matches denylist entry 1/);
  assert.doesNotMatch(output, /robots\.txt/);
});

test("a term split across lines or HTML entities in the page is still caught", () => {
  const root = writeSite({
    "index.html": page("<p>Built with\n  widget-tracker&#46;example and Example&#x63;orp.</p>"),
  });
  const { status, output } = guard(root, { PUBLISH_GUARD_DENYLIST: "Big Examplecorp Group\nwidget-tracker.example\nExamplecorp" });
  assert.equal(status, 1);
  assert.match(output, /entry 2/);
  assert.match(output, /entry 3/);
  assert.doesNotMatch(output, /entry 1/);
});

test("a multi-word term matches across a line break in the HTML", () => {
  const root = writeSite({ "index.html": page("<p>at Big\n    Examplecorp   Group</p>") });
  const { status } = guard(root, { PUBLISH_GUARD_DENYLIST: "Big Examplecorp Group" });
  assert.equal(status, 1);
});

for (const written of ["099 555 0123", "099-555-0123", "0995550123", "+00 99 555 0123", "+00-99-555-0123", "+00995550123", "(099) 555 01 23", "99 555 0123"]) {
  test(`the sample phone number is caught when written as "${written}"`, () => {
    const root = writeSite({ "index.html": page(`<p>Call ${written} today</p>`) });
    const { status, output } = guard(root, withList);
    assert.equal(status, 1);
    assert.match(output, /index\.html: matches denylist entry 3/);
    assert.doesNotMatch(output, /555/);
  });
}

test("a phone entry written in international form catches the national form too", () => {
  const root = writeSite({ "index.html": page("<p>099 555 0123</p>") });
  const { status } = guard(root, { PUBLISH_GUARD_DENYLIST: "+00 99 555 0123" });
  assert.equal(status, 1);
});

test("other numbers that merely share digits with the phone number pass", () => {
  const root = writeSite({
    "index.html": page("<p>Since 2018, about 100 services, 99 555 01234 and 1995550123 are not it.</p>"),
  });
  const { status } = guard(root, withList);
  assert.equal(status, 0);
});

test("locally the list is read from the gitignored file in the working directory", () => {
  const root = writeSite({ "index.html": page("<p>Examplecorp</p>") });
  writeFileSync(join(root, ".publish-guard-denylist"), SAMPLE_LIST);
  const { status, output } = guard(root);
  assert.equal(status, 1);
  assert.match(output, /entry 1/);
});

test("a missing list warns locally and passes", () => {
  const root = writeSite({ "index.html": page("<p>Examplecorp</p>") });
  const { status, output } = guard(root);
  assert.equal(status, 0);
  assert.match(output, /warning/i);
  assert.match(output, /\.publish-guard-denylist/);
});

test("a list with only comments and blank lines counts as missing", () => {
  const root = writeSite({ "index.html": page("<p>ok</p>") });
  const { status, output } = guard(root, { GITHUB_ACTIONS: "true", PUBLISH_GUARD_DENYLIST: "# nothing\n\n" });
  assert.equal(status, 1);
  assert.match(output, /PUBLISH_GUARD_DENYLIST/);
});

test("a missing list fails closed in CI", () => {
  const root = writeSite({ "index.html": page("<p>ok</p>") });
  const { status, output } = guard(root, { GITHUB_ACTIONS: "true", PUBLISH_GUARD_DENYLIST: "" });
  assert.equal(status, 1);
  assert.match(output, /PUBLISH_GUARD_DENYLIST/);
});

test("a missing list only warns in CI on a pull request that gets no secrets (a fork or Dependabot)", () => {
  const root = writeSite({ "index.html": page("<p>ok</p>") });
  const { status, output } = guard(root, { GITHUB_ACTIONS: "true", PUBLISH_GUARD_NO_SECRETS: "true" });
  assert.equal(status, 0);
  assert.match(output, /warning/i);
});

test("in CI the local file is ignored: the secret is the only source", () => {
  const root = writeSite({ "index.html": page("<p>ok</p>") });
  writeFileSync(join(root, ".publish-guard-denylist"), SAMPLE_LIST);
  const { status } = guard(root, { GITHUB_ACTIONS: "true" });
  assert.equal(status, 1);
});

test("a missing output directory is an error, not a pass", () => {
  const root = mkdtempSync(join(tmpdir(), "publish-guard-"));
  const { status } = guard(root, withList);
  assert.notEqual(status, 0);
});

test("an international phone entry without a separator after the country code is rejected, not silently weakened", () => {
  const root = writeSite({ "index.html": page("<p>ok</p>") });
  const { status, output } = guard(root, { PUBLISH_GUARD_DENYLIST: "Examplecorp\n+00995550123" });
  assert.equal(status, 1);
  assert.match(output, /entry 2/);
  assert.match(output, /country code/);
  assert.doesNotMatch(output, /555/);
});
