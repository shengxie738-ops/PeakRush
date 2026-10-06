/**
 * Shared harness for the WebGL unit specs.
 *
 * jsdom has no WebGL, so `new THREE.WebGLRenderer({ canvas })` throws inside
 * `WebGLHost`'s try/catch and the host goes `dead` — exactly the fail-soft path the
 * scenes must survive (state is still applied, only drawing is skipped). `muteWebglLogs`
 * keeps the expected diagnostics out of a green run.
 */
export function stubCanvasContext(): void {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
}

const NOISY = ['THREE.WebGLRenderer: Error creating WebGL context', '[webgl] renderer init failed'];

export function muteWebglLogs(): () => void {
  const real = console.error;
  console.error = (...args: unknown[]) => {
    const text = String(args[0] ?? '');
    if (NOISY.some((needle) => text.includes(needle))) return;
    real(...args);
  };
  return () => {
    console.error = real;
  };
}
