# Progress — FOLLOW.ART desktop clone

Result state: **PARTIAL, but the 3D core is now evidence-backed rather than fitted.** Everything
below is backed by a command that ran, or marked as not measured.

## Reference version (frozen)
- `https://follow.art`, site tag `v_1790676598601`, Nuxt build `63c1e131-150b-472a-8fd2-ea1d2a3b59fb`.
- Captured 2026-09-29T16:10Z–19:27Z and extended 2026-09-30 at viewport **1376×772 @ dpr 1.5**
  (the in-app browser cannot be resized to the plan's 1440×900@1; recorded as an environment
  constraint, not silently ignored).
- 158 reference assets with real URL, bytes, content-type and sha256
  (`evidence/reference/asset-manifest.json`); 107 of them registered as clone deliverables in
  `src/content/assets.manifest.json`, all `rights: permission-required`.

## Stack — measured, not assumed
Nuxt 3 · three.js **r176** · Lenis **1.3.3** · Pinia · **no GSAP and no ScrollTrigger**
(grep across all captured JS chunks: 0 hits). Fonts `HeadingNow-73Book` + `Hardbop-Bold`, each with
a real `.woff` fallback declared by the reference. Fluid unit `--scale-px: clamp(.5px,.06944vw,1px)`;
palette `#f4793a / #8e9487 / #c5939d / #8498ac`.

## Gates — re-run, not remembered
| Check | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0, **0 CSS/asset warnings** (was 3) |
| `npx vitest run tests/unit` | **47** passed / 5 files (was 34) |
| `node scripts/validate-assets.mjs` | PASS — 107/107 traced |
| `node scripts/validate-evidence.mjs` | **PASS** (was FAIL) |
| `node scripts/check-hero-cards.mjs` | **PASS** — envelope deltas +0.9 / −0.1 / +1.7 / +0.1 px |
| `node scripts/capture-local.mjs` ONLY=V01 | canvases=6, live=3 |
| 26 checkpoints | 26/26 render, 0 blank, 0 console/HTTP errors |
| Fixed Join button | measured `1150,677,207,76` vs reference `[1150,676,207,76]` — 1px |

`verify:evidence` went from FAIL to PASS by **removing a lie, not by lowering a bar**: GAP-001
cited `evidence/reference/captured/V01-_@primary.png`, which does not exist (the one capture that
ever landed was an 8.6 KB Cloudflare challenge page, parked in `_rejected/`). It now says
`localEvidence: "none"`, which is legal for a `blocked` entry. The pixel baseline is still blocked,
still listed in `pending.json` PENDING-01, and `scorecard.total` is still null by design.

## The hero 3D is measured now (this is the headline of this round)
Read out of the **live** reference through a hidden same-origin iframe — no screenshot, no visible
panel, no Cloudflare fight. Method in `scripts/probe-reference-scenes.mjs`, data in
`evidence/reference/scenes-measured.json`, narrative in `evidence/reference/hero-ring-measured.md`.

- `spineLength = 94.24718821101328`, `spineOffset = 161`, `pathSegment = 1`, `flow = 1`,
  per-card `pathOffset = i/9`.
- The spine DataTexture (1024×4, RGBA, HalfFloat) decodes to a **flat radius-15 circle in the XZ
  plane**: `x² + z² = 225`, `y = 0` at every column. Row 1 (tangent) carries three.js' *chord*
  tangent `(-0.00031, 0, 0.99951)`, not the analytic `(0,0,1)` — so the clone now builds frames via
  `getSpacedPoints` + `computeFrenetFrames` like the reference, and a test asserts every texel.
- fov **29.2518** agrees across two independent captures: the live camera and, independently,
  inverting the captured projection matrix (`m[5]=3.8319625854492188 → 2·atan(1/m5)`, with
  `m[0]/m[5] = 1.78234 = 1376/772`).
- Display box: canvas CSS `1376×772`, buffer `2752×1544` → **renderer pixel ratio 2**, pinned
  against a 1.5 device. The clone now pins 2 as well (`WebGLHost.fixedPixelRatio`).
- D01 idle rotation derived from source: `deltaTime × -5e-5` turns/frame = −0.05 turns/s =
  **20 s per revolution**, direction decreasing. Confirmed by a measured accumulated offset of
  −0.00158 after two frames.

## Three defects found and fixed by measuring instead of tuning
1. **A gate that asserted a fiction.** `check-hero-cards.mjs` demanded a card cross `x ≤ 0`. The
   reference's textured-card envelope is `x [308, 1114]` at 1440×900 (`[335, 1026]` at 1376×772)
   and is **phase-invariant** — the ring has 9-fold symmetry, so idle spin permutes which card holds
   which slot without moving the band. No phase ever crops. The clone was already within 3 px of
   correct. Three rounds of knob-turning (`phase`, `pathSegment`, radius 15→12.9) had been spent on
   a defect that does not exist. The gate now asserts the four edges against
   `scripts/project-hero.mjs`, a reconstruction from measured values.
2. **Wrong interaction model.** The clone drove the hero camera roll from section **scroll**
   progress. The reference recomputes `rotation.z` only from `[pointerXInElement, smDown]`; the
   measured −28.19° records a cursor at 22.17 % of canvas width, not a scroll position. Fixed to
   pointer-driven, with a test asserting rotZ is byte-identical at progress 0 and 0.83.
3. **Buffer/format drift.** Hero pixel ratio 1.5 vs the reference's pinned 2; spine texture ported
   with `LinearFilter` + `wrapT RepeatWrapping` where the reference measures `NearestFilter` +
   `ClampToEdge` (its source writes `e.wrapY = C`, a no-op because three calls it `wrapT`). Both
   corrected; sampling lands on texel centres so these are exactness rather than visible fixes.

## Also unblocked by the same method
- **`/signin` is fully measured** (`evidence/reference/signin-measured.md`): the 426.823 px
  right-hand auth column at x=819, `h2` "Login" 38.9335 px right-aligned, Facebook/Google 209×28.656,
  `.input-text__group` with a 1 px `rgba(0,0,0,0.15)` border, labels 12.6534 px `rgba(0,0,0,0.6)`,
  "I forgot my password" 12.6534 px `rgb(156,156,156)`. PENDING-05's old reason ("never observed")
  no longer holds for `/signin`. Two numbers are flagged for re-checking before use.
- **All six home WebGL scenes captured**, including the two previously invisible ones:
  connectory (an **8-plane pool showing 4 at a time**, radius 4.24, offset −π/2) and testimonials
  (radius 6.3, offset −5.4, `Plane(1, 0.5342465753424658, 30×30)`). The clone is not yet bound to
  those numbers — tracked as GAP-006.
- `GATE-002`: the missing `.woff` files turn out to be *real reference declarations*, so the fix
  was to fetch them (81008 / 44252 bytes) rather than delete the rule. Plus the corrupted
  `@layer components;{None}` line at `src/styles/layout.css:960` removed → build is warning-free.

## Second panel window: the first real reference pixels (09:25Z–09:28Z)

`take_screenshot` worked briefly and produced `evidence/reference/captured/V01-_@primary.png`
(2064×1158 = CSS 1376×772 @ dpr 1.5, 339,830 bytes, sha256 `be46f4d8ac7f5032`). Corners read
`rgb(244,121,58)`, card band near-black — the real hero. Then the panel went hidden again, so
**1 of 26** states exists. What it bought:

| Measurement | Result |
|---|---|
| Reference dark-card envelope | **[337, 1024]** CSS px vs reconstruction **[335, 1026]** → **2 px** |
| Reference Join-button box | mean `rgb(8,6,6)`, 96.4% dark |
| Clone button box, before fix | mean `rgb(241,120,57)`, **1.0% dark** → invisible |
| Clone button box, after fix | mean `rgb(5,5,5)`, 97.3% dark |
| V01 pixel diff, raw | 15.08% |
| V01 pixel diff, phase-aligned best over one 1/9 slot | **11.53%** (worst 14.83%, spread 3.3 pp) |
| Header band y0–50 | **0.98%** — static layout matches |
| Left third x0–300 | 2.01% |
| Ring band [300,90 820×610] | 22.5% — dominated by unrecoverable animation phase |
| Right third x1120–1376 | 18.9% — display-word glyph divergence (DIFF-014) |

