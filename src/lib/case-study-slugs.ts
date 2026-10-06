// Case-study slugs and the URL each one is published at. Slugs are permanent
// once listed in src/content/published-slugs.json.
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function caseStudyPath(slug: string): string {
  return `/case-studies/${slug}/`;
}
