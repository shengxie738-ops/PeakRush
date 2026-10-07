/**
 * legal.ts — the three legal routes.
 *
 * What is evidenced: the three footer links and their destinations
 * (docs/DOM_CONTRACT.md: "Brand Kit · Buy Gift Card · Terms & Conditions ·
 * Privacy Policy · Cookie Policy" and the measured routes
 * /terms-and-conditions /privacy-policy /cookies-policy), plus the cookie dialog
 * copy captured in Bi84onXO.js (`This website uses` + a `cookies` link to
 * /cookies-policy). What is NOT evidenced: the body text of the three documents —
 * none of them was captured in T00, so each page renders the shared shell and
 * marks its document region pending-T00-subpage.
 */
export interface LegalDocument {
  path: string;
  /** Measured footer label. */
  footerLabel: string;
  /** Heading for the page (derived from the measured footer label). */
  heading: string;
  documentKey: 'terms-and-conditions' | 'privacy-policy' | 'cookies-policy';
}

export const LEGAL_DOCUMENTS: readonly LegalDocument[] = [
  {
    path: '/terms-and-conditions',
    footerLabel: 'Terms & Conditions',
    heading: 'Terms & Conditions',
    documentKey: 'terms-and-conditions',
  },
  {
    path: '/privacy-policy',
    footerLabel: 'Privacy Policy',
    heading: 'Privacy Policy',
    documentKey: 'privacy-policy',
  },
  {
    path: '/cookies-policy',
    footerLabel: 'Cookie Policy',
    heading: 'Cookie Policy',
    documentKey: 'cookies-policy',
  },
] as const;

export function legalDocumentFor(key: string): LegalDocument | undefined {
  return LEGAL_DOCUMENTS.find((document) => document.documentKey === key);
}

/**
 * The one legal sentence this clone is allowed to state, because it is clone
 * behaviour rather than reference copy: no analytics, no third-party requests and
 * no personal data are wired in this local build (the reference's Google tag,
 * Meta pixel and Datadog RUM are deliberately not replayed).
 */
export const CLONE_LOCAL_NOTES: readonly string[] = [
  'This build is a local, offline clone: it loads no analytics, no advertising or error-reporting scripts.',
  'The only value written to storage is the cookie consent flag itself (cookieConsentStatus=0|1), exactly as the reference names it.',
];
