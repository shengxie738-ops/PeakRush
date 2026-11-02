/** 活动规则。保留既有选项 id 和双栏结构，呈现真实购物流程。 */
export type BillingCycle = 'annually' | 'monthly' | 'weekly';

export interface PriceFigure {
  amount: string;
  unit: string;
  srOnly: string;
  period: string;
}
export interface CycleSpec {
  id: BillingCycle;
  label: string;
  primary: PriceFigure;
  annualised: PriceFigure;
  promoFigure: string;
}

export const BILLING_CYCLES: readonly CycleSpec[] = [
  {
    id: 'weekly', label: '准备',
    primary: { amount: '01', unit: '准备', srOnly: '第一步，提前准备', period: '准备' },
    annualised: { amount: '先登录', unit: '', srOnly: '参与前注册或登录账户', period: '账户' },
    promoFigure: '提前准备',
  },
  {
    id: 'annually', label: '开抢',
    primary: { amount: '02', unit: '开抢', srOnly: '第二步，场次开始后提交抢购', period: '开抢' },
    annualised: { amount: '选场次', unit: '', srOnly: '确认时间与商品，选择活动场次', period: '场次' },
    promoFigure: '提交抢购',
  },
  {
    id: 'monthly', label: '下单',
    primary: { amount: '03', unit: '下单', srOnly: '第三步，查看订单并体验模拟支付', period: '订单' },
    annualised: { amount: '查订单', unit: '', srOnly: '在订单页确认抢购结果', period: '结果' },
    promoFigure: '确认订单',
  },
] as const;

export const DEFAULT_BILLING_CYCLE: BillingCycle = 'weekly';
export function cycleById(id: BillingCycle): CycleSpec {
  const found = BILLING_CYCLES.find((option) => option.id === id);
  if (!found) throw new Error('unknown shopping step ' + id);
  return found;
}

export interface PlanFeatureRow {
  label: string;
  tooltip: string | null;
  freeForPro?: boolean;
  disabled?: boolean;
}
export interface PlanFeatureGroup {
  title: string;
  hiddenOnSmall?: boolean;
  rows: readonly PlanFeatureRow[];
}

export const PRO_FEATURE_GROUPS: readonly PlanFeatureGroup[] = [
  {
    title: '参与准备',
    rows: [
      { label: '先登录', tooltip: '参加抢购前，先注册或登录 PeakRush 账户。', freeForPro: true },
      { label: '看商品', tooltip: '了解商品介绍与活动展示信息，根据自己的需求选择。' },
      { label: '选场次', tooltip: '确认场次开始时间、结束时间和活动状态。' },
    ],
  },
  {
    title: '活动时间',
    rows: [
      { label: '限时参与', tooltip: '活动只在对应场次的有效时间内开放。', freeForPro: true },
      { label: '准时开抢', tooltip: '场次开始后，进入商品或活动页面提交抢购请求。' },
      { label: '关注状态', tooltip: '未开始、进行中和已结束等状态，以商城实时展示为准。' },
    ],
  },
  {
    title: '活动库存',
    rows: [
      { label: '限量库存', tooltip: '每场活动的库存有限，库存不足时可能无法成功下单。', freeForPro: true },
      { label: '等待结果', tooltip: '提交后等待系统返回结果，避免连续重复操作。', freeForPro: true },
      { label: '结果为准', tooltip: '是否抢购成功，以系统返回与订单页面的信息为准。' },
    ],
  },
  { title: '活动价格', rows: [{ label: '确认金额', tooltip: '活动价格与订单成交金额，以商城对应页面显示为准。' }] },
  { title: '下一步', rows: [{ label: '查看订单', tooltip: '成功生成订单后，进入订单页核对商品、金额与状态。' }] },
] as const;

export const STARTER_FEATURE_GROUPS: readonly PlanFeatureGroup[] = [
  {
    title: '订单确认',
    rows: [
      { label: '核对商品', tooltip: '进入订单详情，确认购买的商品信息。' },
      { label: '核对金额', tooltip: '查看订单展示的实际成交金额。' },
      { label: '确认状态', tooltip: '以订单页显示的当前状态判断后续操作。' },
    ],
  },
  {
    title: '支付体验',
    rows: [
      { label: '模拟支付', tooltip: '当前项目使用模拟支付流程，按订单页面提示体验。' },
      { label: '等待返回', tooltip: '操作后等待系统反馈，再查看订单结果。' },
      { label: '再次确认', tooltip: '完成操作后，重新查看订单当前状态。' },
    ],
  },
  {
    title: '参与提醒',
    rows: [
      { label: '按需选择', tooltip: '根据商品信息和自己的需求决定是否参与。' },
      { label: '留意场次', tooltip: '活动时间与可参与状态，请以当前商城展示为准。' },
      { label: '查看规则', tooltip: '不同场次的具体说明，请在参与前认真查看。' },
    ],
  },
  { title: '查看记录', rows: [{ label: '订单列表', tooltip: '在商城订单入口查看账户下的订单。' }] },
  { title: '继续发现', rows: [{ label: '浏览好物', tooltip: '返回商城，查看其他商品与当前活动。' }] },
] as const;

export interface PlanCard {
  id: 'pro' | 'starter';
  title: string;
  tagline: string;
  frameClass: string;
  icon: string | null;
  ctaTo: string;
}
export const PLAN_CARDS: readonly PlanCard[] = [
  {
    id: 'pro', title: '抢购须知', tagline: '把时间、库存与结果看清楚',
    frameClass: 'ui-dark plans-difference__frame plans-difference__frame_upgraded px-1 py-1 pt-1.25 pt-1:md',
    icon: '/assets/decor/subscribe.svg', ctaTo: '/app/',
  },
  {
    id: 'starter', title: '订单须知', tagline: '成功之后，继续确认每一步',
    frameClass: 'plans-difference__frame plans-difference__frame_free px-1 py-1 pt-1.25 pt-1:md',
    icon: null, ctaTo: '/app/',
  },
] as const;
export const STARTER_PRICE_LABEL = '以订单页面为准';
export const PROMO_COMPARISONS: readonly string[] = ['确认活动时间', '查看商品信息', '留意库存状态', '核对订单金额'] as const;
export const PROMO_SENTENCE = { lead: '当前步骤：', middle: '每次参与，请先' } as const;
export const PRICING_PAGE = {
  path: '/pricing', theme: 'pink', heading: '活动规则', subheading: '参与抢购须知',
  titleDecoration: null, radioName: 'type',
} as const;

/** 兼容常见问题内容导入，所有说明均对应当前项目流程。 */
export const FAQ_PRICE_LINES: readonly string[] = [
  '- **提前准备**：注册或登录账户，查看商品与活动场次。',
  '- **准时开抢**：活动开始后提交抢购，以系统返回结果为准。',
  '- **订单跟进**：查看订单，并按提示体验模拟支付。',
] as const;
export const GIFT_CARD_PRICE = Object.freeze({ label: '活动商品', amount: '以商城为准', derivedFrom: '商城当前商品信息' });
