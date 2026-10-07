import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { SLUG_PATTERN } from "./lib/case-study-slugs";

// Case studies: one Markdown file each. A missing or invalid field, or an
// unknown one (a typo), fails the build.
const caseStudies = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/case-studies" }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string().min(1),
        // Used on the timeline card and as the meta description.
        summary: z.string().min(1).max(200),
        // Permanent once published: see src/content/published-slugs.json.
        slug: z.string().regex(SLUG_PATTERN),
        order: z.number().int().positive(),
        // The ADR-style status table.
        status: z.string().min(1),
        area: z.string().min(1),
        decision: z.string().min(1),
        code: z.url(),
        tags: z.array(z.string().min(1)).min(1),
        // Optional link-preview image, next to the Markdown file; the site
        // default is used otherwise. 1200x630 suits most previews.
        ogImage: z.object({ src: image(), alt: z.string().min(1) }).strict().optional(),
      })
      .strict(),
});

export const collections = { caseStudies };
