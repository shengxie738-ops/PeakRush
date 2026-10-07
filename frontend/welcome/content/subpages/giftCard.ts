/**
 * giftCard.ts — /gift-card, captured 2026-09-30 from the RENDERED page (the SSR
 * shell only contains the `sr-only` h1, so everything below came out of the
 * hydrated DOM).
 *
 * Measured shape: one sticky `.gift-card-section.row.row--gx.row--stretch.px-1`
 * inside `.ui-orange`, split into
 *   `.gift-card-section__content.col-12.col--6:md`  — title + bg image + CTA
 *   `.gift-card-section__form-wrapper.col-12.col--6:md.col-divider__right:md`
 *     → video preview ("How / Gift Card / works?")
 *     → `.pt-1.25.pt-4.25:md.ui-light` panel: pitch, "What your gift unlocks:"
 *       6-bullet list, post-purchase note, `.buying-gift-card-form`,
 *       `<hr>`, Trustpilot block, "Media outlets and partners" + 9 logos.
 *
 * The Trustpilot widget on the reference is a cross-origin <iframe>; it is not
 * replayed here (no network) and the region is marked pending.
 */
import { GIFT_CARD_PRICE } from './pricing';

export const GIFT_CARD = {
  path: '/gift-card',
  /** `<h1 class="sr-only">gift card</h1>` — lowercase, as measured. */
  heading: 'gift card',
  /** Desktop word-mark is an inline SVG; the mobile copy is plain text. */
  titleText: 'gift card',
  titleDecoration: '/assets/subpages/gift-card/buy.svg',
  background: '/assets/subpages/gift-card/image.png',
  ctaText: 'Buy Gift Card',
  video: {
    /** `.gift-card-section__video-preview-text` — three hard-broken lines. */
    lines: ['How', 'Gift Card', 'works?'] as const,
    preview: '/assets/subpages/gift-card/video-preview.png',
    playIcon: '/assets/decor/media-play-white.svg',
    /** The video file itself was never captured; play stays pending. */
    playable: false,
  },
  pitch: 'Give your favorite artist or curator a',
  /** `.underline-class` wraps this word. */
  pitchUnderlined: 'full year',
  pitchTail: 'of professional visibility',
  body: 'FOLLOW.ART is a global network where artists and curators present their work, connect professionally and receive direct support from the audience.',
  unlocksTitle: 'What your gift unlocks:',
  unlocks: [
    'A professional profile that replaces endless PDFs and portfolio websites',
    'Space to present artworks and projects',
    'Access to direct financial support from people who value their work',
    'Links to social media, publications and e-shops',
    'Visibility insights and profile statistics',
    'Access to a global network of artists and curators',
  ] as const,
  closing:
    'A thoughtful, practical gift for emerging artists, curators, recent graduates or anyone building their professional presence in the arts.',
  afterPurchase:
    'After purchase, we’ll send activation instructions by email either directly to the recipient or to you.',
  mediaTitle: 'Media outlets and partners',
  /** `.gift-card-section__partners` — 9 logos, all present in public/. */
  partners: [
    'vaa.png',
    'artdaily.png',
    'vao.png',
    'all-about-art.png',
    'world-art-news.png',
    'cold.png',
    '18-83.png',
    'art-plugged.png',
    'ypp.png',
  ] as const,
  /**
   * The `/pricing` copy of this block measures exactly **two** logo rows — six
   * `img` elements at y 3921 and 3971 (h 40), i.e. the first six of `partners`.
   * A third row would end at y 4061 and the white column stops at 4097 with a
   * 10px tail, so there is no room for the remaining three: the route really
   * does show fewer than `/gift-card`. Count, not a second transcription.
   */
  pricingPartnerCount: 6,
  partnersDirectory: '/assets/subpages/gift-card/',
  trustpilot: {
    /** Reference embeds an iframe from widget.trustpilot.com — never requested here. */
    replayed: false,
  },
  price: GIFT_CARD_PRICE,
} as const;

/** Form fields measured on `.buying-gift-card-form form`. */
export interface GiftCardField {
  name: string;
  label: string;
  /** Trailing required marker, measured as `&nbsp;*` in `.text-color-error`. */
  required: boolean;
  type: 'text' | 'email';
  maxlength: number;
  autocomplete: string;
}

export const GIFT_CARD_FIELDS: readonly GiftCardField[] = [
  { name: 'name', label: "Recipient's name", required: true, type: 'text', maxlength: 50, autocomplete: 'name' },
  { name: 'email', label: "Recipient's e-mail", required: true, type: 'email', maxlength: 50, autocomplete: 'email' },
  { name: 'message', label: 'Message (Optional)', required: false, type: 'text', maxlength: 150, autocomplete: 'off' },
] as const;

export const GIFT_CARD_DEMO_NOTICE =
  'Local clone demo — this form never submits, no payment is taken and nothing is stored.';

/**
 * CLONE-LOCAL audit labels — not reference copy. They name the regions whose
 * internals were never measured so the gap is visible in the DOM instead of
 * being papered over with invented inputs (see the `data-evidence` contract).
 */
export const GIFT_CARD_PENDING = {
  /** `.buying-gift-card-form` — the panel is measured, its field geometry is not. */
  form: 'Purchase form — panel measured, field geometry pending T00 sub-page capture.',
  /** The reference embeds a cross-origin Trustpilot iframe; nothing is requested. */
  trustpilot: 'Trustpilot widget — cross-origin iframe on the reference, never requested here.',
} as const;

/**
 * The `/pricing` block's own measured geometry, kept with the copy it belongs to
 * so the component that renders it carries no numbers of its own. All values are
 * CSS px in the reference frame (viewport 1376x772 @ dpr 1.5), expressed relative
 * to the top-left of the block's own column, which is what the transcribed rules
 * in `GiftCardSection.vue` consume.
 */
export const GIFT_CARD_PRICING_GEOMETRY = {
  /** `.gift-card-section__title-decoration` (buy.svg): 127x96 at x 107 / y 72. */
  titleDecoration: { left: 112, top: 75, width: 133 },
  /** `.gift-card-section__bg-image` (image.png): 401x339 at x 114 / y 138. */
  bgImage: { left: 119, top: 145, width: 420 },
  /** play button: 56x56 black square centred on the video preview. */
  play: { size: 59 },
} as const;

