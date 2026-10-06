/**
 * about.ts — /about.
 *
 * Evidence: the page exists (docs/DOM_CONTRACT.md route list, and the measured
 * header label `About` → /about). No copy of the page body was captured in T00,
 * so the page renders the shared shell with a pending region. The strings below
 * are only the measured label plus clone-local meta text.
 */
export const ABOUT = {
  path: '/about',
  /** Verbatim from the measured header text order. */
  navLabel: 'About',
  heading: 'About',
  theme: 'orange',
  /** Measured header tagline, reused as the page's only non-placeholder line. */
  tagline: 'One Practice. One Card',
} as const;
