// @ts-check
import { unified } from "@astrojs/markdown-remark";
import { defineConfig } from "astro/config";
import remarkDiagrams from "./src/lib/remark-diagrams.ts";

// User site served at the root of arsanurak.github.io, so no `base`.
export default defineConfig({
  site: "https://arsanurak.github.io",
  markdown: {
    // The unified (remark) pipeline, not Astro's default Sätteri processor,
    // because the diagram plugin is a remark plugin.
    processor: unified({ remarkPlugins: [remarkDiagrams] }),
  },
  build: {
    // Keep all CSS in external files so the output stays plain HTML + CSS.
    inlineStylesheets: "never",
  },
});
