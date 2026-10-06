# Portfolio site

Source for [arsanurak.github.io](https://arsanurak.github.io), a small static site built with [Astro](https://astro.build). Pages ship plain HTML and CSS with zero JavaScript, and fonts (IBM Plex) are self-hosted.

## Develop

Node is pinned in `mise.toml`.

```sh
mise install
npm install
npm run dev
```

## Check

One command runs every check that CI runs on a pull request:

```sh
npm run check
```

It typechecks, runs the unit tests (check scripts and the diagram plugin), builds the site, validates every built HTML page, fails if any `<script>` element (in HTML or SVG) or JavaScript file is in the output, checks that every text colour pair meets WCAG AA contrast in both themes, and checks that every published case-study slug still has a page.

## Layout

- `src/styles/tokens.css`: the colour and type tokens, light and dark. Everything else uses these.
- `src/pages/`: one file per page.
- `src/components/`: pieces shared between pages.
- `src/data/`: the site's copy as typed data (profile, timeline, Other work).
- `src/content/case-studies/`: one Markdown file per case study. The frontmatter schema is in `src/content.config.ts`, and a bad field fails the build. Sections must follow the fixed shape in `src/pages/case-studies/[slug].astro`.
- `src/content/published-slugs.json`: every case-study slug that has been published. Slugs are permanent: add a slug when its case study goes live, and never remove or rename one.
- `src/lib/remark-diagrams.ts`: renders ` ```mermaid alt="…" caption="…" ` blocks to inline SVG at build time, and turns a hand-made SVG or PNG on its own line (`![alt](./file.svg "caption")`) into a figure. Every diagram needs alt text. A hand-made SVG loads as an image, so it repeats the token hex values (light and dark) rather than using the CSS variables.
- `scripts/`: checks that run against the built site in `dist/`.

`resume/` is gitignored and must never be committed.
