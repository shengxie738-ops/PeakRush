/**
 * pricing.ts — the ONE source of price truth for every sub-page in this clone.
 *
 * Provenance (captured 2026-09-30 in the in-app browser, same-origin fetch of
 * https://follow.art/pricing, viewport 1376x772 @ dpr 1.5):
 *   the page's own Nuxt payload carries, in `pinia.subscriptionPrices.pricesData`,
 *   `subscribeWeeklyPrice: 5.99`, `subscribeMonthlyPrice: 11.99`,
 *   `subscribeAnnuallyPrice: 59.88`, `subscribeCurrency: "usd"`.
 *   Nothing else on the page is a price: every displayed amount, period label and
 *   unit in this clone is derived from SUBSCRIPTION_PRICES below.
 *
 * Measured render (verified by clicking each radio and reading the DOM):
 *   annually -> primary "US$4.99 / mo." (sr-only "US$4.99 per month"),
 *               secondary "US$59.88 / year" (sr-only "US$59.88 per year"),
 *               promo "US$4.99/mo."
 *   monthly  -> primary "US$11.99 / mo.", secondary "US$143.88 / year",
 *               promo "US$11.99/mo."
 *   weekly   -> primary "US$5.99 / wk.",  secondary "US$311.48 / year",
 *               promo "US$5.99/w."
 * i.e. the secondary figure is always the annualised cost of the selected cycle
 * (annually x1, monthly x12, weekly x52) and the annual cycle is shown as its
 * monthly equivalent. Those are computed here, never written out.
 */

export type BillingCycle = 'annually' | 'monthly' | 'weekly';

/** The frozen figures, exactly as the reference payload states them. */
export const SUBSCRIPTION_PRICES = Object.freeze({
  currency: 'usd' as const,
  /** Displayed prefix measured on the rendered page ("US$", not "$"). */
  displayPrefix: 'US$',
  weekly: 5.99,
  monthly: 11.99,
  annually: 59.88,
  /** Number of each cycle inside one year — drives the annualised figure. */
  perYear: { weekly: 52, monthly: 12, annually: 1 } as const,
  /** Reference capture stamp, kept so the figures can be re-verified. */
  capturedAt: '2026-09-30',
  capturedFrom: '/pricing Nuxt payload `subscriptionPrices.pricesData`',
});

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** The only money formatter in the clone. */
export function moneyWithPrefix(value: number, prefix: string): string {
  return `${prefix}${round2(value).toFixed(2)}`;
}

export function money(value: number): string {
  return moneyWithPrefix(value, SUBSCRIPTION_PRICES.displayPrefix);
}

/** /our-product paints "$5.99", /pricing paints "US$5.99" (both measured). */
export const SHORT_DISPLAY_PREFIX = '$';

export interface PriceFigure {
  /** Visible amount, e.g. "US$59.88". */
  amount: string;
  /** Visible unit suffix as measured, e.g. "/ year". */
  unit: string;
  /** Screen-reader sentence: "<amount> per <period>". */
  srOnly: string;
  period: string;
}

export interface CycleSpec {
  id: BillingCycle;
  /** Radio label, measured order: Annual, Monthly, Weekly. */
  label: string;
  /** Price block the reference paints first (text-color-heading). */
  primary: PriceFigure;
  /** Annualised price block. */
  annualised: PriceFigure;
  /** Inline figure of the promo sentence, e.g. "US$4.99/mo.". */
  promoFigure: string;
}

/** `input[value]` order measured in `.radio-group__options`. */
export const BILLING_CYCLES: readonly CycleSpec[] = [
  {
    id: 'annually',
    label: 'Annual',
    primary: {
      amount: money(SUBSCRIPTION_PRICES.annually / SUBSCRIPTION_PRICES.perYear.monthly),
      unit: '/ mo.',
      period: 'month',
      srOnly: `${money(SUBSCRIPTION_PRICES.annually / SUBSCRIPTION_PRICES.perYear.monthly)} per month`,
    },
    annualised: {
      amount: money(SUBSCRIPTION_PRICES.annually),
      unit: '/ year',
      period: 'year',
      srOnly: `${money(SUBSCRIPTION_PRICES.annually)} per year`,
    },
    promoFigure: `${money(SUBSCRIPTION_PRICES.annually / SUBSCRIPTION_PRICES.perYear.monthly)}/mo.`,
  },
  {
    id: 'monthly',
    label: 'Monthly',
    primary: {
      amount: money(SUBSCRIPTION_PRICES.monthly),
      unit: '/ mo.',
      period: 'month',
      srOnly: `${money(SUBSCRIPTION_PRICES.monthly)} per month`,
    },
    annualised: {
      amount: money(SUBSCRIPTION_PRICES.monthly * SUBSCRIPTION_PRICES.perYear.monthly),
      unit: '/ year',
      period: 'year',
      srOnly: `${money(SUBSCRIPTION_PRICES.monthly * SUBSCRIPTION_PRICES.perYear.monthly)} per year`,
    },
    promoFigure: `${money(SUBSCRIPTION_PRICES.monthly)}/mo.`,
  },
  {
    id: 'weekly',
    label: 'Weekly',
    primary: {
      amount: money(SUBSCRIPTION_PRICES.weekly),
      unit: '/ wk.',
      period: 'week',
      srOnly: `${money(SUBSCRIPTION_PRICES.weekly)} per week`,
    },
    annualised: {
      amount: money(SUBSCRIPTION_PRICES.weekly * SUBSCRIPTION_PRICES.perYear.weekly),
      unit: '/ year',
      period: 'year',
      srOnly: `${money(SUBSCRIPTION_PRICES.weekly * SUBSCRIPTION_PRICES.perYear.weekly)} per year`,
    },
    promoFigure: `${money(SUBSCRIPTION_PRICES.weekly)}/w.`,
  },
] as const;

