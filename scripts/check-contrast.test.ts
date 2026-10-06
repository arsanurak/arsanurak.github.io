import { test } from "node:test";
import assert from "node:assert/strict";
import { contrastRatio, findContrastFailures, readThemes } from "./check-contrast.ts";

test("contrast ratio matches the WCAG formula", () => {
  assert.equal(contrastRatio("#000000", "#ffffff").toFixed(2), "21.00");
  assert.equal(contrastRatio("#fff", "#fff").toFixed(2), "1.00");
  assert.equal(contrastRatio("#767676", "#ffffff").toFixed(2), "4.54");
});

const css =
  ":root{color-scheme:light dark;--font-sans:Plex,sans-serif;--ground:#fff;--ink:#000;--muted:#767676}" +
  "@media (prefers-color-scheme:dark){:root{--ground:#000;--ink:#fff}}" +
  "body{color:var(--ink)}";

test("light tokens come from :root, dark tokens override them inside the dark media query", () => {
  const { light, dark } = readThemes(css);
  assert.deepEqual(light, { ground: "#fff", ink: "#000", muted: "#767676" });
  assert.deepEqual(dark, { ground: "#000", ink: "#fff", muted: "#767676" });
});

test("the dark media query is found with or without spaces", () => {
  const { dark } = readThemes(":root{--ink:#000}@media(prefers-color-scheme: dark){:root{--ink:#fff}}");
  assert.deepEqual(dark, { ink: "#fff" });
});

test("pairs that meet AA in both themes pass", () => {
  assert.deepEqual(findContrastFailures(css, [["ink", "ground"]]), []);
});

test("a pair below 4.5:1 is reported with its theme and ratio", () => {
  const failing = css.replace("--muted:#767676", "--muted:#888");
  assert.deepEqual(findContrastFailures(failing, [["muted", "ground"]]), [
    "light: muted on ground is 3.54:1 (needs 4.5:1)",
  ]);
});

test("a token missing from the CSS is reported, not skipped", () => {
  assert.deepEqual(findContrastFailures(css, [["accent", "ground"]]), [
    "light: token --accent not found",
    "dark: token --accent not found",
  ]);
});
