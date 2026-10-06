/**
 * product.ts — /our-product.
 *
 * Evidence beyond the measured header label: the reference component
 * `Landing10JoinUs` takes a `pageVariant` prop and
 * evidence/reference/raw/_nuxt/CCJzzdh0.js stores the variant used by this page —
 *   case "our-product": return "Join 4,000+ artists and curators across 100+
 *   countries on FOLLOW.ART for portfolio, contacts, booking, and direct financial
 *   support in one place"
 * which is also the aria-label of the Join CTA on that page, and the section order
 * the page is about (the measured home headings CARD / CENTRA LIZE / AUDIENCE
 * SUPPORT / CONNECTORY, docs/DOM_CONTRACT.md rows 2-4 and 6).
 */
export const PRODUCT = {
  path: '/our-product',
  navLabel: 'Our Product',
  heading: 'Our Product',
  theme: 'green',
  /** verbatim, CCJzzdh0.js pageVariant === "our-product" */
  joinDescription:
    'Join 4,000+ artists and curators across 100+ countries on FOLLOW.ART for portfolio, contacts, booking, and direct financial support in one place',
  /** measured feature names of the product, in DOM_CONTRACT order (rows 2,3,4,6) */
  measuredFeatures: [
    { key: 'home.card', title: 'CARD', line: 'Your practice, all in one place' },
    { key: 'home.centralize', title: 'CENTRA LIZE', line: 'Have your work together in one clear format' },
    { key: 'home.audience', title: 'AUDIENCE SUPPORT', line: 'Support Me button in your Card lets people back your work financially.' },
    { key: 'home.connectory', title: 'CONNECTORY', line: 'A global searchable directory of curators and artists' },
  ] as const,
} as const;
