/**
 * routeManifest.ts — the 12 internal routes measured from live `a[href]` on the
 * reference (docs/DOM_CONTRACT.md, "Routes (12 internal, measured from live a[href])").
 *
 * PeakRush titles and descriptions are paired with the existing route paths.
 * `headerTheme` is the `data-page-header-theme` value the fixed bar starts with.
 */
export interface RouteMeta {
  path: string;
  name: string;
  /** Chinese page title with PeakRush branding. */
  title: string;
  description: string;
  headerTheme: 'light' | 'orange' | 'dark' | 'green' | 'pink' | 'blue';
  /** PagePromoHeader defaultExpanded — the reference passes it on the home page. */
  headerExpanded?: boolean;
  file: string;
}

export const ROUTE_MANIFEST: readonly RouteMeta[] = [
  {
    path: '/',
    name: 'home',
    title: 'PeakRush | 好物准点开抢',
    description:
      'PeakRush 限时抢购，让好物与热爱准点相遇。发现心动商品，查看抢购场次与订单。',
    headerTheme: 'orange',
    headerExpanded: true,
    file: 'HomePage.vue',
  },
  {
    path: '/about',
    name: 'about',
    title: '关于我们 | PeakRush',
    description: '了解 PeakRush，让好物与热爱准点相遇。',
    headerTheme: 'orange',
    file: 'AboutPage.vue',
  },
  {
    path: '/our-product',
    name: 'our-product',
    title: '抢购指南 | PeakRush',
    description: '了解登录账号、选择场次、参与抢购和查看订单的流程。',
    headerTheme: 'green',
    file: 'ProductPage.vue',
  },
  {
    path: '/community-board',
    name: 'community-board',
    title: '活动预告 | PeakRush',
    description: '关注 PeakRush 限时抢购活动，发现下一场心动好物。',
    headerTheme: 'green',
    file: 'CommunityPage.vue',
  },
  {
    path: '/pricing',
    name: 'pricing',
    title: '活动规则 | PeakRush',
    description: '查看 PeakRush 抢购活动的参与条件、限购规则和订单说明。',
    headerTheme: 'pink',
    file: 'PricingPage.vue',
  },
  {
    path: '/faq',
    name: 'faq',
    title: '常见问题 | PeakRush',
    description: '解答账号、抢购场次、处理结果和订单相关的常见问题。',
    headerTheme: 'light',
    file: 'FaqPage.vue',
  },
  {
    path: '/signin',
    name: 'signin',
    title: '登录 | PeakRush',
    description: '登录 PeakRush 账号，继续你的抢购之旅。',
    headerTheme: 'light',
    file: 'SignInPage.vue',
  },
  {
    path: '/signup',
    name: 'signup',
    title: '注册 | PeakRush',
    description: '创建 PeakRush 账号，让热爱与好价相遇。',
    headerTheme: 'orange',
    file: 'SignUpPage.vue',
  },
  {
    path: '/gift-card',
    name: 'gift-card',
    title: '好物清单 | PeakRush',
    description: '发现 PeakRush 精选好物，进入商城查看实时商品与抢购场次。',
    headerTheme: 'pink',
    file: 'GiftCardPage.vue',
  },
  {
    path: '/terms-and-conditions',
    name: 'terms-and-conditions',
    title: '平台使用规则 | PeakRush',
    description: '了解 PeakRush 平台的账号、活动和订单使用规则。',
    headerTheme: 'light',
    file: 'LegalPage.vue',
  },
  {
    path: '/privacy-policy',
    name: 'privacy-policy',
    title: '隐私说明 | PeakRush',
    description: '了解 PeakRush 处理账号与订单相关信息的方式。',
    headerTheme: 'light',
    file: 'LegalPage.vue',
  },
  {
    path: '/cookies-policy',
    name: 'cookies-policy',
    title: '存储说明 | PeakRush',
    description: '了解 PeakRush 使用浏览器存储维持登录状态的方式。',
    headerTheme: 'light',
    file: 'LegalPage.vue',
  },
] as const;

export const NOT_FOUND_TITLE = '页面未找到 | PeakRush';

export function routeMetaFor(path: string): RouteMeta | undefined {
  return ROUTE_MANIFEST.find((entry) => entry.path === path);
}
