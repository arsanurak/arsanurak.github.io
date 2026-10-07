import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { findSeoProblems } from "./check-seo.ts";

const SITE = "https://example.github.io";

// The head a crawler should find on the page served at `path`.
function head(path: string, overrides: Record<string, string | null> = {}): string {
  const tags: Record<string, string | null> = {
    title: "<title>A page</title>",
    description: '<meta name="description" content="What the page is about">',
    canonical: `<link rel="canonical" href="${SITE}${path}">`,
    "og:title": '<meta property="og:title" content="A page">',
    "og:type": '<meta property="og:type" content="website">',
    "og:description": '<meta property="og:description" content="What the page is about">',
    "og:url": `<meta property="og:url" content="${SITE}${path}">`,
    "og:image": `<meta property="og:image" content="${SITE}/og.png">`,
    "og:image:width": '<meta property="og:image:width" content="1200">',
    "og:image:height": '<meta property="og:image:height" content="630">',
    "og:image:alt": '<meta property="og:image:alt" content="The site name on a dark panel">',
    ...overrides,
  };
  return `<!doctype html><html><head>${Object.values(tags).filter(Boolean).join("")}</head><body></body></html>`;
}

const SITEMAP = (paths: string[]) =>
  `<?xml version="1.0"?><urlset>${paths.map((p) => `<url><loc>${SITE}${p}</loc></url>`).join("")}</urlset>`;

// A built site: files keyed by path under dist. Defaults to a complete site.
function writeSite(files: Record<string, string | null>): string {
  const root = mkdtempSync(join(tmpdir(), "seo-"));
  const all: Record<string, string | null> = {
    "og.png": "png",
    "robots.txt": `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap-index.xml\n`,
    "sitemap-index.xml": `<?xml version="1.0"?><sitemapindex><sitemap><loc>${SITE}/sitemap-0.xml</loc></sitemap></sitemapindex>`,
    "sitemap-0.xml": SITEMAP(["/", "/about/"]),
    "index.html": head("/"),
    "about/index.html": head("/about/"),
    ...files,
  };
  for (const [path, content] of Object.entries(all)) {
    if (content === null) continue;
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

test("a site where every page has every tag passes", () => {
  assert.deepEqual(findSeoProblems(writeSite({})), []);
});

test("a page missing a required tag is reported by name", () => {
  const dist = writeSite({ "about/index.html": head("/about/", { "og:image:alt": null, title: null }) });
  assert.deepEqual(findSeoProblems(dist), [
    "about/index.html: missing <title>",
    "about/index.html: missing og:image:alt",
  ]);
});

test("canonical, og:url and og:image must be absolute https URLs", () => {
  const dist = writeSite({
    "about/index.html": head("/about/", {
      canonical: '<link rel="canonical" href="/about/">',
      "og:url": `<meta property="og:url" content="http://example.github.io/about/">`,
      "og:image": '<meta property="og:image" content="/og.png">',
    }),
  });
  assert.deepEqual(findSeoProblems(dist), [
    "about/index.html: canonical is not an absolute https URL: /about/",
    "about/index.html: og:url is not an absolute https URL: http://example.github.io/about/",
    "about/index.html: og:image is not an absolute https URL: /og.png",
  ]);
});

test("canonical and og:url must point at the page itself", () => {
  const dist = writeSite({
    "about/index.html": head("/about/", { "og:url": `<meta property="og:url" content="${SITE}/">` }),
    "index.html": head("/", { canonical: `<link rel="canonical" href="${SITE}/about/">` }),
  });
  assert.deepEqual(findSeoProblems(dist), [
    "about/index.html: og:url points at /, not /about/",
    "index.html: canonical points at /about/, not /",
  ]);
});

test("an og:image on the site must exist in the built output", () => {
  const dist = writeSite({
    "about/index.html": head("/about/", { "og:image": `<meta property="og:image" content="${SITE}/_astro/gone.png">` }),
  });
  assert.deepEqual(findSeoProblems(dist), ["about/index.html: og:image /_astro/gone.png is not in the built site"]);
});

test("robots.txt must exist and must not block crawling", () => {
  assert.deepEqual(findSeoProblems(writeSite({ "robots.txt": null })), ["robots.txt: missing"]);
  assert.deepEqual(findSeoProblems(writeSite({ "robots.txt": "User-agent: *\nDisallow: /\n" })), [
    "robots.txt: blocks crawling with Disallow: /",
  ]);
});

test("robots.txt must name a sitemap that the site serves", () => {
  assert.deepEqual(findSeoProblems(writeSite({ "robots.txt": "User-agent: *\nAllow: /\n" })), [
    "robots.txt: no Sitemap line",
  ]);
  assert.deepEqual(findSeoProblems(writeSite({ "sitemap-index.xml": null })), [
    "robots.txt: sitemap /sitemap-index.xml is not in the built site",
  ]);
});

test("every page's canonical URL must be in the sitemap", () => {
  const dist = writeSite({ "sitemap-0.xml": SITEMAP(["/"]) });
  assert.deepEqual(findSeoProblems(dist), [`sitemap: ${SITE}/about/ is not listed`]);
});
