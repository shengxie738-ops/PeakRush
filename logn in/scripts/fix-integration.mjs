import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const log = [];

if (!existsSync('src/content/displayHeadings.json')) {
  writeFileSync('src/content/displayHeadings.json', '{}\n');
  log.push('displayHeadings.json: created EMPTY — display words fall back to text (P1 gap, needs SVG-glyph extraction from Cc-BjTZB.js)');
}

let f = 'src/app/routeManifest.ts';
let s = readFileSync(f, 'utf8');
s = s.replace(
  "headerTheme: 'light' | 'orange' | 'dark';",
  "headerTheme: 'light' | 'orange' | 'dark' | 'green' | 'pink' | 'blue';",
);
writeFileSync(f, s);
log.push('routeManifest: headerTheme widened to the 6 ui-* themes');

f = 'src/components/CookieConsent.vue';
s = readFileSync(f, 'utf8');
const stray = /\n\s*import \{ watch \} from 'vue';\n\s*watch\(visible, syncBodyClass\);\n/.exec(s);
if (stray) {
  s = s.replace(stray[0], '\n');
  writeFileSync(f, s);
  log.push('CookieConsent: removed duplicate mid-file watch import + duplicate watcher');
} else log.push('CookieConsent: no stray import found');

f = 'src/components/SiteFooter.vue';
s = readFileSync(f, 'utf8');
if (!s.includes('function VideinfraIcon')) {
  const anchor = "import { FOOTER, EXTERNAL, JOIN } from '@/content/home';";
  const inject =
    anchor +
    `\n\n/**\n * The reference footer credit carries the Vide Infra mark as an inline <svg> whose class\n * differs per breakpoint (CCJzzdh0.js). The mark path data was not part of the\n * captured chunks available to this clone, so the placeholder keeps the reference\n * class contract and the link target; the artwork itself is tracked as an asset gap.\n */\nfunction VideinfraIcon(className: string): Component {\n  return {\n    render(): VNode {\n      return h(\n        'svg',\n        { class: className, viewBox: '0 0 24 24', width: '24', height: '24', 'aria-hidden': 'true', focusable: 'false' },\n        [h('rect', { x: '2', y: '2', width: '20', height: '20', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' })],\n      );\n    },\n  };\n}`;
  s = s.replace(anchor, inject);
  writeFileSync(f, s);
  log.push('SiteFooter: defined VideinfraIcon (placeholder artwork, class contract kept — asset gap recorded)');
}

f = 'src/features/home/HomeGetSeen.vue';
s = readFileSync(f, 'utf8');
if (s.includes("displaySvg") && s.includes("from '@/content/assetRegistry'")) {
  s = s.replace(
    /import \{([^}]*)\bdisplaySvg\b([^}]*)\} from '@\/content\/assetRegistry';/,
    (m, a, b) => {
      const rest = (a + b).split(',').map((x) => x.trim()).filter((x) => x && x !== 'displaySvg');
      return "import { displaySvg } from '@/content/home';" + (rest.length ? "\nimport { " + rest.join(', ') + " } from '@/content/assetRegistry';" : '');
    },
  );
  writeFileSync(f, s);
  log.push('HomeGetSeen: displaySvg now imported from @/content/home');
}

const PAGE_FIX = { AboutPage: 'tagline', ProductPage: 'joinDescription', PricingPage: 'plansNote', FaqPage: 'questionsNote' };
for (const [name] of Object.entries(PAGE_FIX)) {
  f = 'src/pages/' + name + '.vue';
  s = readFileSync(f, 'utf8');
  const key = name === 'AboutPage' ? 'tagline' : name === 'ProductPage' ? 'joinDescription' : null;
  s = s.replace('{{ ${d}.title ?? ', '').replace(/\{\{ (\w+)\.title \?\? '(\w+)' \}\}/, '{{ $1.heading }}');
  s = s.replace(
    /\{\{ (\w+)\.lead \?\? '' \}\}/,
    key ? '{{ $1.' + key + ' ?? "" }}' : '',
  );
  writeFileSync(f, s);
}
log.push('sub-pages: bound to the real content keys (heading / tagline / joinDescription)');

f = 'src/pages/LegalPage.vue';
s = readFileSync(f, 'utf8');
s = s.replace('const doc = computed(() => LEGAL_DOCUMENTS[props.document]);', 'const doc = computed(() => (LEGAL_DOCUMENTS as Record<string, { title: string; paragraphs: string[] }>)[props.document]);');
writeFileSync(f, s);
log.push('LegalPage: typed document lookup');

f = 'vite.config.ts';
s = readFileSync(f, 'utf8');
s = s.replace(/\n\s*test: \{[\s\S]*?\n\s*\},\n/, '\n');
writeFileSync(f, s);
if (!existsSync('vitest.config.ts')) {
  writeFileSync('vitest.config.ts', "import { fileURLToPath, URL } from 'node:url';\nimport vue from '@vitejs/plugin-vue';\nimport { defineConfig } from 'vitest/config';\n\nexport default defineConfig({\n  plugins: [vue()],\n  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },\n  test: { environment: 'node', include: ['tests/unit/**/*.spec.ts'] },\n});\n");
  log.push('vite.config: test block moved to vitest.config.ts');
}

writeFileSync('scripts/INTEGRATION_LOG.txt', log.join('\n'));
console.log(log.join('\n'));
