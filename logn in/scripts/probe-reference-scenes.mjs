/**
 * probe-reference-scenes.mjs — the exact browser-side bodies used to MEASURE follow.art
 * without a visible browser surface and without a screenshot.
 *
 * WHY THIS EXISTS
 *   Cloudflare challenges curl, Playwright's bundled Chromium and channel:'msedge' for the HTML
 *   document, and the Qoder in-app browser only rasterises when its panel is a visible surface.
 *   Pixels are therefore unavailable — but the page's own JS objects are not, because
 *   `evaluate_script` runs in the already-open tab. Everything below is structural: read the
 *   live three.js scene graph and the live DOM.
 *
 * KEY TRICKS, each of which cost a wrong turn to learn
 *   1. Work in a hidden SAME-ORIGIN IFRAME, never in the user's tab. The tab keeps its URL and
 *      scroll position; the iframe is removed at the end.
 *   2. `Object3D.prototype.add` patched inside the iframe's OWN three realm (obtained by
 *      `iframe.contentWindow.eval("import('/_nuxt/8mlhRxUg.js')")` — the module registry is
 *      per-realm, and `await import` is not available on the window object itself) lets every
 *      scene root be recorded as it mounts. Patches installed after page load do not see scenes
 *      that already mounted.
 *   3. Re-mount by SPA route push (`#__nuxt.__vue_app__.config.globalProperties.$router`), not by
 *      navigation: `router.push('/')` rebuilds every home WebGL scene inside the same realm, so
 *      the patch is still installed when they mount. This is what unlocked the connectory and
 *      testimonials scenes that a scroll-based probe could never see.
 *   4. Uniforms are readable with ZERO renders: the hero shader-injection helper does
 *      `Object.assign(patch.uniforms, sharedUniforms)`, so calling
 *      `material.onBeforeCompile({ uniforms: {}, vertexShader: 'void main(){}' })` copies the
 *      private uniform bag into the object you hand it. No frame, no visible surface.
 *   5. The spine DataTexture's CPU payload is `texture.image.data` (a Uint16Array of half
 *      floats) — decode with the half-float formula in `probeReadSpineTexels` below;
 *      three's own `DataUtils.fromHalfFloat` is not exposed on the page.
 *   6. Do not `await requestAnimationFrame`: in a hidden document frames are intermittent and
 *      the await will hit the 15 s tool timeout. Drive waits with one `setTimeout`.
 *   7. `matrixWorld` reads as identity in a never-rendered document. Use
 *      position/rotation/scale, not the world matrix.
 *
 * USAGE: pass the chosen body to the browser MCP `evaluate_script` `function` parameter.
 * Each export is a self-contained arrow-function source string.
 */

/** Step 1 — create the hidden same-origin iframe and wait for it to hydrate. */
export const createIframe = /* js */ `() => {
  const old = document.getElementById('__probe_iframe__');
  if (old) old.remove();
  const f = document.createElement('iframe');
  f.id = '__probe_iframe__';
  f.style.cssText = 'position:fixed;left:0;top:0;width:1376px;height:772px;border:0;opacity:0.01;pointer-events:none;z-index:-1;visibility:hidden';
  f.src = '/signin';            // any non-home route: the hero is re-mounted in step 2
  window.__P__ = { created: performance.now(), state: 'pending' };
  f.addEventListener('load', () => { window.__P__.state = 'load'; });
  document.body.appendChild(f);
  return JSON.stringify({ tabUrl: location.pathname, dpr: devicePixelRatio, visibility: document.visibilityState });
}`;

/** Step 2 — patch add() in the iframe's three realm, then SPA-push to '/' and collect roots. */
export const remountAndCollect = /* js */ `async () => {
  const win = document.getElementById('__probe_iframe__').contentWindow;
  const mod = await win.eval("import('/_nuxt/8mlhRxUg.js')");   // three bundle chunk, cached
  let proto = Object.getPrototypeOf(mod.M.prototype);            // M = Mesh
  while (proto && !Object.prototype.hasOwnProperty.call(proto, 'add')) proto = Object.getPrototypeOf(proto);
  if (!win.__ADDS__) {
    const orig = proto.add;
    win.__ADDS__ = [];
    proto.add = function (child) { win.__ADDS__.push({ parent: this, child }); return orig.call(this, child); };
  }
  const router = win.document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$router;
  win.__ADDS__.length = 0;
  await router.push('/');
  await new Promise((r) => setTimeout(r, 2500));                 // hydration + texture resolve
  const scenes = new Set();
  for (const rec of win.__ADDS__) { let p = rec.parent; while (p.parent) p = p.parent; if (p.isScene) scenes.add(p); }
  win.__SCENES__ = [...scenes];
  return JSON.stringify({ url: win.location.pathname, adds: win.__ADDS__.length, scenes: win.__SCENES__.length });
}`;

