import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findBrokenLinks } from "./check-links.ts";

function writeSite(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "links-"));
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

const page = (body: string) =>
  `<!doctype html><html lang="en"><head><title>t</title></head><body>${body}</body></html>`;

test("a site whose internal links all resolve passes", () => {
  const dir = writeSite({
    "index.html": page('<a href="/about/">About</a>'),
    "about/index.html": page('<a href="/">Home</a>'),
  });
  assert.deepEqual(findBrokenLinks(dir), []);
});

test("a link to a page that doesn't exist is reported", () => {
  const dir = writeSite({
    "index.html": page('<a href="/about/">About</a>'),
  });
  assert.deepEqual(findBrokenLinks(dir), ["index.html: /about/ (no such page or file)"]);
});

test("anchors resolve against ids on the target page", () => {
  const dir = writeSite({
    "index.html": page('<a href="#work">Work</a><h2 id="work">Work</h2><a href="/about/#team">Team</a>'),
    "about/index.html": page('<section id="team"></section>'),
  });
  assert.deepEqual(findBrokenLinks(dir), []);
});

test("an anchor with no matching id is reported, on the same page or another", () => {
  const dir = writeSite({
    "index.html": page('<a href="#wrok">Work</a><h2 id="work">Work</h2><a href="/about/#people">Team</a>'),
    "about/index.html": page('<section id="team"></section>'),
  });
  assert.deepEqual(findBrokenLinks(dir), [
    "index.html: #wrok (no element with id \"wrok\")",
    "index.html: /about/#people (no element with id \"people\")",
  ]);
});

test("links to other sites and non-web schemes are not checked", () => {
  const dir = writeSite({
    "index.html": page(
      '<a href="https://example.com/missing#nope">x</a><a href="mailto:me@example.com">x</a><a href="tel:+1">x</a>',
    ),
  });
  assert.deepEqual(findBrokenLinks(dir, { site: "https://me.example.org" }), []);
});

test("absolute links to the site's own origin are checked like internal ones", () => {
  const dir = writeSite({
    "index.html": page(
      '<link rel="canonical" href="https://me.example.org/"><a href="https://me.example.org/gone/">x</a>',
    ),
  });
  assert.deepEqual(findBrokenLinks(dir, { site: "https://me.example.org" }), [
    "index.html: https://me.example.org/gone/ (no such page or file)",
  ]);
});

test("images and stylesheets must exist, relative paths resolve from the page", () => {
  const dir = writeSite({
    "index.html": page('<link rel="stylesheet" href="/_astro/site.css"><img src="/_astro/gone.svg" alt="">'),
    "_astro/site.css": "body{}",
    "notes/index.html": page('<img src="diagram.png" alt=""><a href="../#top">up</a>'),
    "notes/diagram.png": "png",
  });
  assert.deepEqual(findBrokenLinks(dir), [
    "index.html: /_astro/gone.svg (no such page or file)",
    'notes/index.html: ../#top (no element with id "top")',
  ]);
});

test("percent-encoded paths and anchors match the decoded file and id", () => {
  const dir = writeSite({
    "index.html": page('<a href="/caf%C3%A9/#d%C3%A9j%C3%A0-vu">x</a>'),
    "café/index.html": page('<h2 id="déjà-vu">x</h2>'),
  });
  assert.deepEqual(findBrokenLinks(dir), []);
});

test("a missing output directory is an error, not a pass", () => {
  assert.throws(() => findBrokenLinks(join(tmpdir(), "does-not-exist-links")));
});
