// Fails if any internal link in the built site (an href or src on the site
// itself, including absolute URLs on the site's own origin) points at a page or
// file that doesn't exist, or at an anchor with no matching id on the target
// page. Links to other sites are not checked. The site's origin comes from
// astro.config.mjs. Usage: node scripts/check-links.ts <dist-dir>
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { listFiles } from "./list-files.ts";

const LINK_ATTRIBUTE = /\s(?:href|src)\s*=\s*"([^"]*)"/gi;
const ID_ATTRIBUTE = /\sid\s*=\s*"([^"]*)"/gi;
// Stands in for the site's origin when none is given.
const DEFAULT_SITE = "https://site.invalid";

function resolvePath(distDir: string, path: string): string | undefined {
  const target = join(distDir, path);
  if (existsSync(target) && statSync(target).isFile()) return target;
  const index = join(target, "index.html");
  if (existsSync(index)) return index;
  return undefined;
}

// The URL a visitor sees for a built file: about/index.html is /about/.
function pageUrl(path: string, site: string): URL {
  return new URL(`/${path.split(sep).join("/").replace(/(^|\/)index\.html$/, "$1")}`, site);
}

export function findBrokenLinks(distDir: string, { site = DEFAULT_SITE }: { site?: string } = {}): string[] {
  const origin = new URL(site).origin;
  const problems: string[] = [];
  const ids = new Map<string, Set<string>>();
  const idsIn = (file: string) => {
    if (!ids.has(file)) {
      ids.set(file, new Set([...readFileSync(file, "utf8").matchAll(ID_ATTRIBUTE)].map(([, id]) => id)));
    }
    return ids.get(file)!;
  };

  for (const file of listFiles(distDir).filter((f) => f.endsWith(".html"))) {
    const from = relative(distDir, file);
    const html = readFileSync(file, "utf8");
    for (const [, href] of html.matchAll(LINK_ATTRIBUTE)) {
      const url = new URL(href, pageUrl(from, site));
      if (url.origin !== origin) continue;
      const target = resolvePath(distDir, decodeURIComponent(url.pathname));
      if (!target) {
        problems.push(`${from}: ${href} (no such page or file)`);
        continue;
      }
      const fragment = decodeURIComponent(url.hash.slice(1));
      if (fragment && !idsIn(target).has(fragment)) {
        problems.push(`${from}: ${href} (no element with id "${fragment}")`);
      }
    }
  }
  return problems;
}

if (import.meta.main) {
  const distDir = process.argv[2] ?? "dist";
  const { default: config } = await import("../astro.config.mjs");
  const problems = findBrokenLinks(distDir, { site: config.site });
  if (problems.length > 0) {
    console.error(`Found broken internal links in ${distDir}:\n${problems.map((p) => `  ${p}`).join("\n")}`);
    process.exit(1);
  }
  console.log(`Every internal link and anchor in ${distDir} resolves.`);
}
