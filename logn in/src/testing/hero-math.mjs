/**
 * hero-math.mjs — CPU mirror of the captured hero vertex shader
 * (evidence/reference/shaders/hero-0.vert.glsl) + the measured camera.
 *
 * Kept dependency-free so both the calibration CLI and the vitest specs can use it.
 * The GPU path lives in src/webgl/geometry.ts + src/webgl/shaders/hero-*.glsl; this
 * file reproduces exactly the same maths so the ring can be solved/verified offline.
 */

/** PlaneGeometry(9, 12.6, 10, 1) vertex grid, in three.js order. */
export function planeGrid(width, height, widthSegments, heightSegments) {
  const verts = [];
  const ix = widthSegments + 1;
  const iy = heightSegments + 1;
  for (let gy = 0; gy < iy; gy++) {
    for (let gx = 0; gx < ix; gx++) {
      const u = gx / widthSegments;
      const v = 1 - gy / heightSegments;
      verts.push({ x: u * width - width / 2, y: v * height - height / 2, uv: [u, v] });
    }
  }
  return verts;
}

/** The measured hero ring spine: a circle of radius R in the (x,z) plane, tilted about X. */
export function spineSample(cfg, u) {
  const theta = cfg.phase + (((u % 1) + 1) % 1) * Math.PI * 2;
  const st = Math.sin(theta);
  const ct = Math.cos(theta);
  const cos = Math.cos(cfg.tiltX);
  const sin = Math.sin(cfg.tiltX);
  const rot = (v) => [v[0], cos * v[1] - sin * v[2], sin * v[1] + cos * v[2]];
  const radial = [st, 0, ct];
  const tangent = [ct, 0, -st];
  const up = [0, 1, 0];
  const posRel = rot([cfg.radius * st, 0, cfg.radius * ct]);
  return {
    position: [cfg.center[0] + posRel[0], cfg.center[1] + posRel[1], cfg.center[2] + posRel[2]],
    a: rot(tangent),
    b: rot(up),
    c: rot(radial),
  };
}

/** Per-card uniforms, mirroring src/webgl/geometry.ts#computeCardPathParams. */
export function cardParams(cardWidth, cardCount, index, gapFactor, spin = 0) {
  const slot = 1 / cardCount;
  return {
    spineLength: cardWidth,
    spineOffset: cardWidth / 2,
    pathSegment: slot * Math.max(0, Math.min(1, gapFactor)),
    pathOffset: (index + 0.5) * slot + spin,
  };
}

/**
 * `transformed = basis * vec3(worldPos.x * xWeight, worldPos.y, worldPos.z) + spinePos`
 * with xWeight = 0 while `bend` (flow > 0) — the reference's ring mode.
 */
export function vertexWorld(spine, p, x, y, pathOffsetBase, spin, bend = true) {
  const spinePortion = (x + p.spineOffset) / p.spineLength;
  let mt = spinePortion * p.pathSegment + pathOffsetBase + spin;
  mt = ((mt % 1) + 1) % 1; // textureStacks === 1 -> rowOffset === 0
  const f = spineSample(spine, mt);
  const xw = bend ? 0 : x;
  return [
    f.a[0] * xw + f.b[0] * y + f.c[0] * 0 + f.position[0],
    f.a[1] * xw + f.b[1] * y + f.c[1] * 0 + f.position[1],
    f.a[2] * xw + f.b[2] * y + f.c[2] * 0 + f.position[2],
  ];
}

/** three.js Euler 'XYZ' -> rotation matrix (Rx * Ry * Rz). */
export function eulerXYZ(x, y, z) {
  const cx = Math.cos(x), sx = Math.sin(x);
  const cy = Math.cos(y), sy = Math.sin(y);
  const cz = Math.cos(z), sz = Math.sin(z);
  // Rx*Ry*Rz, row-major.
  return [
    [cy * cz, -cy * sz, sy],
    [sx * sy * cz + cx * sz, -sx * sy * sz + cx * cz, -sx * cy],
    [-cx * sy * cz + sx * sz, cx * sy * sz + sx * cz, cx * cy],
  ];
}

/** Camera world->view (R^T, then translate) for pos/rot. */
export function makeView(pos, rot) {
  const R = eulerXYZ(rot[0], rot[1], rot[2]);
  const RT = R[0].map((_, i) => R.map((row) => row[i]));
  const t = RT.map((row) => -(row[0] * pos[0] + row[1] * pos[1] + row[2] * pos[2]));
  return (p) => [
    RT[0][0] * p[0] + RT[0][1] * p[1] + RT[0][2] * p[2] + t[0],
    RT[1][0] * p[0] + RT[1][1] * p[1] + RT[1][2] * p[2] + t[1],
    RT[2][0] * p[0] + RT[2][1] * p[1] + RT[2][2] * p[2] + t[2],
  ];
}

/**
 * Projection using the MEASURED matrix values (hero-summary.json):
 * m00 = 2.149909257888794, m11 = 3.8319625854492188, m22/m32/m23 from near/far.
 */
export function makeProjection(fovDeg, aspect, near, far) {
  const f = 1 / Math.tan((fovDeg * Math.PI) / 360);
  const nf = 1 / (near - far);
  return {
    f,
    apply: (v) => [
      (v[0] * (f / aspect) + v[2] * 0) / -v[2],
      (v[1] * f) / -v[2],
      v[2],
    ],
    m00: f / aspect,
    m11: f,
    m22: (far + near) * nf,
    m23: 2 * far * near * nf,
    m32: -1,
  };
}

/**
 * Project every card of the ring to normalised screen space (x,y in [-1,1], y up).
 * Returns per-card corner lists plus convenience metrics.
 */
export function projectRing(cfg) {
  const { spine, cardCount = 9, cardWidth = 9, cardHeight = 12.6, gapFactor, spin = 0, bend = true } = cfg;
  const view = makeView(cfg.camera.pos, cfg.camera.rot);
  const proj = makeProjection(cfg.camera.fov, cfg.aspect, cfg.camera.near, cfg.camera.far);
  const grid = planeGrid(cardWidth, cardHeight, 10, 1);
  const cards = [];
  for (let i = 0; i < cardCount; i++) {
    const p = cardParams(cardWidth, cardCount, i, gapFactor);
    const pts = grid.map((g) => {
      const w = vertexWorld(spine, p, g.x, g.y, p.pathOffset, spin, bend);
      const v = view(w);
      const c = proj.apply(v);
      return { world: w, view: v, ndc: c, uv: g.uv };
    });
    const inside = pts.filter((q) => Math.abs(q.ndc[0]) <= 1 && Math.abs(q.ndc[1]) <= 1 && q.view[2] < 0);
    const centers = pts.map((q) => q.ndc);
    const cx = centers.reduce((s, q) => s + q[0], 0) / centers.length;
    const cy = centers.reduce((s, q) => s + q[1], 0) / centers.length;
    const xs = centers.map((q) => q[0]);
    const ys = centers.map((q) => q[1]);
    cards.push({
      index: i,
      pts,
      center: [cx, cy],
      ndcBox: [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)],
      anyInside: inside.length > 0,
      fractionInside: inside.length / pts.length,
      depth: -avg(pts.map((q) => q.view[2])),
    });
  }
  return cards;
}

function avg(a) { return a.reduce((s, v) => s + v, 0) / a.length; }

/** Screen-space (pixel) projection helper for the frame-fit measurements. */
export function toPixels(ndc, w, h) {
  return [((ndc[0] + 1) / 2) * w, ((1 - ndc[1]) / 2) * h];
}
