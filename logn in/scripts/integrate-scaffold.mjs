import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';

const SECTION_IDS = {
  'HomeHero.vue': 'home.hero',
  'HomeGetSeen.vue': 'home.get-seen',
  'HomeCard.vue': 'home.card',
  'HomeCentralize.vue': 'home.centralize',
  'HomeAudience.vue': 'home.audience',
  'HomeTestimonials.vue': 'home.testimonials',
  'HomeConnectory.vue': 'home.connectory',
  'HomeJoinUs.vue': 'home.join',
};

let patched = 0;
for (const [file, id] of Object.entries(SECTION_IDS)) {
  const p = 'src/features/home/' + file;
  let s = readFileSync(p, 'utf8');
  if (s.includes('data-section-id')) continue;
  const marker = '<section ref="root"';
  if (!s.includes(marker)) { console.log('SKIP (no root marker): ' + file); continue; }
  s = s.replace(marker, '<section ref="root" data-section-id="' + id + '"');
  writeFileSync(p, s);
  patched++;
}

const iconSrc = 'evidence/reference/raw/_nuxt/icons.g7tMF2ID.svg';
if (existsSync(iconSrc)) {
  copyFileSync(iconSrc, 'public/icons.svg');
  const raw = readFileSync(iconSrc, 'utf8');
  const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const safe = inner.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  const reg = 'src/content/assetRegistry.ts';
  let rs = readFileSync(reg, 'utf8');
  if (rs.includes('__ICON_SPRITE_PLACEHOLDER__')) {
    rs = rs.replace(/`__ICON_SPRITE_PLACEHOLDER__`/, '`' + safe + '`');
    writeFileSync(reg, rs);
    console.log('ICON_SPRITE inlined: ' + inner.length + ' chars');
  } else console.log('ICON_SPRITE already real');
} else console.log('icons sprite missing');

const PAGES = {
  HomePage: {
    theme: null,
    body: `    <HomeHero />
    <HomeGetSeen />
    <HomeCard />
    <HomeCentralize />
    <HomeAudience />
    <HomeTestimonials />
    <HomeConnectory />
    <HomeJoinUs />
    <SiteFooter />`,
    imports: `import HomeHero from '@/features/home/HomeHero.vue';
import HomeGetSeen from '@/features/home/HomeGetSeen.vue';
import HomeCard from '@/features/home/HomeCard.vue';
import HomeCentralize from '@/features/home/HomeCentralize.vue';
import HomeAudience from '@/features/home/HomeAudience.vue';
import HomeTestimonials from '@/features/home/HomeTestimonials.vue';
import HomeConnectory from '@/features/home/HomeConnectory.vue';
import HomeJoinUs from '@/features/home/HomeJoinUs.vue';
import SiteFooter from '@/components/SiteFooter.vue';`,
  },
};

const SUB = [
  ['AboutPage', 'about', 'ABOUT', 'about.ts'],
  ['ProductPage', 'our-product', 'PRODUCT', 'product.ts'],
  ['PricingPage', 'pricing', 'PRICING', 'pricing.ts'],
  ['FaqPage', 'faq', 'FAQ', 'faq.ts'],
];

mkdirSync('src/pages', { recursive: true });
writeFileSync('src/pages/HomePage.vue', `<script setup lang="ts">
/**
 * HomePage — the 8 measured sections of docs/DOM_CONTRACT.md, in reference order.
 * Heights at 1376x772: 1544, 1544, 2123, 1544, 1544, 1544, 2316, 808 (total 7563).
 */
${PAGES.HomePage.imports}
</script>

<template>
${PAGES.HomePage.body}
</template>
`);

for (const [name, slug, dataKey, module] of SUB) {
  writeFileSync('src/pages/' + name + '.vue', `<script setup lang="ts">
/**
 * ${name} — /${slug}. Template shell is real; section content beyond the shared
 * header/footer still needs its own T00 capture pass (see
 * evidence/reference/pending.json), so the content region is marked rather than invented.
 */
import SiteFooter from '@/components/SiteFooter.vue';
import { ${dataKey} } from '@/content/${module.replace('.ts', '')}';
</script>

<template>
  <section class="ui-orange" data-section-id="${slug}" data-page-header-theme="orange">
    <div class="section">
      <h1 class="display-heading">{{ ${dataKey}.title ?? '${dataKey}' }}</h1>
      <p class="subheading">{{ ${dataKey}.lead ?? '' }}</p>
      <div data-evidence="pending-T00-subpage">
        <p>Layout for /${slug} awaits its own reference capture pass.</p>
      </div>
    </div>
  </section>
  <SiteFooter />
</template>
`);
}

