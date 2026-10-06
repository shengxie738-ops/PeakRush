/**
 * community.ts — /community-board.
 *
 * The reference list is client-rendered from an authenticated API: the SSR page
 * carries only the `sr-only` h1 plus 51 images, and the hydrated page showed 20
 * thread cards (avatar + username + date + optional image + body + comment/like
 * counters) in a 2-column masonry (`.community-board__list` 885px wide, two
 * `.community-board__list-column` of 433px, first item `create new thread`), with a
 * `Load more` button below. It reported "144 Threads".
 *
 * Real member posts are other people's data, so they are NOT copied. What is
 * reproduced is the measured DOM contract — card classes, the pinned/collaborate
 * variant, the footer actions, the sidebar radio groups — filled with a small
 * deterministic fixture: 3 card variants, repeated in a fixed order, ids assigned
 * from the index so appending a page can never collide.
 */

export type ThreadVariant = 'announcement' | 'discussion' | 'collab';

export interface CommunityThread {
  /** Stable id: `thread-<index>`; never re-used across pages. */
  id: string;
  variant: ThreadVariant;
  /** `.community-board-user-card__username-text` — a fixture author, not a member. */
  author: string;
  /** `.community-board-user-card` second line (measured as a date string). */
  date: string;
  /** `… .community-board-thread-card__thread-message.text-card-h2` headline. */
  headline: string;
  /** Body paragraphs under the headline. */
  body: readonly string[];
  /** `community-board-thread-card__image` — only /assets images, no member uploads. */
  image?: string;
  /** Footer counters, measured as `.community-board-thread-card__counter-text`. */
  comments: number;
  likes: number;
  /** Pinned cards carry `--pinned ui-green` + a collaborate footer. */
  pinned?: boolean;
  /** Collaborate variant: avatar list + action button + badge. */
  collaborators?: number;
  actionLabel?: string;
  badge?: string;
}

const VARIANTS: readonly Omit<CommunityThread, 'id'>[] = [
  {
    variant: 'announcement',
    author: 'FOLLOW.ART Team',
    date: 'Demo fixture',
    headline: 'Community Board is open for curators and artists',
    body: [
      'This board is where members post open calls, studio visit offers and updates about their practice.',
      'Posts stay searchable by medium, theme and location through the Connectory filters. Nothing here is ranked by an algorithm.',
      'Clone note: this is a local fixture that reproduces the measured card structure. The reference board lists real member threads, which are not copied into this build.',
    ],
    image: '/assets/decor/image.png',
    comments: 12,
    likes: 34,
    pinned: true,
  },
  {
    variant: 'discussion',
    author: 'Demo Curator',
    date: 'Demo fixture',
    headline: 'Open call for a group show on slow infrastructure',
    body: [
      'We are collecting proposals for a two-room show built around maintenance, care and the unglamorous work that keeps a studio running.',
      'Applications run through the Card: send your portfolio link and three works. Shortlisted artists get a studio visit slot.',
    ],
    comments: 5,
    likes: 18,
  },
  {
    variant: 'collab',
    author: 'Demo Artist',
    date: 'Demo fixture',
    headline: 'Looking for a co-curator for a pop-up in Turin',
    body: [
      'A weekend pop-up in a former workshop space, twelve artists, one wall text each.',
      'I handle production and the QR codes; I need help with the texts and the invite list.',
    ],
    image: '/assets/decor/Review-1.png',
    comments: 8,
    likes: 21,
    collaborators: 3,
    actionLabel: 'Collaborate',
    badge: '3',
  },
] as const;

/** Measured: the desktop list renders 20 cards per fetch before `Load more`. */
export const COMMUNITY_PAGE_SIZE = 6;
export const COMMUNITY_MAX_PAGES = 3;

/** Deterministic fill: variant order cycles, counters stay fixture-authored. */
export function threadsForPage(page: number): readonly CommunityThread[] {
  const start = (page - 1) * COMMUNITY_PAGE_SIZE;
  return Array.from({ length: COMMUNITY_PAGE_SIZE }, (_, offset) => {
    const index = start + offset;
    const base = VARIANTS[index % VARIANTS.length];
    return { ...base, id: `thread-${index}` } as CommunityThread;
  });
}

/** Total fixture threads available, so the thread count line is derived, not typed. */
export const COMMUNITY_TOTAL_THREADS = COMMUNITY_PAGE_SIZE * COMMUNITY_MAX_PAGES;

/** Measured first page count reference: the live board reported "144 Threads". */
export const COMMUNITY_MEASURED_LIVE_COUNT = 144;

export const COMMUNITY_SIDEBAR = {
  /** `.connectory-sidebar` radio group, measured labels + order. */
  scopes: ['All threads', 'My threads'] as const,
  sortTitle: 'Sort by',
  sorts: ['Newest first', 'Most commented'] as const,
  searchLabel: 'Search threads',
  createLabel: 'Create new thread',
  scopeName: 'scope',
  sortName: 'sort',
} as const;

export const COMMUNITY_PAGE = {
  path: '/community-board',
  heading: 'Community Board',
  /** Measured `h1.text-card-h1.text-box-trim`. */
  headingClass: 'text-card-h1 text-box-trim',
  countLabel: (total: number): string => `${total} Threads`,
  loadMoreLabel: 'Load more',
  /** Measured list geometry: 2 columns x 433px inside an 885px column. */
  listColumns: 2,
} as const;
