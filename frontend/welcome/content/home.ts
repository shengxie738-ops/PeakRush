/** PeakRush storefront content. Scene IDs and display geometry stay stable. */
import displayHeadingsRaw from './displayHeadings.json';
import selectedLiquidSvg from './selected-liquid.svg?raw';
import newArrivalsLiquidSvg from './new-arrivals-liquid.svg?raw';
import { PRODUCT_CATALOG, productCard, productPhoto } from './productCatalog';

export { productCard, productPhoto };
export const IMG = {
  heroCard: productCard, nexusCard: (n: number) => `/peakrush/nexus-product-${n === 1 ? 1 : 3}.png`,
  videoPreview: '/peakrush/shopping-scene.png',
  mediaPlay: '/images/common/media-play.svg', usdCurrency: '/peakrush/yuan.svg',
  line: '/images/landing/common/line.svg', helix: '/images/landing/common/helix-decoration.svg',
  the: '/peakrush/selected.svg', star: '/images/landing/common/star.svg',
  promoArrow: '/images/landing/common/promo-arrow.svg', cross: '/images/landing/4.follow-art/cross.svg',
  speechBalloon: '/images/landing/9.testimonials/speech-balloon.svg', usWord: '/peakrush/rush.svg',
  person: productPhoto, trail: productPhoto, connectoryImage: '/peakrush/collection-wide.png', review: productPhoto,
} as const;
export const IMAGE_TRAIL_ORDER = [1, 6, 3, 8, 5, 2, 9, 4, 7, 10] as const;
export interface DisplaySvg { class: string; html: string; bytes: number }
const DISPLAY_HEADINGS = displayHeadingsRaw as unknown as Record<string, DisplaySvg | string>;
const DISPLAY_COPY: Record<string, string[]> = {
  'follow-art': ['PEAKRUSH'], card: ['限时好物'], testimonials: ['精选好物'], connectory: ['好物上新'],
  'join-us': ['即刻', '开抢'], 'about-title': ['关于', '我们'], 'product-intro': ['抢购指南'],
  'pricing-title': ['活动规则'], 'gift-card-title': ['好物清单'],
  'signin-wordmark': ['PEAKRUSH'], 'signup-wordmark': ['PEAKRUSH'],
};
/** Keep original SVG canvas sizes so the existing title animation is preserved. */
export function displaySvg(key: string): DisplaySvg | null {
  const entry = DISPLAY_HEADINGS[key];
  if (!entry || typeof entry === 'string') return null;
  const lines = DISPLAY_COPY[key];
  if (!lines) return entry;
  if (key === 'testimonials' || key === 'connectory') {
    const html = key === 'testimonials' ? selectedLiquidSvg : newArrivalsLiquidSvg;
    return { ...entry, html, bytes: html.length };
  }
  const match = entry.html.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  const width = Number(match?.[1] ?? 1420), height = Number(match?.[2] ?? 500);
  // Preserve the display face's natural proportions for the two-tone title.
  if (key === 'card') {
    const canvasHeight = 360;
    const fontSize = width * .82 / 3.2; // Four 0.8em Chinese glyphs in the display face.
    const html = `<svg class="${entry.class}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${canvasHeight}" aria-hidden="true"><text x="${width / 2}" y="${canvasHeight * .86}" text-anchor="middle" font-size="${fontSize}"><tspan>限时</tspan><tspan class="peakrush-title__outline">好物</tspan></text></svg>`;
    return { ...entry, html, bytes: html.length };
  }
  const latin = lines[0] === 'PEAKRUSH';
  const font = latin ? 'Hardbop, Arial Black, sans-serif' : 'Microsoft YaHei, PingFang SC, sans-serif';
  const rowHeight = height / lines.length;
  const text = lines.map((line, i) => `<text x="${width * .015}" y="${rowHeight * (i + .85)}" font-family="${font}" font-weight="900" font-size="${rowHeight * (latin ? 1.2 : .82)}" textLength="${width * .97}" lengthAdjust="spacingAndGlyphs">${line}</text>`).join('');
  const fill = entry.html.match(/fill="(white|black|#[\da-fA-F]{3,8})"/)?.[1] ?? 'currentColor';
  const html = `<svg class="${entry.class}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" fill="${fill}" aria-hidden="true">${text}</svg>`;
  return { ...entry, html, bytes: html.length };
}
export const HERO = {
  sectionId: 'home.hero', accessibleTitle: 'PeakRush 好物准点开抢', word: 'PeakRush',
  footerLines: ['这一刻，好物开抢。', '限时限量，心动好价。', '让热爱准点相遇'] as const, cardCount: 9,
} as const;
export const GET_SEEN = {
  sectionId: 'home.get-seen', headingWords: ['好物', '开抢'] as const, headingAccessible: '好物开抢',
  bullets: ['选好心动商品。', '关注开抢时间。', '查看抢购结果。'] as const,
  revealWord: '准点相遇', descriptionTail: '，让每一份期待都有回应。',
  mediaTitle: ['开启', 'PeakRush', '抢购之旅'] as const, playLabel: '查看抢购流程', modalTitle: '开启你的抢购之旅',
} as const;
export const CARD = {
  sectionId: 'home.card', titleKey: 'card', accessibleTitle: '限时好物', description1: '好产品，值得这一刻的心动。',
  description2: '从随身数码到日常好物，发现生活里的新灵感。进入商城查看场次、价格与剩余库存，开抢时间和购买结果以活动页面为准。',
  joinAriaLabel: '进入 PeakRush 商城，查看限时抢购商品',
} as const;
export const CENTRALIZE = {
  sectionId: 'home.centralize', headingWords: ['准点', '开抢'] as const, headingAccessible: '准点开抢',
  revealWord: '简单四步', descriptionTail: '，把心动变成订单。', subhead: '从发现好物，到查看结果，每一步都清晰。',
  cards: [
    { index: '1', theme: 'light', image: '/peakrush/guide/step-login-white.webp', front: ['登录', '账号'] as const, back: '登录 PeakRush 账号，准备好你的抢购之旅。' },
    { index: '2', theme: 'dark', image: '/peakrush/guide/step-session.webp', front: ['选好', '场次'] as const, back: '查看活动时间、商品价格和限购规则，选好心动商品。' },
    { index: '3', theme: 'dark', image: '/peakrush/guide/step-rush.webp', front: ['准点', '抢购'] as const, back: '活动开启后提交抢购，等待系统返回处理结果。' },
    { index: '4', theme: 'light', image: '/peakrush/guide/step-order-white.webp', front: ['查看', '订单'] as const, back: '抢购成功后进入我的订单，在有效时间内完成模拟支付。' },
  ] as const,
} as const;
export interface AudienceMember { name: string; role: string; photo: string }
export const AUDIENCE_MEMBERS: readonly AudienceMember[] = PRODUCT_CATALOG;
export const AUDIENCE = {
  sectionId: 'home.audience', headingWords: ['心动', '好价'] as const, headingAccessible: '心动好价',
  subDescription: '数码、服饰、运动、影像。把喜欢的好物，带进每一个日常。',
  revealWord: '限时限量', descriptionTail: '，每场活动都有自己的开抢时间。商品价格、库存与限购条件，请以商城实时信息为准。', loopGroups: 2,
} as const;
export const TESTIMONIALS = {
  sectionId: 'home.testimonials', titleKey: 'testimonials', accessibleTitle: '精选好物',
  description: '让日常，多一点心动。', cardCount: 8, prev: '上一件好物', next: '下一件好物',
} as const;
export const CONNECTORY = {
  sectionId: 'home.connectory', titleKey: 'connectory', accessibleTitle: '好物上新', subtitle: '发现新好物，期待下一场。',
  revealWord: '下一场', description1Lead: '关注', description1Tail: '，让喜欢的好物准点相遇。',
  description2: ['进入商城查看当前活动与后续场次，找到适合自己的生活好物。', '开抢时间、商品价格和剩余库存，以活动详情为准。'] as const,
} as const;
export const JOIN = {
  sectionId: 'home.join', titleKey: 'join-us', accessibleTitle: '即刻开抢', revealWord: '这一刻',
  descriptionTail: '，和好物相遇。你的心动之选，就在 PeakRush。', button: '进入商城', to: '/app/',
  srLabel: '进入 PeakRush 限时抢购商城', ariaLabel: '进入 PeakRush 商城，查看商品与抢购场次',
} as const;
export interface NavItem { label: string; to: string }
export const HEADER = {
  logo: 'PeakRush', tagline: '让好物与热爱，准点相遇。',
  nav: [
    { label: '关于我们', to: '/about' }, { label: '抢购指南', to: '/our-product' },
    { label: '活动预告', to: '/community-board' }, { label: '活动规则', to: '/pricing' }, { label: '常见问题', to: '/faq' },
  ] as readonly NavItem[],
  login: { label: '登录', to: '/signin' } as NavItem, join: { label: '注册', to: '/signup' } as NavItem,
  menuLabel: '菜单', menuAnchor: '#menu',
} as const;
export const EXTERNAL = {
  brandKit: '/our-product', instagram: '/app/', linkedin: '/app/orders', youtube: '/our-product',
  substack: '/community-board', facebook: '/faq', email: '/faq', videinfra: '/about',
} as const;
export const FOOTER = {
  nav: [
    { label: '抢购指南', to: '/our-product' }, { label: '好物清单', to: '/gift-card' },
    { label: '平台使用规则', to: '/terms-and-conditions' }, { label: '隐私说明', to: '/privacy-policy' }, { label: '存储说明', to: '/cookies-policy' },
  ] as const,
  copyright: '© PeakRush', email: '常见问题', madeBy: 'PeakRush · 好物准点开抢', madeByTitle: '了解 PeakRush',
  social: [] as {icon: string; label: string; href: string}[],
} as const;
export const COOKIE = {
  dialogLabel: '站点存储提示', text: '本站使用本地存储维持登录状态，详情见', link: '存储说明', linkTo: '/cookies-policy', deny: '关闭', accept: '知道了',
} as const;
export const SEO = {
  title: 'PeakRush | 好物准点开抢', description: 'PeakRush 限时抢购，让好物与热爱准点相遇。发现心动商品，查看抢购场次与订单。',
} as const;
