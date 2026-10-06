/**
 * createWebGLHost.ts — one WebGLRenderer per <canvas>.
 *
 * The reference genuinely uses 2 canvases for the hero and 1 for every other WebGL
 * section, so the clone mirrors that: a host OWNS exactly one renderer bound to one
 * canvas and never shares it. A controller may therefore hold several hosts (hero = 2)
 * and render a scene into each with its own camera.
 *
 * Responsibilities:
 *  - attach/detach/resize/dispose a renderer against a canvas;
 *  - viewport + scissor helpers that translate a CSS rect (top-left origin) into GL
 *    framebuffer coords (bottom-left origin) — used for the hero's depth-layered
 *    compositing and any sub-region drawing;
 *  - stop drawing when the canvas leaves the viewport (IntersectionObserver) or the
 *    tab is hidden;
 *  - fail soft: if WebGL can't be created the host goes `dead`, render is a no-op and
 *    the DOM placeholder behind the canvas stays readable.
 */
import * as THREE from 'three';

export interface RectCss {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HostOptions {
  antialias?: boolean;
  /** Canvas is decorative: default clear is fully transparent so layers composite. */
  clearAlpha?: number;
  /**
   * Force the drawing-buffer ratio instead of following the device. The reference hero
   * canvases measure CSS 1376x772 with buffer 2752x1544 while `devicePixelRatio` is 1.5,
   * so its renderer is pinned at 2 and is deliberately crisper than the screen.
   */
  fixedPixelRatio?: number;
}

export class WebGLHost {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: THREE.WebGLRenderer | null = null;
  private readonly fixedPixelRatio: number | undefined;

  private disposed = false;
  private dead = false;
  private onScreen = true;
  private docVisible = typeof document !== 'undefined' ? document.visibilityState !== 'hidden' : true;

  private readonly io: IntersectionObserver | null = null;
  private readonly onVisibility = (): void => {
    this.docVisible = document.visibilityState !== 'hidden';
  };

  constructor(canvas: HTMLCanvasElement, opts: HostOptions = {}) {
    this.canvas = canvas;
    this.fixedPixelRatio = opts.fixedPixelRatio;
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: opts.antialias ?? true,
        alpha: true,
        depth: true,
        stencil: false,
        premultipliedAlpha: true,
        powerPreference: 'high-performance',
      });
      // r176 defaults already give SRGBColorSpace output + NoToneMapping; the ported
      // hero shader performs its own OETF, so we must not add a second conversion.
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.NoToneMapping;
      this.renderer.autoClear = true;
      const a = opts.clearAlpha ?? 0;
      this.renderer.setClearColor(0x000000, a);
    } catch (err) {
      this.dead = true;
       
      console.error('[webgl] renderer init failed; canvas stays decorative', err);
    }

    if (typeof IntersectionObserver !== 'undefined') {
      this.io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) this.onScreen = e.isIntersecting;
        },
        { rootMargin: '10% 0px', threshold: 0 },
      );
      this.io.observe(canvas);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibility, { passive: true });
    }
  }

  get isDead(): boolean {
    return this.dead || this.disposed;
  }

  /** Live, on-screen and not disposed — the gate the controller checks before drawing. */
  get shouldDraw(): boolean {
    return !this.dead && !this.disposed && this.renderer !== null && this.onScreen && this.docVisible;
  }

  setSize(cssWidth: number, cssHeight: number, dpr: number): void {
    if (this.isDead || !this.renderer) return;
    const ratio = this.effectivePixelRatio(dpr);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(cssWidth, cssHeight, false);
  }

  /**
   * A host created with `fixedPixelRatio` ignores the device ratio, which is how the
   * reference keeps its hero at a 2x buffer on a 1.5x screen.
   */
  effectivePixelRatio(dpr: number): number {
    if (this.fixedPixelRatio !== undefined) return this.fixedPixelRatio;
    return Math.min(dpr, this.maxPixelRatio());
  }

  private maxPixelRatio(): number {
    return Math.min(window.devicePixelRatio || 1, 2);
  }

  /** Set GL viewport from a CSS-space rect (full canvas by default). */
  setViewport(rect?: RectCss): void {
    if (this.isDead || !this.renderer) return;
    if (!rect) {
      this.renderer.setScissorTest(false);
      // setViewport/setScissor expect CSS-space units (three multiplies by pixelRatio).
      const s = this.renderer.getSize(new THREE.Vector2());
      this.renderer.setViewport(0, 0, s.x, s.y);
      return;
    }
    const { x, y, w, h } = this.toGlRect(rect);
    this.renderer.setViewport(x, y, w, h);
  }

  /** Restrict drawing to a CSS-space rect (used by the hero for per-canvas layers). */
  setScissor(rect?: RectCss): void {
    if (this.isDead || !this.renderer) return;
    if (!rect) {
      this.renderer.setScissorTest(false);
      return;
    }
    const { x, y, w, h } = this.toGlRect(rect);
    this.renderer.setScissorTest(true);
    this.renderer.setScissor(x, y, w, h);
  }

  private toGlRect(rect: RectCss): { x: number; y: number; w: number; h: number } {
    const size = new THREE.Vector2();
    this.renderer!.getSize(size);
    // CSS y is top-down, GL y is bottom-up.
    return {
      x: Math.round(rect.x),
      y: Math.round(size.y - (rect.y + rect.height)),
      w: Math.round(rect.width),
      h: Math.round(rect.height),
    };
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    if (!this.shouldDraw || !this.renderer) return;
    this.renderer.render(scene, camera);
  }

  /** Force a single frame even when off-screen (used for reduced-motion stills). */
  renderOnce(scene: THREE.Scene, camera: THREE.Camera): void {
    if (this.isDead || !this.renderer) return;
    this.renderer.render(scene, camera);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.io) this.io.disconnect();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibility);
    }
    if (this.renderer) {
      this.renderer.dispose();
      const gl = this.renderer.getContext();
      // Nudge the driver to actually free the context on route change.
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    }
  }
}
