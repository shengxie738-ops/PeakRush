/**
 * textureRegistry.ts — ref-counted, colour-managed image loading.
 *
 * Scenes acquire textures by URL and color mode; the registry loads each pair once,
 * hands out the shared THREE.Texture for that pair, and only disposes it when the last owner
 * releases it (route changes / dispose).
 *
 * COLOUR MANAGEMENT — the two modes are both taken from the reference, and mixing
 * them up is what shifts the card artwork:
 *   • `srgb`   — hero card maps. The captured hero fragment shader ends with
 *                `gl_FragColor = linearToOutputTexel(gl_FragColor)` (the sRGB OETF),
 *                and the reference sets `texture.colorSpace = SRGBColorSpace` when it
 *                loads those maps (CDL_IiwC.js: `f.loadTexture(p, X => { X.colorSpace = … })`).
 *                Hardware decode on sample + shader encode on output = one round trip,
 *                so the artwork keeps its authored colours.
 *   • `none`   — nexus / get-seen maps. Their captured shaders emit
 *                `gl_FragColor = texture2D(imageTexture, uv)` with NO encode, so the
 *                texture must be uploaded raw (NoColorSpace). Tagging those sRGB would
 *                decode them with nobody re-encoding → visibly darker artwork.
 *
 * Missing images never throw: a 1×1 white pixel is substituted so the dependent
 * material still compiles and the section keeps a readable static fallback (the DOM
 * placeholder owns layout regardless).
 */
import * as THREE from 'three';

export type TextureColorSpace = 'srgb' | 'none';

export interface AcquireOptions {
  /** Default `srgb` (three's `SRGBColorSpace`); use `none` for shaders with no output encode. */
  colorSpace?: TextureColorSpace;
}

interface TextureEntry {
  texture: THREE.Texture;
  refs: number;
  failed: boolean;
  loaded: boolean;
  colorSpace: TextureColorSpace;
}

function fallbackPixel(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 1;
  c.height = 1;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1, 1);
  }
  return c;
}

export class TextureRegistry {
  private readonly entries = new Map<string, TextureEntry>();
  private readonly loader = new THREE.TextureLoader();

  private key(url: string, options: AcquireOptions): string {
    return JSON.stringify([url, options.colorSpace ?? 'srgb']);
  }

  /** Acquire a shared texture for `url`, incrementing its ref count. */
  acquire(url: string, options: AcquireOptions = {}): THREE.Texture {
    const colorSpace: TextureColorSpace = options.colorSpace ?? 'srgb';
    const key = this.key(url, options);
    const existing = this.entries.get(key);
    if (existing) {
      existing.refs += 1;
      return existing.texture;
    }

    const threeSpace = colorSpace === 'srgb' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    const entry: TextureEntry = {
      refs: 1,
      failed: false,
      loaded: false,
      colorSpace,
      texture: undefined as unknown as THREE.Texture,
    };
    const texture = this.loader.load(
      url,
      (t) => {
        if (this.entries.get(key) !== entry) return;
        entry.loaded = true;
        t.colorSpace = threeSpace;
        t.needsUpdate = true;
      },
      undefined,
      () => {
        if (this.entries.get(key) !== entry) return;
        entry.failed = true;
        texture.image = fallbackPixel();
        texture.needsUpdate = true;
         
        console.warn(`[webgl] texture failed, using 1x1 fallback: ${url}`);
      },
    );
    texture.colorSpace = threeSpace;
    entry.texture = texture;
    this.entries.set(key, entry);
    return texture;
  }

  /** Release one reference; dispose the GPU texture at zero refs. */
  release(url: string, options: AcquireOptions = {}): void {
    const key = this.key(url, options);
    const entry = this.entries.get(key);
    if (!entry) return;
    entry.refs -= 1;
    if (entry.refs <= 0) {
      entry.texture.dispose();
      this.entries.delete(key);
    }
  }

  has(url: string, options: AcquireOptions = {}): boolean {
    return this.entries.has(this.key(url, options));
  }

  ready(url: string, options: AcquireOptions = {}): boolean {
    const entry = this.entries.get(this.key(url, options));
    return !!entry?.loaded && !entry.failed;
  }

  /** Held URLs (empty once every scene has been disposed). */
  held(): string[] {
    return [...new Set([...this.entries.keys()].map((key) => JSON.parse(key)[0] as string))];
  }

  /** Total live references across every held texture. */
  referenceCount(): number {
    let n = 0;
    for (const e of this.entries.values()) n += e.refs;
    return n;
  }

  /** Test/teardown helper: force-release every tracked texture. */
  disposeAll(): void {
    for (const entry of this.entries.values()) {
      entry.texture.dispose();
    }
    this.entries.clear();
  }
}

/** Process-wide registry shared by all scenes on the page. */
export const textureRegistry = new TextureRegistry();
