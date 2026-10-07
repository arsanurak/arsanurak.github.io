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

One command runs every check that CI runs on a pull request, apart from the Lighthouse budget below:

```sh
npm run check
```

It typechecks, runs the unit tests (check scripts and the diagram plugin), builds the site, validates every built HTML page, fails if any `<script>` element (in HTML or SVG) or JavaScript file is in the output, checks that every text colour pair meets WCAG AA contrast, checks that every published case-study slug still has a page, and checks that every page has its title, meta description, canonical URL and Open Graph tags (absolute https URLs, an image that exists in the build), that `robots.txt` allows crawling, that the sitemap lists every page, and that every internal link, image and `#anchor` in the output resolves. Last, it runs the publish guard.

`npm run check` is `npm run check:without-guard` followed by `npm run check:publish-guard`. CI runs the two as separate steps so that only the guard's step sees the private denylist.

### Lighthouse budget

CI also runs a Lighthouse budget on every built page. It needs Chrome, so it is a separate command (run `npm run check` first to build):

```sh
npm run lighthouse
```

It audits each page three times and fails if the median performance score is below 0.95 or the median accessibility score is below 1.0. The thresholds live in `lighthouserc.json`, and reports land in the gitignored `.lighthouseci/`. If Chrome isn't found, point `CHROME_PATH` at it.

### Publish guard

The publish guard scans every file in `dist/` for terms on a private denylist and fails on any match. It reports the file and the entry number, never the term. Matching ignores case, decoded HTML entities and line wrapping. A line made only of digits and phone punctuation (at least 7 digits) is a phone number, and matches with or without spaces, dashes, brackets, a leading 0 or a country code (with or without the `+`).

The denylist is never committed. It is one term per line, with blank lines and `#` comments ignored. Write a phone number in national form (`012 345 6789`), or in international form with a space after the country code (`+00 12 345 6789`).

- **Locally:** put the list in `.publish-guard-denylist` at the repo root (gitignored). Without it, `npm run check` warns and skips the scan.
- **In CI:** the list is the `PUBLISH_GUARD_DENYLIST` Actions secret (repository settings, Secrets and variables, Actions), in the same format. Only the guard's own step sees it, not the build. Without it the run fails, except on pull requests that get no Actions secrets (forks and Dependabot), where it warns; the guard runs again with the list on `main`.

### Dependency updates

Dependabot (`.github/dependabot.yml`) opens weekly update PRs for npm packages and the SHA-pinned Actions, waiting 7 days after each release and grouping minor and patch bumps. Its PRs run the same checks, with the publish guard in warn-only mode because Dependabot PRs get no Actions secrets.

## Layout

- `src/styles/tokens.css`: the colour and type tokens, light and dark. Everything else uses these.
- `src/pages/`: one file per page.
- `src/components/`: pieces shared between pages.
- `src/data/`: the site's copy as typed data (profile, timeline, Other work).
- `src/content/case-studies/`: one Markdown file per case study. The frontmatter schema is in `src/content.config.ts`, and a bad field fails the build. Sections must follow the fixed shape in `src/pages/case-studies/[slug].astro`.
- `src/content/published-slugs.json`: every case-study slug that has been published. Slugs are permanent: add a slug when its case study goes live, and never remove or rename one.
- `src/lib/remark-diagrams.ts`: renders ` ```mermaid alt="…" caption="…" ` blocks to inline SVG at build time, and turns a hand-made SVG or PNG on its own line (`![alt](./file.svg "caption")`) into a figure. Every diagram needs alt text. A hand-made SVG loads as an image, so it repeats the token hex values (light and dark) rather than using the CSS variables.
- `public/`: files copied to the site as they are: `robots.txt` and `og-default.png`, the default link-preview image (1200x630). Its source is `scripts/og-image/og-default.html`; the render command is in that file. A case study can set its own with `ogImage` in its frontmatter.
- `scripts/`: checks that run against the built site in `dist/`, with their tests and shared helpers (`built-site.ts` and `list-files.ts` for reading `dist/`, `test-site.ts` for test fixtures). `scripts/og-image/` holds the source of the default link-preview image, `og-default.html`, with its render command.

`resume/` and `.publish-guard-denylist` are gitignored and must never be committed.
