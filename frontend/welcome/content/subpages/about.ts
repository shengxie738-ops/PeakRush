/**
 * about.ts — /about, transcribed from https://follow.art/about (2026-09-30).
 *
 * Measured page shape (3 stacked sticky sections):
 *   1. `.ui-pink`  → `.about-page.row.row--gx.px-1.pt-promo-header`, a two-column
 *      sticky: `.text-page-title` (right, `col--last:md`) holds the h1 "Our Story"
 *      + `.about-page-media` video-preview collage; `.text-page-content` (left)
 *      holds 5 `row row--gx` blocks separated by `<hr class="mt-3 mb-1 mt-4:md">`.
 *   2. `.ui-blue`  → `.about-team-section`, `.about-team-title` (sticky h2
 *      "MEET THE TEAM") + 7 `.about-team-card`.
 *   3. `.ui-green` → `.about-partners-section`, `.about-partners__title` +
 *      3 `.about-partners__loop-carousel` (1 desktop row, 2 mobile rows).
 *
 * Emails: the reference ships them Cloudflare-obfuscated; they were decoded from
 * its own hex payload (the algorithm in email-decode.min.js), so they are the
 * page's real values rather than invented addresses.
 */

export interface AboutBlock {
  /** `<p>` label above the body copy (text-card / lead styled in the template). */
  title: string;
  /** Body paragraphs, mini-markdown (see src/pages/RichText.vue). */
  body: readonly string[];
}

export const ABOUT_BLOCKS: readonly AboutBlock[] = [
  {
    title: 'FOLLOW.ART',
    body: [
      'A digital infrastructure for artists and curators to centralize their practice, present it clearly, and earn support from it.',
      'Today, it already connects more than 4K users across 100+ countries through the FOLLOW.ART Card.',
    ],
  },
  {
    title: 'Built from experience',
    body: [
      'FOLLOW.ART started with an observation by founder Bruno Mellis, an artist and entrepreneur with more than a decade of experience in the art fair sector. Through years of working closely with artists and curators, he saw that many lacked a clear way to present their work and connect with both professional opportunities and the public.',
    ],
  },
  {
    title: 'The team',
    body: [
      'Today, we are an international team across UK, Latvia, Switzerland, Germany, Portugal and Italy, bringing together backgrounds in curating, technology, event production, and communications. We care deeply about artistic and curatorial work and see it as a vital foundation of the art field. That belief continues to shape the platform and the partnerships we build.',
    ],
  },
  {
    title: "Let's connect",
    body: ['[help@follow.art](mailto:help@follow.art)'],
  },
  {
    title: 'PR & Press',
    body: ['Contact', 'Christina Chara Ioannou', 'CCIcomms', '[christina@ccicomms.com](mailto:christina@ccicomms.com)'],
  },
] as const;

/**
 * `.about-page-media` video-preview collage (`images/about/1.our-story/*`).
 * The four preview stills and the Webby logo were never downloaded into public/
 * (verified with find), so `previews` stays empty and the template renders a
 * marked pending region instead of a 404 <img>.
 */
export const ABOUT_MEDIA = {
  /** play button overlay, `btn--primary btn--square btn--block btn--accent ui-orange` */
  playIcon: '/assets/decor/media-play-white.svg',
  stars: ['/assets/decor/star-white.svg', '/assets/decor/star-white.svg'] as const,
  previews: [] as readonly string[],
  missingPreviews: [1, 2, 3, 4].map((n) => `/images/about/1.our-story/preview-${n}-mobile.png`),
  /** `images/about/1.our-story/webby-logo.svg` — not captured locally. */
  webbyLogo: null as string | null,
  /** The referenced video itself was never downloaded; region stays pending. */
  videoAvailable: false,
} as const;

export interface TeamMember {
  name: string;
  /** `… .about-team-card__role` */
  role: string;
  email: string;
  /** `/assets/people/<slug>.jpg`, present in public/. */
  photo: string;
  /** Measured `img` src on the reference (kept for provenance). */
  referencePhoto: string;
}

