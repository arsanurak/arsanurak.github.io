import { test } from "node:test";
import assert from "node:assert/strict";
import remarkDiagrams, { type MdNode as Node } from "./remark-diagrams.ts";

function run(...blocks: Node[]): Node[] {
  const tree: Node = { type: "root", children: blocks };
  remarkDiagrams()(tree, { path: "src/content/case-studies/example.md" });
  return tree.children!;
}

function transform(...blocks: Node[]): string[] {
  return run(...blocks).map((node) => (node.type === "html" ? node.value! : `[${node.type}]`));
}

const mermaid = (meta: string | null, value = "flowchart LR\n  A[Pilot] --> B[Wave 1]"): Node => ({
  type: "code",
  lang: "mermaid",
  meta,
  value,
});

test("a mermaid block becomes an inline SVG figure labelled with its alt text", () => {
  const [html] = transform(mermaid('alt="Pilot first, then wave 1"'));
  assert.match(html, /^<figure class="diagram">/);
  assert.match(html, /<svg[^>]* role="img"[^>]* aria-label="Pilot first, then wave 1"/);
  assert.match(html, /<text[^>]*>Pilot<\/text>/);
});

test("a caption becomes a figcaption", () => {
  const [html] = transform(mermaid('alt="x" caption="Figure 1. Waves & gates"'));
  assert.match(html, /<figcaption>Figure 1\. Waves &amp; gates<\/figcaption><\/figure>$/);
});

test("a mermaid block without alt text fails the build and names the file", () => {
  assert.throws(() => transform(mermaid(null)), /alt text.*example\.md/);
  assert.throws(() => transform(mermaid('caption="only a caption"')), /alt text/);
});

test("the SVG makes no third-party requests", () => {
  const [html] = transform(mermaid('alt="x"'));
  assert.doesNotMatch(html, /@import|https?:\/\/(?!www\.w3\.org)/);
});

test("ids are unique across diagrams on one page and references follow them", () => {
  const html = transform(mermaid('alt="one"'), mermaid('alt="two"')).join("\n");
  const ids = [...html.matchAll(/ id="([^"]+)"/g)].map(([, id]) => id);
  assert.ok(ids.length > 2);
  assert.equal(new Set(ids).size, ids.length, `duplicate ids: ${ids}`);
  for (const [, ref] of html.matchAll(/url\(#([^)]+)\)/g)) {
    assert.ok(ids.includes(ref), `url(#${ref}) points at no element`);
  }
});

test("the SVG's styles are scoped to that diagram", () => {
  const [html] = transform(mermaid('alt="x"'));
  const style = html.match(/<style>([\s\S]*?)<\/style>/)![1].replace(/\/\*[\s\S]*?\*\//g, "");
  const selectors = [...style.matchAll(/([^{}]+)\{/g)].flatMap(([, s]) => s.split(",").map((x) => x.trim()));
  assert.ok(selectors.length > 0);
  for (const selector of selectors) assert.match(selector, /^#diagram-1(\s|$)/);
});

test("other code blocks are left alone", () => {
  assert.deepEqual(transform({ type: "code", lang: "sh", meta: null, value: "ls" }), ["[code]"]);
});

const imageParagraph = (alt: string | null, title: string | null = null): Node => ({
  type: "paragraph",
  children: [{ type: "image", url: "./rollback.svg", alt, title }],
});

test("an image on its own line becomes a figure, its title a visible caption", () => {
  const [figure] = run(imageParagraph("Old platform at zero replicas", "Figure 2. Rollback state"));
  assert.equal(figure.data?.hName, "figure");
  assert.deepEqual(figure.data?.hProperties, { className: ["diagram"] });
  const [image, caption] = figure.children!;
  assert.equal(image.type, "image");
  assert.equal(image.title, null);
  assert.equal(caption.data?.hName, "figcaption");
  assert.deepEqual(caption.children, [{ type: "text", value: "Figure 2. Rollback state" }]);
});

test("an image without alt text fails the build", () => {
  assert.throws(() => run(imageParagraph("")), /alt text.*rollback\.svg.*example\.md/);
  assert.throws(() => run(imageParagraph(null)), /alt text/);
});
