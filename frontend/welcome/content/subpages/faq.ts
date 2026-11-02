/** PeakRush 帮助中心；每个小分类可以独立展开。 */
export interface FaqQuestion {
  question: string;
  /** 支持加粗、站内链接和列表的简易 Markdown 文本。 */
  answer: readonly string[];
}

export interface FaqSubGroup {
  regionId: string;
  label: string;
  numbered: boolean;
  questions: readonly FaqQuestion[];
}

export interface FaqGroup {
  title: string;
  subGroups: readonly FaqSubGroup[];
}

export const FAQ_GROUPS: readonly FaqGroup[] = [
  {
    title: '账号与登录',
    subGroups: [
      {
        regionId: 'account-getting-started',
        label: '注册与账号信息',
        numbered: true,
        questions: [
          {
            question: '如何开始使用 PeakRush？',
            answer: ['在[注册页面](/signup)创建账号，登录后即可前往[秒杀会场](/app/)，查看活动商品并参与抢购。浏览活动无需登录，提交抢购和查看个人订单需要登录。'],
          },
          {
            question: '用户名和密码有哪些要求？',
            answer: ['用户名须为 **3–40 位字母、数字或下划线**，且不能与已有账号重复。密码至少 8 个字符，编码后不超过 72 字节；中文字符通常占多个字节。请妥善保管密码。'],
          },
        ],
      },
      {
        regionId: 'account-sign-in',
        label: '登录状态与安全',
        numbered: true,
        questions: [
          {
            question: '登录过期后怎么办？',
            answer: ['登录凭证过期时，页面会提示重新登录。完成[登录](/signin)后可以继续查看活动与订单；原有订单不会因为退出登录而消失。'],
          },
          {
            question: '在公共设备上使用时需要注意什么？',
            answer: ['使用结束后请退出账号，并按需要清除浏览器的网站数据。PeakRush 会在当前浏览器保存登录凭证，以便后续访问时识别账号。'],
          },
        ],
      },
    ],
  },
  {
    title: '活动与抢购',
    subGroups: [
      {
        regionId: 'sale-time-and-stock',
        label: '开抢时间与限量库存',
        numbered: true,
        questions: [
          {
            question: '什么时候可以抢购？',
            answer: ['以秒杀会场显示的活动时间和状态为准。活动开始前可提前浏览，只有活动开放且处于有效时间内才能提交抢购；活动结束、下线或售罄后无法继续购买。'],
          },
          {
            question: '看到剩余库存，为什么还是没抢到？',
            answer: ['库存会随着其他用户的抢购实时变化。页面展示的库存是查询时的状态，点击按钮并不保证获得商品；请以服务器返回的抢购结果和生成的订单为准。'],
          },
        ],
      },
      {
        regionId: 'sale-limits',
        label: '限购数量与下单规则',
        numbered: true,
        questions: [
          {
            question: '每人可以买多少件？',
            answer: ['每件活动商品都有自己的限购数量，具体以商品卡片和抢购窗口显示为准。同一账号对同一场活动中的同一商品只能生成一笔订单，请在提交前确认数量。'],
          },
          {
            question: '订单取消后还能重新抢同一商品吗？',
            answer: ['不能。同一活动商品的购买记录会保留，取消或超时关闭后也无法再次下单。请确认商品和数量后再提交抢购。'],
          },
        ],
      },
      {
        regionId: 'sale-results',
        label: '排队与抢购结果',
        numbered: true,
        questions: [
          {
            question: '“处理中”是否表示抢购成功？',
            answer: ['“处理中”表示请求已提交，订单尚未确认。请等待结果更新，或使用窗口中的刷新结果功能；只有显示抢购成功并生成订单后，才能进入订单页完成后续操作。'],
          },
          {
            question: '网络中断或结果不明确时怎么办？',
            answer: ['先查询当前抢购结果，并到[我的订单](/app/orders)确认是否已生成订单。页面会保留尚未确认的抢购请求，帮助继续查询，请避免反复新建请求。'],
          },
          {
            question: '如何查看已成功的抢购？',
            answer: ['在[我的订单](/app/orders)中查看订单状态、商品数量、订单金额和支付截止时间。售罄或失败的抢购请求不会生成可支付订单。'],
          },
        ],
      },
    ],
  },
  {
    title: '订单与支付',
    subGroups: [
      {
        regionId: 'orders-payment',
        label: '待支付与模拟支付',
        numbered: true,
        questions: [
          {
            question: '抢购成功后需要做什么？',
            answer: ['打开[我的订单](/app/orders)，在订单显示的截止时间前完成模拟支付。请核对商品、数量与金额；超过截止时间的未支付订单会关闭。'],
          },
          {
            question: '模拟支付会扣款吗？',
            answer: ['不会。PeakRush 当前使用 **模拟支付**，点击后只会更新订单状态和记录，不会调用真实支付渠道，也不会扣除银行卡或支付账户的资金。'],
          },
          {
            question: '模拟支付成功后会发货吗？',
            answer: ['当前系统提供活动抢购与订单管理流程，尚未接入实际付款和物流发货服务。“已支付”表示模拟支付流程完成，不代表真实交易或发货。'],
          },
        ],
      },
      {
        regionId: 'orders-cancel-and-expire',
        label: '取消与超时关闭',
        numbered: true,
        questions: [
          {
            question: '可以取消订单吗？',
            answer: ['未支付且仍在有效期内的订单可以在订单页取消。取消后库存会释放，但同一活动商品不能再次下单；已模拟支付的订单不支持取消操作。'],
          },
          {
            question: '订单超时后还能支付吗？',
            answer: ['不能。未支付订单超过有效期后会关闭并释放库存，页面会更新相应状态。支付截止时间以订单详情为准。'],
          },
        ],
      },
    ],
  },
  {
    title: '隐私与使用帮助',
    subGroups: [
      {
        regionId: 'privacy-browser-storage',
        label: '账号数据与浏览器存储',
        numbered: true,
        questions: [
          {
            question: 'PeakRush 会保存哪些信息？',
            answer: ['系统会保存账号信息、抢购记录和订单信息，用于登录校验、限购判断与订单查询。浏览器会保存登录凭证、账号概要和待确认的抢购请求；详情见[隐私说明](/privacy-policy)与[存储说明](/cookies-policy)。'],
          },
          {
            question: '清除网站数据会删除订单吗？',
            answer: ['清除浏览器的网站数据会移除本机保存的登录信息和待确认请求，但不会删除服务器上的订单。重新登录同一账号后，可以在我的订单中查看已生成的订单。'],
          },
        ],
      },
      {
        regionId: 'help-troubleshooting',
        label: '遇到问题时',
        numbered: true,
        questions: [
          {
            question: '页面提示无法连接或操作失败时怎么办？',
            answer: ['检查网络连接，保留页面显示的订单号或抢购请求信息，稍后刷新结果。遇到“登录已过期”时重新登录；结果尚未确认时，请先查询我的订单。'],
          },
          {
            question: '在哪里查看完整的参与规则？',
            answer: ['请查看[平台使用规则](/terms-and-conditions)，并在提交抢购前阅读活动页显示的开始时间、结束时间、限购数量和订单有效期。'],
          },
        ],
      },
    ],
  },
] as const;

export const FAQ_PAGE = {
  path: '/faq',
  theme: 'light',
  heading: '帮助中心',
  description: '从准点开抢到查看订单，你关心的参与规则，都在这里。',
  descriptionLink: '/terms-and-conditions',
  descriptionLinkLabel: '查看平台使用规则',
} as const;

export function faqQuestionCount(): number {
  return FAQ_GROUPS.reduce(
    (groups, group) =>
      groups + group.subGroups.reduce((sum, sub) => sum + sub.questions.length, 0),
    0,
  );
}
