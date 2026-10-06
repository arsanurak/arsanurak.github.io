import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findJavaScript } from "./check-no-js.ts";

function writeSite(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "no-js-"));
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

const page = (body: string) =>
  `<!doctype html><html lang="en"><head><title>t</title></head><body>${body}</body></html>`;

test("a site with only HTML and CSS passes", () => {
  const dir = writeSite({
    "index.html": page("<p>hello</p>"),
    "_astro/index.css": "body{color:red}",
  });
  assert.deepEqual(findJavaScript(dir), []);
});

test("a script element in any page is reported", () => {
  const dir = writeSite({
    "index.html": page("<p>ok</p>"),
    "case-studies/one/index.html": page('<script type="module">x()</script>'),
  });
  assert.deepEqual(findJavaScript(dir), [
    "case-studies/one/index.html: <script> element",
  ]);
});

test("script elements are found regardless of case or attributes", () => {
  const dir = writeSite({ "index.html": page('<SCRIPT\nsrc="/a.js"></SCRIPT>') });
  assert.deepEqual(findJavaScript(dir), ["index.html: <script> element"]);
});

test("words that merely contain 'script' are not reported", () => {
  const dir = writeSite({
    "index.html": page("<p>I write &lt;script&gt; tags and <noscript-ish> prose about JavaScript.</p>"),
  });
  assert.deepEqual(findJavaScript(dir), []);
});

test("a script element inside an SVG is reported", () => {
  const dir = writeSite({
    "index.html": page(""),
    "case-studies/one/diagram.svg": '<svg xmlns="http://www.w3.org/2000/svg"><script>x()</script></svg>',
  });
  assert.deepEqual(findJavaScript(dir), ["case-studies/one/diagram.svg: <script> element"]);
});

test("emitted JS files are reported", () => {
  const dir = writeSite({
    "index.html": page(""),
    "_astro/client.js": "x",
    "_astro/chunk.mjs": "x",
    "_astro/legacy.cjs": "x",
  });
  assert.deepEqual(findJavaScript(dir).sort(), [
    "_astro/chunk.mjs: JavaScript file",
    "_astro/client.js: JavaScript file",
    "_astro/legacy.cjs: JavaScript file",
  ]);
});

test("a missing output directory is an error, not a pass", () => {
  assert.throws(() => findJavaScript(join(tmpdir(), "does-not-exist-no-js")));
});
