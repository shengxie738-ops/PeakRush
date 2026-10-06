import { makeView, toPixels } from './hero-math.mjs';

/**
 * hero-ring-projection.mjs — CPU mirror of the FINAL hero scene (same maths as
 * src/webgl/geometry.ts + src/webgl/createCardRing.ts) so the ring can be inspected
 * without a GPU: card screen boxes, how many are on screen, how many survive each
 * depth layer, and the on-screen angle of the band.
 */
const rad = (d) => (d * Math.PI) / 180;
const W = Number(process.env.W ?? 1376), H = Number(process.env.H ?? 772);
const R = 15;
const SPINE_LEN = 512 * 2 * R * Math.sin((Math.PI * 2) / 512 / 2); // three Curve.getLength()
const SPINE_OFFSET = 161;
const PATH_SEGMENT = 1;
const CARD_W = 9, CARD_H = 12.6, COUNT = 9;
const FOV = 29.2518;
const POS = [0, -14, -70];
const rotX = rad(-192);

/** spine frame at path fraction u (reference Frenet frames of the r=15 circle). */
function frame(u) {
  const phi = (((u % 1) + 1) % 1) * Math.PI * 2;
  const sp = Math.sin(phi), cp = Math.cos(phi);
  return { position: [R * cp, 0, R * sp], a: [-sp, 0, cp], b: [0, -1, 0], c: [cp, 0, sp] };
}

function project(progress, spin = 0) {
  const rotZ = rad(-25) + (progress - 0.5) * 0.2;
  const view = makeView(POS, [rotX, 0, rotZ]);
  const f = 1 / Math.tan(rad(FOV) / 2);
  const m00 = f / (W / H);
  const cards = [];
  for (let i = 0; i < COUNT; i++) {
    const pathOffset = i / COUNT + spin;
    const pts = [];
    for (let gx = 0; gx <= 10; gx++) {
      for (let gy = 0; gy <= 4; gy++) {
        const x = (gx / 10) * CARD_W - CARD_W / 2;
        const y = (gy / 4) * CARD_H - CARD_H / 2;
        const mt = (((x + SPINE_OFFSET) / SPINE_LEN) * PATH_SEGMENT + pathOffset) % 1;
        const fr = frame(mt);
        const w = [fr.b[0] * y + fr.position[0], fr.b[1] * y + fr.position[1], fr.b[2] * y + fr.position[2]];
        const v = view(w);
        const z = -v[2];
        pts.push({ sx: ((v[0] * m00) / z / 2 + 0.5) * W, sy: ((-(v[1] * f) / z / 2) + 0.5) * H, z, y });
      }
    }
    const xs = pts.map((p) => p.sx), ys = pts.map((p) => p.sy);
    const front = pts.filter((p) => p.z > 0.1 && p.z < 69);
    const behind = pts.filter((p) => p.z >= 69 && p.z < 200);
    const inFrame = pts.filter((p) => p.sx >= 0 && p.sx <= W && p.sy >= 0 && p.sy <= H);
    cards.push({
      i,
      box: [Math.round(Math.min(...xs)), Math.round(Math.min(...ys)), Math.round(Math.max(...xs)), Math.round(Math.max(...ys))],
      center: [Math.round(xs.reduce((s, v) => s + v, 0) / xs.length), Math.round(ys.reduce((s, v) => s + v, 0) / ys.length)],
      hPct: +(((Math.max(...ys) - Math.min(...ys)) / H) * 100).toFixed(1),
      zMin: +Math.min(...pts.map((p) => p.z)).toFixed(1),
      zMax: +Math.max(...pts.map((p) => p.z)).toFixed(1),
      nearLayer: front.length, farLayer: behind.length, inFrame: inFrame.length, total: pts.length,
    });
  }
  return cards;
}

console.log(`spineLength (three getLength, 512 chords of r=${R}) = ${SPINE_LEN.toFixed(4)}`);
console.log(`canvas ${W}x${H}, fov ${FOV}, rot.x -192deg, rot.z = -25deg + (p-0.5)*0.2rad`);
for (const progress of [0, 0.2215, 0.5, 1]) {
  const cards = project(progress);
  const onScreen = cards.filter((c) => c.inFrame > 0).sort((a, b) => a.center[0] - b.center[0]);
  console.log(`\nprogress=${progress} rotZ=${((rad(-25) + (progress - 0.5) * 0.2) * 180 / Math.PI).toFixed(2)}deg`);
  console.log(`  cards with pixels in frame: ${onScreen.length}  (near-layer frags / far-layer frags)`);
  for (const c of onScreen) {
    console.log(
      `   card ${c.i} box=${JSON.stringify(c.box)} h=${c.hPct}% z=[${c.zMin},${c.zMax}] inFrame=${c.inFrame}/${c.total} A=${c.nearLayer} B=${c.farLayer}`,
    );
  }
}