writeFileSync('src/pages/LegalPage.vue', `<script setup lang="ts">
/**
 * LegalPage — one template for /terms-and-conditions, /privacy-policy and
 * /cookies-policy, selected by the route prop. The legal TEXT is the reference's
 * own wording; it does not make this local clone a party to it.
 */
import { computed } from 'vue';
import SiteFooter from '@/components/SiteFooter.vue';
import { LEGAL_DOCUMENTS, CLONE_LOCAL_NOTES } from '@/content/legal';

const props = defineProps<{ document: 'terms-and-conditions' | 'privacy-policy' | 'cookies-policy' }>();
const doc = computed(() => LEGAL_DOCUMENTS[props.document]);
</script>

<template>
  <section class="ui-light" :data-section-id="props.document" data-page-header-theme="light">
    <div class="section legal-section">
      <h1 class="display-heading">{{ doc?.title ?? props.document }}</h1>
      <div class="legal-body" data-evidence="pending-T00-subpage">
        <p v-for="(para, i) in doc?.paragraphs ?? []" :key="i">{{ para }}</p>
      </div>
      <p class="legal-note">{{ CLONE_LOCAL_NOTES }}</p>
    </div>
  </section>
  <SiteFooter />
</template>
`);

writeFileSync('src/pages/SignInPage.vue', `<script setup lang="ts">
/**
 * SignInPage — local demo only. No network request is ever made, nothing is
 * persisted, and the demo notice stays visible (plan §13.4).
 */
import { ref } from 'vue';
import SiteFooter from '@/components/SiteFooter.vue';
const email = ref('');
const password = ref('');
const status = ref<'idle' | 'checking' | 'demo-ok'>('idle');
function submit(): void {
  status.value = email.value && password.value ? 'demo-ok' : 'idle';
}
</script>

<template>
  <section class="ui-light" data-section-id="signin" data-page-header-theme="light">
    <div class="section auth-section">
      <h1 class="display-heading">Log in</h1>
      <p class="demo-notice" role="note">Local demo — this clone is not the real FOLLOW.ART service. Credentials are never sent or stored.</p>
      <form class="auth-form" @submit.prevent="submit">
        <label>Email <input v-model="email" type="email" autocomplete="off" name="demo-email" /></label>
        <label>Password <input v-model="password" type="password" autocomplete="off" name="demo-password" /></label>
        <button type="submit">Log in</button>
      </form>
      <p v-if="status === 'demo-ok'" data-evidence="pending-T00-subpage">Demo only: no account exists here.</p>
    </div>
  </section>
  <SiteFooter />
</template>
`);

writeFileSync('src/pages/SignUpPage.vue', `<script setup lang="ts">
/** SignUpPage — local demo only; steps still need their T00 capture. */
import SiteFooter from '@/components/SiteFooter.vue';
</script>

<template>
  <section class="ui-orange" data-section-id="signup" data-page-header-theme="orange">
    <div class="section auth-section">
      <h1 class="display-heading">Join FOLLOW.ART</h1>
      <p class="demo-notice" role="note">Local demo — no account is created and nothing is submitted.</p>
      <div data-evidence="pending-T00-subpage"><p>The reference signup steps still need a capture pass.</p></div>
    </div>
  </section>
  <SiteFooter />
</template>
`);

writeFileSync('src/pages/GiftCardPage.vue', `<script setup lang="ts">
/** GiftCardPage — public presentation only; the buy action stops at a local echo. */
import { ref } from 'vue';
import SiteFooter from '@/components/SiteFooter.vue';
const acknowledged = ref(false);
</script>

<template>
  <section class="ui-pink" data-section-id="gift-card" data-page-header-theme="pink">
    <div class="section gift-section">
      <h1 class="display-heading">Gift Card</h1>
      <p class="demo-notice" role="note">Local demo — no purchase is made.</p>
      <button type="button" @click="acknowledged = true">Buy Gift Card</button>
      <p v-if="acknowledged" data-evidence="pending-T00-subpage">Demo confirmation only.</p>
    </div>
  </section>
  <SiteFooter />
</template>
`);

writeFileSync('src/pages/CommunityPage.vue', `<script setup lang="ts">
/** CommunityPage — /community-board. Needs its own capture pass for card density. */
import SiteFooter from '@/components/SiteFooter.vue';
</script>

<template>
  <section class="ui-green" data-section-id="community-board" data-page-header-theme="green">
    <div class="section community-section">
      <h1 class="display-heading">Community Board</h1>
      <div data-evidence="pending-T00-subpage"><p>List layout awaits the reference capture pass.</p></div>
    </div>
  </section>
  <SiteFooter />
</template>
`);

writeFileSync('src/pages/NotFoundPage.vue', `<script setup lang="ts">
/** NotFoundPage — clone-local error page; the reference 404 was not captured, so
 *  this is explicitly not claimed to match it. */
import { RouterLink } from 'vue-router';
import SiteFooter from '@/components/SiteFooter.vue';
</script>

<template>
  <section class="ui-orange" data-section-id="not-found" data-page-header-theme="orange">
    <div class="section error-section">
      <h1 class="display-heading">Page Not Found</h1>
      <RouterLink class="button button--primary" to="/">Go to homepage</RouterLink>
      <p data-evidence="pending-T00-subpage">Clone-local error page; reference 404 not yet captured.</p>
    </div>
  </section>
  <SiteFooter />
</template>
`);

console.log('sections patched: ' + patched + '; pages: ' + ['HomePage', ...SUB.map((s) => s[0]), 'LegalPage', 'SignInPage', 'SignUpPage', 'GiftCardPage', 'CommunityPage', 'NotFoundPage'].join(', '));
