# Next actions — FOLLOW.ART clone

Written 2026-10-01T02:20Z. Supersedes the 2026-09-30T09:00Z version.

## What this round changed

**The pixel baseline exists.** 26/26 checkpoints plus 2 pointer-roll frames were frozen into
`evidence/reference/captured/2026-10-01/`, with `capture-report.json` carrying 28 records, 0 missing,
0 unclaimed, every field computed from the file itself. The unlock is small and easy to miss:
`take_screenshot` accepts **`filePath`** and writes straight to disk. Every previous round round-tripped
the image through the model, so one ~3-minute visibility window bought one frame; now it buys the
whole freeze. **PENDING-01, PENDING-05, PENDING-06 are closed.**

**First real fidelity score.** `compare:reference` now aggregates freeze folders (newest wins per
id+viewport) and covers all 26 checkpoints. Mean diff **35.33 %**, 0/26 at the ≤5 % bar.

| checkpoint | before | after | |
|---|---|---|---|
| V25 /privacy-policy | 85.74 % | **15.72 %** | −70.0 |
| V26 /cookies-policy | 89.67 % | **21.45 %** | −68.2 |
| V24 /terms | 82.55 % | **18.58 %** | −64.0 |
| V20 /community-board | 82.92 % | **24.44 %** | −58.5 |
| V16 /our-product | 44.46 % | 37.89 % | −6.6 |
| V15 /about | 34.52 % | 27.90 % | −6.6 |
| V19 /faq | 21.96 % | 15.42 % | −6.5 |
| V21 /signin | 41.23 % | 41.23 % | reverted, see D |

Cause of the four big wins: **9 of 12 routes carried the wrong page theme**, and `LegalPage.vue`
hardcoded `ui-light` so it painted white no matter what the route said. Legal pages are also *not*
the home model — the heading is **visible real text at 250.148px, right-aligned, in the right 6
columns** (`col--6:md col--last:md` at [698,76,659,696]), not an sr-only heading plus a glyph SVG.
Full table in `evidence/reference/subpages-measured.md`.

## Gate status (all re-run this session, exit codes measured WITHOUT a pipe)

```
npm run typecheck                  exit 0
npm run build                      exit 0
npx vitest run tests/unit          exit 0   (47 tests)
node scripts/validate-assets.mjs   exit 0   (107/107)
node scripts/validate-evidence.mjs exit 0
node scripts/check-hero-cards.mjs  exit 0
node scripts/compare-reference.mjs exit 0   (26 compared, mean 35.33%)
```

## New tooling (all four are reusable, not scratch)

- `scripts/finalize-capture-freeze.mjs <dir> [vp]` — turn a folder of MCP screenshots into a
  verified capture-report. Run it **immediately** at the end of any visibility window.
- `scripts/contact-sheet.mjs <dir> <out> [cols] [div]` — whole scroll sequence as one image.
- `scripts/compare-strip.mjs <IDS> <out> [div]` — reference | clone | diff rows. This is the QA
  loop; it is what found the theme defect in one look.
- `scripts/measure-sections.mjs <loopback-url>` — section tops/heights/advances. Refuses non-loopback
  origins, so it cannot be pointed at the reference by mistake.

## A. Section geometry is already correct — stop re-checking it

`measure-sections.mjs` vs the reference DOM: tops `0, 772, 1544, 2895, 3667, 4439, 5211, 6755` and
heights `1544, 1544, 2123, 1544, 1544, 1544, 2316, …` **match exactly**, all eight. The reference
sections are 1544 px tall but advance only 772 px — each is pinned for one extra viewport. The clone
reproduces that.

One real difference: **`home.join` is 772 px, the reference is 808 px**, which is the whole of
scrollHeight 7527 vs 7563. Fix the section height, not the scroll wiring.

## B. Doable now, no new evidence needed

### B1. The remaining worst frames are content-layout, not colour
`V23 /gift-card 69.93 %`, `V22 /signup 67.80 %`, `V17 /pricing 66.62 %`, `V18 /pricing 46.22 %`.
Run `compare-strip.mjs V23,V22,V17,V18` and read the strips before touching CSS — the auth/legal
fix only worked because the strip showed the whole model was wrong, not a value.

