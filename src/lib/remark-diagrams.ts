// Turns diagrams in Markdown into figures with alt text, at build time.
//
// Mermaid: rendered to inline SVG, so diagrams ship as static markup with no
// browser JavaScript.
//
//   ```mermaid alt="What the diagram shows" caption="Figure 1. Optional caption"
//
// Hand-made SVG or PNG stored next to the Markdown: an image on its own line
// becomes a figure, and its title becomes the visible caption.
//
//   ![What the diagram shows](./diagram.svg "Figure 2. Optional caption")
//
// Alt text is required on both: a diagram without it fails the build. Each
// Mermaid SVG is self-contained: no font @import (the site self-hosts IBM
// Plex), and its ids and styles are scoped so several can share a page.
import { renderMermaidSVG } from "beautiful-mermaid";

export interface MdNode {
  type: string;
  lang?: string | null;
  meta?: string | null;
  value?: string;
  url?: string;
  alt?: string | null;
  title?: string | null;
  data?: { hName?: string; hProperties?: Record<string, unknown> };
  children?: MdNode[];
}

// Colours come from the site's tokens, so diagrams follow light and dark mode.
// See the --diagram-* aliases in tokens.css for why these aren't --line etc.
const THEME = {
  bg: "var(--ground)",
  fg: "var(--ink)",
  line: "var(--diagram-line)",
  accent: "var(--diagram-accent)",
  muted: "var(--diagram-muted)",
  border: "var(--diagram-border)",
  surface: "var(--card)",
  font: "IBM Plex Sans",
  transparent: true,
};

const ATTRIBUTE = /(\w+)="([^"]*)"/g;

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function scopeStyle(css: string, scope: string): string {
  return css
    .replace(/@import[^;]*;/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/([^{}]+)\{/g, (_, selectors: string) => {
      const scoped = selectors
        .split(",")
        .map((selector) => selector.trim())
        .map((selector) => (selector === "svg" ? scope : `${scope} ${selector.replace(/^svg\s+/, "")}`));
      return `\n  ${scoped.join(", ")} {`;
    });
}

export function renderDiagram(source: string, options: { id: string; alt: string; caption?: string }): string {
  const { id, alt, caption } = options;
  const svg = renderMermaidSVG(source, THEME)
    .replace(/ id="([^"]+)"/g, ` id="${id}-$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${id}-$1)`)
    .replace(/href="#([^"]+)"/g, `href="#${id}-$1"`)
    .replace(/<style>([\s\S]*?)<\/style>/g, (_, css: string) => `<style>${scopeStyle(css, `#${id}`)}\n</style>`)
    .replace(/^<svg /, `<svg id="${id}" role="img" aria-label="${escapeHtml(alt)}" `);
  const figcaption = caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : "";
  return `<figure class="diagram">${svg}${figcaption}</figure>`;
}

function asFigure(paragraph: MdNode, image: MdNode): void {
  const caption = image.title;
  image.title = null;
  paragraph.data = { hName: "figure", hProperties: { className: ["diagram"] } };
  if (caption) {
    paragraph.children!.push({ type: "paragraph", data: { hName: "figcaption" }, children: [{ type: "text", value: caption }] });
  }
}

export default function remarkDiagrams() {
  return (tree: MdNode, file: { path?: string }) => {
    const where = file.path ?? "a Markdown file";
    let count = 0;
    const requireAlt = (image: MdNode) => {
      if (!image.alt?.trim()) throw new Error(`An image has no alt text: ${image.url} in ${where}`);
    };
    const visit = (node: MdNode) => {
      for (const child of node.children ?? []) {
        if (child.type === "code" && child.lang === "mermaid") {
          const attributes = Object.fromEntries([...(child.meta ?? "").matchAll(ATTRIBUTE)].map(([, k, v]) => [k, v]));
          if (!attributes.alt) {
            throw new Error(`A mermaid diagram has no alt text in ${where}: add alt="…" after \`\`\`mermaid`);
          }
          count += 1;
          const html = renderDiagram(child.value ?? "", { id: `diagram-${count}`, alt: attributes.alt, caption: attributes.caption });
          Object.assign(child, { type: "html", value: html, lang: undefined, meta: undefined });
          continue;
        }
        if (child.type === "image") requireAlt(child);
        const soleChild = child.children?.length === 1 ? child.children[0] : undefined;
        if (child.type === "paragraph" && soleChild?.type === "image") {
          requireAlt(soleChild);
          asFigure(child, soleChild);
          continue;
        }
        visit(child);
      }
    };
    visit(tree);
  };
}
