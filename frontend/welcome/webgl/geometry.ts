/**
 * geometry.ts — pure math for the WebGL layer.
 *
 *  1. `bendPoint` — the CPU mirror of the reference's cylindrical arc bend
 *     (`landing-5-nexus` vertex shader / plan §9.2). Exposed for calibration,
 *     unit tests and as a provable fallback if a GLSL path ever fails to compile.
 *  2. Ring-spine construction — the hero (`landing-1-intro`) arranges and bends its
 *     9 cards ENTIRELY inside the vertex shader. The only CPU-side input the shader
 *     needs is a "spine": a curve sampled into a DataTexture whose four rows are,
 *     per column, [ position, tangent, normal, binormal ] (see the ported hero GLSL).
 *
 * Everything in section 2 is transcribed from the reference renderer chunk
 * `evidence/reference/raw/_nuxt/CDL_IiwC.js`, not guessed:
 *
 *   const ye extends Curve { options = { scale: 15 };
 *     getPoint(t, v) { const l = 15; return v.set(cos(t*2PI)*l, 0, sin(t*2PI)*l); } }
 *   const v = 1024, u = 4, g = 4;                       // width, layers, channels
 *   he()  -> new DataTexture(new Uint16Array(v*u*g), v, u, RGBAFormat, HalfFloatType)
 *            wrapS = wrapT = RepeatWrapping, magFilter = minFilter = LinearFilter
 *   we()  -> arcLengthDivisions = v*(u/4)/2 = 512; getSpacedPoints(1024);
 *            computeFrenetFrames(1024, closed=true);
 *            row 0 = point, row 1 = tangent (a), row 2 = normal (b), row 3 = binormal (c)
 *   xe()  -> { pathOffset: 0, pathSegment: 1, spineOffset: 161, spineLength: <curve
 *              length>, flow: 1 }        // spineLength is overwritten by updateCurve()
 *   moveAlongCurve(d / 9) per card      -> pathOffset = index / 9
 *
 * So the spine is a flat circle of radius 15 in the world XZ plane — no tilt at all —
 * and its Frenet normal is (0,-1,0): the cards hang along −Y, which is exactly why the
 * measured camera needs rotation.x = -192deg (a half turn plus 12deg of elevation)
 * before the ring reads right-side-up.
 */
import * as THREE from 'three';
import { DataUtils } from 'three';

/** A single Frenet frame along the spine (matches the shader's mat3 basis). */
export interface SpineFrame {
  /** World position on the path (shader row 0). */
  readonly position: [number, number, number];
  /** Basis column a = tangent (shader row 1) — multiplies local X. */
  readonly a: [number, number, number];
  /** Basis column b = normal (shader row 2) — multiplies local Y (the card "up"). */
  readonly b: [number, number, number];
  /** Basis column c = binormal (shader row 3) — multiplies local Z (the card normal). */
  readonly c: [number, number, number];
}

/** Descriptor for the hero card-ring path (the reference's `ye` curve). */
export interface RingSpineConfig {
  /** Circle radius = the reference curve's `options.scale`. Measured: 15. */
  radius: number;
  /** Circle centre. The reference curve is built at the origin. */
  center: [number, number, number];
  /** Extra rotation of the whole ring about the world X axis. Reference: 0. */
  tiltX: number;
  /** Angular offset of the first sample, in turns (0..1). Reference: 0. */
  phase: number;
  /** Texture columns = path samples. Reference `v`: 1024. */
  samples: number;
  /** three.js `arcLengthDivisions` used for getLength(). Reference: samples/2 = 512. */
  arcLengthDivisions: number;
}

export const DEFAULT_RING_SPINE: RingSpineConfig = {
  radius: 15,
  center: [0, 0, 0],
  tiltX: 0,
  /* Reverted to 0 after measurement. Setting this to 0.23 — derived from the fact
     that the leftmost card began at x=311 of 1376 while the reference crops it at
     x<=0 — moved every projected card by only ~3px, so `phase` here is NOT the knob
     that arranges the cards on screen. The per-card span comes from
     computeCardPathParams() (pathSegment / pathOffset) and the idle angle from
     spinPhase in createCardRing.ts. Diff-009 stays open against those instead. */
  phase: 0,
  samples: 1024,
  arcLengthDivisions: 512,
};

