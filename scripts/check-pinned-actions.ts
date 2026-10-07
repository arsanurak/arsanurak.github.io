// Fails if any workflow step uses an action not pinned to a full commit SHA
// (or a Docker image not pinned to a digest), so a moved tag can't change what
// runs. Usage: node scripts/check-pinned-actions.ts <workflows-dir>
import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { listFiles } from "./list-files.ts";

// A `uses:` key and its (optionally quoted) value: at the start of a line, with
// or without a leading list dash, or after `{` or `,` in a flow-style mapping
// such as `- { name: x, uses: actions/checkout@v4 }`.
const USES = /(?:^\s*(?:-\s+)?|[{,]\s*)uses:\s*["']?([^\s"'#,}]+)/;
const FULL_SHA = /@[0-9a-f]{40}$/;
const DOCKER_DIGEST = /^docker:\/\/[^@]+@sha256:[0-9a-f]{64}$/;

// Local actions (./path) come from this repo's own checkout, so need no pin.
function isPinned(ref: string): boolean {
  if (ref.startsWith("./")) return true;
  if (ref.startsWith("docker://")) return DOCKER_DIGEST.test(ref);
  return FULL_SHA.test(ref);
}

export function findUnpinnedActions(workflowsDir: string): string[] {
  const problems: string[] = [];
  for (const file of listFiles(workflowsDir)) {
    const path = relative(workflowsDir, file);
    readFileSync(file, "utf8").split("\n").forEach((line, i) => {
      const ref = USES.exec(line)?.[1];
      if (ref && !isPinned(ref)) problems.push(`${path}:${i + 1}: ${ref}`);
    });
  }
  return problems;
}

if (import.meta.main) {
  const workflowsDir = process.argv[2] ?? ".github/workflows";
  const problems = findUnpinnedActions(workflowsDir);
  if (problems.length > 0) {
    console.error(`Actions not pinned to a commit SHA in ${workflowsDir}:\n${problems.map((p) => `  ${p}`).join("\n")}`);
    process.exit(1);
  }
  console.log(`Every action in ${workflowsDir} is pinned to a commit SHA.`);
}
