/**
 * routeManifest.ts — the 12 internal routes measured from live `a[href]` on the
 * reference (docs/DOM_CONTRACT.md, "Routes (12 internal, measured from live a[href])").
 *
 * External destinations (drive.google Brand Kit, instagram, linkedin, youtube,
 * substack, facebook, mailto:help@follow.art, videinfra.com) are entry-only and are
 * never cloned — they stay as plain `target=_blank` anchors in SiteHeader/SiteFooter.
 *
 * `headerTheme` is the `data-page-header-theme` value the fixed bar starts with;
 * `localDemo` flags the three pages that are local-demo-only (no network, no
 * stored credentials, permanent fixed notice).
 */
export interface RouteMeta {
  path: string;
  name: string;
  /** Document title, reference style "FOLLOW.ART | …". */
  title: string;
  description: string;
  headerTheme: 'light' | 'orange' | 'dark' | 'green' | 'pink' | 'blue';
  /** PagePromoHeader defaultExpanded — the reference passes it on the home page. */
  headerExpanded?: boolean;
  /** /signin, /signup, /gift-card: local demo only. */
  localDemo?: boolean;
  file: string;
}

export const ROUTE_MANIFEST: readonly RouteMeta[] = [
  {
    path: '/',
    name: 'home',
    title: 'FOLLOW.ART | Digital Infrastructure for Curators & Artists',
    description:
      'Your portfolio, contacts, and direct support in one Card. Join 2.5K+ curators and artists across 100+ countries. Free to start. No algorithm.',
    headerTheme: 'orange',
    headerExpanded: true,
    file: 'HomePage.vue',
  },
  {
    path: '/about',
    name: 'about',
    title: 'About | FOLLOW.ART',
    description: 'About FOLLOW.ART — one practice, one card.',
    headerTheme: 'orange',
    file: 'AboutPage.vue',
  },
  {
    path: '/our-product',
    name: 'our-product',
    title: 'Our Product | FOLLOW.ART',
    description: 'The FOLLOW.ART Card, Centralize and Connectory.',
    headerTheme: 'green',
    file: 'ProductPage.vue',
  },
  {
    path: '/community-board',
    name: 'community-board',
    title: 'Community Board | FOLLOW.ART',
    description: 'Community board of curators and artists.',
    headerTheme: 'green',
    file: 'CommunityPage.vue',
  },
  {
    path: '/pricing',
    name: 'pricing',
    title: 'Pricing | FOLLOW.ART',
    description: 'FOLLOW.ART plans and pricing.',
    headerTheme: 'pink',
    file: 'PricingPage.vue',
  },
  {
    path: '/faq',
    name: 'faq',
    title: 'FAQ | FOLLOW.ART',
    description: 'Frequently asked questions about FOLLOW.ART.',
    headerTheme: 'light',
    file: 'FaqPage.vue',
  },
  {
    path: '/signin',
    name: 'signin',
    title: 'Login | FOLLOW.ART',
    description: 'Login screen — local clone demo only.',
    headerTheme: 'light',
    localDemo: true,
    file: 'SignInPage.vue',
  },
  {
    path: '/signup',
    name: 'signup',
    title: 'Join | FOLLOW.ART',
    description: 'Sign-up screen — local clone demo only.',
    headerTheme: 'orange',
    localDemo: true,
    file: 'SignUpPage.vue',
  },
  {
    path: '/gift-card',
    name: 'gift-card',
    title: 'Buy Gift Card | FOLLOW.ART',
    description: 'Gift card purchase — local clone demo only.',
    headerTheme: 'pink',
    localDemo: true,
    file: 'GiftCardPage.vue',
  },
  {
    path: '/terms-and-conditions',
    name: 'terms-and-conditions',
    title: 'Terms & Conditions | FOLLOW.ART',
    description: 'Terms and conditions.',
    headerTheme: 'light',
    file: 'LegalPage.vue',
  },
  {
    path: '/privacy-policy',
    name: 'privacy-policy',
    title: 'Privacy Policy | FOLLOW.ART',
    description: 'Privacy policy.',
    headerTheme: 'light',
    file: 'LegalPage.vue',
  },
  {
    path: '/cookies-policy',
    name: 'cookies-policy',
    title: 'Cookie Policy | FOLLOW.ART',
    description: 'Cookie policy.',
    headerTheme: 'light',
    file: 'LegalPage.vue',
  },
] as const;

export const NOT_FOUND_TITLE = 'Page Not Found';

export function routeMetaFor(path: string): RouteMeta | undefined {
  return ROUTE_MANIFEST.find((entry) => entry.path === path);
}