### B2. Auth pages: the colour is the *word*, not the ground
`V21 /signin 41.23 %` is white-ground with a green giant FOLLOWART on the left; `V22` is the same in
orange. Sampled from the frozen frames: `/signin` x=10 → `rgb(142,148,135)`, x=688 → white. So the
left panel carries a tinted display word and the page ground stays `ui-light`. Build it that way.

### B3. GAP-006 — DONE, do not redo
All five home WebGL scenes are now built from **captured shader source** and verified drawing.
`evidence/reference/scenes-measured.json` had **connectory and testimonials transposed**; the
component sources, the on-disk texture aspects (1380² squares vs 2920×1560) and the shaders'
`#define HEIGHT` all agree. Full correction: `evidence/reference/webgl-scenes-corrected.md`.

Added: `shaders/connectory.{vert,frag}.glsl`, `shaders/testimonials.{vert,frag}.glsl`,
`createConnectoryPanel.ts`, `createTestimonialCarousel.ts`. `V11` improved 45.2 → 24.1 %.

**The silent-failure bug worth remembering:** `mountScenes.ts::buildMount` re-narrowed every
non-`card-ring` kind to `curved-panel|pointer-panel`, so a newly registered scene failed its
per-case guard, returned `null`, and **never requested a WebGL context** — no error, no console
output, just a blank canvas. `canvases=N` and `live=N` cannot detect this (the canvas element
exists either way). Only counting `drawElements`/`drawArrays` per context proves rendering;
`evidence/reference/webgl-scenes-corrected.md` has the probe.

### B3′. New, from the same strips
- **Connectory panel renders too large.** It now draws, but the browser mockup fills ~70 % of the
  width where the reference shows it at ~40 %, left-of-centre. V12 52.5 %.
- **Home display words are oversized.** In the reference `THE CARD` / `CONNECTORY` occupy a band
  and coexist with prose at the same scroll position; the clone's fill the viewport. This is the
  dominant contributor to V05 49.1 %, V06 55.7 %, V13 54.5 %. Measure the rendered
  `.title svg` rect in reference vs clone before touching it — section geometry is already exact,
  so this is intra-section placement/scale only.

### B4. Diffs are not yet reproducible
With no home-page change between runs, V08 moved 16.47 → 18.30 % and V09 23.79 → 28.50 %. That is
time-driven animation landing at a different phase each capture. `?heroTimeSec=` pins the clone's hero
clock; the reference frames are unpinned and unpinable. Either restrict the gate to static regions or
record the phase and sweep it, as `diff-hero-phase.mjs` already does for V01.

### B5. `scorecard.total` can now be computed
It has been null by design because no pixel baseline existed. There are now 26 reference frames.
Define the aggregate over them and let it leave null.

## C. Needs the visible panel (only these two remain)
- **PENDING-02** — D02-D10 continuous-frame trajectories. D01 is derived (−0.05 turns/s, 20 s period).
- **PENDING-07** — font/artwork redistribution rights. Not an engineering task.

Bring the in-app Browser panel to the foreground and keep it there, then run
`finalize-capture-freeze.mjs` the moment the last frame lands.

## D. Rejected this round — do not retry

- **"`/signin` page ground is green."** Changed `SignInPage.vue` and the route meta to green on the
  strength of a left-edge pixel sample; V21 went 41.23 → **69.23 %**. Reverted to `ui-light` and it
  returned to 41.23 %. The green is the giant left-hand word. See B2.
- **"Home sections drift out of phase because section heights are wrong."** Plausible from the
  V11/V12/V13 strips, and false — geometry matches to the pixel (A). The strips show *what is in the
  section*, not where the section is.
- Carried forward and still dead: ring radius 12.9, `phase`/`pathSegment` as card knobs, any hero card
  reaching x ≤ 0, scroll-driven `rotZ`, GSAP/ScrollTrigger, Playwright/curl for **reference** pixels.

## E. Boundaries that must not be relaxed

No public deployment (all 107 assets `rights: permission-required`). No write request to follow.art —
this round's reference interaction was GET navigation, `scrollTop` assignment, and `router.push` in
the user's own tab, all reverted. No credentials stored or transmitted; no DataDog / reCAPTCHA / GTM /
Facebook keys copied. `capture-local.mjs` and `measure-sections.mjs` hard-refuse non-loopback origins;
`capture-reference.mjs` hard-refuses anything but `https://follow.art`. Never copy `evidence/local/`
into `evidence/reference/`. No git commit or push unless asked.