**DIFF-013, found only by pixels:** the fixed Join button matched the reference rect to 1 px and
hit-tested at its centre, but painted flat orange. The clone rendered
`btn btn--start fixed-sign-up-button__btn`; the live element is
`btn btn--start btn--primary btn--full btn--accent btn--large fixed-sign-up-button__btn`. `.btn`
is `background-color: transparent` — all paint is on `.btn:after { inset:0; background:
var(--btn-background) }`, and `--btn-background:#000` comes only from `.btn--primary`. The earlier
hardcoded `height: var(--sign-up-height)` that masked the resulting 38 px collapse was removed:
`btn--large` supplies `--btn-height: calc(var(--scale-px)*80)` = 76.44 px (measured 76.4375 px).
The real `.sr-only` / `aria-label` text was transcribed into `JOIN.srLabel`.

**A rect match does not prove a paint.** Every overlay whose identity *is* a colour block now
needs a pixel-box assertion; this one sat behind a passing "1 px" claim for a whole round.

`?heroTimeSec=` was added to `mountScenes.ts` as a capture-only clock pin — without it the ring is
at a different rotation in every screenshot and the diff measures timing, not fidelity.

## Remaining work, in the order that makes sense
1. **GAP-006** — bind get-seen / nexus / connectory / testimonials to the measured radii, offsets,
   plane sizes, textures and the connectory pool. Do **not** invent the progress→uniform easing:
   the uniform values are measured, the mapping is not.
2. **GAP-007 / DIFF-010** — bind `SignInPage.vue` to `signin-measured.md`; probe `/signup` the same
   way; then `/pricing` per-cell benefit state (PENDING-06), which is no longer pixel-blocked.
3. **DIFF-008** — the second display line is a *separate* SVG set, already dumped: `scripts/_sheet.html`
   entry #0 is `intro__title` (FOLLOW.ART), entry #4 is `section-5__title--desktop` (ONE PRACTICE /
   ONE CARD). Mount #4; compare to the measured `h1.sr-only` 1×1 at [19,75], font-size 250.148 px.
4. **T07 / T09 / T10 / T11** — choreography registry (pointer-driven hero roll, not scroll), e2e
   network isolation, lifecycle/leak + DPR2 buffer verification, final report.
5. **GAP-001 / GAP-005** — need the user to bring the in-app Browser panel to the foreground. Only
   pixels and continuous-frame trajectories are waiting on that now; nothing else on the list is.

## Process lessons recorded this round
- **"Cannot observe" was over-generalised.** The visible-panel limit is real for *pixels*; the
  previous round extended it to *structure* and parked five items behind it. DOM, computed style,
  three.js scene graphs and GPU-bound texture payloads are all reachable in a hidden same-origin
  iframe. Two "blocked" pending entries and one "open P1" closed the same way in one session.
- **Uniforms need no render.** `material.onBeforeCompile({uniforms:{}, vertexShader:'void main(){}'})`
  copies the shader-injection helper's private uniform bag into whatever object it is handed.
- **A red gate is not always a code defect.** When a gate has been failing across rounds while every
  tuning knob moves ~3 px, suspect the gate's *target* before the geometry.
- Re-confirmed environment traps: `| tail` swallows the exit code (this round's `verify:evidence`
  first "passed" as `exit=0` only because `tail` was in the pipeline — re-measured as 1); `/tmp` is
  not shared with Node on Windows; never pipe `npm run dev`.

## Boundaries held
No public deployment. No write request to follow.art. No credentials stored or sent. No tracking
keys copied from the reference's runtime config. All 107 assets are `rights: permission-required`.
No commits (the workspace is not a git repository). The user's browser tab was left at `/`, with
the probe iframe and its globals removed.

---

# Round 2026-10-01 — the pixel baseline exists, and it immediately found a systemic defect

Result state: **the clone now has a 26-frame reference to be wrong against.** Mean pixel diff
**35.33 %**, 0/26 at the ≤5 % bar, four checkpoints improved by 58–70 percentage points.

## The unlock was a tool parameter, not a technique

`take_screenshot` accepts `filePath` and writes straight to disk. Twenty-seven rounds treated the
visibility window as worth ~one frame because the image was being round-tripped through the model;
with `filePath` the same window holds **26 checkpoints + 2 pointer-roll frames**. Frozen in
`evidence/reference/captured/2026-10-01/` with a 28-record `capture-report.json` (0 missing,
0 unclaimed, every field computed from the bytes). `finalize-capture-freeze.mjs` makes this repeatable.

Scroll was driven by assigning `.scrollable__area.scrollTop` and polling to settle. The recorded
"Lenis reverts direct scrollTop assignment" belief is wrong for the reference: 1900 read back as
1869.33 mid-flight and exactly 1900 ~1.1 s later, and computed `scrollSnapType` is `none`.

## What the baseline found on first use

`compare-strip.mjs` (reference | clone | diff rows) showed in one image that **9 of 12 routes carried
the wrong page theme** and that `LegalPage.vue` hardcoded `ui-light`, forcing white regardless of the
route. Legal pages also use a different heading model from home: **visible real text at 250.148px,
right-aligned, in the right 6 columns** — not sr-only-plus-glyph-SVG.

| checkpoint | before | after |
|---|---|---|
| V25 /privacy-policy | 85.74 % | **15.72 %** |
| V26 /cookies-policy | 89.67 % | **21.45 %** |
| V24 /terms | 82.55 % | **18.58 %** |
| V20 /community-board | 82.92 % | **24.44 %** |
| V19 /faq | 21.96 % | 15.42 % |
| V16 /our-product | 44.46 % | 37.89 % |
| V15 /about | 34.52 % | 27.90 % |

## Three things measured rather than assumed

- **Section geometry is already exact.** `measure-sections.mjs` vs the reference DOM: all eight tops
  (`0, 772, 1544, 2895, 3667, 4439, 5211, 6755`) and heights match. Sections are 1544 px tall but
  advance 772 px — pinned one extra viewport each — and the clone reproduces that. The only real gap
  is `home.join` 772 vs 808 px, which is the entire scrollHeight difference (7527 vs 7563). This
  killed a tempting "sections drift" theory raised from reading the V11/V12/V13 strips.
- **PENDING-06 /pricing entitlements.** State is on the `li`: `_free` marks Pro rows also in Starter,
  `_disabled` marks Starter rows not included, with a `…_not-subscribed-wrapper` beside each. Dimming
  is **`color: rgba(255,255,255,0.3)`, not `opacity`** (measured 1 everywhere) — an `opacity` clone
  blends against the wrong layer. Row order genuinely differs between the two frames (Pro: Link
  sharing / QR sharing / Add to Wallet; Starter: Link sharing / Add to Wallet / QR sharing), which is
  exactly the §13.3 text-order trap. Starter excludes 4 of 11 leaf rows.
- **PENDING-05 /signup, and both flagged /signin numbers.** The 204×29 submit is genuinely
  203.85×28.66, and the password field genuinely computes `font-family: "Noto Sans SC", 20px` while
  the adjacent email field is `HeadingNow, 12.6534px`. The "caught a hidden mobile variant" theory
  was wrong — a visible-element-filtered re-probe reproduced both, and the anomaly repeated on
  `/signup`. Reproduce, do not fix. `/signup` also mirrors the tab pair (active `Join` left) and adds
  artist/curator radios plus two sr-only consent checkboxes.

## One change reverted on evidence

`/signin`'s left-edge pixel read green, so the page theme was set to green. V21 went 41.23 → **69.23 %**.
Reverted to `ui-light` → back to 41.23 %. The green is the giant left-hand display word; the ground is
white. Recorded as a rejected hypothesis rather than silently undone.

## Known measurement noise

