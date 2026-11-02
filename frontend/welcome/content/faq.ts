/**
 * faq.ts — /faq.
 *
 * Evidence: the route and the measured header label `FAQ` (docs/DOM_CONTRACT.md).
 * No question or answer copy was captured in T00 (evidence/reference/subpages/ is
 * empty), so the page lists its own shell and marks the question list pending
 * instead of writing questions the reference never showed.
 */
export const FAQ = {
  path: '/faq',
  navLabel: 'FAQ',
  heading: 'FAQ',
  theme: 'light',
  /** The reference accordion name is not in the capture; kept as a pending shape. */
  questions: [] as const,
} as const;
