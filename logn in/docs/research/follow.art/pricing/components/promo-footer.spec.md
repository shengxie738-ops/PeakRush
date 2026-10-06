# PromoFooter Specification

**Round 34 · DIFF-015 · written 2026-10-01T22:40Z from live reference measurement**

## Overview

- **Target file:** `src/components/PromoFooter.vue`
- **Reference evidence:**
  - markup: `evidence/reference/raw/pricing-promo-footer.html` (verbatim `footer.outerHTML`, 13,783 bytes)
  - geometry + computed styles: `evidence/reference/raw/pricing-promo-footer-boxtree.json` (73 nodes)
  - real CSS: `evidence/reference/raw/_nuxt/PagePromoFooter.4X9VGMLH.css` (1,186 bytes, `@layer components`)
  - route scope survey: `evidence/reference/raw/pricing-promo-footer-routes.json`
- **Interaction model:** static flow content. No scroll, no click, no timer. The only behaviour is
  the site-wide `.btn__hover-accent` hover, which already exists in the clone's button CSS.
- **What this replaces:** `src/pages/PricingPage.vue` line 295 renders
  `<SiteFooter shell :description="…" />`, which produces a *third* 772 px sticky
  `.section__layer`. The reference has no such layer on this route.

## Why this component exists (measured, not inferred)

Reference `/pricing` is three flow children of `.scrollable__area`:

| block | doc y | height |
|---|---|---|
| layer 1 `section__layer--sticky … subscription-and-pricing-section-layer` | 0 | 2213.77 |
| layer 2 `section__layer--sticky … ui-orange` (GIFT CARD) | 2213.77 | 1883.17 |
| **`footer.promo-footer`** | **4097.94** | **185.21** |
| `.scrollable__area.scrollHeight` | | **4283** (frozen baseline says 4282) |

The clone currently renders a 772 px sticky footer layer instead → 4869 (+586). Home is *not*
like this: `/` carries `footer.section-10__footer.text-smaller.row.row--gx.row--stretch` at
h=413.76 inside the sticky Join-Us layer, which is what `SiteFooter shell` models and it is
correct there. **The two footers coexist; do not merge them and do not edit `SiteFooter`.**

### Route table (which `<footer>` each route carries, measured by SPA sweep)

| route | footer class (truncated) | theme | h |
|---|---|---|---|
| `/` | `section-10__footer text-smaller row row--gx row--stretch` | — | 413.76 |
| `/our-product` | `section-10__footer text-smaller row row--gx row--stretch` | — | 413.76 |
| `/pricing` | `promo-footer px-1 py-1 footer-padding ui-background …` | `ui-orange` | 185.21 |
| `/gift-card` | `promo-footer px-1 py-1 footer-padding ui-background …` | `ui-orange` | 185.21 |
| `/faq` | `promo-footer … footer-padding ui-background …` | `ui-green` | 185.21 |
| `/about` | `promo-footer … footer-padding ui-background …` | `ui-green` | 535.03 |
| `/terms-and-conditions` | `promo-footer … footer-padding ui-background …` | `ui-pink` | 185.21 |
| `/signin` | *no `<footer>` element at all* | — | — |

**This round wires `/pricing` and `/gift-card` only** — the two routes whose full box tree and
markup were captured. The others are recorded for later rounds; `h=535.03` on `/about` is a
different content shape and must be measured before it is built.

## DOM structure (verbatim class lists from the live element)

