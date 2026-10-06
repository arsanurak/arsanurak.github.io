// Fails if a published case-study slug no longer has a page, or a case-study
// page is published without being registered. Published slugs are permanent:
// once a slug is in the registry, renaming or removing its case study breaks
// this check. Usage: node scripts/check-slugs.ts <dist-dir>
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { SLUG_PATTERN, caseStudyPath } from "../src/lib/case-study-slugs.ts";

export const REGISTRY = "src/content/published-slugs.json";

export function parseRegistry(json: string): string[] {
  const slugs: unknown = JSON.parse(json);
  if (!Array.isArray(slugs)) throw new Error(`${REGISTRY} must be a list of slugs`);
  const seen = new Set<string>();
  for (const slug of slugs) {
    if (typeof slug !== "string" || !SLUG_PATTERN.test(slug)) throw new Error(`Invalid slug in ${REGISTRY}: ${slug}`);
    if (seen.has(slug)) throw new Error(`Slug listed twice in ${REGISTRY}: ${slug}`);
    seen.add(slug);
  }
  return slugs;
}

export function findMissingSlugs(distDir: string, slugs: string[]): string[] {
  return slugs
    .filter((slug) => !existsSync(join(distDir, caseStudyPath(slug), "index.html")))
    .map((slug) => `${slug}: no page at ${caseStudyPath(slug)}`);
}

export function findUnregisteredPages(distDir: string, slugs: string[]): string[] {
  const dir = join(distDir, "case-studies");
  const published = existsSync(dir) ? readdirSync(dir).filter((name) => existsSync(join(dir, name, "index.html"))) : [];
  return published
    .filter((slug) => !slugs.includes(slug))
    .map((slug) => `${slug}: ${caseStudyPath(slug)} is published but not in the registry`);
}

if (import.meta.main) {
  const distDir = process.argv[2] ?? "dist";
  const slugs = parseRegistry(readFileSync(REGISTRY, "utf8"));
  const problems = [...findMissingSlugs(distDir, slugs), ...findUnregisteredPages(distDir, slugs)];
  if (problems.length > 0) {
    console.error(`Case-study slugs out of step with ${REGISTRY} (slugs are permanent):\n${problems.map((p) => `  ${p}`).join("\n")}`);
    process.exit(1);
  }
  console.log(`All ${slugs.length} published slugs have a page.`);
}
