// Publish guard: fails if the built site contains any term from a private
// denylist. The list never enters the repo. Matches are reported by file and
// term position only, so the terms never show up in CI logs.
// Usage: node scripts/check-publish-guard.ts <dist-dir>
import { existsSync, readFileSync } from "node:fs";
import { relative } from "node:path";
import { listFiles } from "./built-site.ts";

const NAMED_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

// Lower-cased, HTML entities decoded and whitespace runs collapsed, so a term
// is found however the markup spells or wraps it.
function normalise(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match)
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// One term from the list. `position` counts terms from 1, skipping blank lines
// and comments; reports use it in place of the term itself.
export type DenylistTerm = { position: number; matches: (normalisedText: string) => boolean };

const PHONE_ENTRY = /^\+?[\d\s\-.()]+$/;
const SEPARATORS = "[\\s\\-.()]*";

// A phone entry matches its number however it is written: with or without
// spaces, dashes, dots or brackets, a trunk 0, or a country code (with or
// without the +). Write the entry in national form ("012 345 6789"), or
// international form with a separator after the country code ("+00 12 345 6789").
function phoneMatcher(line: string, position: number): DenylistTerm["matches"] {
  if (/^\+\d+$/.test(line)) {
    throw new Error(`Publish guard: denylist entry ${position} needs a space or dash after the country code.`);
  }
  const countryCode = line.match(/^\+(\d+)/)?.[1];
  const core = line.replace(/^\+\d+/, "").replace(/\D/g, "").replace(/^0+/, "");
  const trunk = `(?:0${SEPARATORS})?`;
  const prefixes = [`\\+${SEPARATORS}\\d{1,3}${SEPARATORS}${trunk}`, `0${SEPARATORS}`];
  if (countryCode) prefixes.push(`${countryCode}${SEPARATORS}${trunk}`);
  const pattern = new RegExp(`(?<!\\d)(?:${prefixes.join("|")})?${[...core].join(SEPARATORS)}(?!\\d)`);
  return (text) => pattern.test(text);
}

export function parseDenylist(text: string): DenylistTerm[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
    .map((line, i) => {
      const position = i + 1;
      if (PHONE_ENTRY.test(line) && line.replace(/\D/g, "").length >= 7) {
        return { position, matches: phoneMatcher(line, position) };
      }
      const term = normalise(line);
      return { position, matches: (text: string) => text.includes(term) };
    });
}

// Every text file in the built site, checked against every term.
export function findDenylisted(distDir: string, terms: DenylistTerm[]): string[] {
  const problems: string[] = [];
  for (const file of listFiles(distDir)) {
    const text = normalise(readFileSync(file, "utf8"));
    for (const { position, matches } of terms) {
      if (matches(text)) problems.push(`${relative(distDir, file)}: matches denylist entry ${position}`);
    }
  }
  return problems;
}

// The environment variable wins when set. In CI it carries the Actions secret
// and is the only source. Locally the list comes from a gitignored file.
export function chooseDenylist({ fromEnv, fromFile, inCI }: { fromEnv?: string; fromFile?: string; inCI: boolean }): string {
  if ((fromEnv ?? "").trim() !== "" || inCI) return fromEnv ?? "";
  return fromFile ?? "";
}

// What to do with no list. CI fails closed, unless the run gets no Actions
// secrets: then the list can't be there, so it warns, and the guard runs again
// with the list once the change reaches main. Locally it warns.
export function whenListMissing({ inCI, secretsAvailable }: { inCI: boolean; secretsAvailable: boolean }): "fail" | "warn" {
  return inCI && secretsAvailable ? "fail" : "warn";
}

const LOCAL_FILE = ".publish-guard-denylist";
const SECRET_ENV = "PUBLISH_GUARD_DENYLIST";

if (import.meta.main) {
  const distDir = process.argv[2] ?? "dist";
  const inCI = process.env.GITHUB_ACTIONS === "true";
  // Set by the workflow. Anything but "false" counts as available, so a
  // missing value fails closed.
  const secretsAvailable = process.env.PUBLISH_GUARD_SECRETS_AVAILABLE !== "false";
  let terms: DenylistTerm[];
  try {
    const fromFile = existsSync(LOCAL_FILE) ? readFileSync(LOCAL_FILE, "utf8") : undefined;
    terms = parseDenylist(chooseDenylist({ fromEnv: process.env[SECRET_ENV], fromFile, inCI }));
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }

  if (terms.length === 0) {
    const where = inCI ? `the ${SECRET_ENV} Actions secret` : `${LOCAL_FILE} (one term per line)`;
    if (whenListMissing({ inCI, secretsAvailable }) === "fail") {
      console.error(`Publish guard: no denylist. Set ${where}.`);
      process.exit(1);
    }
    console.warn(`Publish guard warning: no denylist, so ${distDir} was not scanned. Add ${where}.`);
    process.exit(0);
  }

  const problems = findDenylisted(distDir, terms);
  if (problems.length > 0) {
    console.error(
      `Denylisted strings in ${distDir} (entry numbers count terms in the list, skipping blanks and comments):\n` +
        problems.map((p) => `  ${p}`).join("\n"),
    );
    process.exit(1);
  }
  console.log(`No denylisted strings in ${distDir} (${terms.length} entries checked).`);
}