/** Measured order of the 7 `.about-team-card` blocks. */
export const TEAM: readonly TeamMember[] = [
  { name: 'Veronika Gorbacova', role: 'Head of Curatorial Collaboration', email: 'veronika@follow.art', photo: '/assets/people/veronika-gorbacova.jpg', referencePhoto: '/images/about/2.team/veronika-gorbacova.jpg' },
  { name: 'Evelina Gorbacova', role: 'Head of Digital\nDevelopment', email: 'evelina@follow.art', photo: '/assets/people/evelina-gorbacova.jpg', referencePhoto: '/images/about/2.team/evelina-gorbacova.jpg' },
  { name: 'Anton Persianov', role: 'Head of Video Production', email: 'video@follow.art', photo: '/assets/people/anton-persianov.jpg', referencePhoto: '/images/about/2.team/anton-persianov.jpg' },
  { name: 'Ksenija Labecka', role: 'Social Media Manager', email: 'ksenija@follow.art', photo: '/assets/people/ksenija-labecka.jpg', referencePhoto: '/images/about/2.team/ksenija-labecka.jpg' },
  { name: 'Pricila Ito', role: 'Marketing Manager', email: 'pricila@follow.art', photo: '/assets/people/pricila-lto.jpg', referencePhoto: '/images/about/2.team/pricila-lto.jpg' },
  { name: 'Diana Novicka', role: 'Managing Director', email: 'diana@follow.art', photo: '/assets/people/diana-novicka.jpg', referencePhoto: '/images/about/2.team/diana-novicka.jpg' },
  { name: 'Bruno Mellis', role: 'CEO', email: '', photo: '/assets/people/bruno-mellis.jpg', referencePhoto: '/images/about/2.team/bruno-mellis.jpg' },
] as const;

/**
 * `.about-partners__loop-group` logo set: 20 unique SVGs. Only the 10 listed in
 * `PARTNER_LOGOS.available` were downloaded into public/assets/subpages/about by
 * the asset pass; the remaining `missing` names are rendered as a marked pending
 * region instead of pointing at a 404.
 */
export const PARTNER_LOGOS = {
  directory: '/assets/subpages/about/',
  available: [
    'art-fairs-service.svg',
    'vaa.svg',
    'zuzeum.svg',
    'museum-of-pacific.svg',
    'young-painter-prize.svg',
    'cci.svg',
    'all-about-art.svg',
    'aac.svg',
    'volta.svg',
    'worlding-project.svg',
  ] as readonly string[],
  missing: [
    'art.svg',
    'artists-runway.svg',
    'art-academy-of-latvia.svg',
    'kunst-news.svg',
    'world-art-news.svg',
    'cold.svg',
    '18-83.svg',
    'artdaily.svg',
    'art-plugged.svg',
    'next-gen.svg',
  ] as readonly string[],
  /** Mobile shows two rows (10 + 10); desktop one loop of all 20 doubled. */
  desktopRow: 1,
  mobileRows: 2,
} as const;

/** `.about-partners__title-decoration` — helix, captured under /assets/decor. */
export const ABOUT_DECORATIONS = {
  partnersHelix: '/assets/decor/helix-decoration.svg',
} as const;

/** `.about-team-card__more` opens the card overlay; `--overlay` class is measured. */
export const ABOUT_OVERLAY_CLASS = 'about-team-card--overlay';

export const ABOUT_PAGE = {
  path: '/about',
  heading: 'Our Story',
  /** Measured section theme order: pink (story) → blue (team) → green (partners). */
  themes: ['pink', 'blue', 'green'] as const,
  teamHeading: 'Meet the Team',
  partnersHeading: 'Partners, Collaborators & Media',
  socials: [
    { icon: 'social-instagram', label: 'Follow us on Instagram', href: 'https://www.instagram.com/followart.world' },
    { icon: 'social-linkedin', label: 'Follow us on Linkedin', href: 'https://lv.linkedin.com/company/followart-world' },
    { icon: 'social-youtube', label: 'Follow us on Youtube', href: 'https://www.youtube.com/@FOLLOWART' },
    { icon: 'social-substack', label: 'Follow us on Substack', href: 'https://followart.substack.com' },
    { icon: 'social-facebook', label: 'Follow us on Facebook', href: 'https://www.facebook.com/followart.world/' },
  ] as const,
} as const;