```
footer.promo-footer.px-1.py-1.footer-padding.ui-background.ui-orange      [0,4097.94,1376,185.21]
├── hr.mb-1                                                               [19.1,4117.04,1337.79,0.67]
└── div.row.row--gx.row--stretch                                          [19.1,4136.81,1337.79,69.9]
    ├── div.row.row--gx.col.col--12.col--3:md                             [697.54,4136.81,320.11,69.9]
    │   ├── div.col.col--6.col--12:md.footer-links.pb-1.pb-0:md           [697.54,4136.81,320.11,69.9]
    │   │   └── 5 × a.not-nuxt-link.btn.btn--link.btn--block.btn--accent.btn--text-smaller
    │   │            each: span.btn__content > span.btn__text
    │   │                  > svg.btn__hover-accent.btn__hover-accent--text.icon.icon-hover + text node
    │   └── div.footer-copyright.col.col--6.is-hidden:md-up.text-right     [0,0,0,0]  (mobile twin)
    │       ├── p.text-smaller.text-box-trim.text-right  "2026 © FOLLOW. ART"
    │       └── a.not-nuxt-link.btn.btn--link.btn--accent.btn--text-smaller.mt-0.25  mailto:help@follow.art
    ├── div.group.col.col--6.col--first:md                                [19.1,4136.81,659.33,69.9]
    │   └── div.footer-side-left                                          [19.1,4136.81,181.49,69.9]
    │       ├── p.footer-copyright.text-smaller.text-box-trim.is-hidden:sm-down  "2026 © FOLLOW. ART"
    │       ├── a.not-nuxt-link.btn.btn--link.btn--accent.btn--text-smaller.is-hidden:sm-down
    │       │      mailto:help@follow.art, inner span.btn__text > span.btn__text-text "help@follow.art"
    │       └── div.is-hidden:sm-down.mt-auto                             [19.1,4178.05,181.49,28.66]
    │           └── div.social-networks.mt-auto.social-networks--smaller
    │               └── 5 × a.not-nuxt-link.btn.btn--primary.btn--square.btn--block.btn--accent
    │                          .btn--smallish.btn--text-smallish  [each 28.66 × 28.66, gap 9.55494]
    │                          children: svg.btn__hover-accent.icon.icon-hover
    │                                    span.btn__content > svg.btn__icon.icon.icon-social-<network>
    ├── div.col.col--12.col--3:md.mt-1.mt-0:md.text-right.footer-author   [1036.76,4136.81,320.11,9.4]
    │   ├── svg.footer-author__icon.is-hidden:md-up.icon.icon-videinfra   [0,0,0,0]
    │   ├── a.not-nuxt-link.btn.btn--link.btn--block.btn--accent.btn--text-smaller
    │   │      href="https://videinfra.com/"  text "Digital product development by Vide Infra"
    │   │      inner: svg.btn__hover-accent.btn__hover-accent--text.icon.icon-hover [1055.54,4130.51,66.95,22]
    │   └── svg.footer-author__icon.is-hidden:sm-down.icon.icon-videinfra [1339.68,4132.91,17.2,17.2]
    └── div.is-hidden:md-up.mt-1.5                                        [0,0,0,0]  (mobile socials)
        └── div.social-networks.mt-auto.social-networks--smaller  (same 5 anchors again)
```

**Copy the markup from `evidence/reference/raw/pricing-promo-footer.html` — it is the literal
`outerHTML`, including the inline `<svg>` contents, `tabindex="0"`, `aria-label`, `title=""` and the
`<!---->` comment nodes Vue emits for empty slots. Do not re-derive it from this tree; use the tree
to check you got it right.**

Note the **DOM order is not the visual order**: `.col--first:md` (`order:-1`, already in
`src/styles/layout.css:229`) moves the `div.group` column to the left of the links column. Reproduce
the DOM order as captured, do not "fix" it to match the visual order.

## Computed styles (exact, at 1376×772, dpr 1.5)

### `footer.promo-footer`
- display: `block`; position: `static`; box-sizing: `border-box`
- width: `1376px`; height: `185.208px`
- padding: top `19.1099px`, right `19.1099px`, **bottom `76.4396px`**, left `19.1099px`
- color: `rgb(255, 255, 255)`; background-color: `rgb(244, 121, 58)`
- inherited font-size `25.3068px` / line-height `29.2001px` / letter-spacing `-0.759204px`
  (inherited from the route shell — do not set it on the footer, do not "correct" it)