With zero home-page changes between runs, V08 moved 16.47 → 18.30 % and V09 23.79 → 28.50 %. That is
time-driven animation at a different phase per capture, not a regression. `?heroTimeSec=` pins the
clone; the reference cannot be pinned, so either gate on static regions or sweep phase as
`diff-hero-phase.mjs` already does.

## Gates

typecheck 0 · build 0 · vitest **47** · validate-assets 0 (107/107) · validate-evidence 0 ·
check-hero-cards 0 · compare-reference 0 (26 compared).

## Still open, in priority order

`V23 /gift-card 69.93 %` · `V22 /signup 67.80 %` · `V17 /pricing 66.62 %` · home WebGL
`V06 55.68 / V13 55.57 / V12 51.02 / V05 49.31` · **GAP-006** (and note nexus mesh 2 carries
`radius 0.87, offset -1.04` where the capture lists one set at `1.96 / -0.48` — re-probe per mesh,
which needs no render and no panel) · `home.join` +36 px · `scorecard.total` can now leave null.
PENDING-02 (D02-D10 trajectories) and PENDING-07 (rights) are the only items left that need the panel.

---

# Round 2026-10-01 (cont.) — GAP-006 closed, and the two scenes turned out to be mislabelled

## The capture had connectory and testimonials swapped

`scenes-measured.json` gave `landing-7-connectory` the 8-plane / 1380×1380 / radius-4.24 set and
`landing-9-testimonials` the single-plane / 2920×1560 / radius-6.3 set. The reference **component
sources** on disk say the opposite, and three independent signals agree: `Landing7ConnectoryWebGl`
builds `Plane(1, 1/1460*780, 30, 30)` at radius 6.3 / offset −5.4, `Landing9TestimonialsWebGl` builds
`count:8` × `Plane(1,1,20,20)` at radius 4.24 / offset −π/2; the downloaded `Review-1..8.png` are
1380×1380 squares (only they can feed `Plane(1,1)`) and `decor/image.png` is 2920×1560, aspect
1460:780 = the shader's `#define HEIGHT 0.5342465753`. Recorded in
`evidence/reference/webgl-scenes-corrected.md`.

Neither scene's GLSL had ever been captured, so both were built from the component sources instead:
`shaders/connectory.{vert,frag}.glsl` (from `C4ipafMf.js` + `si6jlswl.js`) and
`shaders/testimonials.{vert,frag}.glsl` (inlined `le`/`ce` in `BsSV4kAi.js`), plus
`createConnectoryPanel.ts` and `createTestimonialCarousel.ts`.

**Testimonials is a drag carousel, not a scroll scene.** Index changes only via Prev/Next or pointer
drag; camera is static. Its `effect` uniform drives a `mix(pointBase, point, effect)` — `effect 0`
renders the card **flat**, `effect 1` renders it **wrapped**, while radius relaxes 4.24 → 2.07. So the
front card is the curved one and the edge cards are flat, the inverse of a naive always-bend build.

## A silent-failure bug that no existing gate could see

`mountScenes.ts::buildMount` re-narrowed every non-`card-ring` kind to
`curved-panel | pointer-panel`. Both new scenes therefore reached `createWebGLScene` with the wrong
`mount.kind`, hit the per-case guard, returned `null`, and **never requested a WebGL context**. No
error, no console output — just a blank canvas. `canvases=6 live=3` looked stable throughout, because
the `<canvas>` element exists either way.

Only counting real draw calls found it: patch `getContext` + `drawElements`/`drawArrays` before app
load. Before the fix, 4 contexts and none for testimonials/connectory; after, 6 contexts that tick
when their section is in range (nexus 4→22→144→174 across scroll 0/1150/1900/4450; testimonials
8→288 at its own section). `V11` 45.2 → **24.1 %**.

## Two things I suspected and then disproved

- **nexus mesh 2 `radius 0.87 / offset -1.04` is measured, not fitted.** Last turn I flagged it as
  transcribed from another scene; `evidence/reference/webgl-scenes.json` has per-mesh uniforms and
  confirms both values. No re-probe was needed.
- **`nexus draws=0` was a probe artifact, not a defect.** I read it at scroll 5400, where the nexus
  section is legitimately out of range. Re-measured at four positions it scales correctly. I also
  nearly added `frustumCulled = false` to nexus on the theory that culling caused it — the reference
  nexus component does **not** set that flag, so adding it would have made the clone diverge from the
  thing being cloned. Checked the source first.

## Where the diff stands

Mean 34.61 % across 26 checkpoints. Gates: typecheck / build / lint / 47 tests / assets / evidence /
hero-cards all exit 0. Four tests asserted that these two sections stay unbuilt; they encoded a real
limitation that is now resolved, so they were moved to the new truth — and the texture test now also
asserts the wrong-mount-kind rejection, which is the regression guard for the bug above.

Worst remaining: `V23 /gift-card 69.9` · `V22 /signup 67.8` · `V17 /pricing 66.6` · `V06 55.7` ·
`V13 54.5` · `V12 52.5` · `V05 49.1`. The three home ones share one cause visible in the strips: the
clone's display words fill the viewport where the reference keeps them a band beside prose, and the
connectory panel renders ~70 % width against the reference's ~40 %.

---

# Round 2026-10-01 (later) — sub-page glyph sets recovered

**`evaluate_script` supports `filePath` after all.** A prior note in memory said it hangs; it now
writes the result straight to disk. That is what made the next step affordable: a single
client-side router walk dumped every sub-page's inline `<svg>` sets to
`evidence/reference/raw/_subpage_svgs.json` (548 KB) at **zero context cost**. Anything that was
previously "never downloaded" and lives in the DOM is now reachable this way.

`scripts/extract-subpage-svgs.mjs` folds six of them into `src/content/displayHeadings.json`
(7 → 13 entries): `about-title`, `product-intro`, `pricing-title`, `gift-card-title`,
`signin-wordmark`, `signup-wordmark`. Selection is by viewBox + path count + rendered rect, not by
"biggest SVG on the page", because each route also carries dozens of 82×4
`underline-text-piece__decoration` sets. Two notes recorded in the script: `/gift-card`'s word-mark
has **no class at all** (so it can only be matched geometrically), and `/signin` + `/signup` each
mount a second collapsed 0×0 copy that must be filtered out.

**Two `/pricing` defects fixed, both by measurement rather than tuning:**
1. The heading was a `text-h2` real-text fallback — ~4× too small. Now the captured 12-path SVG,
   rendering at 1338px wide against the reference's 1338px.
2. `.subscription-and-pricing-section-layer { background: var(--c-orange) }` hardcoded orange and
   claimed to be "transcribed from the live CSSOM". Every sampled point of the frozen V17/V18
   reference frames reads `rgb(197,147,157)`. The element already carries `ui-background`, whose
   `var(--t-background)` resolves to pink through the `.ui-pink` ancestor — so the correct rule is
   **no rule**, and the override was merely out-specifying the theme utility. Ground now verified
   `rgb(197, 147, 157)`.

**Two hypotheses I raised and then killed with measurement, same as last round:**
- *"Home display words are oversized."* They are not. Reference vs clone rendered rects:
  intro 1338×471 / 1338×471, section-5 [1619 vs 1616], section-9 [4513 vs 4511],
  section-7 [5377 vs 5378], section-10 640×546 / 640×546. **All within 3 px.** The V05/V06/V13 strips
  look nothing alike for a different reason, and I should not have spent a turn on the scale theory.
- *"nexus draws=0 is a bug."* It was my probe reading scroll 5400, where the nexus section is
  legitimately out of range. Re-measured across four positions it scales correctly.

**Still open on /pricing:** clone scrollHeight 2925 vs reference 4282 — roughly 1357 px of section
content is missing, which is now the dominant diff. Word-mark height 471 vs 411 (the reference
squashes it via per-path `data-scale-y`, not via CSS height).

Gates after this block: typecheck exit 0. (Full suite re-run pending the auth-page work landing.)

---

# Round 2026-10-01 (later still) — T09 landed, and four gate-integrity defects fixed

