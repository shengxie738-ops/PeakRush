/**
 * project-hero.mjs — closed-form oracle for the hero card ring.
 *
 * Why this exists: the reference pixel baseline is blocked (Cloudflare + the in-app
 * browser only rasterises a visible surface), so "does a card crop at x<=0" cannot be
 * answered by looking at the reference. It CAN be answered exactly, because two things
 * were captured verbatim:
 *   1. the whole ring construction (evidence/reference/raw/_nuxt/CDL_IiwC.js)
 *   2. the real projection matrices (evidence/reference/shaders/hero-summary.json)
 *
 * so the CPU side can reproduce the GPU side. three.js is used from node_modules, not
 * reimplemented — the curve, its arc-length table and the Frenet frames are the same
 * code the reference runs. Only the vertex-shader bend is re-applied here in JS,
 * transcribed line by line from the captured GLSL:
 *
 *   worldPos   = modelMatrix * vec4(position,1.)            // modelMatrix == identity
 *   xWeight    = bend ? 0. : 1.                             // flow=1 -> 0
 *   mt         = mod((worldPos.x + spineOffset)/spineLength * pathSegment
 *                    + pathOffset, textureStacks)
 *   spinePos   = tex(mt, 0.5/4); a=tex(mt,1.5/4); b=..2.5/4; c=..3.5/4
 *   transformed= mat3(a,b,c) * vec3(worldPos.x*xWeight, worldPos.y, worldPos.z) + spinePos
 *   gl_Position= projectionMatrix * modelViewMatrix * vec4(transformed,1.)
 *
 * Linear filtering along a 1024-texel RepeatWrapping texture is sampled at the texel
 * centres here, which is exact at every vertex whose mt lands on a texel centre; the
 * deviation elsewhere is a sub-texel interpolation and is reported as a tolerance.
 *
 * Usage: node scripts/project-hero.mjs [--width=1376 --height=772 --spin=0 --mouse=0.5]
 */
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

const arg = (name, dflt) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : dflt;
};

// ---------------------------------------------------------------- captured facts
const SUMMARY = JSON.parse(
  readFileSync('evidence/reference/shaders/hero-summary.json', 'utf8'),
);
/**
 * fov and aspect come from the captured projection matrix — that is what actually
 * rasterised the reference frame. near/far come from the probe record instead of from
 * m33/m34 because inverting them needs m33^2-1, which cancels to ~3 significant digits
 * for a 0.1–69 frustum.
 */
function cameraFromProjection(elements, record) {
  const sy = elements[5];
  const sx = elements[0];
  const fovDeg = (2 * Math.atan(1 / sy) * 180) / Math.PI;
  const aspect = sy / sx;
  if (Math.abs(aspect - record.aspect) > 1e-3) {
    console.warn(`  ! aspect from matrix ${aspect.toFixed(4)} != probe ${record.aspect}`);
  }
  const cam = new THREE.PerspectiveCamera(fovDeg, aspect, record.near, record.far);
  cam.position.fromArray(record.position);
  return cam;
}

const SCENES = JSON.parse(readFileSync('evidence/reference/webgl-scenes.json', 'utf8'));
const camRecord = (owner) => SCENES.cameras.find((c) => c.owner === owner);

// ------------------------------------------------------------------- the reference
// CDL_IiwC.js: const g=4, v=1024, u=4;  curve options.scale = 15
const V = 1024; // texture columns
const U = 4; // texture rows (position, tangent, normal, binormal)
const SPINE_OFFSET = 161; // xe() default, never overwritten
const PATH_SEGMENT = 1; // xe() default, never overwritten
const TEXTURE_STACKS = U / 4; // 1
const PLANE_W = 9;
const PLANE_H = 12.6;
const CARDS = 9;

class CircleCurve extends THREE.Curve {
  constructor() {
    super();
    this.options = { scale: 15 };
  }
  getPoint(t, target = new THREE.Vector3()) {
    const l = this.options.scale;
    return target.set(Math.cos(t * Math.PI * 2) * l, 0, Math.sin(t * Math.PI * 2) * l);
  }
}