/**
 * The reference's per-card spine uniforms (`xe()` in CDL_IiwC.js).
 * `spineOffset` is a constant 161 world units — never overwritten — while
 * `spineLength` is replaced by the curve length, so the cards start their span
 * 161/94.25 = 1.7082 turns along the path and each covers 9/94.25 = 0.0955 of it.
 */
export const HERO_SPINE_UNIFORMS = {
  pathSegment: 1,
  spineOffset: 161,
  flow: 1,
} as const;

/**
 * Chord length of the curve sampled with `divisions` segments — the value three.js
 * `Curve.getLength()` returns for `arcLengthDivisions`, which the reference pushes
 * into the `spineLength` uniform. (512 chords of a r=15 circle: 94.24748…)
 */
export function ringArcLength(radius: number, divisions: number): number {
  const step = (Math.PI * 2) / divisions;
  return divisions * 2 * radius * Math.sin(step / 2);
}

/**
 * Sample the hero ring spine into frames, reproducing the reference construction exactly:
 * `getSpacedPoints(1024)` + `computeFrenetFrames(1024, closed=true)` on a Curve subclass
 * whose `getPoint(t)` is `( R·cos 2πt, 0, R·sin 2πt )` — the same three.js calls the
 * reference makes, so the resulting texture is byte-identical rather than analytically
 * equivalent.
 *
 * The difference matters for honesty, not for looks: three's Frenet tangent at column 0 is
 * the chord direction (-0.00031, 0, 0.99951), not the exact derivative (0, 0, 1). The
 * captured reference texels carry the chord value, so a closed-form table would have
 * silently disagreed with the reference in row 1. (Row 1 is multiplied by `xWeight`, which
 * is 0 whenever `flow > 0`, so this never reached the picture — but a calibration that
 * matches the reference only "where it is invisible" is not a calibration.)
 *
 * Measured result for the reference's r=15 circle:
 *   position = ( R·cos φ, 0, R·sin φ )      row 0
 *   a tangent  ≈ ( −sin φ, 0,  cos φ )      row 1  (unused while flow > 0)
 *   b normal   = ( 0, −1, 0 )               row 2  — so a card's top points to world −Y
 *   c binormal = ( cos φ, 0, sin φ )        row 3  — the outward radial direction
 */
class ReferenceRingCurve extends THREE.Curve<THREE.Vector3> {
  constructor(private readonly radius: number) {
    super();
  }
  override getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    return target.set(Math.cos(t * Math.PI * 2) * this.radius, 0, Math.sin(t * Math.PI * 2) * this.radius);
  }
}

export function buildRingSpineFrames(cfg: RingSpineConfig = DEFAULT_RING_SPINE): SpineFrame[] {
  const cos = Math.cos(cfg.tiltX);
  const sin = Math.sin(cfg.tiltX);
  const [cx, cy, cz] = cfg.center;
  const rot = (v: THREE.Vector3): [number, number, number] => [
    v.x,
    cos * v.y - sin * v.z,
    sin * v.y + cos * v.z,
  ];

  // we() in CDL_IiwC.js: arcLengthDivisions = samples/2, then updateArcLengths()
  const curve = new ReferenceRingCurve(cfg.radius);
  curve.arcLengthDivisions = cfg.arcLengthDivisions;
  curve.updateArcLengths();
  const points = curve.getSpacedPoints(cfg.samples);
  const frames = curve.computeFrenetFrames(cfg.samples, true);

  const out: SpineFrame[] = [];
  for (let i = 0; i < cfg.samples; i++) {
    const p = rot(points[i]);
    out.push({
      position: [cx + p[0], cy + p[1], cz + p[2]],
      a: rot(frames.tangents[i]),
      b: rot(frames.normals[i]),
      c: rot(frames.binormals[i]),
    });
  }
  return out;
}