## T09 (interactions + network isolation e2e) is now real
`tests/e2e/` did not exist and there was no `playwright.config.ts`, yet `package.json` declared
`test:e2e` and `verify:release` already invoked it — so a declared gate was running against nothing.
Added `playwright.config.ts` (baseURL hard-pinned to loopback, measured 1376x772@1.5 viewport,
`reuseExistingServer`) and `tests/e2e/network-isolation.spec.ts` with **6 tests, all passing**:
every route loads with zero non-loopback requests; full home scroll; WebGL home runs with no egress
and no console errors; auth forms never hit the wire **and persist nothing** to
localStorage/sessionStorage/cookie; pricing cycle + gift-card controls; and no reference-site secret
marker (datadog / recaptcha / GTM / facebook / clarity) appears in the served bundle.

Two of my own test bugs, both fixed in the test rather than by weakening the assertion: clicking the
plan CTAs navigates and tears the page down mid-loop, and the default 30 s budget was outrun by the
control walk (it took 120 s to fail, now 4.1 s to pass).

## Four places where a gate was measuring the wrong thing
1. **`verify-release.mjs` counted only the legacy top-level reference report** → reported
   `captured 1` while 29 frames exist in freeze folders. Now aggregates them and reports
   `28 states x 1 viewport (29 frames)`. **The 24 x 3 bar was NOT lowered** — it still fails,
   correctly, because reference pixels are only obtainable at the in-app viewport.
2. **`validate-evidence.mjs` scanned only the top-level captured dir** → "1 usable reference
   screenshots". Now recurses one level and reports `29 usable (0 rejected as <40KB)`, keeping the
   per-file Cloudflare guard.
3. **The D01-D10 motion gate was `/D10/.test(readFileSync('progress.md'))`** — a gate satisfied by
   writing the string "D10" in a prose paragraph. Replaced with a real check for `evidence/motion/D01..D10`
   files. It now honestly reports `0/10`.
4. **`lib-capture.mjs` let a filtered run overwrite the whole report** — `ONLY=V21,V22` reduced
   26 records to 2. Now merges by id+viewport. Verified: `26 prior + 1 new -> 26 records`.

My own two mistakes caught and fixed in the same pass: I set GAP-006's `localEvidence` to a
comma-joined file list, and `validate-evidence` takes the first space-delimited token as a path — so
it resolved `src/webgl/create` and **broke a previously-passing gate**. Then my merge guard silently
no-op'd because `readFileSync` wasn't imported and I had wrapped it in `catch {}` — a swallowed
ReferenceError presenting as working code. Removed the blanket catch and added the import; the guard
now announces what it merged.

## Backlog
GAP-001 (reference pixel baseline) and GAP-006 (bind non-hero WebGL scenes) moved to `fixed` with
observation/hypothesis/nextAction recorded. Still open: GAP-004, GAP-005 (blocked), DIFF-008,
DIFF-010, GAP-007, DIFF-014.

## Gates
typecheck · build · lint · 47 unit · 6 e2e · assets · evidence · hero-cards — **all exit 0**.
`verify:release` **9 passed / 5 failed** (was 8/6). The 5 remaining are genuine gaps, not bookkeeping:
reference breadth 24x3 (have 26x1), D01-D10 trajectories, `scorecard.total` still null,
open GAP-004/DIFF-010, blocked GAP-005.

---

# Round 2026-10-01 (later) — scoring made mechanical, /pricing gap located

## `scorecard.total` went from "null by design" to "null for a specific, narrowing reason"
For 28 rounds `total` was null because no pixel baseline existed. That reason is now gone, so the
null needed to become mechanical rather than editorial. Added `scripts/score-clone.mjs` (wired as
`npm run score:clone`), which derives each category from a named artifact and enforces plan §1579
("no data → null with a reason, never a guessed value"): **`total` stays null while any category is
null.**

Current honest output: `layoutCompositionRhythm` **14.16/20** from the mean pixel diff over 26
scored checkpoints. The other five are null **with reasons**, and two of those refusals are the
point:
- `TypographyTextColour` — a whole-frame pixel diff cannot separate type rendering from layout.
  Scoring it would be a guess wearing a number.
- `webglGeometryPerspectiveAssets` — the hero ring is measured to 1.7px and all five scenes are
  verified drawing, but per-scene pixel agreement isn't separable and the non-hero scenes have no
  numeric oracle. Refusing to bank 25% of the rubric on partial evidence.

## /pricing's missing 1357px is a whole section, not padding
Reference `/pricing` has **two** `.section__layer--sticky` blocks: subscription [0,0,1376,2214] on
pink, and a **GIFT CARD block [0,2214,1376,1883] on orange** with a white right-hand form panel.
The clone renders only the first — hence 2925 vs 4282. Structure, all nine image paths (every one
already on disk under `public/assets/subpages/gift-card/`), and the two-column 659px split were
measured and handed to a builder. Note the second layer genuinely **is** orange, which confirms the
earlier orange removal was correctly scoped to layer 1 only.

## Two self-inflicted errors caught in-pass
The scorer first emitted `score=1416.64` — I reused a ratio-rounding helper on an already-weighted
value. Then it broke `lint` (and so dropped `verify:release` 9→8) via an unused `pending` read I'd
left behind. Both fixed; the second is a reminder that a new script is a new gate surface.

`tmp-rects.mjs` in the repo root currently fails `no-undef`. It belongs to the still-running auth
worker, so I left it alone rather than pull a file out from under a live job; lint must be re-run
once that agent finishes.

## Gates
typecheck · 47 unit · assets · evidence · hero-cards — exit 0. `verify:release` 8 passed / 6 failed,
the 6th being that `tmp-rects.mjs` lint error. Genuine remaining gaps unchanged: reference breadth
24×3 (have 28×1), D01-D10 trajectories, `total` pending 5 categories, open GAP-004/DIFF-010,
blocked GAP-005.

---

# Round 2026-10-01 (later) — auth pages land, /gift-card word-mark restored

## Auth rebuild verified independently, then the worker died
The `/signin` + `/signup` builder hit the **150-turn subagent cap** and terminated mid-edit with
"found the main bug — the 8-column width is on the wrong element". Its output was already on disk and
was re-verified from scratch rather than trusted:

| checkpoint | before | after |
|---|---|---|
| V21 `/signin` | 41.23 % | **9.93 %** |
| V22 `/signup` | 67.80 % | **12.43 %** |
| mean (26 checkpoints) | 34.61 % | **28.51 %** |

typecheck · build · 47 unit · 6 e2e all exit 0 after re-running. Spot-check confirmed it did **not**
fabricate unobserved states: zero `is-invalid` / `aria-invalid` / `:focus` rules, no `fetch`/XHR, no
localStorage/sessionStorage access, and 3 `data-evidence` markers retained for the parts genuinely
never measured. GAP-007 closed. Its unfinished column-width refinement is a polish item, not a
breakage — which is why re-verifying a dead agent's tree mattered.

## /pricing V17 went 66.62 % -> 4.00 %, and the reason is worth stating
The two fixes made earlier this session (remove the hardcoded orange on layer 1; swap the `text-h2`
text fallback for the real 12-path word-mark) address exactly what is visible at scroll 0. A 4 %
result on a page still 1357px too short looked wrong enough to check, so the reference frame was
re-hashed: `f9689f41ab7ba0c9` matches its own capture record and differs from the clone's
`3ecc323f24ce69d3`. The reference is intact; V17 is simply a first-screen checkpoint. **The missing
below-the-fold GIFT CARD section is still missing** and is being built separately.

## /gift-card was missing its word-mark entirely
The strip showed the clone rendering a 38.9px `text-card-h1` and promoting "HOW GIFT CARD WORKS?" to
hero, where the reference has a 631x362 "GIFT CARD" word-mark on the left. That glyph set was already
banked this session as `gift-card-title` (viewBox 0 0 667 383, 8 paths). Wired it; 69.9 % -> **58.71 %**.

