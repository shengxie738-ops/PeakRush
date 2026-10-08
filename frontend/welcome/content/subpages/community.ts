/** 活动预告与参与提示。内容提供浏览指引，实际场次以商城为准。 */
export type ThreadVariant = 'announcement' | 'discussion' | 'collab';
export interface CommunityThread {
  id: string;
  variant: ThreadVariant;
  author: string;
  date: string;
  headline: string;
  body: readonly string[];
  image?: string;
  pinned?: boolean;
  actionLabel?: string;
}

const NOTICES: readonly Omit<CommunityThread, 'id'>[] = [
  { variant: 'announcement', author: 'PeakRush 活动提示', date: '场次以商城为准', headline: '好物开抢，先看活动场次', body: ['当前商品、开始时间、活动价格与库存，统一在商城中查看。', '先找到喜欢的商品，再选择适合自己的场次。'], image: '/peakrush/collection-wide.png', pinned: true, actionLabel: '查看当前场次' },
  { variant: 'announcement', author: '数码好物', date: '活动信息请进入商城查看', headline: '无线耳机，让好声音随行', body: ['通勤、学习或日常聆听，先了解商品介绍，再决定是否参加抢购。', '商品配置与活动价格，以商城详情为准。'], image: '/peakrush/photo-1.png', actionLabel: '查看商品' },
  { variant: 'discussion', author: '参与提示', date: '开抢前准备', headline: '账户准备，放在开抢之前', body: ['参加活动前先注册或登录账户。', '提前查看想参加的场次，确认活动开始与结束时间。'], actionLabel: '登录商城' },
  { variant: 'announcement', author: '日常装备', date: '活动信息请进入商城查看', headline: '智能手表，陪你记录日常', body: ['把喜欢的日常装备放进你的好物清单。', '参与前查看商品功能、活动说明与当前场次状态。'], image: '/peakrush/photo-2.png', actionLabel: '查看商品' },
  { variant: 'discussion', author: '参与提示', date: '场次开始后', headline: '限时限量，等待明确结果', body: ['在活动有效时间内提交抢购。', '提交后等待系统反馈，能否成功以返回结果为准。'], actionLabel: '查看抢购场次' },
  { variant: 'announcement', author: '影像好物', date: '活动信息请进入商城查看', headline: '便携相机，留住喜欢的瞬间', body: ['从旅行到日常，寻找适合自己的影像装备。', '详细参数、库存与活动价格，请在商城商品页面查看。'], image: '/peakrush/photo-3.png', actionLabel: '查看商品' },
  { variant: 'collab', author: '订单提示', date: '抢购成功后', headline: '订单里，确认你的抢购结果', body: ['成功生成订单后，进入订单页核对商品与金额。', '以订单当前状态为准，继续完成页面提示的操作。'], actionLabel: '进入订单入口' },
  { variant: 'collab', author: '支付提示', date: '订单跟进', headline: '体验模拟支付，查看状态变化', body: ['当前项目提供模拟支付流程。', '按订单页提示完成体验后，再次确认订单状态。'], actionLabel: '查看订单' },
  { variant: 'discussion', author: '购物提示', date: '参与前阅读', headline: '按需选择，让每次抢购更从容', body: ['活动信息会随场次变化，参加前请重新查看商品、价格与状态。', '好物值得期待，也值得认真选择。'], image: '/peakrush/shopping-scene.png', actionLabel: '发现更多好物' },
] as const;

export const COMMUNITY_PAGE_SIZE = 6;
export const COMMUNITY_MAX_PAGES = Math.ceil(NOTICES.length / COMMUNITY_PAGE_SIZE);
export const COMMUNITY_TOTAL_THREADS = NOTICES.length;
export function threadsForPage(page: number): readonly CommunityThread[] {
  const start = (page - 1) * COMMUNITY_PAGE_SIZE;
  return NOTICES.slice(start, start + COMMUNITY_PAGE_SIZE).map((notice, index) => ({ ...notice, id: 'thread-' + (start + index) }));
}
export const COMMUNITY_SIDEBAR = {
  scopes: ['全部预告', '参与提示'] as const,
  sortTitle: '浏览顺序',
  sorts: ['推荐顺序', '分类浏览'] as const,
  searchLabel: '搜索商品或活动提示',
  createLabel: '查看商城场次',
  scopeName: 'scope',
  sortName: 'sort',
} as const;
export const COMMUNITY_PAGE = {
  path: '/community-board', heading: '活动预告',
  headingClass: 'text-card-h1 text-box-trim',
  countLabel: (total: number): string => total + ' 条活动与参与提示',
  loadMoreLabel: '查看更多提示',
  listColumns: 2,
} as const;
