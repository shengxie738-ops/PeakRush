/** 抢购指南。内部选项 id 与卡片类名保留，以延续已有动效。 */
import { cycleById, type BillingCycle } from './pricing';
import { productPhoto } from '../productCatalog';

export interface CardPlanPanel {
  cycle: BillingCycle;
  panelClass: string;
  title: string;
  description: readonly string[];
  list: readonly string[];
  unit: string;
  srOnlyPeriod: string;
  ctaVariant: string;
  promoIcon: string | null;
}

export const CARD_PLAN_TAB_ORDER: readonly BillingCycle[] = ['weekly', 'annually', 'monthly'];
export const CARD_PLAN_PANELS: readonly CardPlanPanel[] = [
  {
    cycle: 'weekly',
    panelClass: 'card-plan__panel card-plan__panel--weekly card-plan__panel--light ui-light px-1 py-1.25 py-1:md',
    title: '提前准备',
    description: ['选好商品，也选好场次。', '开抢前了解活动信息，给自己留出准备时间。'],
    list: ['注册或登录 PeakRush 账户', '查看商品介绍与活动价格', '确认场次开始和结束时间', '留意场次状态与限量库存', '根据自己的需求决定参与'],
    unit: '准备', srOnlyPeriod: '提前准备', ctaVariant: 'primary', promoIcon: null,
  },
  {
    cycle: 'annually',
    panelClass: 'card-plan__panel card-plan__panel--annual card-plan__panel--dark ui-dark px-1 pt-1.25 pt-1:md pb-1',
    title: '准时开抢',
    description: ['时间一到，提交抢购。', '限时限量的活动中，清楚的操作与结果同样重要。'],
    list: ['进入已开始的活动场次', '再次确认目标商品与价格', '提交抢购请求', '等待系统返回抢购结果', '库存不足或活动结束时停止参与', '成功后前往订单页确认', '以商城当前状态为准'],
    unit: '开抢', srOnlyPeriod: '准时开抢', ctaVariant: 'secondary', promoIcon: '/assets/decor/subscribe.svg',
  },
  {
    cycle: 'monthly',
    panelClass: 'card-plan__panel card-plan__panel--monthly card-plan__panel--light ui-light px-1 py-1.25 py-1:md',
    title: '订单跟进',
    description: ['抢购结果，在订单中确认。', '从下单到模拟支付，继续完成你的购物体验。'],
    list: ['打开商城订单页面', '核对商品与订单金额', '查看订单当前状态', '按提示体验模拟支付', '完成后重新确认订单状态', '关注页面展示的订单信息'],
    unit: '下单', srOnlyPeriod: '订单跟进', ctaVariant: 'primary', promoIcon: null,
  },
] as const;

export function panelAmount(cycle: BillingCycle): string {
  return { weekly: '01', annually: '02', monthly: '03' }[cycle];
}
export function panelTabFigures(cycle: BillingCycle): { label: string; amount: string; alt: string } {
  return { label: cycleById(cycle).label, amount: panelAmount(cycle), alt: panelAmount(cycle) };
}

export const CARD_PLAN = { title: '抢购三步', subtitle: '先准备，再开抢，最后确认订单', ctaTo: '/app/', ctaText: '进入商城' } as const;
export const PRODUCT_INTRO = {
  heading: '抢购指南',
  tagline: '提前选好物，准时参加限量场次，抢购结果在订单中确认。',
  lines: ['先选好物，', '再等开抢。', '每一步，心中有数。'] as const,
  wordIcon: '/assets/decor/promo-arrow.svg',
  ctaText: '开始抢购',
  ctaAria: '进入 PeakRush 商城，查看商品和抢购场次',
} as const;
export const YOUR_CARD = {
  heading: '准备开抢',
  wordIcon: '/assets/decor/star-white.svg',
  subIcon: '/assets/subpages/nexus-card/time-forward.svg',
  bullets: ['注册或登录账户，让准备先一步', '选好场次，确认时间、价格与库存', '开抢后提交请求，等待明确的结果', '成功生成订单，继续体验模拟支付'] as readonly string[],
  timelineAvailable: false,
  ctaText: '查看场次',
} as const;

export interface UsageSlide { title: string; description: string; color: 'green' | 'orange' | 'pink' | 'blue'; }
export const WHERE_THE_CARD_WORKS = {
  heading: '把期待，变成好物',
  description: '从心动商品，到清楚的订单结果',
  decoration: '/assets/decor/helix-decoration.svg',
  slides: [
    { title: '登录', description: '进入商城，注册或登录账户。参加抢购前先准备好账户，让开抢时的操作更连贯。', color: 'green' },
    { title: '选场', description: '浏览商品和场次，查看活动时间、价格与状态。当前可参与的活动，请以商城展示为准。', color: 'orange' },
    { title: '开抢', description: '在场次开始后提交抢购请求。活动限时限量，能否成功以系统返回的结果为准。', color: 'pink' },
    { title: '订单', description: '成功后查看订单，核对商品与金额，并按页面提示体验模拟支付。完成操作后确认订单状态。', color: 'blue' },
  ] as readonly UsageSlide[],
  ctaText: '进入商城',
  ctaIcon: '/assets/decor/promo-arrow-orange.svg',
} as const;
export const PRODUCT_JOIN_US = {
  heading: '好物开抢',
  descriptionLead: '从现在开始',
  descriptionTail: '选一件喜欢的好物，找到适合自己的抢购场次。',
  ctaText: '查看好物',
  ctaAria: '进入 PeakRush 商城查看当前商品与抢购活动',
  ctaIcon: '/assets/decor/promo-arrow.svg',
  trailOrder: [16, 18, 14, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 17] as const,
  trailPath: productPhoto,
  usWord: '/assets/decor/star-white.svg',
} as const;
export const PRODUCT_PAGE = { path: '/our-product', heading: '抢购指南', themes: ['orange', 'pink', 'blue', 'light', 'orange'] as const } as const;
export type { BillingCycle };