# ADDENDUM 2026-10-01T19:55Z — /pricing layer 2 is UNOWNED; recipe is complete, execute it

Both builder agents are now dead (one hit the 150-turn cap mid-edit, one exited having written
nothing). `src/pages/PricingPage.vue` still has **zero** `gift-card-section` and clone scrollHeight is
still **2925** vs reference **4282**. Everything needed to build it is below — do not re-measure.

## Target structure (measured, viewport 1376x772 @ dpr 1.5, y = absolute document px)

```
div.section__layer.section__layer--sticky.section__layer--full-height   [0,2214,1376,1883]  bg rgb(244,121,58)  ORANGE
  div.sticky.sticky--sticky.sticky--full-height                          [0,2214,1376,1883]
    div.gift-card-section.row.row--gx.row--stretch                        [0,2290,1376,1807]
      h2.sr-only "GIFT CARD"                                               [19,2289,1,1]
      div.gift-card-section__content.col.col-12.col--6:md                  [19,2290,659,676]  display:flex
      div.gift-card-section__form-wrapper.col.col-12.col--6:md             [698,2290,659,1807] bg rgb(255,255,255)
```

Layer 1 is pink `rgb(197,147,157)`; **layer 2 is orange `rgb(244,121,58)`**. Do not unify them.

Word-mark chain inside the left column (from the same component on `/gift-card`):
`.gift-card-section__title.text-h2.text-box-trim` (w=640.229) > `.title` (w=630.688) >
`.title-children-wrapper` > `span.is-hidden:sm-down` > `svg` [24,73,631,362].
**631px is produced by the 6-col grid plus `pr-1` (=var(--spacing)=19.104px) on
`.gift-card-section__title`**; a bare `.title` in a full-bleed parent renders 1376px wide.

Images, all already on disk under `public/assets/subpages/gift-card/`:
`buy.svg`→`gift-card-section__title-decoration` [126,2362,127,96]; `image.png`→
`gift-card-section__bg-image` [133,2428,401,339]; `video-preview.png`→
`gift-card-section__video-preview-img` [698,2290,659,358]; `../common/media-play-white.svg`→
`gift-card-section__video-preview-play-icon` [1023,2462,9,15]; press logos
`vaa.png artdaily.png vao.png all-about-art.png world-art-news.png cold.png` at y≈3921 and 3971, h=40.

Glyph set: `displayHeadings.json` key **`gift-card-title`** (viewBox 0 0 667 383, 8 paths) — already
extracted, render via `displaySvg('gift-card-title')` from `src/content/home.ts`. Copy the working
pattern from `src/pages/GiftCardPage.vue` (it is wired and verified there).

Strings: import from `src/content/subpages/giftCard.ts` (`GIFT_CARD`). Do not paste new prose.

Do NOT invent the white form panel's field internals — unmeasured; use
`data-evidence="pending-T00-subpage"`.

Acceptance: clone `/pricing` scrollHeight → 4282; V18 (51.1 %) should drop hard, V17 (4.0 %) must not
regress. Then `npx playwright test` (12) and `npx vitest run tests/unit` (47) must stay green.

## Also unowned, cheap, and already banked
- `displayHeadings.json` keys **`about-title`** (vb 0 0 503 670, 8 paths, target [849,76,508,676]) and
  **`product-intro`** (vb 0 0 1421 505, 7 paths, target [19,20,1338,296]) are extracted but unwired.
  `AboutPage.vue` and `ProductPage.vue` currently use **no `DisplayHeading` at all**, so this is an
  insertion, not a key swap. Targets V15 27.9 % and V16 37.9 %.
- `/gift-card`: column is 914px tall vs measured 676 (238px surplus) — measure the reference's
  **child** heights next, not the container. Also `svg` 640 vs 631 (one more `--spacing/2` inset).

## Measurement-integrity rule now in force
Untouched checkpoints swing up to **7.1pp** between runs (V06 55.7→57.5, V09 30.9→23.8, V13 54.2→61.3)
from time-driven animation phase. **A single `compare:reference` run cannot attribute a small delta to
a small change.** Treat only >~7pp moves or static-region-masked comparisons as evidence; say "within
noise" when that is the honest verdict (as with the auth word-mark: geometrically exact, pixels flat).

