/**
 * promoFooter.ts — the content of `footer.promo-footer`, the compact per-route
 * footer the reference puts at the bottom of /pricing and /gift-card
 * (docs/research/follow.art/pricing/components/promo-footer.spec.md, DIFF-015).
 *
 * Everything below is transcribed from the literal `footer.outerHTML` capture
 * `evidence/reference/raw/pricing-promo-footer.html`; the geometry of every node
 * is in `evidence/reference/raw/pricing-promo-footer-boxtree.json`.
 *
 * PeakRush shares destinations and branding with the home footer while retaining
 * this compact layout. The year is rendered at runtime by the component.
 */
import { EXTERNAL, FOOTER } from '../home';

/** One promo nav link: either an internal route (`to`) or an absolute `href`. */
export interface PromoFooterLink {
  label: string;
  /** Internal SPA route. */
  to?: string;
  /** Absolute external href. */
  href?: string;
  /** Renders `target="_blank"`, exactly where the capture has it. */
  external?: boolean;
}

/** One promo social button; `icon` is both the sprite symbol id and `icon-*` class. */
export interface PromoFooterSocial {
  icon: string;
  label: string;
  href: string;
}

/** The five promo nav links, in captured DOM order. */
export const PROMO_FOOTER_NAV: PromoFooterLink[] = [...FOOTER.nav];

/** Social buttons render only when destinations are supplied. */
export const PROMO_FOOTER_SOCIAL: PromoFooterSocial[] = [...FOOTER.social];

export const PROMO_FOOTER = {
  /** The year is added by the footer component. */
  copyright: FOOTER.copyright,
  email: FOOTER.email,
  emailHref: EXTERNAL.email,
  author: FOOTER.madeBy,
  authorHref: EXTERNAL.videinfra,
  /** The `<a title>` of the author link, as captured. */
  authorTitle: FOOTER.madeByTitle,
  /** The sprite id behind `.footer-author__icon`. */
  authorIcon: '',
  nav: PROMO_FOOTER_NAV,
  social: PROMO_FOOTER_SOCIAL,
} as const;

export default PROMO_FOOTER;