The 76.4396 px bottom padding is **`--spacing` (19.1099) + `--cookie-message-height` (57.3297)**,
i.e. `py-1` plus `.footer-padding` with `body.cookie-message-active` set
(`--cookie-message-height: calc(var(--scale-px)*60)`, already transcribed at
`src/styles/tokens.css:823-825`). `--scale-px` = `clamp(.5px,.06944vw,1px)` = 0.95556 px at 1376 px.
**Nothing about the cookie bar needs to change** — if the footer lands 57.33 px short, the body class
is missing, and that is a CookieConsent defect to report, not something to patch with a magic number.

### `hr.mb-1`
- `border-top: 0.666667px solid rgba(255, 255, 255, 0.3)` (0.666667 = 1 CSS px at dpr 1.5 — the
  declaration is `1px`, do not transcribe the device-scaled reading), `margin-bottom: 19.1099px`
- box `[19.1, 4117.04, 1337.79, 0.67]`

### `div.row.row--gx.row--stretch`
- display `flex`, `gap: 0px 19.1099px`, box `[19.1, 4136.81, 1337.79, 69.9]`
- children widths: `col--6` = 659.33, `col--3` = 320.11, `col--3` = 320.11 → 659.33+320.11+320.11
  + 2×19.1099 gaps = 1337.78 ✓ (this is arithmetic on the existing grid, no new rule needed)

### `.footer-links`
- display `flex`, flex-direction `column`, `gap: 5.73297px` (row and column), height 69.8958
- 5 links, each 9.39583 px tall, ys 4136.81 / 4151.94 / 4167.06 / 4182.19 / 4197.31 (15.12 pitch)
- widths per label: Brand Kit 58.4688, Buy Gift Card 83.375, Terms & Conditions 122.969,
  Privacy Policy 85.6979, Cookie Policy 82.625

### `.footer-side-left`
- display `flex`, column, `gap: 7.64396px`, height 100 % (69.8958), width 181.49
- copyright p 9.39583 tall / 181.49 wide; email link 9.39583 tall (inner text 93.9583 wide)
- socials block at y 4178.05, 28.6562 tall, `gap: 9.55494px`, five 28.6562 px squares

### `.footer-author`
- display `flex`, `align-items: center`, `justify-content: flex-end`, `gap: 8.59945px`, height 9.39583
- link text 261.542 wide; `svg.footer-author__icon` 17.1979 × 17.1979, `margin-top/-bottom: -4px`,
  positioned right (x 1339.68, y 4132.91)

### Text runs
- every `span.btn__text`: font-size `12.6534px`, line-height `15.5734px`, letter-spacing
  `-0.379602px`, white-space `nowrap`, color `rgb(255,255,255)`, display `block`
- `p.text-smaller`: same 12.6534/15.5734/-0.379602
- social anchors: font-size `19.4668px`, line-height `24.3334px`, letter-spacing `-0.584003px`

## CSS to add

Append the `@layer components` block from `evidence/reference/raw/_nuxt/PagePromoFooter.4X9VGMLH.css`
**verbatim** to `src/styles/home-overrides.css` (that file is imported last by design — see the
cascade comment in `src/main.ts:10-12` — and it is where every other transcribed reference component
chunk already lives). The block defines exactly:

```
.promo-footer{padding-bottom:var(--cookie-message-height,0)}
.footer-links{display:flex;flex-direction:column;gap:var(--md,calc(var(--scale-px)*6)) var(--n-md,calc(var(--scale-px)*11))}
.footer-links--text-right{align-items:flex-end}            /* inside the breakpoint group */
.footer-copyright{position:relative}
.footer-author{align-items:center;display:flex;gap:calc(var(--scale-px)*9)}
.footer-author{align-self:flex-start;justify-content:flex-end}   /* inside the breakpoint group */
.footer-author--no-justify-content{justify-content:flex-start}
.footer-author__icon{position:relative;z-index:1}
.footer-padding{padding-bottom:calc(var(--spacing) + env(safe-area-inset-bottom) + var(--cookie-message-height, 0px))}
.footer-side-left{display:flex;flex-direction:column;gap:calc(var(--scale-px)*8);height:100%}
.footer-social{display:flex;flex-direction:row;gap:calc(var(--scale-px)*10)}
```