export const DEFAULT_BILLING_CYCLE: BillingCycle = 'annually';

export function cycleById(id: BillingCycle): CycleSpec {
  const found = BILLING_CYCLES.find((cycle) => cycle.id === id);
  if (!found) throw new Error(`unknown billing cycle ${id}`);
  return found;
}

/* --------------------------------------------------------------------- plans
 * The two comparison frames are NOT one table with per-plan flags: measured row-by-row
 * (evidence/reference/pricing-plans-difference-measured.md) they differ in labels, in row
 * order, in how rows are grouped into `ul.plans-difference__sub-list`, and in whether a row
 * paints a tooltip at all. So each column is its own measured list.
 *
 *   Pro frame     one sub-list per group; rows Starter already has carry
 *                 `plans-difference__list-item_free`.
 *   Starter frame one sub-list PER ROW; rows Pro has that Starter lacks are painted
 *                 disabled (`_list-item_disabled is-hidden:sm-down`, promo-more-close,
 *                 label only — no tooltip wrapper).
 */

export interface PlanFeatureRow {
  label: string;
  /**
   * `.tooltip .plans-difference__tooltip-content`, verbatim. `null` is measured, not missing:
   * a disabled row renders no tooltip wrapper, so its label is the whole item.
   */
  tooltip: string | null;
  /** Pro paints this row `plans-difference__list-item_free`. Starter never uses it. */
  freeForPro?: boolean;
  /** Starter paints this row disabled. Pro never uses it. */
  disabled?: boolean;
}

export interface PlanFeatureGroup {
  title: string;
  /** In the Starter frame the `Support` and `Insights` group `<li>` carry `is-hidden:sm-down`. */
  hiddenOnSmall?: boolean;
  rows: readonly PlanFeatureRow[];
}

export const PRO_FEATURE_GROUPS: readonly PlanFeatureGroup[] = [
  {
    title: 'Presentation',
    rows: [
      { label: 'Profile', tooltip: 'The essential identity section of your Card', freeForPro: true },
      { label: 'Full portfolio', tooltip: 'Up to 50 artworks or projects with descriptions' },
      { label: 'Extended links', tooltip: 'Links to your website, CV, socials, e-commerce, and publications' },
    ],
  },
  {
    title: 'Sharing',
    rows: [
      { label: 'Link sharing', tooltip: 'Share your Card through a direct link', freeForPro: true },
      { label: 'QR sharing', tooltip: 'Download printable QR code templates to use at events' },
      { label: 'Add to Wallet', tooltip: 'Keep your Card ready in your phone Wallet for exhibitions, meetings, and events' },
    ],
  },
  {
    title: 'Connections',
    rows: [
      { label: 'Connectory', tooltip: 'Discover and be discovered by curators and artists globally', freeForPro: true },
      { label: 'Community Board', tooltip: 'Access opportunities, updates, and collaboration invites', freeForPro: true },
      { label: 'Book a studio visit / meeting', tooltip: 'Let others request a studio visit or professional meeting directly through your Card' },
    ],
  },
  {
    title: 'Support',
    rows: [
      { label: 'Support My Practice', tooltip: 'Let people financially support your artistic or curatorial practice' },
    ],
  },
  {
    title: 'Insights',
    rows: [
      { label: 'Card statistics', tooltip: 'See views, scans, search appearances, and mentions to understand how people engage with your Card' },
    ],
  },
] as const;

/**
 * The Starter column. Note `Sharing` puts Add to Wallet before QR sharing, which is the reverse of
 * the Pro column — the disabled rows are pushed to the end of their group, so the two frames share
 * one row grid and `row--stretch` has something to align.
 */
