import { test } from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findBrokenLinks } from "./check-links.ts";
import { page, writeSite } from "./test-site.ts";

const SITE = "https://me.example.org";

test("a site whose internal links all resolve passes", () => {
  const dir = writeSite({
    "index.html": page('<a href="/about/">About</a>'),
    "about/index.html": page('<a href="/">Home</a>'),
  });
  assert.deepEqual(findBrokenLinks(dir, { site: SITE }), []);
});

test("a link to a page that doesn't exist is reported", () => {
  const dir = writeSite({
    "index.html": page('<a href="/about/">About</a>'),
  });
  assert.deepEqual(findBrokenLinks(dir, { site: SITE }), ["index.html: /about/ (no such page or file)"]);
});

test("anchors resolve against ids on the target page", () => {
  const dir = writeSite({
    "index.html": page('<a href="#work">Work</a><h2 id="work">Work</h2><a href="/about/#team">Team</a>'),
    "about/index.html": page('<section id="team"></section>'),
  });
  assert.deepEqual(findBrokenLinks(dir, { site: SITE }), []);
});

test("an anchor with no matching id is reported, on the same page or another", () => {
  const dir = writeSite({
    "index.html": page('<a href="#wrok">Work</a><h2 id="work">Work</h2><a href="/about/#people">Team</a>'),
    "about/index.html": page('<section id="team"></section>'),
  });
  assert.deepEqual(findBrokenLinks(dir, { site: SITE }), [
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
  assert.deepEqual(findBrokenLinks(dir, { site: SITE }), []);
});

test("absolute links to the site's own origin are checked like internal ones", () => {
  const dir = writeSite({
    "index.html": page(
      '<link rel="canonical" href="https://me.example.org/"><a href="https://me.example.org/gone/">x</a>',
    ),
  });
  assert.deepEqual(findBrokenLinks(dir, { site: SITE }), [
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
  assert.deepEqual(findBrokenLinks(dir, { site: SITE }), [
    "index.html: /_astro/gone.svg (no such page or file)",
    'notes/index.html: ../#top (no element with id "top")',
  ]);
});

test("percent-encoded paths and anchors match the decoded file and id", () => {
  const dir = writeSite({
    "index.html": page('<a href="/caf%C3%A9/#d%C3%A9j%C3%A0-vu">x</a>'),
    "café/index.html": page('<h2 id="déjà-vu">x</h2>'),
  });
  assert.deepEqual(findBrokenLinks(dir, { site: SITE }), []);
});

test("a missing output directory is an error, not a pass", () => {
  assert.throws(() => findBrokenLinks(join(tmpdir(), "does-not-exist-links"), { site: SITE }));
});

test("single-quoted and unquoted attributes are checked too", () => {
  const dir = writeSite({
    "index.html": page("<a href='/gone/'>x</a><a href=/missing/>x</a><a href=/ok/>x</a>"),
    "ok/index.html": page(""),
  });
  assert.deepEqual(findBrokenLinks(dir, { site: SITE }), [
    "index.html: /gone/ (no such page or file)",
    "index.html: /missing/ (no such page or file)",
  ]);
});

test("every candidate URL in a srcset is checked", () => {
  const dir = writeSite({
    "index.html": page('<img src="/a.png" srcset="/a.png 1x, /a@2x.png 2x,/gone@3x.png 3x" alt="">'),
    "a.png": "png",
    "a@2x.png": "png",
  });
  assert.deepEqual(findBrokenLinks(dir, { site: SITE }), ["index.html: /gone@3x.png (no such page or file)"]);
});

test("xlink:href in inline SVG is checked", () => {
  const dir = writeSite({
    "index.html": page('<svg><use xlink:href="#icon"></use><use xlink:href="/sprite.svg#gone"></use></svg>'),
    "sprite.svg": '<svg><symbol id="here"></symbol></svg>',
  });
  assert.deepEqual(findBrokenLinks(dir, { site: SITE }), [
    'index.html: #icon (no element with id "icon")',
    'index.html: /sprite.svg#gone (no element with id "gone")',
  ]);
});
