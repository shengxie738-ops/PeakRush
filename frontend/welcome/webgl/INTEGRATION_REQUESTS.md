# Welcome WebGL lifecycle contract

`App.vue` is the application's only `mountWebGLScenes` caller. It waits for Vue's
next render, activates scenes only on `home` with full motion, and releases the
mount registry before disposing the motion runtime on route leave, preference
change, and unmount. A lifecycle version invalidates delayed imports. Importing
`sceneRegistry` supplies metadata and factories without allocating renderers.

`mountScenes` discovers late route DOM using a mutation observer and bounded retry.
It compares section, host and canvas identities before reusing entries, maintains
one owner per canvas, and drives each registered scene through one motion clock.
Its optional standalone presentation clock is used only by integrations that omit
a runtime; the application disables it. Disposal removes observers, timers,
context listeners and fallback clock listeners and restores posters.

The mount wrapper owns host measurement. `resizeToHost` sizes the scene from its
host and mutates the existing scroll range so the runtime retains the current
layout. The runtime calls this hook on registration and resize; wrappers also
refresh layout periodically. Scene dimensions never inherit the whole scroll
container by accident.

A scene's `ready` getter becomes true only after its dependencies have loaded and
a real renderer call succeeds. Until then canvases remain hidden and static
posters remain visible. Initialization, image and render failures keep the poster.
Context loss clears readiness and immediately restores it; context restoration
requires another successful draw before revealing the canvas again.

`TextureRegistry` shares entries by `(URL, colorSpace)`. Every acquire and release
must use the same mode. Image load completion is tracked independently from texture
construction, and callbacks from a released entry cannot update a newer entry.

The carousel delegates `data-carousel-step` button clicks and publishes
`peakrush:carousel-index` with `{ index }` when its target changes. Vue uses that
index for its poster and disabled states. `data-webgl-index` preserves the target
through scene rebuilds. Click and pointer handlers are removed on disposal.

Reduced motion cancels Lenis inertia, disables `smoothWheel`, and immediately
unlocks the runner with `start()`, preserving native wheel scrolling.

## Verification boundaries

`welcome-webgl.test.mjs` executes the actual application setup, carousel template,
BrushLink template, scene controllers and registry source. Three geometry,
materials and Vue reactivity remain real. The test harness substitutes DOM,
GPU renderer, image delivery and Lenis browser adapters. It verifies ownership,
resource release, readiness, host sizing, route/import races and state bridging;
it does not measure FPS, actual wheel dispatch, GPU pixels or a physical context
restore. `motion-preference.test.mjs` checks our Lenis configuration and lock policy.
Target-browser interaction and graphics acceptance remain separate checks.
