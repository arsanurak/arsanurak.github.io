// @ts-check
import { unified } from "@astrojs/markdown-remark";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
import remarkDiagrams from "./src/lib/remark-diagrams.ts";

// User site served at the root of arsanurak.github.io, so no `base`.
export default defineConfig({
  site: "https://arsanurak.github.io",
  // Emits sitemap-index.xml (named in public/robots.txt).
  integrations: [sitemap()],
  markdown: {
    // The unified (remark) pipeline, not Astro's default Sätteri processor,
    // because the diagram plugin is a remark plugin.
    processor: unified({ remarkPlugins: [remarkDiagrams] }),
  },
  build: {
    // Inline the (small) CSS so no stylesheet request blocks first paint;
    // separate files dropped Lighthouse performance below 0.95 on CI runners.
    inlineStylesheets: "always",
  },
});
