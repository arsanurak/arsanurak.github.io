// Fails if any text colour pair in the built CSS is below WCAG AA (4.5:1) in
// either theme. Light tokens are the :root custom properties; dark tokens are
// the same properties overridden under prefers-color-scheme: dark.
// Usage: node scripts/check-contrast.ts <dist-dir>
import { readFileSync } from "node:fs";
import { listFiles } from "./list-files.ts";

type Tokens = Record<string, string>;
type Pair = [text: string, background: string];

const AA = 4.5;

// Text-on-background pairs used by the site's pages. Add a pair here whenever a
// component puts a text token on a new background token.
export const TEXT_PAIRS: Pair[] = [
  ["ink", "ground"],
  ["body", "ground"],
  ["muted", "ground"],
  ["accent", "ground"],
  ["ink", "band"],
  ["body", "band"],
  ["muted", "band"],
  ["accent", "band"],
  ["ink", "card"],
  ["body", "card"],
  ["muted", "card"],
  ["accent", "card"],
  ["ink", "footer"],
  ["body", "footer"],
  ["muted", "footer"],
  ["accent", "footer"],
  ["accent-light", "card"],
  ["ground", "ink"],
];

const DARK_BLOCK = /@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)\s*\{\s*:root\s*\{([^}]*)\}\s*\}/g;
const ROOT_BLOCK = /:root\s*\{([^}]*)\}/g;
const COLOUR_TOKEN = /--([\w-]+)\s*:\s*(#[0-9a-f]{3}(?:[0-9a-f]{3})?)\b/gi;

function colourTokens(declarations: string): Tokens {
  return Object.fromEntries([...declarations.matchAll(COLOUR_TOKEN)].map(([, name, value]) => [name, value]));
}

export function readThemes(css: string): { light: Tokens; dark: Tokens } {
  const darkOverrides = [...css.matchAll(DARK_BLOCK)].map(([, body]) => colourTokens(body));
  const lightCss = css.replace(DARK_BLOCK, "");
  const light = Object.assign({}, ...[...lightCss.matchAll(ROOT_BLOCK)].map(([, body]) => colourTokens(body)));
  return { light, dark: Object.assign({ ...light }, ...darkOverrides) };
}

function luminance(hex: string): number {
  const digits = hex.slice(1);
  const full = digits.length === 3 ? [...digits].map((d) => d + d).join("") : digits;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function findContrastFailures(css: string, pairs: Pair[] = TEXT_PAIRS): string[] {
  const failures: string[] = [];
  for (const [theme, tokens] of Object.entries(readThemes(css))) {
    for (const [text, background] of pairs) {
      const missing = [text, background].filter((name) => !(name in tokens));
      if (missing.length > 0) {
        failures.push(...missing.map((name) => `${theme}: token --${name} not found`));
        continue;
      }
      const ratio = contrastRatio(tokens[text], tokens[background]);
      if (ratio < AA) {
        failures.push(`${theme}: ${text} on ${background} is ${ratio.toFixed(2)}:1 (needs ${AA}:1)`);
      }
    }
  }
  return failures;
}

if (import.meta.main) {
  const distDir = process.argv[2] ?? "dist";
  // Stylesheets are inlined into the pages, so read <style> blocks from HTML too.
  const css = listFiles(distDir)
    .filter((path) => path.endsWith(".css") || path.endsWith(".html"))
    .map((path) => {
      const text = readFileSync(path, "utf8");
      if (path.endsWith(".css")) return text;
      return [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(([, body]) => body).join("\n");
    })
    .join("\n");
  const failures = findContrastFailures(css);
  if (failures.length > 0) {
    console.error(`Contrast below WCAG AA:\n${failures.map((f) => `  ${f}`).join("\n")}`);
    process.exit(1);
  }
  console.log(`All ${TEXT_PAIRS.length} text colour pairs meet WCAG AA.`);
}
