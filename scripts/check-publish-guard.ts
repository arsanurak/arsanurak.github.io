// Publish guard: fails if the built site contains any term from a private
// denylist. The list never enters the repo. Matches are reported by file and
// entry number only, so the terms never show up in CI logs.
// Usage: node scripts/check-publish-guard.ts <dist-dir>
import { existsSync, readFileSync } from "node:fs";
import { relative } from "node:path";
import { listFiles } from "./list-files.ts";

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

type Entry = { entry: number; matches: (text: string) => boolean };

const PHONE_ENTRY = /^\+?[\d\s\-.()]+$/;
const SEPARATORS = "[\\s\\-.()]*";

// A phone entry matches its number however it is written: with or without
// spaces, dashes, dots or brackets, a trunk 0, or a +country code. Write the
// entry in national form ("012 345 6789"), or international form with a
// separator after the country code ("+00 12 345 6789").
function phoneMatcher(line: string, entry: number): (text: string) => boolean {
  if (/^\+\d+$/.test(line)) {
    throw new Error(`Publish guard: denylist entry ${entry} needs a space or dash after the country code.`);
  }
  const core = line.replace(/^\+\d+/, "").replace(/\D/g, "").replace(/^0+/, "");
  const prefix = `(?:\\+${SEPARATORS}\\d{1,3}${SEPARATORS}(?:0${SEPARATORS})?|0${SEPARATORS})?`;
  const pattern = new RegExp(`(?<!\\d)${prefix}${[...core].join(SEPARATORS)}(?!\\d)`);
  return (text) => pattern.test(text);
}

function parseDenylist(text: string): Entry[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
    .map((line, i) => {
      if (PHONE_ENTRY.test(line) && line.replace(/\D/g, "").length >= 7) {
        return { entry: i + 1, matches: phoneMatcher(line, i + 1) };
      }
      const term = normalise(line);
      return { entry: i + 1, matches: (text: string) => text.includes(term) };
    });
}

function findDenylisted(distDir: string, entries: Entry[]): string[] {
  const problems: string[] = [];
  for (const file of listFiles(distDir)) {
    const text = normalise(readFileSync(file, "utf8"));
    for (const { entry, matches } of entries) {
      if (matches(text)) problems.push(`${relative(distDir, file)}: matches denylist entry ${entry}`);
    }
  }
  return problems;
}

const LOCAL_FILE = ".publish-guard-denylist";
const SECRET_ENV = "PUBLISH_GUARD_DENYLIST";

// The environment variable wins when set. In CI it carries the Actions secret
// and is the only source. Locally the list comes from a gitignored file.
function readDenylist(inCI: boolean): string {
  const fromEnv = process.env[SECRET_ENV] ?? "";
  if (fromEnv.trim() !== "" || inCI) return fromEnv;
  return existsSync(LOCAL_FILE) ? readFileSync(LOCAL_FILE, "utf8") : "";
}

const distDir = process.argv[2] ?? "dist";
const inCI = process.env.GITHUB_ACTIONS === "true";
let entries: Entry[];
try {
  entries = parseDenylist(readDenylist(inCI));
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

if (entries.length === 0) {
  // Fail closed in CI. A pull request from a fork or Dependabot gets no
  // Actions secrets, so it can only warn; the guard runs again with the list
  // once the change reaches main.
  const where = inCI ? `the ${SECRET_ENV} Actions secret` : `${LOCAL_FILE} (one term per line)`;
  if (inCI && process.env.PUBLISH_GUARD_NO_SECRETS !== "true") {
    console.error(`Publish guard: no denylist. Set ${where}.`);
    process.exit(1);
  }
  console.warn(`Publish guard warning: no denylist, so ${distDir} was not scanned. Add ${where}.`);
  process.exit(0);
}

const problems = findDenylisted(distDir, entries);
if (problems.length > 0) {
  console.error(
    `Denylisted strings in ${distDir} (entry numbers count terms in the list, skipping blanks and comments):\n` +
      problems.map((p) => `  ${p}`).join("\n"),
  );
  process.exit(1);
}
console.log(`No denylisted strings in ${distDir} (${entries.length} entries checked).`);
