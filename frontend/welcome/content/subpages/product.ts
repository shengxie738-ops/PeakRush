/**
 * product.ts — /our-product, transcribed from https://follow.art/our-product
 * (2026-09-30). Five measured sections:
 *   .nexus-intro (ui-orange, h1 "FollowArt")  → .card-plan (ui-pink)
 *   → .nexus-section-2 "Your Card" (ui-blue)  → .section-6 "Where the Card works
 *   for You" (ui-light)                        → .wrapper-section-10 "Join Us".
 *
 * "Find Your Card Plan" renders THREE plan cards in the measured order
 * Weekly / Annual / Monthly (a swiper on desktop, a tab strip below md), each with
 * its own bullet list and Join CTA. Every amount comes from ./pricing.
 */
import {
  SHORT_DISPLAY_PREFIX,
  SUBSCRIPTION_PRICES,
  cycleById,
  moneyWithPrefix,
  type BillingCycle,
} from './pricing';

export interface CardPlanPanel {
  cycle: BillingCycle;
  /** `… .card-plan__panel--annual|monthly|weekly` + theme class, measured. */
  panelClass: string;
  title: string;
  /** Two lines of `.card-plan__description`. */
  description: readonly string[];
  list: readonly string[];
  /** Unit text after the amount, measured per panel. */
  unit: string;
  /** Screen-reader sentence, e.g. "$5.99 per week". */
  srOnlyPeriod: string;
  ctaVariant: string;
  promoIcon: string | null;
}

/** Tab strip order measured below md (`Weekly, Annual, Monthly`). */
export const CARD_PLAN_TAB_ORDER: readonly BillingCycle[] = ['weekly', 'annually', 'monthly'];

export const CARD_PLAN_PANELS: readonly CardPlanPanel[] = [
  {
    cycle: 'weekly',
    panelClass: 'card-plan__panel card-plan__panel--weekly card-plan__panel--light ui-light px-1 py-1.25 py-1:md',
    title: 'Weekly plan',
    description: [
      'For pop ups, art fairs, open studios and short term events.',
      'Best when you need to turn event attention into conversations and support before people leave.',
    ],
    list: [
      'Receive €50+ on average through micro-patronage',
      'Share your work through one clear QR code',
      'Give visitors instant access to your portfolio and contacts',
      'Let people support your practice financially on the spot',
      'Use it for one event without a long-term commitment',
    ],
    unit: '/ weekly',
    srOnlyPeriod: 'per week',
    ctaVariant: 'primary',
    promoIcon: null,
  },
  {
    cycle: 'annually',
    panelClass: 'card-plan__panel card-plan__panel--annual card-plan__panel--dark ui-dark px-1 pt-1.25 pt-1:md pb-1',
    title: 'Annual plan',
    description: [
      'Best value for year-round access.',
      'Best when you want one reliable place for your practice, contacts, audience support and visibility throughout the year.',
    ],
    list: [
      'Receive €550+ on average through micro‑patronage',
      'Present your portfolio, contacts and links in one place',
      'Keep one stable link and QR code throughout the year',
      'Give people one clear channel to share and revisit your work',
      'Receive direct audience support through ongoing micro‑patronage',
      'Use your Card across fairs, exhibitions, talks, studio visits and applications',
      'Track engagement and access advanced data to understand your reach',
      'Get the best value and lowest proportional rate for your practice',
    ],
    unit: '/ year',
    srOnlyPeriod: 'per year',
    ctaVariant: 'secondary',
    promoIcon: '/assets/decor/subscribe.svg',
  },
  {
    cycle: 'monthly',
    panelClass: 'card-plan__panel card-plan__panel--monthly card-plan__panel--light ui-light px-1 py-1.25 py-1:md',
    title: 'Monthly plan',
    description: [
      'For longer exhibitions, projects and active promotion periods.',
      'Best when your work needs dedicated visibility and engagement tracking beyond opening night.',
    ],
    list: [
      'Receive €150+ on average through micro‑patronage',
      'Keep all project information, work and contacts in one place',
      'Use your QR code across exhibition texts, price lists, posters and social media',
      'Update your Card easily as the project grows',
      'Track views, QR scans and audience activity',
      'Embed your Card online so people can keep finding you',
    ],
    unit: '/ mo.',
    srOnlyPeriod: 'per month',
    ctaVariant: 'primary',
    promoIcon: null,
  },
] as const;

/** Amount for one panel, always derived from the single price source. */
export function panelAmount(cycle: BillingCycle): string {
  const figures: Record<BillingCycle, number> = {
    weekly: SUBSCRIPTION_PRICES.weekly,
    monthly: SUBSCRIPTION_PRICES.monthly,
    annually: SUBSCRIPTION_PRICES.annually,
  };
  return moneyWithPrefix(figures[cycle], SHORT_DISPLAY_PREFIX);
}

