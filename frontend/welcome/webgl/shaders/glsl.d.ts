/**
 * createWebGLScene shader asset module declaration.
 * More specific than vite/client's `*?raw`; used for the ported GLSL.
 */
declare module '*.glsl?raw' {
  const source: string;
  export default source;
}