export const STARTER_FEATURE_GROUPS: readonly PlanFeatureGroup[] = [
  {
    title: 'Presentation',
    rows: [
      { label: 'Profile', tooltip: 'The essential identity section of your Card' },
      { label: 'Basic portfolio', tooltip: 'Two images to introduce your practice' },
      { label: 'Basic links', tooltip: 'Two links' },
    ],
  },
  {
    title: 'Sharing',
    rows: [
      { label: 'Link sharing', tooltip: 'Share your Card through a direct link' },
      { label: 'Add to Wallet', tooltip: 'Keep your Card ready in your phone Wallet for exhibitions, meetings, and events' },
      { label: 'QR sharing', tooltip: null, disabled: true },
    ],
  },
  {
    title: 'Connections',
    rows: [
      { label: 'Connectory', tooltip: 'Discover and be discovered by curators and artists globally' },
      { label: 'Community Board', tooltip: 'Access opportunities, updates, and collaboration invites' },
      { label: 'Book a studio visit / meeting', tooltip: null, disabled: true },
    ],
  },
  {
    title: 'Support',
    hiddenOnSmall: true,
    rows: [{ label: 'Support My Practice', tooltip: null, disabled: true }],
  },
  {
    title: 'Insights',
    hiddenOnSmall: true,
    rows: [{ label: 'Card statistics', tooltip: null, disabled: true }],
  },
] as const;

export interface PlanCard {
  id: 'pro' | 'starter';
  /** `<p class="text-lead …">` inside the frame. */
  title: string;
  /** `<p class="text-small … text-color-small">`. */
  tagline: string;
  /** Frame class list measured on the rendered page. */
  frameClass: string;
  /** Icon shown in the Pro frame (`images/card/edit/subscribe.svg`). */
  icon: string | null;
  /** CTA target. */
  ctaTo: string;
}

export const PLAN_CARDS: readonly PlanCard[] = [
  {
    id: 'pro',
    title: 'Pro Card',
    tagline: 'Show more. Share better. Earn directly',
    frameClass: 'ui-dark plans-difference__frame plans-difference__frame_upgraded px-1 py-1 pt-1.25 pt-1:md',
    icon: '/assets/decor/subscribe.svg',
    ctaTo: '/signup',
  },
  {
    id: 'starter',
    title: 'Starter Card',
    tagline: 'A first impression',
    frameClass: 'plans-difference__frame plans-difference__frame_free px-1 py-1 pt-1.25 pt-1:md',
    icon: null,
    ctaTo: '/signup',
  },
] as const;

/** Starter Card price: measured as the literal word "Free" under a "Pricing" key. */
export const STARTER_PRICE_LABEL = 'Free';

/** Rotating tail of the promo sentence, measured in this order. */
export const PROMO_COMPARISONS: readonly string[] = [
  'one coffee',
  'a slice of pizza',
  'a taxi ride',
  'a glass of wine',
] as const;

export const PROMO_SENTENCE = {
  lead: 'Get your PRO Card for just',
  middle: 'That’s less than',
} as const;

export const PRICING_PAGE = {
  path: '/pricing',
  theme: 'pink',
  /** `<h1 class="sr-only">` measured on /pricing. */
  heading: 'Subscription & Pricing',
  /** Second sr-only heading inside `.title.subscription-and-pricing__title`. */
  subheading: 'Subscription',
  /** `img.subscription-and-pricing__title-decoration` — not captured locally. */
  titleDecoration: null,
  radioName: 'type',
} as const;

/* --------------------------------------------------------------------- FAQ
 * The FAQ copy on follow.art quotes euro figures that contradict the pricing
 * payload above (its copy is regional/stale). They are kept here — in this one
 * module, so no other file repeats an amount — and are labelled as observed
 * copy rather than the plan price.
 */
export const FAQ_OBSERVED_EURO_PRICES = Object.freeze({
  weekly: '€4.99',
  monthly: '€9.99',
  annually: '€47.88',
  monthlyEquivalent: '€3.99',
  note: 'verbatim from /faq answers "Is the FOLLOW.ART Card free?", "…for curators?", "How much does FOLLOW.ART PRO cost?" — euro strings, not the USD payload.',
});

/** Rendered form of the euro sentence reused by three FAQ answers. */
export const FAQ_PRICE_LINES: readonly string[] = [
  `- **Weekly**: ${FAQ_OBSERVED_EURO_PRICES.weekly} per week`,
  `- **Monthly**: ${FAQ_OBSERVED_EURO_PRICES.monthly} per month`,
  `- **Annual**: ${FAQ_OBSERVED_EURO_PRICES.annually} per year or ${FAQ_OBSERVED_EURO_PRICES.monthlyEquivalent} per month`,
] as const;

/* --------------------------------------------------------------- gift card
 * The gift card is one year of PRO, so its amount is the annual figure.
 */
export const GIFT_CARD_PRICE = Object.freeze({
  label: '1-year subscription',
  amount: money(SUBSCRIPTION_PRICES.annually),
  /** Measured on /gift-card: the price cell reads "US$59.88". */
  derivedFrom: 'SUBSCRIPTION_PRICES.annually',
});
