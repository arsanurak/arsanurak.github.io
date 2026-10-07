// Fails if a built page lacks what search engines and link previews need:
// <title>, meta description, canonical URL and the Open Graph tags, with
// absolute https URLs. Usage: node scripts/check-seo.ts <dist-dir>
import { existsSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { listFiles } from "./list-files.ts";

const OPEN_GRAPH = ["og:title", "og:type", "og:description", "og:url", "og:image", "og:image:width", "og:image:height", "og:image:alt"];

// The attributes of every <tag ...> element in the page.
function elements(html: string, tag: string): Record<string, string>[] {
  return [...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, "gi"))].map(([, attrs]) =>
    Object.fromEntries([...attrs.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)].map(([, name, value]) => [name.toLowerCase(), value])),
  );
}

// The page's head as a crawler reads it: tag name -> non-empty value.
function readHead(html: string): Map<string, string> {
  const found = new Map<string, string>();
  const title = html.match(/<title>([^<]*)<\/title>/i)?.[1].trim();
  if (title) found.set("<title>", title);
  for (const meta of elements(html, "meta")) {
    const name = meta.property ?? meta.name;
    if (name && meta.content?.trim()) found.set(name === "description" ? "meta description" : name, meta.content.trim());
  }
  for (const link of elements(html, "link")) {
    if (link.rel === "canonical" && link.href) found.set("canonical", link.href);
  }
  return found;
}

const URL_TAGS = ["canonical", "og:url", "og:image"];
const SELF_TAGS = ["canonical", "og:url"];

function httpsUrl(value: string): URL | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}

// The URL path a built file is served at: about/index.html -> /about/.
function servedPath(path: string): string {
  return `/${path.split(sep).join("/").replace(/(^|\/)index\.html$/, "$1")}`;
}

export function findSeoProblems(distDir: string): string[] {
  const problems: string[] = [];
  const canonicals: string[] = [];
  for (const file of listFiles(distDir).filter((f) => f.endsWith(".html")).sort()) {
    const path = relative(distDir, file);
    const tags = readHead(readFileSync(file, "utf8"));
    for (const required of ["<title>", "meta description", "canonical", ...OPEN_GRAPH]) {
      if (!tags.has(required)) problems.push(`${path}: missing ${required}`);
    }
    for (const name of URL_TAGS) {
      const value = tags.get(name);
      if (value === undefined) continue;
      const url = httpsUrl(value);
      if (!url) problems.push(`${path}: ${name} is not an absolute https URL: ${value}`);
      else if (SELF_TAGS.includes(name) && url.pathname !== servedPath(path)) {
        problems.push(`${path}: ${name} points at ${url.pathname}, not ${servedPath(path)}`);
      }
    }
    // An image on this site must be one the build emitted.
    const image = httpsUrl(tags.get("og:image") ?? "");
    const canonical = httpsUrl(tags.get("canonical") ?? "");
    if (canonical) canonicals.push(canonical.href);
    if (image && canonical && image.origin === canonical.origin) {
      const imagePath = decodeURIComponent(image.pathname);
      if (!existsSync(join(distDir, imagePath))) problems.push(`${path}: og:image ${imagePath} is not in the built site`);
    }
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
