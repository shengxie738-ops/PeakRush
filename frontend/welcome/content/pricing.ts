/**
 * pricing.ts — /pricing.
 *
 * Evidence: the route and the measured header label `Pricing` (DOM_CONTRACT.md
 * "Header (measured text order)" and the route list). No plan names, prices or
 * copy were captured — reference-lock.json froze the home page only, and
 * evidence/reference/subpages/ is empty. The page therefore renders the shared
 * shell, the measured label as its heading, and a pending content region.
 */
export const PRICING = {
  path: '/pricing',
  navLabel: 'Pricing',
  heading: 'Pricing',
  theme: 'pink',
  /** Nothing measured: the plan list is deliberately left pending, not invented. */
  plans: [] as const,
} as const;
