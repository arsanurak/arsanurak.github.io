import { test } from "node:test";
import assert from "node:assert/strict";
import { findUnpinnedActions } from "./check-pinned-actions.ts";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeSite } from "./test-site.ts";

const SHA = "3d3c42e5aac5ba805825da76410c181273ba90b1";

test("actions pinned to a full commit SHA pass", () => {
  const dir = writeSite({
    "ci.yml": `jobs:\n  a:\n    steps:\n      - uses: actions/checkout@${SHA} # v7.0.1\n      - run: echo hi\n`,
  });
  assert.deepEqual(findUnpinnedActions(dir), []);
});

test("an action pinned to a tag or branch is reported with file and line", () => {
  const dir = writeSite({
    "deploy.yml": `jobs:\n  a:\n    steps:\n      - uses: withastro/action@v6\n      - name: x\n        uses: "actions/deploy-pages@main"\n`,
  });
  assert.deepEqual(findUnpinnedActions(dir), [
    "deploy.yml:4: withastro/action@v6",
    "deploy.yml:6: actions/deploy-pages@main",
  ]);
});

test("a flow-style step is checked like a block-style one", () => {
  const dir = writeSite({
    "ci.yml": `steps:\n  - { uses: actions/checkout@v4 }\n  - { name: x, uses: "actions/setup-node@main" }\n  - { uses: actions/checkout@${SHA} }\n`,
  });
  assert.deepEqual(findUnpinnedActions(dir), ["ci.yml:2: actions/checkout@v4", "ci.yml:3: actions/setup-node@main"]);
});

test("local actions in this repo need no pin", () => {
  const dir = writeSite({ "ci.yml": "steps:\n  - uses: ./.github/actions/setup\n" });
  assert.deepEqual(findUnpinnedActions(dir), []);
});

test("a Docker image must be pinned to a sha256 digest", () => {
  const digest = "a".repeat(64);
  const dir = writeSite({
    "ci.yml": `steps:\n  - uses: docker://alpine:3.20\n  - uses: docker://alpine@sha256:${digest}\n`,
  });
  assert.deepEqual(findUnpinnedActions(dir), ["ci.yml:2: docker://alpine:3.20"]);
});

test("a missing workflows directory is an error, not a pass", () => {
  assert.throws(() => findUnpinnedActions(join(tmpdir(), "does-not-exist-workflows")));
});
