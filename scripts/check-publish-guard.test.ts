import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chooseDenylist, findDenylisted, parseDenylist, whenListMissing } from "./check-publish-guard.ts";
import { page, writeSite } from "./test-site.ts";

// Every term here is a throwaway sample.
const SAMPLE_LIST = "# sample denylist\nExamplecorp\nwidget-tracker.example\n\n099 555 0123\n";

const scan = (files: Record<string, string>, list = SAMPLE_LIST) => findDenylisted(writeSite(files), parseDenylist(list));

test("a clean site passes", () => {
  assert.deepEqual(scan({ "index.html": page("<p>Platform work at a payments company.</p>") }), []);
});

test("a match is reported by file and term position, never by the term", () => {
  const problems = scan({
    "index.html": page("<p>ok</p>"),
    "case-studies/one/index.html": page("<p>At Examplecorp we moved services.</p>"),
  });
  assert.deepEqual(problems, ["case-studies/one/index.html: matches denylist entry 1"]);
});

test("blank lines and comments are skipped when numbering terms", () => {
  assert.deepEqual(
    parseDenylist(SAMPLE_LIST).map(({ position }) => position),
    [1, 2, 3],
  );
});

test("matching is case-insensitive and covers every text asset, not just pages", () => {
  const problems = scan({
    "index.html": page("<p>ok</p>"),
    "sitemap-0.xml": "<urlset><url><loc>https://WIDGET-Tracker.Example/a</loc></url></urlset>",
    "_astro/diagram.svg": "<svg><text>EXAMPLECORP</text></svg>",
    "robots.txt": "User-agent: *",
  });
  assert.deepEqual(problems.sort(), [
    "_astro/diagram.svg: matches denylist entry 1",
    "sitemap-0.xml: matches denylist entry 2",
  ]);
});

test("a term split across lines or HTML entities in the page is still caught", () => {
  const problems = scan(
    { "index.html": page("<p>Built with\n  widget-tracker&#46;example and Example&#x63;orp.</p>") },
    "Big Examplecorp Group\nwidget-tracker.example\nExamplecorp",
  );
  assert.deepEqual(problems, ["index.html: matches denylist entry 2", "index.html: matches denylist entry 3"]);
});

test("a multi-word term matches across a line break in the HTML", () => {
  assert.equal(scan({ "index.html": page("<p>at Big\n    Examplecorp   Group</p>") }, "Big Examplecorp Group").length, 1);
});

for (const written of ["099 555 0123", "099-555-0123", "0995550123", "+00 99 555 0123", "+00-99-555-0123", "+00995550123", "(099) 555 01 23", "99 555 0123"]) {
  test(`the sample phone number is caught when written as "${written}"`, () => {
    assert.deepEqual(scan({ "index.html": page(`<p>Call ${written} today</p>`) }), ["index.html: matches denylist entry 3"]);
  });
}

test("a phone entry in international form catches the national form too", () => {
  assert.equal(scan({ "index.html": page("<p>099 555 0123</p>") }, "+00 99 555 0123").length, 1);
});

test("a phone entry in international form catches the country code written without + or a separator", () => {
  assert.equal(scan({ "index.html": page("<p>Call 66812345678</p>") }, "+66 81 234 5678").length, 1);
  assert.equal(scan({ "index.html": page("<p>Call 66 81 234 5678</p>") }, "+66 81 234 5678").length, 1);
});

test("other numbers that merely share digits with the phone number pass", () => {
  assert.deepEqual(scan({ "index.html": page("<p>Since 2018, about 100 services, 99 555 01234 and 1995550123 are not it.</p>") }), []);
  assert.deepEqual(scan({ "index.html": page("<p>Order 7766812345678</p>") }, "+66 81 234 5678"), []);
});

test("an international phone entry without a separator after the country code is rejected without echoing it", () => {
  assert.throws(() => parseDenylist("Examplecorp\n+00995550123"), (error: Error) => {
    assert.match(error.message, /entry 2/);
    assert.match(error.message, /country code/);
    assert.doesNotMatch(error.message, /555/);
    return true;
  });
});

test("a missing output directory is an error, not a pass", () => {
  assert.throws(() => findDenylisted(join(tmpdir(), "does-not-exist-publish-guard"), parseDenylist(SAMPLE_LIST)));
});

test("the environment variable wins; locally the file is the fallback; in CI the file is ignored", () => {
  assert.equal(chooseDenylist({ fromEnv: "a", fromFile: "b", inCI: false }), "a");
  assert.equal(chooseDenylist({ fromEnv: "  ", fromFile: "b", inCI: false }), "b");
  assert.equal(chooseDenylist({ fromEnv: undefined, fromFile: undefined, inCI: false }), "");
  assert.equal(chooseDenylist({ fromEnv: undefined, fromFile: "b", inCI: true }), "");
});

test("a missing list fails in CI when secrets are available, and warns otherwise", () => {
  assert.equal(whenListMissing({ inCI: true, secretsAvailable: true }), "fail");
  assert.equal(whenListMissing({ inCI: true, secretsAvailable: false }), "warn");
  assert.equal(whenListMissing({ inCI: false, secretsAvailable: true }), "warn");
});

// The command itself: exit codes and output, as CI and `npm run check` see them.
const SCRIPT = resolve(import.meta.dirname, "check-publish-guard.ts");

function guard(env: Record<string, string>, site = writeSite({ "index.html": page("<p>At Examplecorp.</p>") })) {
  const result = spawnSync(process.execPath, [SCRIPT, site], {
    cwd: mkdtempSync(join(tmpdir(), "publish-guard-cwd-")),
    encoding: "utf8",
    env: { PATH: process.env.PATH ?? "", ...env },
  });
  return { status: result.status, output: result.stdout + result.stderr };
}

test("command: a match fails without echoing the term", () => {
  const { status, output } = guard({ PUBLISH_GUARD_DENYLIST: SAMPLE_LIST });
  assert.equal(status, 1);
  assert.match(output, /index\.html: matches denylist entry 1/);
  assert.doesNotMatch(output, /examplecorp/i);
});

test("command: a missing or comment-only list fails closed in CI", () => {
  for (const list of ["", "# nothing\n\n"]) {
    const { status, output } = guard({ GITHUB_ACTIONS: "true", PUBLISH_GUARD_DENYLIST: list });
    assert.equal(status, 1);
    assert.match(output, /PUBLISH_GUARD_DENYLIST/);
  }
});

test("command: a missing list warns and passes when CI has no secrets, and locally", () => {
  const runs: Record<string, string>[] = [{ GITHUB_ACTIONS: "true", PUBLISH_GUARD_SECRETS_AVAILABLE: "false" }, {}];
  for (const env of runs) {
    const { status, output } = guard(env);
    assert.equal(status, 0);
    assert.match(output, /warning/i);
  }
});