## CLOSED PATH: the layer-2 column height is NOT a stretch bug — do not "fix" it with align-self

`PricingGiftCardSection.vue`'s `.gift-card-section__content` renders 1807px where the reference
measures 676px, and `row--stretch` is the obvious suspect. Tested non-destructively on the running
clone (set `align-self:flex-start` in the live DOM, read the height, revert):

```
before: 1807   after align-self:flex-start: 362   row align-items: stretch   target: 676
```

The column's own content is only **362px** — exactly the word-mark. So removing the stretch makes it
*worse* (1807 → 362 vs a 676 target), and the real gap is **~314px of left-column content that was
never measured**. The builder agent reached the same conclusion from the other direction and
deliberately left the space empty rather than inventing a "Buy Gift Card" CTA to fill it; that was
correct.

**Next action here is measurement, not code**: capture the reference's left column children at
/pricing layer 2 (heights + classes + computed styles) and only then decide. Until then the 1807px
stretch is the least-wrong state and must be left alone.

## RESOLVED: why the reference layer-2 column is 676px despite `align-items:stretch`

Queried the reference's `.gift-card-section__content` computed style directly:

```
height: 676.448px        <- explicit, not content-derived
position: sticky         <- I had assumed static
align-self: auto
flex: 0 1 calc(50% - 9.55494px)
class: gift-card-section__content col col-12 col--6:md pr-1:md mb-1.5 mb-0:md
row:   display:flex  align-items:stretch  height 1807  position:static
```

So there is no contradiction: an explicit `height` simply wins over cross-axis stretch, and the column
is a **sticky** child of a 1807px row — which is also why it stays put while the form column scrolls.
My earlier "align-self:flex-start collapses it to 362, so don't remove the stretch" test was reading
the wrong axis: the reference never relied on content height at all.

**Exact next action for the clone** (`PricingGiftCardSection.vue`, left column):
1. add `position: sticky` and `height: 676.448px` to `.gift-card-section__content`;
2. change my unconditional `pr-1` to the reference's **`pr-1:md`**, and add `mb-1.5 mb-0:md`
   (the class list above is verbatim from the live DOM);
3. keep `flex: 0 1 calc(50% - 9.55494px)` semantics from the grid `col--6:md` rather than hardcoding.

Then re-check the 61px layer-1 offset (`2290` reference vs `2229` clone) — it is the same
`2214 vs 2153` layer-1 height gap, which is the actual remaining root cause for all of layer 2's
vertical placement. Fix layer 1's height and layer 2 lands correctly for free.

## Layer 1 height: measured target chain for the 61px shortfall (clone 2153 vs ref 2213.77)

Read from the live reference at /pricing, both layers, with the inner sticky's padding:

| | class (verbatim, truncated) | box | minH | height | inner padding |
|---|---|---|---|---|---|
| layer 1 | `section__layer section__layer--sticky section__layer--full-height subs…` | [0,0,1376,**2214**] | 772px | **2213.77px** | pt **76.4396** / pb **19.1099** |
| layer 2 | `section__layer … ui-b…` | [0,2214,1376,**1883**] | 772px | **1882.98px** | pt **76.4396** / pb **0** |

Layer 1's inner is `sticky sticky--sticky sticky--full-height pb-1:md …`; layer 2's inner is
`sticky sticky--sticky sticky--full-height pt-promo…`.
Also measured: `.subscription-and-pricing` = [0,76,1376,2118], reference scrollHeight **4282**.

Two facts that matter for the fix:
1. Both layers carry `min-height:772px` but their real height is content-driven (2213.77 / 1882.98),
   so the 61px is **content or padding**, not a min-height. Do not patch it with a height override.
2. Layer 1's inner has `pb-1:md` (19.1099px) and layer 2's inner has **`pt-promo-header`** (76.4396px)
   with **pb 0**. If the clone's layer-1 inner is missing `pb-1:md`, that accounts for 19px of the 61
   — the remaining ~42px is still unidentified.

