/** 好物清单。图片提供商品浏览入口，详细信息与活动以商城为准。 */
import { GIFT_CARD_PRICE } from './pricing';

export const GIFT_CARD = {
  path: '/gift-card',
  heading: '好物清单',
  titleText: '好物清单',
  titleDecoration: '/assets/decor/promo-arrow.svg',
  background: '/peakrush/collection.png',
  ctaText: '查看商城好物',
  video: {
    lines: ['心动好物', '限时开抢', '现在发现'] as const,
    preview: '/peakrush/collection-wide.png',
    playIcon: '/assets/decor/promo-arrow.svg',
    playable: false,
  },
  pitch: '为你的日常，',
  pitchUnderlined: '选一件',
  pitchTail: '期待已久的好物',
  body: 'PeakRush 将商品、场次与订单放在同一个购物入口。先看清商品与活动信息，再参加限时限量的抢购。',
  unlocksTitle: '参加之前，看看这份清单：',
  unlocks: ['了解商品介绍与配置', '确认活动价格', '查看场次开始与结束时间', '留意当前活动状态', '登录账户后提交抢购', '成功后查看订单与模拟支付提示'] as const,
  closing: '从数码装备到日常好物，按自己的需要认真选择，让每一次心动都有明确的下一步。',
  afterPurchase: '商品详情、活动时间、库存与成交价格，请以商城当前展示为准。',
  mediaTitle: '发现数码好物',
  partners: ['photo-1.png', 'photo-2.png', 'photo-3.png'] as const,
  partnerLabels: ['无线耳机', '智能手表', '便携相机'] as const,
  pricingPartnerCount: 3,
  partnersDirectory: '/peakrush/',
  price: GIFT_CARD_PRICE,
} as const;

/** 既有版式需要的图片坐标与按钮尺寸。 */
export const GIFT_CARD_PRICING_GEOMETRY = {
  titleDecoration: { left: 112, top: 75, width: 133 },
  bgImage: { left: 119, top: 145, width: 420 },
  play: { size: 59 },
} as const;
