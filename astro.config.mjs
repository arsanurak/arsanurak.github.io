// @ts-check
import { defineConfig } from "astro/config";

// User site served at the root of arsanurak.github.io, so no `base`.
export default defineConfig({
  site: "https://arsanurak.github.io",
  build: {
    // Keep all CSS in external files so the output stays plain HTML + CSS.
    inlineStylesheets: "never",
  },
});
