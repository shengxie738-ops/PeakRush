/** PeakRush 品牌与购物流程，沿用原页面的滚动分层结构。 */
export interface AboutBlock {
  title: string;
  body: readonly string[];
}

export const ABOUT_BLOCKS: readonly AboutBlock[] = [
  {
    title: 'PeakRush 巅峰抢购',
    body: ['把期待已久的好物，放进一场限时抢购。PeakRush 将商品、场次与订单集中在同一个购物入口，让每一步都清楚可见。', '从数码装备到日常好物，先了解商品，再选择适合自己的抢购场次。'],
  },
  {
    title: '好物，值得等一场',
    body: ['抢购有明确的开始时间，也有有限的活动库存。提前查看场次、商品与活动价格，开抢时再提交请求；是否成功，以商城返回的结果为准。'],
  },
  {
    title: '从浏览到订单',
    body: ['登录账户，选择场次，提交抢购，查看订单。成功生成订单后，可以在项目的模拟支付流程中体验后续操作。'],
  },
  {
    title: '先看指南',
    body: ['第一次参加？在[抢购指南](/our-product)中了解准备、开抢与订单跟进的完整步骤。'],
  },
  {
    title: '了解活动',
    body: ['在[活动规则](/pricing)中查看参与说明。实际场次时间、库存与成交价格，请以商城当前展示为准。'],
  },
] as const;

export const ABOUT_MEDIA = {
  playIcon: '/assets/decor/promo-arrow.svg',
  stars: ['/assets/decor/star-white.svg', '/assets/decor/star-white.svg'] as const,
  previews: ['/peakrush/shopping-scene.png'] as readonly string[],
  videoAvailable: false,
} as const;

export interface TeamMember {
  name: string;
  role: string;
  email: string;
  photo: string;
  detail: string;
}

/** 保留卡片与展开动效，将人物卡片转换为购物步骤。 */
export const TEAM: readonly TeamMember[] = [
  { name: '发现好物', role: '从需求出发，选择喜欢的商品', email: '', photo: '/peakrush/photo-1.png', detail: '先看商品介绍与活动信息，再决定是否参与。适合自己的好物，才值得加入清单。' },
  { name: '选好场次', role: '确认开始时间与活动状态', email: '', photo: '/peakrush/photo-2.png', detail: '进入商城查看场次安排。未开始、进行中与已结束的场次，参与状态各不相同。' },
  { name: '看清库存', role: '限时限量，售完即止', email: '', photo: '/peakrush/photo-3.png', detail: '活动库存有限。页面展示供选择参考，最终抢购结果以系统返回为准。' },
  { name: '提前登录', role: '使用账户参与抢购', email: '', photo: '/peakrush/photo-1.png', detail: '在开抢前完成注册或登录。准备好账户，再进入想参加的场次。' },
  { name: '提交抢购', role: '开抢后提交，等待结果', email: '', photo: '/peakrush/photo-2.png', detail: '在活动有效时间内提交抢购。等待返回结果，避免连续重复操作。' },
  { name: '查看订单', role: '在订单页确认抢购结果', email: '', photo: '/peakrush/photo-3.png', detail: '抢购成功后前往订单页，确认商品、金额与订单状态。' },
  { name: '模拟支付', role: '体验订单支付流程', email: '', photo: '/peakrush/shopping-scene.png', detail: '当前项目提供模拟支付。按订单页面提示完成体验，并再次确认订单状态。' },
] as const;

export const PARTNER_LOGOS = {
  directory: '/peakrush/',
  available: ['photo-1.png', 'photo-2.png', 'photo-3.png'] as readonly string[],
  labels: ['无线耳机', '智能手表', '便携相机'] as readonly string[],
  desktopRow: 1,
  mobileRows: 2,
} as const;

export const ABOUT_DECORATIONS = { partnersHelix: '/assets/decor/helix-decoration.svg' } as const;
export const ABOUT_OVERLAY_CLASS = 'about-team-card--overlay';
export const ABOUT_PAGE = {
  path: '/about',
  heading: '关于我们',
  themes: ['pink', 'blue', 'green'] as const,
  teamHeading: '购物流程',
  partnersHeading: '好物，为生活加分',
  socials: [] as readonly { icon: string; label: string; href: string }[],
} as const;
