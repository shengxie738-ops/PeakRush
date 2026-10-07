# WebGL → app integration requests

Changes that are **required in files the WebGL layer does not own**
(`src/app/App.vue`, `src/features/home/**`, `src/styles/**`). Everything below is
already compensated for inside `src/webgl/**`, so the page works today; adopting them
removes the compensation and gives the app a single, explicit wiring point.

Measured symptom that started this: `canvases=6 live=0` on `/` at 1440×900.

---

## 1. `src/app/App.vue` — register scenes through the mount layer (root cause of `live=0`)

**Root cause (measured, not inferred).** `App.vue` registers scenes exactly once, in
`onMounted`, after `await import('@/motion/createMotionRuntime')`. Every route in
`src/app/router.ts` is a lazy `() => import('@/pages/HomePage.vue')`, so at that moment
the section components have not been created yet. Probe evidence (dev build, 1440×900):

```
iterate WEBGL_SECTIONS @135ms  hasHeroSection=false   ← App's loop runs here
canvasCountFor:home.hero  ← only ever called from HomeHero's setup, later
canvasCountFor:home.testimonials
canvasCountFor:home.connectory
createWebGLScene:  (never called)
```

`mountFor()` therefore returned `null` for all three built sections (`!section`), the
loop `continue`d, and nothing threw — hence `live=0` with zero console errors.

**Requested change** (one call site; the WebGL layer already exports everything needed):

```diff
- import { WEBGL_SECTIONS, canvasCountFor, createWebGLScene } from '@/webgl/sceneRegistry';
+ import { mountWebGLScenes } from '@/webgl/mountScenes';
```

and inside `onMounted`, replacing `await registerScenes(runtime)` (plus the local
`mountFor` / `rangeFor` / `MOUNT_BY_SCENE` helpers, which `mountScenes.ts` now owns):

```diff
- await registerScenes(runtime);
+ await mountWebGLScenes(runtime, {
+   container: scrollArea.value,
+   onLive: (sectionId, host) => host.setAttribute('data-webgl', 'live'),
+ });
```

`mountWebGLScenes(runtime)` registers each discovered scene with the single-clock
runtime (`runtime.register(scene, range)`), re-registers anything the observer mounts
later, and **stops the fallback render loop** as soon as the runtime owns a scene, so
there is never a second clock. It is idempotent and safe to call on every route change.

**What the WebGL layer does today instead** (`src/webgl/mountScenes.ts`, armed from
`sceneRegistry` module scope): a `MutationObserver` + a 64 ms retry bounded to 10 s
discovers `[data-section-id] → MOUNT_SPEC_BY_SCENE → canvas` whenever the section
appears, and a presentation-only rAF loop renders the scenes. That loop never creates a
Lenis and never writes scroll — it reads `container.scrollTop`, which the app's single
Lenis instance owns — so the "one clock" rule still holds.

## 2. `src/app/App.vue` `<style>` — the hero canvas wrapper collapses to 0px height

Current rule:

```css
.landing-1-intro-webgl__canvas-wrapper,
.landing-5-nexus-webgl__content { inset: 0; position: relative; }
```

`position: relative` + only absolutely-positioned canvas children ⇒ the wrapper measures
**1440×0**, so the hero rendered into a full-size buffer displayed at zero height (this
was the second half of "the hero shows no card imagery"). The reference CSS
(`evidence/reference/raw/_nuxt/Landing1IntroWebGl.DZK6hbZ4.css`) is:

```css
.landing-1-intro-webgl canvas, .landing-1-intro-webgl__canvas-wrapper {
  top: 0; right: 0; bottom: 0; left: 0; position: absolute; }
.landing-1-intro-webgl canvas:first-child { z-index: -1; }
```

Requested change — restore the measured placement for the hero only:

```diff
- .landing-1-intro-webgl__canvas-wrapper,
- .landing-5-nexus-webgl__content {
-   inset: 0;
-   position: relative;
- }
+ .landing-1-intro-webgl__canvas-wrapper { inset: 0; position: absolute; }
+ .landing-1-intro-webgl canvas:first-child { z-index: -1; }
+ .landing-5-nexus-webgl__content { inset: 0; position: relative; }
```

