import type { InjectionKey } from "vue";

/** One scroll owner keeps navigation and in-page jumps in sync with Lenis. */
export type EditorialScroll = (
  target: number | HTMLElement,
  offset?: number,
) => void;
export const EDITORIAL_SCROLL: InjectionKey<EditorialScroll> =
  Symbol("editorial-scroll");