First attempt rendered the SVG at **[0,0,1376,790]** — full viewport. Measuring the reference's actual
ancestor chain explained why: `.gift-card-section__content` (col, 659px) -> `.gift-card-section__title
.text-h2` (640px) -> `.title` (631px) -> svg. The 631px is *produced by the 6-column grid*, so the
wrapper has to be the grid; a bare `.title` in a full-bleed hero just fills it. Rebuilt on that chain
plus `pt-promo-header`. Now 659x379 at [19,0] vs 631x362 at [24,73] — width still ~28px wide and the
y-offset not yet landing, because the intermediate `.gift-card-section__title` isn't narrowing. That
is the same "8-column width on the wrong element" class of bug the dead agent identified but did not
finish. Not guessed at further this turn.

## Gates
`verify:release` still 8 passed / 6 failed. Open: GAP-004, GAP-005 (blocked), DIFF-008, DIFF-010,
DIFF-014. `tmp-rects.mjs` from the terminated auth worker is still in the repo root failing `no-undef`
— it is now safe to remove since that worker is dead.

## /gift-card word-mark: partial, and the residual is a different bug
Chained fix, each step measured rather than tuned:
- wire the captured `gift-card-title` set → V23 69.94 % -> **58.71 %**
- first render was **[0,0,1376,790]** (full viewport). Diffing the clone's ancestor chain against the
  reference's isolated the cause exactly: `.gift-card-section__title` is 640.229px in the reference vs
  659.328px in the clone — a delta of precisely `var(--spacing)` = 19.104px of right padding.
- added `pr-1` → svg 659 -> 640, V23 58.71 % -> **56.25 %**.

Two measured deltas remain open on this page and were **not** guessed at:
1. `.title` is 630.688px inside a 640.229px box — another `--spacing/2` (9.541px) of inset somewhere
   in `.title` / `.title-children-wrapper`.
2. `.gift-card-section__content` computes `display: block` in the clone but **`flex`** in the
   reference, and is 472px tall against the reference's 676px. That flex column is why the reference
   keeps the word-mark, the "Buy" script, the card art and the CTA in one composed stack.

The bigger residual is structural, not numeric: the clone still promotes "HOW GIFT CARD WORKS?" to a
giant heading and pushes the photo panel below it, where the reference puts that phrase *small, inside
the video panel* on the right. Fixing that means rebuilding the page's section order, which is a
larger unit of work than this turn had room for. Tracked as the next item.

---

# Round 2026-10-01 (later) — T10 landed and found a real accessibility defect

## Stopped a drifting subagent before it clobbered verified work
The `/pricing` builder had run ~20 minutes without touching `PricingPage.vue` (`gift-card-section`
count still 0, scrollHeight still 2925) while editing `src/pages/GiftCardPage.vue` and
`src/content/subpages/giftCard.ts` — files I owned with a fix already verified at 56.25 %. Stopped it,
cleared its 12 `tmp-*.mjs` scratch files, and confirmed my gift-card work survived intact.

## T10 is now real: 6 tests, and the reduced-motion one caught a genuine bug
`tests/e2e/lifecycle.spec.ts` covers 20×9 route round-trips (canvas count must not drift, DOM nodes
must not grow, zero errors), reduced-motion suppression, WebGL-unavailable fallback, the pinned DPR-2
hero buffer, all-five-scenes-draw, and three fps samples written to `evidence/perf/home-fps.json`
(26.5 / 31.5 / 33.7 — headless, but the loop is provably ticking).

**The defect it found:** under `prefers-reduced-motion: reduce` the app allocated **6 WebGL contexts**.
`App.vue` does `if (reducedMotion) return;`, but it is not the only mount path —
`mountScenes.ensureWebGLAutoMount()` arms from a module side-effect, mounted all five scenes anyway,
and the `PresentationDriver`'s own reduced-motion check only *stops the loop* afterwards. Suppression
has to happen before the contexts exist. Fixed in the auto-mount path, with a `change` listener so it
arms if the user flips the setting at runtime. This is exactly the class of bug a "looks right once"
screenshot cannot see.

## Process note: my sed-on-code instinct was wrong again
After the suite passed 12/12 I "fixed" the leftover unused `CONTAINER` const with chained
`String.replace` calls and immediately degraded a working file to 8 typecheck errors plus a broken
ternary. Deleted the file and rewrote it cleanly instead — which is when the real remaining issue
(`getContext`'s overload set can't be matched by a generic signature; cast the assignment target, not
the function) became obvious. Batch text-replacement on code behaves like it does on documents.

## Gates
typecheck 0 · lint 0 · build 0 · 47 unit 0 · **12 e2e 0** · assets · evidence · hero-cards 0.
`verify:release` **9 passed / 5 failed**, all five genuine: reference breadth 24×3 (have 28×1),
D01-D10 trajectories, `scorecard.total` null pending 5 categories, open GAP-004/DIFF-010, blocked GAP-005.

## Not done
`/pricing` GIFT CARD section (1357px, agent stopped before starting). `/gift-card` section order and
the two measured residual deltas. T07 motion choreography registry. T11 final report. DIFF-008/010/014.

---

# Round 2026-10-01 (later) — /gift-card flex column, +4.6pp on V23

`/gift-card` V23 **56.25 % -> 51.65 %**, session mean **28.51 % -> 28.14 %**. Cause: the reference's
`.gift-card-section__content` computes `display:flex` (measured box [19,76,659,676]) while the clone
had `block` at 472px tall. The class appears in no captured stylesheet chunk, so it is declared
scoped in `GiftCardPage.vue`.

**`flex-direction:column` is marked DERIVED, not measured.** It was never read; it is the only axis
consistent with a 676px column containing a 362px word-mark at the same x and width. The comment in
the file says explicitly that a future direct capture overrides it. Recorded honestly because the
result was right but the reasoning was inference.

That inference is also *incomplete*: the column now measures **914px** against the reference's 676px,
so the children stack with more vertical space than the reference allows. V23 improved anyway, which
is the reason to keep the change rather than revert it — but the 238px surplus is a real open defect,
not a rounding error. Next step on this page is measuring the reference's actual child heights rather
than guessing at the container.

Remaining `/gift-card` residuals, all measured and none guessed: svg 640px vs target 631px (one more
`--spacing/2` inset missing inside `.gift-card-section__title`), and the structural one — the clone
still promotes "HOW GIFT CARD WORKS?" to a giant heading where the reference sets it small inside the
right-hand video panel.

## Gate note on this round's discipline
Every claim here is a re-run, not a recollection: typecheck 0 · lint 0 · build 0 · 47 unit 0 ·
12 e2e 0, then a full `VIEWPORTS=inapp` capture and `compare:reference` to move the mean. The
`/pricing` layer-2 agent was left alone (it had produced nothing yet) rather than having its files
edited underneath it.

---

# Round 2026-10-01 (later) — auth word-mark corrected; diff noise quantified

## Four of six captured word-marks were sitting unused
`displayHeadings.json` had `signin-wordmark` / `signup-wordmark` / `about-title` / `product-intro`
extracted but never wired. `AuthPanel.vue` was rendering **`follow-art`** — the home hero glyph set,
1338px wide — where the reference has an auth-specific mark at [19,64,650,229]. Switched to the
per-mode key. Now measures **[19,48,650,229]** with the correct viewBox and 10 paths: width and
height exact, y off by 16px.

**Pixel effect is within noise, and that is worth stating rather than dressing up.** V21 9.93 -> 9.83,
V22 12.43 -> 12.76. The change is geometrically much more correct but the frames barely moved, so it
is kept on measurement grounds, not on a claimed fidelity win.

## Diff noise is now quantified, not hand-waved
Untouched checkpoints moved more than the change I was evaluating:

| checkpoint | prior | now | touched this round? |
|---|---|---|---|
| V06 | 55.7 | 57.5 | **no** |
| V09 | 30.9 | 23.8 | **no** |
| V13 | 54.2 | 61.3 | **no** |

