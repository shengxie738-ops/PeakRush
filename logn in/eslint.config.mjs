import pluginVue from 'eslint-plugin-vue';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';
import pluginJs from '@eslint/js';

/**
 * Flat config for the clone. Rules are deliberately narrow: this project's risk is
 * fabricated evidence and dead code, not style preference, so the gate blocks
 * unused/undefined symbols and the patterns that have already caused real defects
 * here (reaching for the GSAP/ScrollTrigger the reference provably does not ship).
 */
export default defineConfigWithVueTs(
  pluginJs.configs.recommended,
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        window: 'readonly', document: 'readonly', navigator: 'readonly', location: 'readonly',
        history: 'readonly', fetch: 'readonly', console: 'readonly', setTimeout: 'readonly',
        clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
        requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly',
        matchMedia: 'readonly', performance: 'readonly', process: 'readonly', URL: 'readonly',
        Blob: 'readonly', btoa: 'readonly', atob: 'readonly', DOMParser: 'readonly',
        Uint8Array: 'readonly', Float32Array: 'readonly', ArrayBuffer: 'readonly',
        HTMLElement: 'readonly', HTMLImageElement: 'readonly', HTMLCanvasElement: 'readonly',
        PointerEvent: 'readonly', Event: 'readonly', CustomEvent: 'readonly',
        WebGLRenderingContext: 'readonly', WebGL2RenderingContext: 'readonly',
        IntersectionObserver: 'readonly', ResizeObserver: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'vue/multi-word-component-names': 'off',
      'vue/require-default-prop': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/attributes-order': 'off',
      'vue/no-v-html': 'off',
      'vue/html-indent': 'off',
      'vue/first-attribute-linebreak': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/require-explicit-emits': 'off',
    },
  },
  {
    files: ['src/**/*.{ts,vue}'],
    rules: {
      'no-restricted-globals': ['error',
        { name: 'gsap', message: 'The reference ships no GSAP (measured across all 34 captured chunks).' },
        { name: 'ScrollTrigger', message: 'The reference ships no ScrollTrigger; use src/motion/createMotionRuntime.' },
      ],
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    rules: { 'no-undef': 'off' },
  },
  {
    // scripts/bodies/*.body.mjs are page-side function bodies: they are read by
    // scripts/run-page-body.mjs and pasted verbatim into the in-app browser probe, so they are
    // expressions evaluated in a document, not Node modules. `no-unused-expressions` and the
    // browser globals they touch are properties of that transport, not defects.
    // .scratch/ is a per-session dump: logs and throwaway probes, never shipped code.
    ignores: [
      'dist/**',
      'node_modules/**',
      'evidence/**',
      'public/**',
      '**/*.d.ts',
      'src/webgl/shaders/**',
      'src/testing/**',
      'scripts/bodies/**',
      '.scratch/**',
    ],
  },
);
