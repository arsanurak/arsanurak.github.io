// Fails if the built site ships any JavaScript: a <script> element in a page
// or SVG, or an emitted .js/.mjs/.cjs file. Usage: node scripts/check-no-js.ts <dist-dir>
import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { listFiles } from "./list-files.ts";

const SCRIPT_ELEMENT = /<script[\s>]/i;
const JS_FILE = /\.(?:js|mjs|cjs)$/i;
const MARKUP_FILE = /\.(?:html|svg)$/i;

export function findJavaScript(distDir: string): string[] {
  const problems: string[] = [];
  for (const file of listFiles(distDir)) {
    const path = relative(distDir, file);
    if (JS_FILE.test(file)) {
      problems.push(`${path}: JavaScript file`);
    } else if (MARKUP_FILE.test(file) && SCRIPT_ELEMENT.test(readFileSync(file, "utf8"))) {
      problems.push(`${path}: <script> element`);
    }
  }
  return problems;
}

if (import.meta.main) {
  const distDir = process.argv[2] ?? "dist";
  const problems = findJavaScript(distDir);
  if (problems.length > 0) {
    console.error(`Found JavaScript in ${distDir}:\n${problems.map((p) => `  ${p}`).join("\n")}`);
    process.exit(1);
  }
  console.log(`No JavaScript in ${distDir}.`);
}
