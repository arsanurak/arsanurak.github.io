// Fails if any internal link in the built site (an href, src, srcset candidate
// or xlink:href on the site itself, including absolute URLs on the site's own
// origin) points at a page or file that doesn't exist, or at an anchor with no
// matching id on the target page. Links to other sites are not checked. The
// site's origin comes from astro.config.mjs. Usage: node scripts/check-links.ts <dist-dir>
import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { elements, listPages, resolveServedPath, servedPath } from "./built-site.ts";

// The URLs in a srcset: each candidate is a URL, then optional descriptors,
// separated by commas. A URL may itself contain commas (a data: URL), so it
// runs to the next whitespace.
function srcsetUrls(srcset: string): string[] {
  const urls: string[] = [];
  let rest = srcset;
  while ((rest = rest.replace(/^[\s,]+/, "")) !== "") {
    const url = rest.match(/^\S+/)![0];
    rest = rest.slice(url.length);
    if (url.endsWith(",")) {
      urls.push(url.replace(/,+$/, ""));
      continue;
    }
    urls.push(url);
    rest = rest.replace(/^[^,]*/, "");
  }
  return urls;
}

// Every URL an element links to.
function linksIn(attributes: Record<string, string>): string[] {
  const links = ["href", "src", "xlink:href"].flatMap((name) => (name in attributes ? [attributes[name]] : []));
  if (attributes.srcset) links.push(...srcsetUrls(attributes.srcset));
  return links;
}

export function findBrokenLinks(distDir: string, { site }: { site: string }): string[] {
  const origin = new URL(site).origin;
  const problems: string[] = [];
  const ids = new Map<string, Set<string>>();
  const idsIn = (file: string) => {
    if (!ids.has(file)) {
      ids.set(file, new Set(elements(readFileSync(file, "utf8")).flatMap(({ attributes }) => attributes.id ?? [])));
    }
    return ids.get(file)!;
  };

  for (const file of listPages(distDir)) {
    const from = relative(distDir, file);
    const base = new URL(servedPath(from), site);
    for (const { attributes } of elements(readFileSync(file, "utf8"))) {
      for (const link of linksIn(attributes)) {
        const url = new URL(link, base);
        if (url.origin !== origin) continue;
        const target = resolveServedPath(distDir, decodeURIComponent(url.pathname));
        if (!target) {
          problems.push(`${from}: ${link} (no such page or file)`);
          continue;
        }
        const fragment = decodeURIComponent(url.hash.slice(1));
        if (fragment && !idsIn(target).has(fragment)) {
          problems.push(`${from}: ${link} (no element with id "${fragment}")`);
        }
      }
    }
  }
  return problems;
}

if (import.meta.main) {
  const distDir = process.argv[2] ?? "dist";
  const { default: config } = await import("../astro.config.mjs");
  if (!config.site) throw new Error("astro.config.mjs must set `site`, the origin internal links are checked against.");
  const problems = findBrokenLinks(distDir, { site: config.site });
  if (problems.length > 0) {
    console.error(`Found broken internal links in ${distDir}:\n${problems.map((p) => `  ${p}`).join("\n")}`);
    process.exit(1);
  }
  console.log(`Every internal link and anchor in ${distDir} resolves.`);
}