/** Tab price cells (the reference paints the same figure twice, alt + main). */
export function panelTabFigures(cycle: BillingCycle): { label: string; amount: string; alt: string } {
  return {
    label: cycleById(cycle).label,
    amount: panelAmount(cycle),
    alt: panelAmount(cycle),
  };
}

export const CARD_PLAN = {
  title: 'Find Your Card Plan',
  subtitle: 'Choose the right level of support for your ongoing practice',
  ctaTo: '/signup',
  ctaText: 'Join',
} as const;

export const PRODUCT_INTRO = {
  heading: 'FollowArt',
  tagline: 'Always working for you. QR scan sends financial support, books a visit, keeps you found.',
  /** `.nexus-intro__title-decoration` (images/nexus-card/icons/the-word.svg). */
  wordIcon: '/assets/subpages/nexus-card/the-word.svg',
  ctaText: 'Join',
  ctaAria:
    'Create your FOLLOW.ART Card and let collectors, peers, and audiences support your curatorial or artistic practice directly',
} as const;

export const YOUR_CARD = {
  heading: 'Your Card',
  /** `images/nexus-card/icons/your-word.svg` decoration over the word. */
  wordIcon: '/assets/subpages/nexus-card/your-word.svg',
  /** `.nexus-section-2__sub-description-icon` (time-forward.svg). */
  subIcon: '/assets/subpages/nexus-card/time-forward.svg',
  /** The 4 `.nexus-section-2__promo-text` lines, measured in order. */
  bullets: [
    'Set up your Card in minutes and add it to your Wallet',
    'Share it in person or online, giving people context and an easy way to stay connected',
    'Receive direct support through your Card and see how people interact with it',
    'Let your Card do the talking and open the door to support',
  ] as readonly string[],
  /** `.nexus-section-2__timeline > .about-timelin-mobile-chart`: client-rendered
   * chart with no SSR text — left pending rather than invented. */
  timelineAvailable: false,
  ctaText: 'Join',
} as const;

export interface UsageSlide {
  title: string;
  description: string;
  /** Measured `section-6__slide--color-*` token. */
  color: 'green' | 'orange' | 'pink' | 'blue';
}

export const WHERE_THE_CARD_WORKS = {
  heading: 'Where the Card works for You',
  description: 'Built to turn interest into real support',
  /** `section-6__header-media-decoration` = helix. */
  decoration: '/assets/decor/helix-decoration.svg',
  slides: [
    {
      title: 'Exhibitions',
      description:
        'Place a QR code next to your artwork or project, so people can learn more about you and financially support your practice on the spot',
      color: 'green',
    },
    {
      title: 'Online',
      description:
        'Use your Card as one clear link across your digital presence, making it easy for people to discover your work and support it without searching through scattered platforms',
      color: 'orange',
    },
    {
      title: 'Meetings',
      description:
        'Keep your Card in your Wallet and share it instantly, so people leave the encounter with a clear way to remember you and support your work',
      color: 'pink',
    },
    {
      title: 'Follow-ups',
      description:
        'Give people one place to return to, so a brief encounter can become a follow-up, collaboration, or future opportunity',
      color: 'blue',
    },
  ] as readonly UsageSlide[],
  ctaText: 'Join',
  ctaIcon: '/assets/decor/promo-arrow-orange.svg',
} as const;

/** `.section-10` block on this page, measured. */
export const PRODUCT_JOIN_US = {
  heading: 'Join Us',
  /** "Start with" is the underlined `underline-text-piece` word. */
  descriptionLead: 'Start with',
  descriptionTail: 'one clear Card you can share wherever your practice is seen',
  ctaText: 'Join',
  /** CCJzzdh0.js pageVariant === "our-product" — also the CTA aria-label. */
  ctaAria:
    'Join 4,000+ artists and curators across 100+ countries on FOLLOW.ART for portfolio, contacts, booking, and direct financial support in one place',
  ctaIcon: '/assets/decor/promo-arrow.svg',
  /** `.image-trail` uses the same 18 photos, in the home page's measured order. */
  trailOrder: [16, 18, 14, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 17] as const,
  trailPath: (n: number): string => `/assets/people/trail-${n}.png`,
  /** `images/landing/10.join-us/us-word.svg` — present in /assets/people. */
  usWord: '/assets/people/us-word.svg',
} as const;

export const PRODUCT_PAGE = {
  path: '/our-product',
  heading: 'FollowArt',
  themes: ['orange', 'pink', 'blue', 'light', 'orange'] as const,
} as const;

/** Re-exported for consumers that type against the page layer (ProductPage imports it via this module). */
export type { BillingCycle };