/** Step 3 — read the hero uniforms + spine texels with no render at all. */
export const probeReadSpineTexels = /* js */ `() => {
  const win = document.getElementById('__probe_iframe__').contentWindow;
  const half = (h) => {                        // IEEE754 binary16 -> Number
    const s = (h & 0x8000) >> 15, e = (h & 0x7C00) >> 10, f = h & 0x03FF;
    if (e === 0) return (s ? -1 : 1) * Math.pow(2, -14) * (f / 1024);
    if (e === 31) return f ? NaN : (s ? -Infinity : Infinity);
    return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / 1024);
  };
  const hero = (win.__SCENES__ || []).find((s) => { let n = 0; s.traverse((o) => { if (o.isMesh) n++; }); return n === 9; });
  if (!hero) return JSON.stringify({ error: 'no 9-mesh scene; was the iframe pushed to "/"?' });
  const meshes = []; hero.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const bag = { uniforms: {}, vertexShader: 'void main(){}' };
  meshes[0].material.onBeforeCompile(bag);      // copies the private uniform object
  const u = bag.uniforms, st = u.spineTexture.value, d = st.image.data, W = st.image.width;
  const at = (row, col, k) => +half(d[(row * W + col) * 4 + k]).toFixed(5);
  return JSON.stringify({
    spineLength: u.spineLength.value, spineOffset: u.spineOffset.value,
    pathSegment: u.pathSegment.value, flow: u.flow.value,
    pathOffsets: meshes.map((m) => { const b = { uniforms: {}, vertexShader: 'void main(){}' }; m.material.onBeforeCompile(b); return b.uniforms.pathOffset.value; }),
    tex: { w: W, h: st.image.height, len: d.length, type: st.type, format: st.format, wrapS: st.wrapS, wrapT: st.wrapT, magFilter: st.magFilter, minFilter: st.minFilter },
    cols: [0, 1, 4, 128, 256, 341, 512, 768, 1023].map((c) => ({ c, r0: [at(0,c,0),at(0,c,1),at(0,c,2)], r1: [at(1,c,0),at(1,c,1),at(1,c,2)], r2: [at(2,c,0),at(2,c,1),at(2,c,2)], r3: [at(3,c,0),at(3,c,1),at(3,c,2)] })),
  });
}`;

/** Step 4 — geometry / transforms / custom-material uniforms for every captured scene. */
export const probeSceneInventory = /* js */ `() => {
  const win = document.getElementById('__probe_iframe__').contentWindow;
  const xyz = (v) => ({ x: +v.x.toFixed(7), y: +v.y.toFixed(7), z: +v.z.toFixed(7) });
  const scenes = (win.__SCENES__ || []).map((s) => {
    const meshes = []; s.traverse((o) => { if (o.isMesh) meshes.push(o); });
    return { meshes: meshes.map((m) => ({
      geometry: { type: m.geometry.type, params: m.geometry.parameters, vertexCount: m.geometry.attributes.position.count },
      material: { type: m.material.type, side: m.material.side, transparent: m.material.transparent,
                  color: m.material.color ? m.material.color.getHexString() : null,
                  mapUrl: m.material.map && m.material.map.source ? String(m.material.map.source.url || '') : null },
      position: xyz(m.position), rotationXYZ: xyz(m.rotation), eulerOrder: m.rotation.order, scale: xyz(m.scale),
      visible: m.visible, renderOrder: m.renderOrder })) };
  });
  const textures = {};
  for (const s of (win.__SCENES__ || [])) s.traverse((m) => {
    if (!m.isMesh) return; const u = m.material.uniforms || {};
    for (const k of Object.keys(u)) { const v = u[k] && u[k].value;
      if (v && v.isTexture && !(k in textures)) { const num = {};
        for (const kk of Object.keys(u)) if (typeof u[kk].value === 'number') num[kk] = u[kk].value;
        textures[k] = { url: String((v.source && v.source.url) || ''), w: v.image && v.image.width, h: v.image && v.image.height,
                        wrapS: v.wrapS, wrapT: v.wrapT, magFilter: v.magFilter, minFilter: v.minFilter,
                        format: v.format, type: v.type, colorSpace: v.colorSpace, numericUniforms: num }; } }
  });
  const canvases = [...win.document.querySelectorAll('canvas')].map((c) => {
    const chain = []; let el = c;
    for (let i = 0; i < 6 && el; i++) { el = el.parentElement; if (el && el.className) chain.push(String(el.className).split(' ')[0]); }
    return { buffer: [c.width, c.height], rect: c.getBoundingClientRect().toJSON(), chain };
  });
  return JSON.stringify({ scenes, textures, canvases });
}`;

/** Teardown — always run this; the iframe lives in the user's document. */
export const teardown = /* js */ `() => {
  const f = document.getElementById('__probe_iframe__');
  if (f) f.remove();
  delete window.__P__;
  return JSON.stringify({ removed: !document.getElementById('__probe_iframe__'), tabUrl: location.href });
}`;

/** Three.js constant ids seen in the reads, for decoding future captures. */
export const THREE_ENUMS = {
  wrapS: { 1000: 'RepeatWrapping', 1001: 'ClampToEdgeWrapping', 1002: 'MirroredRepeatWrapping' },
  filter: { 1003: 'NearestMipmapNearestFilter', 1006: 'NearestFilter', 1008: 'LinearMipmapLinearFilter' /* LinearMipmapLinear */, 1007: 'LinearFilter' },
  format: { 1022: 'RGBFormat', 1023: 'RGBAFormat' },
  type: { 1009: 'UnsignedByteType', 1015: 'FloatType', 1016: 'HalfFloatType' },
  side: { 0: 'FrontSide', 1: 'BackSide', 2: 'DoubleSide' },
};
