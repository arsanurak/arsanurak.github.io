// Test helpers shared by the check scripts' tests: a throwaway built site.
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

// Writes files (keyed by path under the site) into a fresh temp dir and
// returns it. A null value skips the file, so callers can drop a default.
export function writeSite(files: Record<string, string | Buffer | null>): string {
  const root = mkdtempSync(join(tmpdir(), "site-"));
  for (const [path, content] of Object.entries(files)) {
    if (content === null) continue;
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

// A minimal valid page around the given body markup.
export const page = (body: string) =>
  `<!doctype html><html lang="en"><head><title>t</title></head><body>${body}</body></html>`;