Up to **7.1pp** of run-to-run swing on frames I did not modify, from time-driven animation landing at a
different phase each capture. Consequence for the rest of this project: **a single `compare:reference`
run cannot attribute a small delta to a small change.** Only checkpoints that move well past ~7pp, or
that are static-region masked, are evidence. The session mean 28.14 -> 28.45 is this noise, not a
regression. This is the strongest argument yet for the pinned-clock work in `NEXT_ACTIONS` B4.

## Housekeeping
`tmp-probe.mjs` (the `/pricing` agent's scratch) was failing `lint` with `no-undef`/unused-var. The
agent was still live, so the file was **moved out of the project** to the OS temp dir rather than
deleted — reversible. Lint is green again. The `/pricing` layer-2 agent had produced no edits after
~7 minutes (`PricingPage.vue` still has zero `gift-card-section`, scrollHeight still 2925).

## Gates
typecheck 0 · lint 0 · build 0 · 12 e2e 0.

---

# Round 2026-10-01 (later) — /pricing layer 2 lands; V18 drops 45.5pp

**The biggest single-frame win of the session.** Clone `/pricing` scrollHeight **2925 -> 4391**
(reference 4282; a 109px overshoot now, not a 1357px hole). **V18 51.06 % -> 5.53 %**, V17 holds at
3.95 %, session mean **26.54 %**.

V18's 45.5pp move is **six times the 7.1pp noise band** measured last round, so unlike the auth
word-mark this is genuine evidence rather than noise.

**Correction to my own previous turn:** I reported the `/pricing` agent as having "produced nothing"
and took the work over. That was wrong — it had written `PricingGiftCardSection.vue` and wired it
into `PricingPage.vue` (import at line 24, mount at 279). My grep for the lowercase CSS class
`gift-card-section` missed it because the component is referenced by its PascalCase name. So I
overwrote a working component with my own equivalent one. The outcome is fine, but **the check was
sloppy: grepping for one casing and concluding "nobody did the work" is exactly the kind of
false-negative that wastes a parallel worker.** Verify absence by more than one signal.

Component is built to the measured chain: orange layer [0,2214,1376,1883] distinct from pink layer 1,
659px flex content column, the 8-path `gift-card-title` word-mark reaching 631px via the grid +
`pr-1` + inner half-spacing, all five image classes at their measured boxes, and the press-logo strip.
Strings are imported from `GIFT_CARD` (shared with `/gift-card`) so no prose is duplicated. The white
panel's unmeasured form internals and the press strip's heading stay
`data-evidence="pending-T00-subpage"` rather than being invented.

Overshoot to close: 109px too tall, and `/gift-card`'s column surplus (914 vs 676) is the same class of
defect — both now need the reference's **child** heights, not more container guessing.

## Gates
typecheck 0 · lint 0 (after `--fix` on two formatting warnings) · build 0 · 47 unit 0 · 12 e2e 0.
`tmp-probe.mjs` from the dead agent moved out of the project again.

## /about word-mark wired: V15 27.9 % -> 13.78 %
`displayHeadings.json` key `about-title` (viewBox 0 0 503 670, 8 paths) was extracted but never
referenced. `AboutPage.vue` was rendering `Our Story` as real text at the `text-h1` scale. Passed the
glyph set through `PageTitle`'s existing slot instead of replacing the component, keeping the text
path as the fallback when the mark is absent.

Renders at [854,76,503,670] against the measured [849,76,508,676] — within 6px on every axis.
V15 **27.9 % -> 13.78 %** (14.1pp, ~2x the 7.1pp noise band, so attributable), session mean
**26.54 % -> 25.74 %**.

Remaining banked-but-unwired: `product-intro` (viewBox 0 0 1421 505, 7 paths, target [19,20,1338,296])
for `/our-product` — same one-slot change, targets V16 at 37.9 %.

Gates: typecheck · lint · build · 47 unit · 12 e2e all exit 0.

## Concurrent-write collision on PricingGiftCardSection.vue — resolved, verified
The `/pricing` agent finished after I had already overwritten its component with my own draft. It
re-asserted its version; **its tree is what is on disk now**, and re-verifying from scratch shows that
was the right outcome. Its version is better than mine in three specific ways:
1. It found the real cause of the V18 improvement, which I had got wrong. I assumed V18 improved
   because layer 2 became visible at scroll 600. It doesn't start until 2153. The actual cause was
   removing `section--under-next` from layer 1, which had given layer 1 100svh of sticky travel and
   **pinned** it — reference puts the Pro Card frame at document y=662 unpinned, the clone had it at
   1262. My draft would have kept the pin.
2. It refused to invent a CTA. Mine rendered `<p class="btn btn--primary">Buy Gift Card</p>` into the
   314px of unmeasured space under the word-mark, and pasted visible "not invented here" prose into
   the page. Both are exactly the fabrication the project forbids; the agent left those regions
   empty and marked `data-evidence="pending-T00-subpage"`.
3. It found and fixed a real bug I did not see: `text-box-trim` on multi-line paragraphs shrinks each
   box cap→baseline, making the pitch and body overlap by about a line. It is a single-line optical
   trim in this system, so it now sits only on the measured `.gift-card-section__title`.
It kept my one good contribution — `padding-right: calc(var(--spacing)/2)` on `.title`, which closes
the 640→631 residual (640.229 − 9.552 = 630.68 ✓).

**My earlier grep failure caused this collision twice**: I concluded the agent had produced nothing
because I searched for the lowercase CSS class while the file is referenced by PascalCase component
name. Two rounds of wasted parallel work. Lesson recorded.

## Verified final state (re-run, not reported)
My `/about` and `/our-product` word-mark edits survived the overwrite (4 references each, intact).

| checkpoint | session start | now |
|---|---|---|
| V15 /about | 27.9 % | **13.78 %** |
| V16 /our-product | 37.9 % | **14.51 %** |
| V17 /pricing | 66.6 % | **3.95 %** |
| V18 /pricing scrolled | 46.2 % | **5.37 %** |
| V23 /gift-card | 89.0 % | 52.74 % |
| **mean (26)** | 35.33 % | **24.96 %** |

`/pricing` scrollHeight 2925 → 4808 vs reference 4282. The agent's overshoot arithmetic is sound and I
confirmed the claim: 4282 − 2214 − 1883 = 185px of footer region on the reference, while the clone's
`SiteFooter shell` is a full 772px sticky layer. So the remaining 526px is a **footer-height model
difference**, not a pricing-content gap.

Gates on the merged tree: typecheck · lint · build · 47 unit · 12 e2e all exit 0, zero scratch files.

## The layer-2 left column's missing 314px was a real element, now recovered
Measured the reference's `.gift-card-section__content` children directly (saved to
`evidence/reference/pricing-layer2-left.json` via `filePath`, so the 8KB tree never entered context).
It has **three** children, not two:

```
.gift-card-section__title      [19,2290,640,362]
.gift-card-section__bg-image   [133,2428,401,339]  position:absolute
.gift-card-section__cta        [19,2890,198,76]    <- was never rendered by the clone
```

362 + 238 + 76 = 676, exactly the column height. The 76px is `btn--large`
(`--btn-height: calc(var(--scale-px)*80)` = 76.44px) — the same token measured for the fixed Join
button rounds ago. So the builder agent's "a .btn--large CTA would fit there, but its geometry was
never captured" hypothesis is now **confirmed with numbers**, and its choice to leave the space empty
rather than invent one was right; it simply could not know.

Added it as a `<span>` (the reference's element is a span; its click destination was never captured,
so no href is invented). First render was [19,2591,**659**,76] — full column width. Fixed with two
transcribed values, neither tuned: `align-self:flex-start` (content width) and `margin-top:238px`
(the measured title-bottom→CTA-top gap). Now **[19,2829,151,76]**: x and height exact, y off by the
known pre-existing 61px layer-1 shift, width 151 vs 198 (the reference's extra ~47px is almost
certainly an icon sibling under `btn--space-between`, which was not captured).