**Next step is one clone-side measurement, not an edit:** dump the clone's two `.section__layer`
boxes plus their inner padding the same way, and diff the two tables. Guessing at the residual 42px
would be exactly the magic-number behaviour this project has already been burned by twice.

## Layer-1/2 chain diffed — two SEPARATE causes, only one safe to fix blind

Measured both sides with identical fields:

| field | reference | clone | delta |
|---|---|---|---|
| L1 layer height | 2213.77 | 2152.62 | **−61.15** |
| L1 inner class | `sticky… pb-1:md …` | `sticky sticky--full-height pb-1:md pt-promo-header` | clone missing `sticky--sticky` |
| L1 inner pt / pb | 76.4396 / 19.1099 | 76.4396 / 19.1099 | **identical** |
| L2 layer height | 1882.98 | 1883.27 | +0.29 ✓ |
| **L2 inner pt** | **76.4396** (`pt-promo-header`) | **0** | **−76.44** |
| `.subscription-and-pricing` | [0,76,1376,**2118**] | [0,76,1376,**2057**] | **−61** |
| scrollHeight | 4282 | 4808 | +526 |

**Cause A — the 61px.** Padding is identical, so it is *pure content height* inside
`.subscription-and-pricing` (2118 vs 2057). Fixing it means finding 61px of missing/differently-sized
content in layer 1, not adjusting padding. Still unidentified.

**Cause B — L2's inner is missing `pt-promo-header`.** Real class mismatch, but **do not just add it**:
L2's total height already matches (1883.27 vs 1882.98) *because* I pinned the column to an explicit
676px. Adding 76.44px of top padding with nothing else changed grows L2 to ~1960 and pushes
scrollHeight further past 4282 — the opposite of the goal. The correct sequence is: resolve Cause A,
then add `pt-promo-header` to L2's inner and let L2's height become content-driven again.

