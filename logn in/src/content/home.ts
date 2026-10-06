/**
 * home.ts — the home page content model.
 *
 * Every string is verbatim from docs/DOM_CONTRACT.md ("Measured H1/H2 text") or
 * from the captured render functions in evidence/reference/raw/_nuxt/*.js
 * (Cc-BjTZB.js for sections 1-9, CCJzzdh0.js for section 10). Class names are the
 * reference BEM names, kept so the CSS lifted into src/styles/ applies unchanged.
 *
 * The giant display words are the reference's own inline <svg> glyph sets, parsed
 * out of the compiled vnode trees into ./displayHeadings.json (see
 * DISPLAY_SVGS below) — they are not text-sized by this clone.
 */
import displayHeadingsRaw from './displayHeadings.json';

/* ------------------------------------------------------------------ assets */

/** Reference asset URLs, exactly as the reference render functions ask for them. */
export const IMG = {
  heroCard: (n: number) => `/images/landing/1.intro/webgl/Card-${n}.png`,
  nexusCard: (n: number) => `/images/landing/3.nexus/card-${n}.png`,
  videoPreview: '/images/landing/2.get-seen/video-preview.png',
  mediaPlay: '/images/common/media-play.svg',
  usdCurrency: '/images/common/usd-currency.svg',
  line: '/images/landing/common/line.svg',
  helix: '/images/landing/common/helix-decoration.svg',
  the: '/images/landing/common/the.svg',
  star: '/images/landing/common/star.svg',
  promoArrow: '/images/landing/common/promo-arrow.svg',
  cross: '/images/landing/4.follow-art/cross.svg',
  speechBalloon: '/images/landing/9.testimonials/speech-balloon.svg',
  usWord: '/images/landing/10.join-us/us-word.svg',
  person: (n: number) => `/images/landing/team/person-${n}.jpg`,
  trail: (n: number) => `/images/landing/10.join-us/trail-${n}.png`,
  connectoryImage: '/images/landing/7.connectory/image.png',
  review: (n: number) => `/images/landing/9.testimonials/Review-${n}.png`,
} as const;

/** Order of the 18 trail photos used by .image-trail (CCJzzdh0.js `h`). */
export const IMAGE_TRAIL_ORDER = [
  16, 18, 14, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 17,
] as const;

/* ---------------------------------------------------------------- display */

export interface DisplaySvg {
  class: string;
  html: string;
  bytes: number;
}

const DISPLAY_HEADINGS = displayHeadingsRaw as unknown as Record<string, DisplaySvg | string>;

/** The reference inline-SVG word for a display heading, or null when it is absent. */
export function displaySvg(key: string): DisplaySvg | null {
  const entry = DISPLAY_HEADINGS[key];
  if (!entry || typeof entry === 'string') return null;
  return entry;
}

/* ------------------------------------------------------------------ hero */

export const HERO = {
  sectionId: 'home.hero',
  /** The only <h1> in the app. title attribute = the reference's accessible name. */
  accessibleTitle: 'FOLLOW.ART One Practice. One Card',
  word: 'FOLLOW.ART',
  footerLines: ['One Card.', 'Share it. Be noticed.', 'Be supported'] as const,
  cardCount: 9,
} as const;

/* -------------------------------------------------------------- get-seen */

export const GET_SEEN = {
  sectionId: 'home.get-seen',
  /** .section-2__title h2 — the reference sets this at 15.6164383562vw (228/1460). */
  headingWords: ['CURATORS AND ', 'ARTISTS'] as const,
  headingAccessible: 'CURATORS AND ARTISTS',
  /** .section-2__description, verbatim incl. the leading hyphens. */
  bullets: [
    '- Share your practice.',
    '- Build new relationships.',
    '- Get financial support.',
  ] as const,
  revealWord: 'All in one',
  descriptionTail: 'place people can access instantly',
  mediaTitle: ['How', 'FOLLOW. ART', 'works?'] as const,
  playLabel: 'Play video',
  modalTitle: 'How the FOLLOW.ART works?',
} as const;

/* ------------------------------------------------------------------ card */