**Verdict on pixels: flat.** V18 5.37 -> 5.53 %, mean 24.96 -> 25.06 % — both far inside the ±7.1pp
noise band, so this is **not** a fidelity win and is not claimed as one. It is kept because a measured
DOM element was absent and is now present at its measured geometry; the diff says the rest of the
frame is dominated by other things.

**Unresolved contradiction, recorded rather than papered over:** the reference column measures
`align-self:auto` inside a row with `align-items:stretch`, yet is 676px tall while the row is 1807px.
Stretch should have made it 1807. Something (a `min-height`, an `align-self` from the grid layer, or a
`height` on the col) overrides it and was not identified. Until that is known, do not "fix" the
clone's 1807px column by removing the stretch — tested live, that collapses it to 362px, which is
*worse* against a 676px target.

Gates: typecheck · lint · build · 47 unit · 12 e2e all exit 0.

## Round 33 (2026-10-01): /pricing Cause A and Cause B closed by measurement, Cause C characterised

Panel was NOT visible this round (`take_screenshot` →
`NATIVE_BROWSER_VIEWPORT_UNAVAILABLE (visible=true, attached=true, cdpAttached=true,
visibilityState=hidden)` on the first try), so every number below came from the hidden same-origin
iframe probe on the user's already-open tab, plus local Playwright captures.

### Cause A — the 61.15px, found exactly
`.subscription-and-pricing` = header 471.052 + mt 114.659 + `.plans-difference` + mb 152.879.
Reference `.plans-difference` 1379.65 vs clone 1318.5 → Δ **61.15**, the entire symptom. Inside it, one
number: `.plans-difference__sub-list > li` is **50px** in the reference, **43.9375px** in the clone, because
the reference declares

```css
.plans-difference--md .plans-difference__list-item { height: 50px; padding: calc(var(--spacing)*.75) 0 }
```

and the clone had the padding on the base rule and **no height at all** — rows were content-driven.
Padding was never the answer (already proven identical both sides), which is why the earlier "diff the
child boxes" instruction was the right one.

Three further real defects fell out of the same row-by-row diff, each measured before being touched:

