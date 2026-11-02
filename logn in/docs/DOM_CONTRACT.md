# DOM / Section Contract (frozen from T00 measurements)

Reference: `evidence/reference-lock.json`, `evidence/reference/webgl-scenes.json`,
`evidence/reference/page-sections.json`. Viewport the numbers were taken at: **1376×772 @ dpr 1.5**.
Fluid unit: `--scale-px: clamp(.5px, .06944vw, 1px)` → 1px at a 1440px-wide viewport.

## Home page: 8 `<section>` elements, measured top-to-bottom

| # | sectionId | reference class | height px | canvases | WebGL scene |
|---|---|---|---|---|---|
| 0 | `home.hero` | *(none — inherits orange)* | 1544 | 2 | `landing-1-intro-webgl` |
| 1 | `home.get-seen` | `ui-green js-get-seen-section` | 1544 | 1 | `landing-2-get-seen-webgl` |
| 2 | `home.card` | `ui-pink` | 2123 | 1 | `landing-5-nexus-webgl` |
| 3 | `home.centralize` | `ui-green` | 1544 | 0 | — |
| 4 | `home.audience` | `ui-pink` | 1544 | 0 | — |
| 5 | `home.testimonials` | `ui-blue` | 1544 | 1 | `landing-9-testimonials-webgl` |
| 6 | `home.connectory` | `ui-green` | 2316 | 1 | `landing-7-connectory-webgl` |
| 7 | `home.join` | `ui-orange wrapper-section-10` | 808 | 0 | — |

Total scroll height measured: 7563px inside `DIV.scrollable__area.lenis` (`html,body{overflow:clip}`).

## Measured H1/H2 text (verbatim, uppercase is authored in the markup)

- 0: `FOLLOW.ART` / `ONE PRACTICE. ONE CARD`; footer line `One Card.` `Share it. Be noticed. Be supported`
- 1: `How FOLLOW. ART works?` + `CURATORS ANDARTISTS` + `Share your practice. / Build new relationships. / Get financial support.` + `All in one place people can access instantly`
- 2: `CARD` + `Your practice, all in one place` + `A digital Card that brings everything together. Easy for you to share. Easy for others to discover, save, and financially support your practice.`
- 3: `CENTRA LIZE` + `No more scattered links, PDFs, and half-finished profiles.` + `Have your work together in one clear format` + numbered 1–4: `Professional presentation` / `Financial support` / `Instant sharing` / `Better discovery` (each number appears twice: as index and as heading)
- 4: `AUDIENCE SUPPORT` + `Already, hundreds have financially supported curators and artists through FOLLOW.ART Cards.` + `Support Me button in your Card lets people back your work financially.` + 10-name marquee (repeated twice): Teona Toderel·Artist, Erin J Coholan·Artist, Baimba Kamara·Curator, Alberto Balocca·Artist, Thomas Oosterhof·Curator, Isabela Galeano·Curator, Danny Van der Elst·Artist, Sophie Wratzfeld·Curator, Farouk Alao·Artist, Keita Melle·Artist
- 5: `Our Members Say` + `TESTIMONIALS` + `Prev` / `Next`
- 6: `Discover Others & Get Discovered` + `CONNECTORY` + `A global searchable directory of curators and artists` + `Join 4K+ members. Explore practices, find collaborators, and search beyond your usual circles. No algorithms, no race for attention, no echo chambers`
- 7: `JOIN US` + `Create Your Card and share wherever your practice is seen` + `Join` + `Get your FOLLOW.ART Card to present your artistic or curatorial practice, share instantly, receive direct financial support.` + footer: `Brand Kit` `Buy Gift Card` `Terms & Conditions` `Privacy Policy` `Cookie Policy` `Digital product development by Vide Infra` `2026 © FOLLOW.ART` `help@follow.art`

## Header (measured text order)
`FOLLOW. ART` / `One Practice. One Card` · `About` `Our Product` `Community Board` `Pricing` `FAQ` · `Login` `Join` · plus `#menu` anchor.

## Routes (12 internal, measured from live `a[href]`)
`/` `/about` `/our-product` `/community-board` `/pricing` `/faq` `/signin` `/signup` `/gift-card` `/terms-and-conditions` `/privacy-policy` `/cookies-policy`
External (entry only, never clone): drive.google Brand Kit, instagram, linkedin, youtube, substack, facebook, mailto:help@follow.art, videinfra.com.

## WebGL facts (all MEASURED, see evidence/reference/webgl-scenes.json)
- Hero: 9 meshes `PlaneGeometry(9, 12.6, 10, 1)`, `MeshBasicMaterial` side=2, textures `/assets/cards/Card-1..9.png` (700×1080 native). All transforms identity → ring + bend live in the vertex shader via `spineTexture / pathOffset / pathSegment / spineOffset / spineLength / textureStacks / textureLayers / bend / rowOffset`. Full GLSL: `evidence/reference/shaders/hero-0.vert.glsl` (18074 chars) + `.frag.glsl`.
- Hero camera: `fov 29.2518, near 0.1, far 69, pos (0,-14,-70), rot (-3.351, 0, -0.492)`, aspect 1.7824. A second canvas uses the same camera with near/far swapped (69–200) → the picture is split across two depth layers.
- Card section (`landing-5-nexus`): 2 meshes `PlaneGeometry(1,2,20,20)`, custom cylindrical ShaderMaterial (source captured verbatim). Mesh A `pos(-0.59,0.4,0.5) rot(0,2.6,0.4) scale 1.3 radius 1.96 offset -0.48`; Mesh B `pos(-0.3,1.2,-3.5) rot(0,-2.4,-0.41) scale 1.8 radius 0.87 offset -1.04`. Camera `fov 40.1792 near 0.1 far 69 pos(0.6412,-0.8657,3.9274) rot(0.1088,0.0802,-0.0088)`.
- Get-seen: 1 mesh `PlaneGeometry(1, 1.1739, 20, 20)`, ShaderMaterial with `USE_MOUSE:1`, uniforms `mousePos`, `progressStart -0.25`, `progressEnd 0`, texture `/assets/product/video-preview.png` (3375×4219). Camera `fov 42.2793 near 0.1 far 200 pos(0,-0.048,2.04)`.
- `progress` on the nexus meshes moved 1 → -0.25 between two samples while mesh y rose by +1.1 → scroll-driven.

## Naming rules for the clone
- Keep the reference's BEM class names verbatim (`landing-1-intro-webgl__canvas-wrapper`, `ui-orange`, `wrapper-section-10`, `js-get-seen-section`, `scrollable__area`) so CSS lifted from the reference chunks applies unchanged.
- No GSAP and no ScrollTrigger anywhere: the reference ships neither (grep of all 34 JS chunks = 0 hits). Animation is Lenis 1.3.3 + hand-rolled rAF progress.
- Test bridge: `window.__FOLLOW_CLONE_TEST__`, dev/preview builds only.