export const CARD = {
  sectionId: 'home.card',
  titleKey: 'card',
  accessibleTitle: 'card',
  description1: 'Your practice, all in one place',
  description2:
    'A digital Card that brings everything together. Easy for you to share. Easy for others to discover, save, and financially support your practice.',
  joinAriaLabel:
    'Get your FOLLOW.ART Card to present your artistic or curatorial practice, share instantly, receive direct financial support.',
} as const;

/* ------------------------------------------------------------- centralize */

export const CENTRALIZE = {
  sectionId: 'home.centralize',
  /** split across two .section-4__title-word--inline-block spans by the reference */
  headingWords: ['CENTRA', 'LIZE'] as const,
  headingAccessible: 'CENTRA LIZE',
  revealWord: 'No more',
  descriptionTail: 'scattered links, PDFs, and half-finished profiles.',
  subhead: 'Have your work together in one clear format',
  cards: [
    {
      index: '1',
      front: ['Professional', 'presentation'] as const,
      back: 'Portfolio, biography, experience, links and contacts in one place',
    },
    {
      index: '2',
      front: ['Financial', 'support'] as const,
      back: 'Let people financially support your practice, instantly',
    },
    {
      index: '3',
      front: ['Instant', 'sharing'] as const,
      back: 'Use a link, QR code or Wallet pass during events and meetings',
    },
    {
      index: '4',
      front: ['Better', 'discovery'] as const,
      back: 'Be searchable through Connectory without algorithms or closed circles',
    },
  ] as const,
} as const;

/* --------------------------------------------------------------- audience */

export interface AudienceMember {
  name: string;
  role: string;
  photo: string;
}

/** The 10 names of the .section-3__loop-carousel (CCJzzdh0.js `f`, DOM_CONTRACT #4). */
export const AUDIENCE_MEMBERS: readonly AudienceMember[] = [
  { name: 'Teona Toderel', role: 'Artist', photo: IMG.person(1) },
  { name: 'Erin J Coholan', role: 'Artist', photo: IMG.person(2) },
  { name: 'Baimba Kamara', role: 'Curator', photo: IMG.person(3) },
  { name: 'Alberto Balocca', role: 'Artist', photo: IMG.person(4) },
  { name: 'Thomas Oosterhof', role: 'Curator', photo: IMG.person(5) },
  { name: 'Isabela Galeano', role: 'Curator', photo: IMG.person(6) },
  { name: 'Danny Van der Elst', role: 'Artist', photo: IMG.person(7) },
  { name: 'Sophie Wratzfeld', role: 'Curator', photo: IMG.person(8) },
  { name: 'Farouk Alao', role: 'Artist', photo: IMG.person(9) },
  { name: 'Keita Melle', role: 'Artist', photo: IMG.person(10) },
];

export const AUDIENCE = {
  sectionId: 'home.audience',
  headingWords: ['AUDIENCE', 'SUPPORT'] as const,
  headingAccessible: 'AUDIENCE SUPPORT',
  subDescription:
    'Already, hundreds have financially supported curators and artists through FOLLOW.ART Cards.',
  revealWord: 'Support Me',
  descriptionTail: 'button in your Card lets people back your work financially.',
  /** the reference renders the group twice for the 50s loop animation */
  loopGroups: 2,
} as const;

/* ------------------------------------------------------------ testimonials */

export const TESTIMONIALS = {
  sectionId: 'home.testimonials',
  titleKey: 'testimonials',
  accessibleTitle: 'Testimonials',
  /** .section-9__description — DOM_CONTRACT "Our Members Say" */
  description: 'Our Members Say',
  cardCount: 8,
  prev: 'Prev',
  next: 'Next',
} as const;

/* --------------------------------------------------------------- connectory */

export const CONNECTORY = {
  sectionId: 'home.connectory',
  titleKey: 'connectory',
  accessibleTitle: 'Connectory',
  subtitle: 'Discover Others & Get Discovered',
  revealWord: 'global',
  description1Lead: 'A',
  description1Tail: 'searchable directory of curators and artists',
  description2: [
    'Join 4K+ members. Explore practices, find collaborators, and search beyond your usual circles.',
    'No algorithms, no race for attention, no echo chambers',
  ] as const,
} as const;

/* ------------------------------------------------------------------- join */