Interim compensation: `mountScenes.ts#ensureHostBox()` sets those two inline styles on
the mount element (and `z-index:-1` on the first canvas) when the measured box is
degenerate. The `z-index:-1` matters: the reference's **first** canvas is the far,
untextured depth layer (near 69 / far 200) and must sit behind the section content,
while the second canvas carries the near, textured cards (near 0.1 / far 69).

## 3. `src/features/home/Home*.vue` — let the components own their `data-webgl`

Each section binds `:data-webgl="live ? 'live' : 'pending'"` and exposes `markLive()`,
but nothing calls `markLive()`, so `live` stays `false` forever: the static poster
(`<span class="webgl-fallback">`) keeps covering the canvas. Two options:

* keep the components as they are and pass a hook (preferred, one line, see §1):
  `onLive: (id, host) => host.setAttribute('data-webgl', 'live')` — and drop the
  `:data-webgl` binding so Vue never writes `pending` back over it; **or**
* have the section call `markLive()` itself by passing it in:
  `onLive: (id) => sectionRefs[id]?.markLive()`.

Until one of those lands, `mountScenes.ts#signalLive()` sets `data-webgl="live"` on the
host and hides `.webgl-fallback` inside it. Note that `HomeCard.vue` binds `data-webgl`
on `.landing-5-nexus-webgl` (the *parent* of the mount) while the mount layer writes it
on `.landing-5-nexus-webgl__content`, which is why a capture reports one `pending` and
three `live` attributes on that section.

## 4. Layout observation (not WebGL, affects scene progress) — RESOLVED while writing

`.scrollable__area` reported `scrollHeight ≈ 59490px` at 1440×900 versus the measured
reference `7563px` at 1376×772 (`docs/DOM_CONTRACT.md` line 20). Scene progress is
derived from each section's offset inside that container, so an 8× inflated height
pins every scene near progress 0 for thousands of pixels of scroll. Re-measured after
the layout agent's latest pass: **8407px**, i.e. back in range — no action needed, but
this number is what the scene progress windows depend on, so it should stay near the
measured ratio.

## 5. Missing static assets (broken `<img>` glyphs)

`asset()` returns `undefined` for these, and the templates fall back to `?? ''`, which
renders a broken-image glyph (`src` resolves to the page URL). None are inside a
`[data-webgl]` host, so they are outside the WebGL layer:

`/images/landing/2.get-seen/*play icon`, `section-2__media-decoration`,
`section-3__card` ×24, `section-4__cards-wrapper-decoration`, `section-5__title-decoration`,
`section-5__btn-icon` ×2, `section-7__title-decoration`, `section-7__btn-icon` ×2,
`section-9__title-decoration`, `section-10__title-decoration`, `image-trail__photo` ×20,
`intro__title-decoration`.

---

## WebGL-side facts worth knowing before touching these files

* `home.testimonials` and `home.connectory` stay **unregistered on purpose**: their
  scenes were never captured (`webgl-scenes.json` marks both "未取到场景"), so the DOM
  placeholders remain and `WEBGL_SECTIONS` keeps them with `built: false` + a `reason`.
* The hero's two canvases are **not** two copies of the same picture. Decoding
  `m22`/`m23` of the captured `projectionMatrix` values in
  `evidence/reference/shaders/hero-summary.json` gives: the `USE_MAP` program is
  near 0.1 / far 69 (the near, textured cards) and the untextured program is
  near 69 / far 200 (solid `#B05A2E` silhouettes behind them). The previous port had
  that inverted, which is why the hero could never show card artwork.
* Colour: the hero maps are acquired as `srgb` because the captured hero fragment shader
  ends with `linearToOutputTexel()` (hardware decode + shader encode = identity
  round trip). The nexus and get-seen shaders write `texture2D()` straight to
  `gl_FragColor` with no encode, so their maps are acquired as `none`; tagging those
  sRGB would darken the artwork.
