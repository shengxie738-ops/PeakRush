/**
 * promoFooter.ts — the content of `footer.promo-footer`, the compact per-route
 * footer the reference puts at the bottom of /pricing and /gift-card
 * (docs/research/follow.art/pricing/components/promo-footer.spec.md, DIFF-015).
 *
 * Everything below is transcribed from the literal `footer.outerHTML` capture
 * `evidence/reference/raw/pricing-promo-footer.html`; the geometry of every node
 * is in `evidence/reference/raw/pricing-promo-footer-boxtree.json`.
 *
 * This list is NOT the home footer's list. `FOOTER` in ../home.ts is bound to the
 * measured `.section-10__footer` geometry on / and stays untouched; only the
 * shared, identical hrefs are reused from `EXTERNAL`.
 *
 * Note the copyright string: the promo footer reads "FOLLOW. ART" with a space
 * before ART, where the home footer renders "FOLLOW.ART". Both are measured, so
 * both are kept — the year is rendered at runtime by the component.
 */
import { EXTERNAL } from '../home';

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
export const PROMO_FOOTER_NAV: PromoFooterLink[] = [
  { label: 'Brand Kit', href: EXTERNAL.brandKit, external: true },
  { label: 'Buy Gift Card', to: '/gift-card' },
  { label: 'Terms & Conditions', to: '/terms-and-conditions' },
  { label: 'Privacy Policy', to: '/privacy-policy' },
  { label: 'Cookie Policy', to: '/cookies-policy' },
];

/** The five social buttons, in captured DOM order. */
export const PROMO_FOOTER_SOCIAL: PromoFooterSocial[] = [
  { icon: 'social-instagram', label: 'Follow us on Instagram', href: EXTERNAL.instagram },
  { icon: 'social-linkedin', label: 'Follow us on Linkedin', href: EXTERNAL.linkedin },
  { icon: 'social-youtube', label: 'Follow us on Youtube', href: EXTERNAL.youtube },
  { icon: 'social-substack', label: 'Follow us on Substack', href: EXTERNAL.substack },
  { icon: 'social-facebook', label: 'Follow us on Facebook', href: EXTERNAL.facebook },
];

export const PROMO_FOOTER = {
  /** Rendered as `{{ year }} © FOLLOW. ART`. */
  copyright: '© FOLLOW. ART',
  email: 'help@follow.art',
  emailHref: EXTERNAL.email,
  author: 'Digital product development by Vide Infra',
  authorHref: EXTERNAL.videinfra,
  /** The `<a title>` of the author link, as captured. */
  authorTitle: 'Award-winning digital product design agency',
  /** The sprite id behind `.footer-author__icon`. */
  authorIcon: 'videinfra',
  nav: PROMO_FOOTER_NAV,
  social: PROMO_FOOTER_SOCIAL,
} as const;

export default PROMO_FOOTER;