/** we(): arcLengthDivisions = v*(u/4)/2 = 512, getSpacedPoints(1024), closed Frenet. */
function buildSpine() {
  const curve = new CircleCurve();
  const o = Math.floor(V * (U / 4)); // 1024
  curve.arcLengthDivisions = o / 2; // 512
  curve.updateArcLengths();
  const points = curve.getSpacedPoints(o);
  const frames = curve.computeFrenetFrames(o, true);
  const spine = [];
  for (let a = 0; a < o; a++) {
    spine.push({
      position: points[a],
      tangent: frames.tangents[a],
      normal: frames.normals[a],
      binormal: frames.binormals[a],
    });
  }
  return { curve, spine, length: curve.getLength() };
}

/** tex() with linear filtering between texel centres of a 1024-wide repeat texture. */
function sampleSpine(spine, mt) {
  const u = ((mt % 1) + 1) % 1;
  const f = u * spine.length;
  const i0 = Math.floor(f) % spine.length;
  const i1 = (i0 + 1) % spine.length;
  const t = f - Math.floor(f);
  const lerp = (a, b) => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  });
  const s = spine[i0];
  const s2 = spine[i1];
  return {
    position: lerp(s.position, s2.position),
    tangent: lerp(s.tangent, s2.tangent),
    normal: lerp(s.normal, s2.normal),
    binormal: lerp(s.binormal, s2.binormal),
  };
}

const { curve, spine, length: spineLength } = buildSpine();

/** Apply the captured vertex shader to one plane vertex. */
function bendVertex(x, y, z, pathOffset) {
  const spinePortion = (x + SPINE_OFFSET) / spineLength;
  let mt = (spinePortion * PATH_SEGMENT + pathOffset) * TEXTURE_STACKS;
  mt = (((mt % TEXTURE_STACKS) + TEXTURE_STACKS) % TEXTURE_STACKS) / TEXTURE_STACKS;
  const s = sampleSpine(spine, mt);
  // basis = mat3(a=tangent, b=normal, c=binormal) * vec3(x*xWeight(=0), y, z) + spinePos
  const px = s.normal.x * y + s.binormal.x * z + s.position.x;
  const py = s.normal.y * y + s.binormal.y * z + s.position.y;
  const pz = s.normal.z * y + s.binormal.z * z + s.position.z;
  return new THREE.Vector3(px, py, pz);
}

function cardClipPath(pathOffset) {
  const geo = new THREE.PlaneGeometry(PLANE_W, PLANE_H, 10, 1);
  const pos = geo.attributes.position;
  const pts = [];
  for (let i = 0; i < pos.count; i++) {
    pts.push(bendVertex(pos.getX(i), pos.getY(i), pos.getZ(i), pathOffset));
  }
  geo.dispose();
  return pts;
}

/**
 * Project a world-space vertex grid into CSS px, clipping each segment at the camera's
 * own near/far planes so a layer only reports what it can actually show. Done in view
 * space: depth = -z because the camera looks down -z.
 */
function project(pts, cam, width, height) {
  const rect = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, samples: 0 };
  const view = pts.map((p) => p.clone().applyMatrix4(cam.matrixWorldInverse));
  const zmin = cam.near;
  const zmax = cam.far;
  const toScreen = (v) => {
    // Vector4, not Vector3: Vector3.applyMatrix4 performs the perspective divide
    // itself, which mirrors points behind the camera and yields NaN when w === 0.
    const c = new THREE.Vector4(v.x, v.y, v.z, 1).applyMatrix4(cam.projectionMatrix);
    if (!(c.w > 1e-9)) return null;
    return [((c.x / c.w) * 0.5 + 0.5) * width, (1 - ((c.y / c.w) * 0.5 + 0.5)) * height];
  };
  const inside = (z) => z >= zmin && z <= zmax;
  const edge = (a, b) => {
    const za = -a.z;
    const zb = -b.z;
    if (!inside(za) && !inside(zb)) return;
    let pa = a;
    let pb = b;
    if (!inside(za)) {
      pa = a.clone().lerp(b, ((za > zmax ? zmax : zmin) - za) / (zb - za));
    }
    if (!inside(zb)) {
      pb = b.clone().lerp(a, ((zb > zmax ? zmax : zmin) - zb) / (za - zb));
    }
    for (const q of [pa, pb]) {
      const s = toScreen(q);
      if (!s) continue;
      rect.minX = Math.min(rect.minX, s[0]);
      rect.maxX = Math.max(rect.maxX, s[0]);
      rect.minY = Math.min(rect.minY, s[1]);
      rect.maxY = Math.max(rect.maxY, s[1]);
      rect.samples++;
    }
  };
  const cols = 11;
  for (let i = 0; i < view.length; i++) {
    if (i % cols !== cols - 1) edge(view[i], view[i + 1]);
    if (i + cols < view.length) edge(view[i], view[i + cols]);
  }
  return rect;
}

