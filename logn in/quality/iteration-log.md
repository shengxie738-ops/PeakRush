# Iteration log

Rules followed: evidence before conclusion; at most three defects per round; each round
changes only the variables needed; keep the best version; after three rounds with no
measurable improvement on the same defect, change method instead of tuning further.

---

## Round 1 — 2026-09-29 (T00 forensics → first runnable build → first defect set)

### What was measured before any code was written
- Stack identified from the live page: Nuxt 3, three.js r176 (`window.__THREE__`),
  Lenis 1.3.3 (`window.lenisVersion`), scroll owned by `DIV.scrollable__area.lenis`
  with `html,body{overflow:clip}`.
- Negative result that changed the architecture: **no GSAP and no ScrollTrigger** in any
  of the 34 captured JS chunks. The plan listed them as a rebuild choice; they are now
  excluded by measurement and the choreography is a hand-rolled single-clock runtime.
- Real GLSL extracted from the live GL context (`getAttachedShaders` + `getShaderSource`):
  the hero card bend is a **spine-texture path bend** (18,074-char vertex shader), not the
  plain cylinder the plan proposed in §9.2. The `landing-5-nexus` panel IS the simple
  cylinder and its 538-char shader was captured verbatim.
- Full scene graph enumerated via an `Object3D.prototype.updateMatrixWorld` probe:
  4 scenes / 4 cameras with exact fov, near, far, position, rotation; 9 hero cards as
  `PlaneGeometry(9,12.6,10,1)` with identity transforms; per-mesh `radius/offset/progress`.
- Typography truth: the visible giant words are **inline SVG**, the real `<h1>` is
  `sr-only` at 1×1px; one `h2` carries `matrix(1,0,0,0.6,0,0)`.
- 156 reference assets fetched with real URL, bytes, content-type and sha256.

### Changes made
1. Scaffolded Vue 3 + Vite + TS + Router + Pinia + three 0.176 + Lenis 1.3.3;
   12-route manifest; the plan's command contract implemented as real scripts.
2. Design-token layer lifted verbatim from the 12 reference CSS chunks, including the
   fluid unit `--scale-px: clamp(.5px,.06944vw,1px)` and the `--x/--n-x` breakpoint pairs.
3. WebGL module ported from the captured shaders and measured transforms.
4. Single-clock motion runtime (`src/motion/`) with `FrameInput`, per-section progress
   intervals, frame-rate-independent pointer damping, and `setTestInput`.
5. Evidence gates: `verify:assets`, `verify:evidence`, `compare:reference`,
   `verify:release` — each one fails on missing evidence rather than defaulting to pass.

### Three defects selected (and only these)
| id | defect | single-cause hypothesis | test that will show improvement |
|---|---|---|---|
| DIFF-001 | root background white, reference is `rgb(244,121,58)` | route meta theme not reaching the root element's inline style, or a later `@layer` repaint | computed style of `.scrollable--root` in the local capture |
| DIFF-002 | hero word renders as oversized text over the header | `displayHeadings.json` is an empty placeholder so components take the text branch | `h1` rect must be 1×1 and an SVG word must exist with the measured heading metrics |
| DIFF-004 | `live=0`: no WebGL scene attaches | `App.vue` registers scenes once in `onMounted`, before the section canvases exist | capture report `live` count equals 3 built scenes |

### Verification actually run this round
- `npm run typecheck` → exit 0.
- `npm run build` → passes (2.85 s).
- `npx vitest run tests/unit/motion-runtime.spec.ts` → **5 passed**, exit 0.
  Covers plan T04's four acceptance items: one FrameInput per tick, progress clamped to
  the declared interval and monotonic, forward/backward reversibility, and identical
  damped pointer settle at 30/60/120 Hz (agreement < 1e-6).
- `node scripts/validate-assets.mjs` → **PASS** (105/105 traced to a real request).
- `node scripts/validate-evidence.mjs` → **FAIL, 1 real blocker**: the only "reference
  screenshot" was a <40 KB Cloudflare challenge page. Quarantined to
  `evidence/reference/_rejected/` so it can never be mistaken for a baseline.
- `npx eslint .` → after wiring the TS parser it found 7 real problems, two of them in
  my own runtime: `layoutVersion` and `ownedListeners` were maintained but never exposed.
  Fixed by adding `diagnostics()` rather than deleting the counters.

### Method changes forced by measurement (not by preference)
- Dropped GSAP/ScrollTrigger from the stack (absent from the reference).
- Replaced the §9.2 cylinder assumption for the hero with the captured spine shader.
- Replaced pixel-diff verification with a rect/computed-style oracle while the reference
  screenshot path is blocked; the pixel gate stays UNVERIFIED rather than being quietly
  redefined as "tests pass".

### Not improved this round
- No reference screenshot baseline (PENDING-01) → §15.2 pixel and colour gates unrunnable.
- No D01–D10 trajectories (PENDING-02) → motion category score stays `null`.
- `landing-7-connectory` and `landing-9-testimonials` scenes still unobserved (PENDING-03).
