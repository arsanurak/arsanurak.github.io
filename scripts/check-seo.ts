// Fails if a built page lacks what search engines and link previews need:
// <title>, meta description, canonical URL and the Open Graph tags, with
// absolute https URLs. Usage: node scripts/check-seo.ts <dist-dir>
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { elements, listPages, servedPath } from "./built-site.ts";

// The page's head as a crawler reads it: non-empty values only.
type Head = { title?: string; meta: Map<string, string>; links: Map<string, string> };

function readHead(html: string): Head {
  const meta = new Map<string, string>();
  for (const { attributes } of elements(html, "meta")) {
    const key = attributes.property ?? attributes.name;
    const content = attributes.content?.trim();
    if (key && content) meta.set(key, content);
  }
  const links = new Map<string, string>();
  for (const { attributes } of elements(html, "link")) {
    if (attributes.rel && attributes.href) links.set(attributes.rel, attributes.href);
  }
  return { title: html.match(/<title>([^<]*)<\/title>/i)?.[1].trim() || undefined, meta, links };
}

// Every tag a page needs: its name in reports, where to read it, and whether
// it is a URL that must be absolute https ("absolute") and also point at the
// page itself ("self").
type RequiredTag = { name: string; read: (head: Head) => string | undefined; url?: "absolute" | "self" };
const meta = (key: string) => (head: Head) => head.meta.get(key);

const REQUIRED_TAGS: RequiredTag[] = [
  { name: "<title>", read: (head) => head.title },
  { name: "meta description", read: meta("description") },
  { name: "canonical", read: (head) => head.links.get("canonical"), url: "self" },
  { name: "og:title", read: meta("og:title") },
  { name: "og:type", read: meta("og:type") },
  { name: "og:description", read: meta("og:description") },
  { name: "og:url", read: meta("og:url"), url: "self" },
  { name: "og:image", read: meta("og:image"), url: "absolute" },
  { name: "og:image:width", read: meta("og:image:width") },
  { name: "og:image:height", read: meta("og:image:height") },
  { name: "og:image:alt", read: meta("og:image:alt") },
];

function httpsUrl(value: string): URL | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}

// Each required tag is present, and its URL (if it is one) is valid.
function findTagProblems(path: string, head: Head): string[] {
  const problems: string[] = [];
  for (const { name, read, url } of REQUIRED_TAGS) {
    const value = read(head);
    if (value === undefined) {
      problems.push(`${path}: missing ${name}`);
      continue;
    }
    if (!url) continue;
    const parsed = httpsUrl(value);
    if (!parsed) problems.push(`${path}: ${name} is not an absolute https URL: ${value}`);
    else if (url === "self" && parsed.pathname !== servedPath(path)) {
      problems.push(`${path}: ${name} points at ${parsed.pathname}, not ${servedPath(path)}`);
    }
  }
  return problems;
}

// An og:image on the site's own origin must be one the build emitted.
function findImageProblems(distDir: string, path: string, head: Head): string[] {
  const image = httpsUrl(head.meta.get("og:image") ?? "");
  const canonical = httpsUrl(head.links.get("canonical") ?? "");
  if (!image || !canonical || image.origin !== canonical.origin) return [];
  const imagePath = decodeURIComponent(image.pathname);
  return existsSync(join(distDir, imagePath)) ? [] : [`${path}: og:image ${imagePath} is not in the built site`];
}

export function findSeoProblems(distDir: string): string[] {
  const problems: string[] = [];
  const canonicals: string[] = [];
  for (const file of listPages(distDir)) {
    const path = relative(distDir, file);
    const head = readHead(readFileSync(file, "utf8"));
    problems.push(...findTagProblems(path, head), ...findImageProblems(distDir, path, head));
    const canonical = httpsUrl(head.links.get("canonical") ?? "");
    if (canonical) canonicals.push(canonical.href);
  }
  return [...problems, ...findCrawlProblems(distDir, canonicals)];
}

// robots.txt must allow crawling and name a sitemap, and the sitemap (or the
// sitemaps its index points to) must list every page.
function findCrawlProblems(distDir: string, canonicals: string[]): string[] {
  const robots = join(distDir, "robots.txt");
  if (!existsSync(robots)) return ["robots.txt: missing"];
  const lines = readFileSync(robots, "utf8").split("\n").map((line) => line.replace(/#.*/, "").trim());
  if (lines.some((line) => /^disallow:\s*\/$/i.test(line))) return ["robots.txt: blocks crawling with Disallow: /"];
  const sitemap = lines.map((line) => line.match(/^sitemap:\s*(\S+)$/i)?.[1]).find(Boolean);
  if (!sitemap) return ["robots.txt: no Sitemap line"];

  const listed = new Set<string>();
  const queue = [sitemap];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    const path = decodeURIComponent(httpsUrl(next)?.pathname ?? next);
    const file = join(distDir, path);
    if (!existsSync(file)) return [`robots.txt: sitemap ${path} is not in the built site`];
    for (const [, loc] of readFileSync(file, "utf8").matchAll(/<loc>\s*([^<]*?)\s*<\/loc>/g)) {
      if (loc.endsWith(".xml")) queue.push(loc);
      else listed.add(loc);
    }
  }
  return canonicals.filter((url) => !listed.has(url)).map((url) => `sitemap: ${url} is not listed`);
}

if (import.meta.main) {
  const distDir = process.argv[2] ?? "dist";
  const problems = findSeoProblems(distDir);
  if (problems.length > 0) {
    console.error(`Pages missing SEO or link-preview tags in ${distDir}:\n${problems.map((p) => `  ${p}`).join("\n")}`);
    process.exit(1);
  }
  console.log(`Every page in ${distDir} has its title, description, canonical and Open Graph tags.`);
}