// --------------------------------------------------------------------------- main
const ranDirectly = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('scripts/project-hero.mjs');

/**
 * The measured reference construction, projected at an arbitrary viewport.
 * Returns the union envelope and the per-card rects a correct clone must reproduce.
 */
export function heroProjectionReport({ width = 1376, height = 772, spin = 0, mouse = 0.5 } = {}) {
  const nearRec = camRecord('landing-1-intro (canvas A)');
  const farRec = camRecord('landing-1-intro (canvas B)');
  const rotZ = (Math.PI / 180) * -25 + (mouse - 0.5) * 0.2;
  const rotX = (Math.PI / 180) * -192;
  const cams = [
    cameraFromProjection(SUMMARY.find((e) => e.index === 1).uniforms.projectionMatrix, nearRec),
    cameraFromProjection(SUMMARY.find((e) => e.index === 0).uniforms.projectionMatrix, farRec),
  ];
  for (const cam of cams) {
    cam.aspect = width / height;
    cam.rotation.set(rotX, 0, rotZ);
    cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();
  }
  const [camNear, camFar] = cams;
  const cards = [];
  for (let i = 0; i < CARDS; i++) {
    const pathOffset = i / CARDS + spin;
    const pts = cardClipPath(pathOffset);
    cards.push({ index: i, pathOffset, near: project(pts, camNear, width, height), far: project(pts, camFar, width, height) });
  }
  const visible = cards.filter((c) => c.near.samples > 0 || c.far.samples > 0);
  const rectOf = (c) => (c.near.samples > 0 ? c.near : c.far);
  const use = visible.map(rectOf);
  const envelope = use.length
    ? {
        minX: Math.min(...use.map((r) => r.minX)),
        maxX: Math.max(...use.map((r) => r.maxX)),
        minY: Math.min(...use.map((r) => r.minY)),
        maxY: Math.max(...use.map((r) => r.maxY)),
      }
    : null;
  return {
    viewport: [width, height],
    spin,
    mouse,
    rotZDeg: (rotZ * 180) / Math.PI,
    fov: camNear.fov,
    spineLength,
    visibleCount: visible.length,
    envelope,
    cards: visible.map((c) => ({ index: c.index, pathOffset: c.pathOffset, ...rectOf(c) })),
  };
}

if (ranDirectly) {
  const width = arg('width', 1376);
  const height = arg('height', 772);
  const spin = arg('spin', 0);
  const mouse = arg('mouse', 0.5);

  console.log('circle radius:', curve.options.scale, ' spine samples:', V);
  console.log('spineLength uniform (computed):', spineLength.toFixed(14));
  console.log('spineLength uniform (measured) : 94.24718821101328');

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(heroProjectionReport({ width, height, spin, mouse })));
  } else {
    const rep = heroProjectionReport({ width, height, spin, mouse });
    console.log(
      `fov ${rep.fov.toFixed(4)}  rotZ ${(rep.rotZDeg).toFixed(3)}deg  spin ${spin}  mouse ${mouse}`,
    );
    console.log(`viewport ${rep.viewport.join('x')}\n`);
    for (const c of rep.cards) {
      console.log(
        `card ${c.index + 1} offset ${c.pathOffset.toFixed(4)}  ` +
          `[${c.minX.toFixed(0)},${c.minY.toFixed(0)} → ${c.maxX.toFixed(0)},${c.maxY.toFixed(0)}] ` +
          `${(((c.maxX - c.minX) * (c.maxY - c.minY)) / 1000).toFixed(0)}k px2`,
      );
    }
    console.log(
      `\nvisible: ${rep.visibleCount}/${CARDS}  envelope x [${rep.envelope.minX.toFixed(0)}, ` +
        `${rep.envelope.maxX.toFixed(0)}] y [${rep.envelope.minY.toFixed(0)}, ${rep.envelope.maxY.toFixed(0)}]`,
    );
  }
}