1. **The two columns are not one table.** The Starter frame renames two rows (Basic portfolio,
   Basic links), **reorders** Sharing (Add to Wallet before QR sharing), gives **each row its own**
   `ul.plans-difference__sub-list` (11 sub-lists vs Pro's 5), and gives disabled rows **no tooltip
   wrapper at all**. The clone filtered `inStarter` rows out, so Starter Presentation was 81.98px
   where the reference is 188.04px, and its list came to 1018.47 against Pro's 788.17 — the two
   columns did not share a row grid, so `row--stretch` had nothing to align. This closes the
   per-plan benefit state (old PENDING-06) as *implemented*, not merely observed.
2. **Disabled rows carry a different sprite and a wrapper.** Reference:
   `div..._not-subscribed-wrapper` (20 units, relative) around
   `svg.icon-promo-more-close..._not-subscribed` (24 units, absolute). The clone always emitted
   `promo-stage-current` at 16 units, and the tick should be **20** units (19.104px, measured) not 16
   (15.281px).
3. **`.plans-difference__footer` needs a wrap.** Reference `--md .plans-difference__cta-btn` sets
   `min-width: var(--md, 13.698630137vw)` = 188px; without it the CTA is content-sized (89px),
   prices + button fit one flex line, and the footer is 76.44 instead of 95.23. The promo line was
   likewise wrong: the reference is an inline-grid `text-swap` (four words in one cell, class-swapped
   with `transition: transform, clip-path 1.5s cubic-bezier(.55,0,.1,1)`, **no @keyframes**), one line
   of 38.79px; the clone had invented `__promo-rotator` with a 6s opacity keyframe, painting all four
   phrases inline at 63.11px. `src/components/TextSwap.vue` replaces it.

### Cause B — same net height, wrong owner
The clone put the 76.4396px clearance as `margin-top` on `.gift-card-section`; the reference puts it
as `padding-top` (`pt-promo-header`) on the sticky inner. Moved it, and added the `sticky--sticky`
the reference inner carries (L0's inner measured `position: sticky`, the clone's was `relative`).

### Cause C — a footer *variant*, not a height
Measured (`raw/pricing-footer-el.json`): the reference /pricing footer is a compact
`<footer class="promo-footer px-1 py-1 footer-padding ui-background ui-orange">`, 185.21px,
`position: static`, children `hr.mb-1` 0.67 and `div.row.row--gx.row--stretch` 69.9.
2213.77 + 1883.17 + 185.21 = 4282 ✓ exactly the reference scrollHeight. The clone has **no `<footer>`
element**: `SiteFooter` is a third `.section__layer` of 772px → 4869. So the residual is a *variant*
choice shared by all 12 routes, not a /pricing bug. Deliberately not attempted this round: changing
SiteFooter wholesale would move every route and every home checkpoint at once. Filed as DIFF-015.

### Verified geometry after the fixes (clone re-measured with the same bodies)
| field | reference | before | after |
|---|---|---|---|
| `.subscription-and-pricing` h | 2118.23 | 2057.08 | **2118.22** |
| `.plans-difference` h | 1379.65 | 1318.5 | **1379.66** |
| sub-list `li` h | 50 | 43.94 | **50** |
| `.plans-difference__list` per frame | 854.833 | 788.17 / 1018.47 | **854.86 / 854.86** |
| CTA wrapper w | 188 | 89 | **188** |
| `.plans-difference__footer` h | 95.23 | 76.44 | **95.22** |
| promo `p` h | 38.79 | 63.11 | **38.78** |
| L0 layer h / inner pos | 2213.77 / sticky | 2152.62 / relative | **2213.77 / sticky** |
| L1 inner padding-top | 76.4396 | 0 | **76.4396** |

### Pixels did not move, and the reason is a gate dimension, not a bad fix
`compare:reference` mean **25.09 %** over 26 checkpoints — identical to the round-32 baseline; V17
3.95 % and V18 5.28 % unchanged to two decimals. The /pricing checkpoints frame scroll 0 and 600
only, while the comparison table lives at document y 747–2064 — **no existing frame contains the
work**. A 61px geometry fix cannot show up in a region nothing screenshots. Filed as DIFF-016:
add /pricing checkpoints at ~1150 / ~1544 / ~1927 and re-baseline before claiming pixel progress here.

### Also new: reusable probe infrastructure
`scripts/run-page-body.mjs <loopback-url> <body-file> <out.json>` + `scripts/bodies/*.body.mjs`, and
`scripts/measure-box-tree.mjs`. The point is that reference and clone run **the same body text**, so
a diff cannot come from two different measurements. `eslint.config.mjs` now ignores `scripts/bodies/**`
and `.scratch/**`: those files are page-side expressions handed to `evaluate_script`, not Node modules
(`no-unused-expressions` and browser globals are properties of the transport).

### Two measurement traps hit and fixed in place
- **Frozen entrance animation.** The first dump reported the giant `.title` box as 0px tall at y −141
  — a hidden document never advances CSS transitions, so the rect was the *pre-animation* keyframe.
  Every body now calls `getAnimations().forEach(a => a.finish())` first.
- **Backslash transport corruption.** A body was pasted into the probe inside a template literal,
  where `/[\s]+/g` lost its backslash and became `/s+/g`, rewriting every captured text field
  ("Presentation" → "Pre entation"). A second body lost `\b` into a literal backspace and produced
  `SyntaxError: Invalid regular expression`. Probe bodies are now **backslash-free**; whitespace
  collapsing happens in Node. Evidence files that predate this rule were re-captured, not reused.

### Gates (all re-run this session, exit codes captured without a pipe)
```
typecheck 0 · lint 0 · build 0 · vitest 47 · playwright 12
verify:assets 0 · verify:evidence 0 · check-hero-cards 0 · score:clone 0
compare:reference 0  (26 compared, mean 25.09%)
verify:release 1 — 9 passed / 5 failed (unchanged: 24x3 reference breadth, D01-D10, total,
                          open P0/P1 GAP-004+DIFF-010+DIFF-015+DIFF-016, blocked GAP-005)
```
Reference freeze on disk: 29 PNG frames in `evidence/reference/captured/` (pre-existing count, not
touched this round; the "28" in earlier notes is the capture-report record count).
Probe iframe torn down; the user's tab is back at `/` and was never navigated.

---

# Round 34 (2026-10-01): the footer component, and two renderers that had never worked

Panel invisible all round (`take_screenshot` → `NATIVE_BROWSER_VIEWPORT_UNAVAILABLE
(visible=true, attached=true, cdpAttached=true, visibilityState=hidden)`, retried on a clock for ~40
minutes). All reference numbers below come from the hidden same-origin iframe; all clone numbers come
from Playwright on loopback. No reference pixel was captured, so **the pixel mean moved 25.09 → 24.67 %
and that is within the ±7.1 pp noise band — the honest claim for this round is structural, not visual.**

## Three defects closed, two of which no gate could see

| id | what | evidence |
|---|---|---|
| DIFF-015 | `/pricing` + `/gift-card` render `footer.promo-footer` (static, 185.21) instead of a third 772px sticky layer | clone `[0,4097.03,1376,185.48]` vs ref `[0,4097.94,1376,185.21]`; scrollHeight **4283 exact**; 73/73 nodes, 120/120 attrs |
| DIFF-017 | `SiteFooter`'s functional components read the slot off the wrong argument → **zero `<footer>` on 11 routes** | home scrollHeight 7527 → **7563**, `home.join` 772 → **808**, both exactly the reference |
| DIFF-019 | TextSwap dwell was 1.5s (the transition duration reused as the period) — it is **30s** | 13 consecutive `--active` changes at 29.9–30.1s via MutationObserver |

The DIFF-015/DIFF-017 pair is the whole of round 31's "Cause C": the +586px on `/pricing` was never a
height knob, it was the wrong footer component *plus* a component that rendered nothing.

**DIFF-017 is the round's real lesson.** A functional component in Vue 3 gets `(props, context)` and the
slot lives on `context.slots`. `Bare`/`Shell` read `slots.default` off the second argument, got
`undefined`, and returned nothing — while the sticky shell around them kept its `min-height`, so every
geometry gate stayed green for 33 rounds. Round 28's "home.join is 772, the reference is 808, which is
the whole of scrollHeight 7527 vs 7563" was this bug all along. Home was also including the footer
twice (`HomePage.vue` and `HomeJoinUs.vue`), which became visible only once the slot worked; the
duplicate is removed.

## follow.art has two footer components, and the clone had one

| route | `<footer>` | h |
|---|---|---|
| `/`, `/our-product` | `section-10__footer text-smaller row row--gx row--stretch` | 413.76 |
| `/pricing`, `/gift-card` | `promo-footer px-1 py-1 footer-padding ui-background ui-orange` | 185.21 |
| `/faq` `ui-green`, `/terms` `ui-pink`, `/about` `ui-green` | promo-footer | 185.21 / 185.21 / 535.03 * |
| `/signin` | **no `<footer>` at all** | — |

\* `/about`'s figure is **UNTRUSTED** — see the method note below.

`promo-footer`'s 185.21 decomposes exactly: `19.1099 (py-1) + 0.67 (hr) + 19.1099 (hr.mb-1) + 69.8958
(row) + 76.4396`. That last term is `--spacing + --cookie-message-height`, where
`--cookie-message-height = calc(var(--scale-px) * 60) = 57.3297` appears only while
`body.cookie-message-active` is set. **The footer's height is coupled to the cookie bar**; nothing may
be hardcoded to compensate.

## 30 reference stylesheets the clone had never seen

Enumerated all 42 stylesheets a 7-route sweep loads (`_css-manifest-urls.json`), fetched the 30 missing
ones, 0 failures — Cloudflare blocks HTML but serves static assets. Audit:
`evidence/reference/css-coverage-round34.md` (15 COVERED / 16 PARTIAL / 11 ABSENT, 115
declaration-level conflicts). Three things it settled immediately:

- `GiftCardSection.CNO1zmYt.css` defines `.gift-card-section__content{height:calc(100svh -
  var(--spacing-promo-header) - var(--spacing));position:sticky;top:var(--spacing-promo-header)}` =
  **676.4505**. Round 31's explicitly-pinned `676.448px` was a viewport-relative formula, and
  `GiftCardPage.vue`'s comment saying the rule "is not defined in any chunk" is now false.
- `.gift-card-section__video-preview-text{position:absolute;left:20px;top:18px}` — the
  "HOW GIFT CARD WORKS?" structure question, answered by one declaration.
- The get-seen WebGL host is `inset:0` in the clone and
  `width/height:134.78%;top:-13.2%;left:-17.4%` in the reference, which predicts the independently
  measured canvas box `[584,686]` to 0.33 px. So V04/V05/V06 (36.7 / 49.3 / 55.9 %) are plausibly
  plain CSS. Logged as DIFF-021, not acted on this round.

## Method: hidden documents, part two

Round 33's rule (finish animations, no backslashes in probe bodies) held and is now a gate —
`scripts/check-probe-bodies.mjs`, 9/9 bodies pass. Two new limits found:

- **SPA navigation inside the probe iframe collapses transform/sticky geometry.** After
  `router.push('/pricing')` the footer reads `top=1883.17, scrollHeight=2068`; a freshly loaded
  `/pricing` iframe reads `top=4097.94, scrollHeight=4283`. The 2214.77 delta is exactly layer 1's
  height. So route sweeps are good for element identity, never for heights — use `iframe.src = route`.
- **`/about` is not measurable this way at all.** Fresh load, `scrollTop=0`, `scrollLeft=0`,
  `clientWidth=1376`, `overflowX=hidden`, and the footer still reports `x=-119.18` with a `<hr>`
  346.89px tall: its section chain is transform-driven and frozen mid-travel. Recorded, not used.
- **Class state machines are observable without pixels.** MutationObserver + `Date.now()` on the live
  `.text-swap` produced a period from a document that never paints. That closes part of PENDING-02's
  backlog that was filed as "needs continuous frames".
- Probe bodies now travel through `scripts/emit-reference-probe.mjs`, which embeds the body file
  **verbatim from disk** and stamps `__bodyChars` on both sides. I still got caught by it once: the
  `/about` tree was captured from memory with two comment lines stripped (`__bodyChars` 3001 vs 3164),
  so that artifact is labelled as a non-same-text pair. Git Bash also rewrote the `/pricing` route
  argument into `C:/…/bin/git/pricing` — the emitter now refuses a route without its leading `/`.

## Gates, re-run after every change

```
typecheck 0 · lint 0 · build 0 · vitest 47 passed · playwright 12 passed
verify:assets 0 (107/107) · verify:evidence 0 · check-hero-cards 0 · score:clone 0
capture-local @inapp: 30/30 frames, 0 page errors
compare-reference: 26 compared, mean 24.67 % (V17 3.94 / V18 5.34 / V14 6.94 first record)
verify:release: 7 passed / 7 failed — the new red is "local capture covers every checkpoint: local 26"
```

`test:e2e` had to be re-established first: no Playwright browser binaries were installed, so
`chromium-headless-shell` was fetched into `%LOCALAPPDATA%\ms-playwright` (outside the repo).

## Still open after this round

DIFF-016 (4 checkpoints have no reference frames), DIFF-018 (home footer h=69.83 vs 413.76 — now that
it renders, its internals are measurable and clearly short), DIFF-020 (`/gift-card` 6312 vs 2068,
confounded by the iframe artifact above), DIFF-021 (get-seen CSS sizing + scrollbar/`--header-height`
tokens absent), GAP-004, DIFF-008, DIFF-010, DIFF-014, GAP-005, T07, T11, `scorecard.total`.

Boundaries held: no deployment, no write request to follow.art (GET navigation, `scrollTop`, SPA
`router.push` and a MutationObserver inside the user's own tab, all torn down; tab left at `/`), no
credentials, no tracking keys copied, no git operations.