Do not "simplify" the `var(--md,X) var(--n-md,Y)` pairs — that two-fallback idiom is how the
reference switches breakpoint values and the clone already relies on it elsewhere.

## Content (verbatim, with real hrefs)

- Nav links (this order): `Brand Kit` →
  `https://drive.google.com/file/d/1TRkafTTsg9FOyLTzmTkNSRsd5lD0kx3X/view?usp=sharing`,
  `Buy Gift Card` → `/gift-card`, `Terms & Conditions` → `/terms-and-conditions`,
  `Privacy Policy` → `/privacy-policy`, `Cookie Policy` → `/cookies-policy`
- Copyright: `2026 © FOLLOW. ART` — **the reference renders the real year at runtime**
  (`new Date().getFullYear()`); follow `SiteFooter.vue:52` and use the same, do not hardcode 2026
- Email: `help@follow.art` → `mailto:help@follow.art`
- Socials in DOM order with these exact `aria-label`s: Instagram
  `https://www.instagram.com/followart.world?igsh=aDVyb205bGVleDZr` ("Follow us on Instagram"),
  LinkedIn `https://lv.linkedin.com/company/followart-world` ("Follow us on Linkedin"),
  YouTube `https://www.youtube.com/@FOLLOWART` ("Follow us on Youtube"),
  Substack `https://followart.substack.com` ("Follow us on Substack"),
  Facebook `https://www.facebook.com/followart.world/` ("Follow us on Facebook")
- Author: `Digital product development by Vide Infra` → `https://videinfra.com/`

`src/content/home.ts` already exports `FOOTER` (nav / social / copyright / madeBy) and `EXTERNAL`.
Reuse those where the values match; the promo nav is a *different* list from the home footer nav, so
add a `PROMO_FOOTER` export to `src/content/home.ts` (or a new `src/content/subpages/promoFooter.ts`)
rather than editing `FOOTER` — home's list is bound to measured home geometry.

## Props

`theme?: string` — the route theme class appended to `ui-background` (`ui-orange` default). Keep it
a plain class pass-through; do not build a theme system. Only `/pricing` and `/gift-card` pass
`ui-orange` (which is also the current CSS default in the captured markup, so an omitted prop must
render `ui-orange`).

## Acceptance (run these, do not eyeball)

1. `node scripts/run-page-body.mjs http://127.0.0.1:5175/pricing scripts/bodies/footer-box-tree.body.mjs evidence/local/raw/pricing-promo-footer-boxtree.json`
   — must report `__bodyChars: 3164` (same probe text as the reference side).
2. Compare against `evidence/reference/raw/pricing-promo-footer-boxtree.json`:
   `footer.box` = `[0,4097.94,1376,185.21]`, `scrollHeight` = 4283 (±1), node count 73, and every
   node's `cls` + `box` matching within 1 px. A short script is fine; do not compare by eye.
3. `npm run typecheck`, `npm run build`, `npx vitest run tests/unit` (47) all exit 0.
4. V17 (`/pricing` scroll 0) and V18 (`/pricing` scroll 600) must not regress — run
   `ONLY=V17,V18 node scripts/capture-local.mjs && node scripts/compare-reference.mjs`.

## Hard boundaries for this task

- **Write scope:** `src/components/PromoFooter.vue`, the footer CSS block in
  `src/styles/home-overrides.css`, the promo content export in `src/content/`,
  `src/pages/PricingPage.vue` (footer line only), `src/pages/GiftCardPage.vue` (footer line only).
- **Do not touch:** `src/components/SiteFooter.vue` (12 routes + the home sticky model depend on its
  current geometry), `src/features/home/**`, `src/webgl/**`, `scripts/bodies/**`, `quality/**`,
  `evidence/reference/**`, any route other than the two named pages.
- Do not invent content, do not add a `<footer>` to routes that were not measured, do not add
  fallbacks for states the reference does not have, and do not use `!important`.
- If any acceptance step cannot pass without going outside the write scope, **stop and report**
  rather than editing the other file.
