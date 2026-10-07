// Helpers for reading the built site in dist/, shared by the check scripts.
import { existsSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { listFiles } from "./list-files.ts";

export { listFiles };

// Every built page, as paths joined onto distDir, in a stable order.
export function listPages(distDir: string): string[] {
  return listFiles(distDir)
    .filter((file) => file.endsWith(".html"))
    .sort();
}

// The URL path a built file is served at: about/index.html is /about/.
// `path` is relative to distDir.
export function servedPath(path: string): string {
  return `/${path.split(sep).join("/").replace(/(^|\/)index\.html$/, "$1")}`;
}

// The built file a URL path is served from (a file, or a directory's
// index.html), or undefined when the site has none. `urlPath` is decoded.
export function resolveServedPath(distDir: string, urlPath: string): string | undefined {
  const target = join(distDir, urlPath);
  if (existsSync(target) && statSync(target).isFile()) return target;
  const index = join(target, "index.html");
  return existsSync(index) ? index : undefined;
}

export type Element = { tag: string; attributes: Record<string, string> };

const ATTRIBUTE = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const START_TAG = /<([a-z][\w:-]*)((?:\s+[^\s"'<>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/gi;

// Every start tag in the markup with its attributes: names lower-cased,
// values double-, single- or un-quoted, and "" for a bare attribute.
export function elements(html: string, tag?: string): Element[] {
  const found: Element[] = [];
  for (const [, name, attrs] of html.matchAll(START_TAG)) {
    if (tag && name.toLowerCase() !== tag) continue;
    const attributes: Record<string, string> = {};
    for (const [, key, double, single, bare] of attrs.matchAll(ATTRIBUTE)) {
      attributes[key.toLowerCase()] = double ?? single ?? bare ?? "";
    }
    found.push({ tag: name.toLowerCase(), attributes });
  }
  return found;
}