export const JOIN = {
  sectionId: 'home.join',
  titleKey: 'join-us',
  accessibleTitle: 'Join Us',
  revealWord: 'Create Your',
  descriptionTail: 'Card and share wherever your practice is seen',
  button: 'Join',
  /**
   * Measured from the live `.fixed-sign-up-button .sr-only` and mirrored onto the anchor's
   * `aria-label` exactly as the reference does — the visible label is only "Join", so this is
   * the whole description of the button for assistive tech.
   */
  srLabel:
    'Join 4,000+ artists and curators across 100+ countries on FOLLOW.ART for portfolio, contacts, booking, and direct financial support in one place',
  /** Landing10JoinUs pageVariant === "homepage" (CCJzzdh0.js `b`) */
  ariaLabel:
    'Get your FOLLOW.ART Card to present your artistic or curatorial practice, share instantly, receive direct financial support.',
} as const;

/* ----------------------------------------------------------------- header */

export interface NavItem {
  label: string;
  to: string;
}

/** Header text order measured in DOM_CONTRACT ("Header"). */
export const HEADER = {
  logo: 'FOLLOW. ART',
  tagline: 'One Practice. One Card',
  nav: [
    { label: 'About', to: '/about' },
    { label: 'Our Product', to: '/our-product' },
    { label: 'Community Board', to: '/community-board' },
    { label: 'Pricing', to: '/pricing' },
    { label: 'FAQ', to: '/faq' },
  ] as readonly NavItem[],
  login: { label: 'Login', to: '/signin' } as NavItem,
  join: { label: 'Join', to: '/signup' } as NavItem,
  menuLabel: 'Menu',
  menuAnchor: '#menu',
} as const;

/* ----------------------------------------------------------------- footer */

export const EXTERNAL = {
  brandKit: 'https://drive.google.com/file/d/1TRkafTTsg9FOyLTzmTkNSRsd5lD0kx3X/view?usp=sharing',
  instagram: 'https://www.instagram.com/followart.world?igsh=aDVyb205bGVleDZr',
  linkedin: 'https://lv.linkedin.com/company/followart-world',
  youtube: 'https://www.youtube.com/@FOLLOWART',
  substack: 'https://followart.substack.com',
  facebook: 'https://www.facebook.com/followart.world/',
  email: 'mailto:help@follow.art',
  videinfra: 'https://videinfra.com/',
} as const;

export const FOOTER = {
  nav: [
    { label: 'Brand Kit', href: EXTERNAL.brandKit, external: true },
    { label: 'Buy Gift Card', to: '/gift-card' },
    { label: 'Terms & Conditions', to: '/terms-and-conditions' },
    { label: 'Privacy Policy', to: '/privacy-policy' },
    { label: 'Cookie Policy', to: '/cookies-policy' },
  ] as const,
  copyright: '© FOLLOW.ART',
  email: 'help@follow.art',
  madeBy: 'Digital product development by Vide Infra',
  madeByTitle: 'Award-winning digital product design agency',
  social: [
    { icon: 'social-instagram', label: 'Follow us on Instagram', href: EXTERNAL.instagram },
    { icon: 'social-linkedin', label: 'Follow us on Linkedin', href: EXTERNAL.linkedin },
    { icon: 'social-youtube', label: 'Follow us on Youtube', href: EXTERNAL.youtube },
    { icon: 'social-substack', label: 'Follow us on Substack', href: EXTERNAL.substack },
    { icon: 'social-facebook', label: 'Follow us on Facebook', href: EXTERNAL.facebook },
  ] as const,
} as const;

/* ------------------------------------------------------------------ cookie */

export const COOKIE = {
  dialogLabel: 'Cookie consent',
  text: 'This website uses',
  link: 'cookies',
  linkTo: '/cookies-policy',
  deny: 'Deny',
  accept: 'Accept',
} as const;

/* --------------------------------------------------------------- page <title> */

export const SEO = {
  title: 'FOLLOW.ART | Digital Infrastructure for Curators & Artists',
  description:
    'Your portfolio, contacts, and direct support in one Card. Join 2.5K+ curators and artists across 100+ countries. Free to start. No algorithm.',
} as const;
