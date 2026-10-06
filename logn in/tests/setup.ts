/**
 * jsdom ships no matchMedia / canvas 2D context. Both are real in every desktop
 * browser the clone targets, so this is an environment shim, not a production
 * fallback — production code must keep assuming they exist.
 */
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

if (!window.devicePixelRatio) {
  Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });
}

/** Lenis 1.3.3 constructs a ResizeObserver in its Dimensions class; jsdom has none. */
class StubObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
globalThis.ResizeObserver = StubObserver as unknown as typeof ResizeObserver;
globalThis.IntersectionObserver = StubObserver as unknown as typeof IntersectionObserver;

/** Lenis writes through Element.scrollTo; jsdom never implemented it. */
if (typeof Element.prototype.scrollTo !== 'function') {
  Element.prototype.scrollTo = function scrollTo(x?: number | ScrollToOptions, y?: number) {
    const next = typeof x === 'object' && x !== null ? x.top : (typeof x === 'number' ? x : 0);
    const top = typeof y === 'number' ? y : (next ?? 0);
    if (typeof top === 'number') this.scrollTop = top;
  };
}
if (typeof Element.prototype.scrollBy !== 'function') {
  Element.prototype.scrollBy = function scrollBy(x?: number | ScrollToOptions, y?: number) {
    const dy = typeof x === 'object' && x !== null ? (x.top ?? 0) : typeof y === 'number' ? y : typeof x === 'number' ? x : 0;
    this.scrollTop = this.scrollTop + dy;
  };
}
