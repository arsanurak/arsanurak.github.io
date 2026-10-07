// Prints the key Lighthouse metrics for every run lhci collected, so a failed
// performance assertion in CI shows which metric moved, not just the score.
import { readdirSync, readFileSync } from "node:fs";

const dir = ".lighthouseci";
const metrics = [
  "first-contentful-paint",
  "largest-contentful-paint",
  "cumulative-layout-shift",
  "total-blocking-time",
  "speed-index",
];

for (const file of readdirSync(dir).filter((f) => f.startsWith("lhr-") && f.endsWith(".json"))) {
  const report = JSON.parse(readFileSync(`${dir}/${file}`, "utf8"));
  const path = new URL(report.finalDisplayedUrl).pathname;
  const values = metrics.map((id) => `${id.replace(/-/g, " ")} ${report.audits[id].displayValue}`);
  console.log(`${path}  performance ${report.categories.performance.score}  ·  ${values.join("  ·  ")}`);
}