/**
 * Pack spine frames into the raw payload for a `RGBAFormat / HalfFloatType`
 * DataTexture of height 4 (one row per shader layer: 0=position, 1=a, 2=b, 3=c)
 * and width = frames.length (one column per path sample).
 *
 * Layout is bottom-up (row 0 first) to match three.js texture uploads; the shader
 * samples row `r` at v = (r + 0.5) / 4, which lands exactly on texel centres, so
 * vertical LinearFilter never bleeds between layers. Half-float packing mirrors the
 * reference (`MathUtils.toHalfFloat` into a Uint16Array).
 */
export function buildSpineTextureData(frames: readonly SpineFrame[]): Uint16Array {
  const width = frames.length;
  const height = 4;
  const data = new Uint16Array(width * height * 4);

  const writeRow = (row: number, col: number, v: readonly [number, number, number]) => {
    const o = (row * width + col) * 4;
    data[o] = DataUtils.toHalfFloat(v[0]);
    data[o + 1] = DataUtils.toHalfFloat(v[1]);
    data[o + 2] = DataUtils.toHalfFloat(v[2]);
    data[o + 3] = DataUtils.toHalfFloat(1);
  };

  for (let col = 0; col < width; col++) {
    const f = frames[col];
    writeRow(0, col, f.position);
    writeRow(1, col, f.a);
    writeRow(2, col, f.b);
    writeRow(3, col, f.c);
  }
  return data;
}

/**
 * `bendPoint(x, y, z, curvature)` — CPU mirror of the reference arc bend.
 *
 * Maps a flat plane point onto a circular arc about the X axis. `curvature` is
 * the arc angle per unit of `y` (radians per world unit; i.e. `HEIGHT / radius`
 * in the nexus shader, so curvature = 0 → straight, larger → tighter cylinder).
 * The original `x` is preserved; `y`/`z` sweep around the cylinder so that the
 * point keeps its distance (1/curvature) from the axis. When curvature→0 the arc
 * degenerates back to the input (identity).
 */
export function bendPoint(
  x: number,
  y: number,
  z: number,
  curvature: number,
  target = new THREE.Vector3(),
): THREE.Vector3 {
  if (Math.abs(curvature) < 1e-6) {
    return target.set(x, y, z);
  }
  const radius = 1 / curvature;
  const theta = y * curvature;
  // Arc centre displaced so the vertex at y=0 sits at the original z (tangent fit).
  const by = Math.sin(theta) * radius;
  const bz = Math.cos(theta) * radius - radius + z;
  return target.set(x, by, bz);
}

/**
 * Per-card path mapping for the hero ring.
 *
 * The shader computes, per vertex: `mt = (spinePortion * pathSegment + pathOffset)`
 * with `spinePortion = (worldPos.x + spineOffset) / spineLength`. The reference sets
 * pathSegment = 1 and spineLength = curve length, so a card's own 9-unit width maps
 * to 9/94.25 of the closed path — the ring therefore has 9 cards of 34.4deg arc
 * spaced 40deg apart (a 5.6deg gap), which is what the capture shows.
 */
export interface CardPathParams {
  spineLength: number;
  spineOffset: number;
  pathSegment: number;
  /** Static per-card offset along the path (before any idle spin is added). */
  pathOffset: number;
  /** World length of arc the card occupies = cardWidth * pathSegment (9 units). */
  arcLength: number;
  /** World length of the slot the card sits in = spineLength / cardCount (10.47). */
  slotArcLength: number;
}

export function computeCardPathParams(
  spineLength: number,
  cardCount: number,
  index: number,
  cardWidth = 9,
  phase = 0,
): CardPathParams {
  const pathSegment = HERO_SPINE_UNIFORMS.pathSegment;
  return {
    spineLength,
    spineOffset: HERO_SPINE_UNIFORMS.spineOffset,
    pathSegment,
    // reference: `moveAlongCurve(index / cards.length)` on top of the default 0
    pathOffset: phase + index / cardCount,
    arcLength: cardWidth * pathSegment,
    slotArcLength: spineLength / cardCount,
  };
}
