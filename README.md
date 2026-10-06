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

It typechecks, runs the unit tests for the check scripts, builds the site, validates every built HTML page, and fails if any `<script>` element (in HTML or SVG) or JavaScript file is in the output.

## Layout

- `src/styles/tokens.css`: the colour and type tokens, light and dark. Everything else uses these.
- `src/pages/`: one file per page.
- `scripts/`: checks that run against the built site in `dist/`.

`resume/` is gitignored and must never be committed.