**Cause C — the +526px scrollHeight** is the footer model (reference implies ~185px of footer region;
the clone's `SiteFooter shell` is a full 772px sticky layer). Independent of A and B.

So: three independent defects, previously conflated into "layer 2 sits 61px high". The 61px offset is
Cause A alone. B and C each need their own fix and will not be resolved by touching padding.

# PARKED 2026-10-01T20:33Z — goal auto-pausing at 18/20 turns

## Verified tree state (every line re-run this turn, nothing recalled)
```
typecheck 0 · lint 0 · build 0 · vitest 47 passed (5 files) · playwright 12 passed
verify:assets 0 · verify:evidence 0 · check-hero-cards 0
scratch/in-flight files: none
```
Nothing is half-edited. The tree is safe to build on or ship locally as-is.

## Fidelity, measured over this session
Mean pixel diff across 26 checkpoints: **35.33 % -> 25.09 %**.
Largest verified wins (all outside the +/-7.1pp noise band, so attributable):

| checkpoint | start | now |
|---|---|---|
| V25 /privacy-policy | 85.74 % | 15.72 % |
| V26 /cookies-policy | 89.67 % | 21.45 % |
| V24 /terms | 82.55 % | 18.58 % |
| V20 /community-board | 82.92 % | 24.44 % |
| V23 /gift-card | 89.04 % | 52.74 % |
| V17 /pricing | 66.62 % | 3.95 % |
| V18 /pricing scrolled | 46.22 % | 5.28 % |
| V22 /signup | 67.80 % | 12.43 % |
| V16 /our-product | 44.46 % | 14.51 % |
| V15 /about | 34.52 % | 13.78 % |
| V21 /signin | 41.23 % | 9.83 % |
| V11 testimonials WebGL | 45.20 % | 24.09 % |

## What shipped structurally
26-frame reference pixel baseline (the 27-round blocker, broken by `take_screenshot`/`evaluate_script`
`filePath`); all five home WebGL scenes built from captured shader source and verified by GL draw
counts; T09 network-isolation suite (was declared but had no config and no directory); T10
lifecycle/reduced-motion/DPR/perf suite; `score-clone.mjs` making `scorecard.total` mechanical;
four gate-integrity defects fixed (two stale counters, one gate satisfied by prose in `progress.md`,
one filtered capture overwriting a whole report).

## Remaining work, with the concrete next step for each
1. **/pricing Cause A** — 61px of missing *content* height in `.subscription-and-pricing`
   (2057 vs 2118). Next step: diff layer 1's child boxes clone-vs-reference. Padding is already
   identical, so do NOT touch padding.
2. **/pricing Cause B** — L2 inner missing `pt-promo-header`. Next step: fix Cause A first, then add
   it and let L2 height return to content-driven. Adding it now makes scrollHeight worse.
3. **/pricing Cause C** — footer model: reference implies ~185px, clone's `SiteFooter shell` is a
   772px sticky layer. Independent of 1 and 2.
4. **/gift-card** — section order ("HOW GIFT CARD WORKS?" belongs small inside the right video panel,
   not as a giant heading) + 238px column surplus. Next step: measure the reference's left-column
   child heights, same technique that resolved /pricing's missing CTA.
5. **Home WebGL residuals** V06 55.5 / V13 54.2 / V12 52.6 — cause still unidentified. Next step:
   compare-strip them against the frozen frames; connectory panel is known to render oversized.
6. **T07** motion choreography registry. Hard constraint: hero roll is pointer-driven, not scroll;
   reference has no GSAP.
7. **T11** final report + `scorecard.total` (1/6 categories scorable; blocked on D01-D10 and on
   typography region masks, which need the in-app panel visible).
8. **DIFF-008 / 010 / 014**, **GAP-004 / GAP-005**.

## Boundaries held throughout
No deployment (all 107 assets `rights: permission-required`). No write request to follow.art —
reference interaction was GET navigation, `scrollTop` assignment and client-side `router.push` in the
user's own tab, with the tab restored to `/`. No credentials stored or transmitted. No tracking keys
copied. No git operations (not a repo).

# ADDENDUM 2026-10-01T21:40Z — round 33: Cause A and B are CLOSED, Cause C is a footer variant

Cause A/B/C are no longer open questions. Two of them are fixed and verified to 0.01px; the third is
measured and deliberately untouched. Full record: `progress.md` (round 33) and
`evidence/reference/pricing-plans-difference-measured.md`.

## Closed this round (do not re-open)

- **Cause A** was one missing declaration:
  `.plans-difference--md .plans-difference__list-item { height: 50px }`. Padding was a red herring —
  the rows were content-driven at 43.9375px instead of a declared 50px. `.subscription-and-pricing`
  is now 2118.22 against a 2118.23 reference, and both columns' benefit lists are 854.86.
- **The per-plan benefit state** (formerly PENDING-06) is implemented, not just observed: the Starter
  column renames, reorders, one-ul-per-row, and disabled rows lose their tooltip wrapper and switch to
  `icon-promo-more-close` inside `_not-subscribed-wrapper`.
- **Cause B**: the 76.4396px clearance moved from `margin-top` on `.gift-card-section` to
  `padding-top` (`pt-promo-header`) on the sticky inner, which is where the reference has it; layer 1's
  inner also gained the reference's `sticky--sticky`.
- **The promo rotator** is now the reference's inline-grid `text-swap` (`src/components/TextSwap.vue`),
  replacing invented `__promo-rotator` + a 6s opacity keyframe.

## 1. FIRST: make the table visible to a gate (DIFF-016)

V17 3.95 % and V18 5.28 % did not move **at all** this round. Not because the fix was wrong — the
geometry now matches — but because the /pricing checkpoints are scroll 0 and 600 while the comparison
table spans document y 747–2064. No existing frame contains this work.

Add /pricing checkpoints at ~1150, ~1544, ~1927 and re-baseline before spending another round on the
table. Until then, "no pixel change" is the expected result of correct table work and must not be read
as evidence against it.

## 2. Cause C = a route-scoped footer *variant* (DIFF-015)

Reference /pricing ends with a compact `<footer class="promo-footer px-1 py-1 footer-padding
ui-background ui-orange">`: 185.21px, `position: static`, children `hr.mb-1` (0.67) and
`div.row.row--gx.row--stretch` (69.9). 2213.77 + 1883.17 + 185.21 = 4282, the reference scrollHeight
exactly. The clone renders **no `<footer>` element**; `SiteFooter` is a third `.section__layer` of
772px, so the route reads 4869 (+587).

Do not edit `SiteFooter` wholesale — it is shared by 12 routes and by the home sticky-footer model,
which is separately correct. Introduce the variant per route. Measure the home footer before deciding
how the two coexist; `scripts/bodies/footer-element.body.mjs` already captures the fields you need.

## 3. Still open, unchanged in priority

- `/gift-card`: section order ("HOW GIFT CARD WORKS?" is small text inside the right video panel, not a
  giant heading) and the 238px column surplus. Measure the reference's **child** heights — the technique
  that resolved /pricing's missing CTA and Cause A.
- Home WebGL residuals: V06 57.40 %, V13 53.93 %, V12 52.59 %, V05 49.10 % (this round's compare run).
  Connectory panel is known to render oversized (~70 % width vs ~40 %).
- **T07** motion choreography registry. `TextSwap` is a good template: class-state machine + CSS
  transition, no GSAP. Hard constraint stands — hero roll is pointer-driven, not scroll.
- **T11** final report; `scorecard.total` (still 1/6 categories scorable).
- GAP-004, DIFF-008, DIFF-010, DIFF-014; GAP-005 blocked.

## 4. Unverified number now in the tree — do not trust it

`TextSwap` advances every **1.5s**. The transition duration (1.5s, cubic-bezier(.55,0,.1,1)) is
measured; the *dwell between advances* is not — the element carries `data-evidence="unverified-period"`.
Two probes minutes apart put `active` at index 2 and index 1, which proves it cycles but fixes no
period. Pinning it needs continuous frames (PENDING-02). If round 34 gets a visible panel, this is a
cheap thing to settle.

## 5. Method notes worth keeping

- **Reference and clone must run the same probe body.** `scripts/run-page-body.mjs` +
  `scripts/bodies/*.body.mjs` + `scripts/measure-box-tree.mjs` exist for that reason.
- **Finish animations first.** A hidden document never advances CSS transitions; the first /pricing
  dump reported the display title as 0px tall. Every body now starts with
  `getAnimations().forEach(a => a.finish())`.
- **Keep probe bodies backslash-free.** They travel through a template literal into the browser probe.
  A lost `\s` silently rewrote every captured text field ("Presentation" → "Pre entation"); a lost `\b`
  became a literal backspace and threw `Invalid regular expression`. Evidence written before this rule
  was re-captured rather than reused — check any older `raw/*.json` text field you rely on.
- **`eslint.config.mjs` ignores `scripts/bodies/**` and `.scratch/**`** — they are page-side
  expressions, not Node modules.

# ADDENDUM 2026-10-01T23:55Z — round 34: two renderers were silently broken, and CSS chunks answer what DOM probes could not

The panel stayed `visibilityState=hidden` all round, so **no reference pixel moved** and the four new
checkpoints have clone frames but nothing to compare against. What did move is structural:

## Closed (do not re-open)

- **DIFF-015** — `/pricing` and `/gift-card` now render `footer.promo-footer` instead of a third
  772px sticky layer. Clone `[0,4097.03,1376,185.48]` vs reference `[0,4097.94,1376,185.21]`,
  **scrollHeight 4283 exactly**, 73/73 box-tree nodes and 120/120 tag+class+attribute signatures.
  The `185.21` is `19.1099 + 0.67 + 19.1099 + 69.8958 + 76.4396`, and the bottom pad is
  `--spacing + --cookie-message-height` (`60 × --scale-px` = 57.3297) from `body.cookie-message-active` —
  so **the footer height is coupled to the cookie bar being mounted**; a clone that hides the bar loses
  57.33px and the cause is nowhere near the footer.
- **DIFF-017, the biggest find of the round** — `SiteFooter.vue` declared its two wrappers as
  functional components and read the default slot off the **second argument**. Vue 3 passes
  `(props, context)`, so `ctx.slots.default` was the real path and `slots.default` was `undefined`:
  **zero `<footer>` elements rendered on 11 routes.** It survived 33 rounds because the surrounding
  sticky shell kept its min-height, so no geometry gate could see it. Fixing it made home
  scrollHeight **7563** and `home.join` **808** — both exactly the reference, closing the 36px that
  round 28 logged as unexplained. Home was also rendering the footer **twice** (`HomePage` and
  `HomeJoinUs` each included one); the duplicate is gone.
- **DIFF-019** — TextSwap dwell is **30s**, not 1.5s. Round 33 measured the *transition* and used it
  as the *period*, so the clone cycled 20× too fast. No panel was needed: the swap is a class state
  machine, so a `MutationObserver` + timestamps on the live element settles it (13 gaps at
  29.9–30.1s; first gap 6.2s and the two throttled tail gaps recorded and excluded, not averaged in).

## 1. FIRST: run the capture runbook

`docs/research/follow.art/pricing/reference-capture-runbook.md` — four `take_screenshot(filePath=…)`
calls into `evidence/reference/captured/2026-10-01-b/`, then `finalize-capture-freeze`. Until that
happens V27–V30 (which are the only frames containing the plans table and the promo footer) contribute
nothing, and DIFF-015's pixel effect stays unmeasured. An incremental freeze legitimately reports
"4 records, 26 missing" — that is not a failure.

## 2. The reference's real CSS is now on disk. Read it before measuring anything

42 stylesheets enumerated from the live site, 30 of them new (`evidence/reference/raw/_css-*`),
audit in `evidence/reference/css-coverage-round34.md`. Three consequences already visible:

- **The 676.448px pinned in round 31 is not a number, it is a formula**:
  `.gift-card-section__content{height:calc(100svh - var(--spacing-promo-header) - var(--spacing));
  position:sticky;top:var(--spacing-promo-header)}` = 676.4505 here. `GiftCardPage.vue`'s CLONE-LOCAL
  block carries the comment *"the reference's .gift-card-section__content is not defined in any chunk"* —
  that is now false. Task #3 of this round.
- **`"HOW GIFT CARD WORKS?"` is `position:absolute; left:20px; top:18px` inside
  `.gift-card-section__video-wrapper`.** The structure question is answered by one declaration.
- **V04/V05/V06 may be CSS, not WebGL**: the clone styles the get-seen host `inset:0`; the reference
  declares `width/height:134.78% ; top:-13.2% ; left:-17.4%`, which predicts the previously measured
  canvas box `[584,686]` to 0.33 px. That is DIFF-021. The same audit found the `@layer components`
  scrollbar block and `:root{--header-height}` absent — those affect *every* frame.

## 3. New open, with the next action spelled out

- **DIFF-018**: `section-10__footer` renders now but measures **h=69.83 vs 413.76** on 8 routes.
  It was written from the JS chunk transcription and never verified, because the element did not exist.
  Capture the reference home footer box tree (hidden iframe is enough — it is flow content) and diff
  node-for-node the way DIFF-015 was closed.
- **DIFF-020**: clone `/gift-card` is **6312** tall, two independent reference reads say **2068**.
  Do not act on this yet — round 34 also saw `/pricing` collapse 4283 → 2068 under `router.push` in
  the probe iframe. One visible-panel scroll-to-bottom read settles it.

## 4. Method notes

- **Hidden-document rects are only trustworthy for flow content that no JS transform moves.** Rule of
  the round: `router.push` inside the probe iframe is for *element identity*, `iframe.src = route` is
  for *geometry*. `/about` additionally reported `footer x=-119.18`, `hr h=346.89` at scrollTop 0 —
  its section chain is transform-driven and frozen mid-travel, so `h=535.03` is in the record as
  UNTRUSTED.
- **A gate that can't see a thing is worse than a red gate.** `footers.length === 0` on 11 routes went
  undetected for 33 rounds because every check measured the layer, not the content. `.scratch/footer-routes.mjs`
  is the per-route inventory; promote it to `scripts/` next round and make it assert the expected
  variant per route.
- **Vue functional components**: `(props, ctx)`, slots on `ctx.slots`. `Bare`/`Shell` here are the only
  two functional components in the tree, which is why this is the only place it bit.
- New gates/tools: `scripts/check-probe-bodies.mjs` (enforces the no-backslash probe-body rule that
  round 33 learned by destroying an evidence set), `scripts/emit-reference-probe.mjs` (embeds a body
  file verbatim so reference and clone cannot drift, stamps `__bodyChars` both sides, `--teardown`),
  `scripts/fetch-reference-css.mjs` (works for CSS and JS; report path derives from the URL list).
- `npx playwright install chromium-headless-shell` was needed — no browser binaries were present, so
  `test:e2e` could not have run green on a clean machine. It writes only to `%LOCALAPPDATA%`.
