/** Desktop editorial content. Product imagery is inspiration; live offers belong to the mall. */
export const GUIDE_STEPS = [
  {
    number: "01",
    title: "准备好账户",
    english: "GET READY",
    heading: "让准备，先于开抢。",
    description: "先完成注册或登录，把开抢时的注意力留给喜欢的商品。",
    image: "/peakrush/guide/step-login-white.webp",
    checklist: [
      "已有账号？提前登录并确认登录状态。",
      "第一次参与？创建账户，再进入商城。",
      "浏览商品无需登录，提交抢购与查看订单需要登录。",
    ],
    action: "登录账户",
    href: "/signin",
  },
  {
    number: "02",
    title: "选好场次",
    english: "PICK YOUR DROP",
    heading: "好物值得等，也值得选。",
    description: "在商城浏览活动，从自己的需求出发，选择想参加的场次。",
    image: "/peakrush/guide/step-session.webp",
    checklist: [
      "了解商品配置，核对活动价格。",
      "确认开始与结束时间，留意当前活动状态。",
      "查看限购数量与库存；库存会随其他人的抢购变化。",
    ],
    action: "查看活动场次",
    href: "/app/",
  },
  {
    number: "03",
    title: "准点开抢",
    english: "MAKE YOUR MOVE",
    heading: "准时参与，等一个明确结果。",
    description: "活动开始后确认商品与数量，提交抢购，并等待系统反馈。",
    image: "/peakrush/guide/step-rush.webp",
    checklist: [
      "仅在活动开放、处于有效时间且有库存时参与。",
      "“处理中”代表请求已提交，尚未确认成功。",
      "结果不明确时刷新结果、查询订单，避免反复提交。",
    ],
    action: "前往秒杀会场",
    href: "/app/",
  },
  {
    number: "04",
    title: "确认订单",
    english: "CHECK YOUR ORDER",
    heading: "每一次心动，都有迹可循。",
    description: "成功生成订单后，核对信息，并在有效期内体验模拟支付。",
    image: "/peakrush/guide/step-order-white.webp",
    checklist: [
      "在我的订单核对商品、数量、金额与状态。",
      "按订单显示的支付截止时间完成操作。",
      "当前为模拟支付，不会扣款，也不涉及实际发货。",
    ],
    action: "查看我的订单",
    href: "/app/orders",
  },
] as const;

export const SHOWCASE_GOODS = [
  {
    key: "earbuds",
    category: "数码装备",
    english: "SOUND / 01",
    title: "把世界，调成喜欢的音量。",
    name: "无线耳机",
    description: "给通勤、专注和放空，留一段好声音。",
    image: "/peakrush/drops-20261009/earbuds.webp",
    imageAlt: "象牙白无线耳机与琥珀色半透明声波雕塑",
  },
  {
    key: "camera",
    category: "数码装备",
    english: "FRAME / 02",
    title: "让寻常，成为珍藏。",
    name: "便携相机",
    description: "换一个视角，定格不期而遇的瞬间。",
    image: "/peakrush/drops-20261009/camera.webp",
    imageAlt: "酒红色建筑镜面布景中的银色便携相机",
  },
  {
    key: "espresso",
    category: "生活方式",
    english: "RITUAL / 03",
    title: "把早晨，调成喜欢的味道。",
    name: "意式咖啡机",
    description: "为日常留一点仪式感，从一杯咖啡开始。",
    image: "/peakrush/drops-20261009/espresso.webp",
    imageAlt: "钴蓝色雕塑展台上的不锈钢意式咖啡机",
  },
  {
    key: "sneakers",
    category: "日常穿搭",
    english: "MOVE / 04",
    title: "下一步，走向新鲜。",
    name: "轻量运动鞋",
    description: "从城市到日常，把轻快穿在脚下。",
    image: "/peakrush/drops-20261009/sneakers.webp",
    imageAlt: "悬于珊瑚橙色弧形跑道上方的米白运动鞋",
  },
  {
    key: "backpack",
    category: "日常穿搭",
    english: "ROAM / 05",
    title: "装上日常，走向远方。",
    name: "户外机能背包",
    description: "从城市街角到周末山野，带上下一份期待。",
    image: "/peakrush/drops-20261009/backpack.webp",
    imageAlt: "陶土色布景与浅色洞石拱门中的森林绿户外背包",
  },
  {
    key: "lamp",
    category: "生活方式",
    english: "GLOW / 06",
    title: "给自己的角落，一束暖光。",
    name: "便携氛围台灯",
    description: "点亮阅读、独处和慢下来的每一个夜晚。",
    image: "/peakrush/drops-20261009/lamp.webp",
    imageAlt: "鼠尾草绿色背景与白色曲面建筑间的橘红蘑菇台灯",
  },
] as const;

export const PARTICIPATION_RULES = [
  {
    id: "account",
    number: "01",
    english: "ACCOUNT & ACCESS",
    title: "参与之前，先准备好账户。",
    lead: "浏览可以从现在开始，抢购需要先登录。",
    items: [
      {
        title: "账户与登录",
        body: "提交抢购与查看个人订单需要登录。登录状态过期后，重新登录即可继续查看活动和已有订单。",
      },
      {
        title: "按需选择",
        body: "参与前确认商品、数量、活动价格与开始时间；具体配置及活动信息，以商城对应页面为准。",
      },
    ],
  },
  {
    id: "time",
    number: "02",
    english: "TIME & AVAILABILITY",
    title: "限时开场，限量参与。",
    lead: "一场活动，有自己的时间窗口与库存。",
    items: [
      {
        title: "有效时间",
        body: "只有活动开放且处于有效时间内才能提交抢购。未开始、已结束、下线或售罄的活动无法继续购买。",
      },
      {
        title: "库存与价格",
        body: "库存会随其他用户的抢购变化，页面展示不代表库存已为你保留。成交金额与是否成功，以服务器结果和订单信息为准。",
      },
    ],
  },
  {
    id: "limit",
    number: "03",
    english: "QUANTITY & RESULTS",
    title: "确认数量，再提交请求。",
    lead: "一次确认，一笔订单；清楚每一个结果。",
    items: [
      {
        title: "限购与订单",
        body: "每件活动商品的限购数量，以商品卡片和抢购窗口为准。同一账号、同一场活动、同一商品只能生成一笔订单，取消或超时关闭后也不能再次下单。",
      },
      {
        title: "等待结果",
        body: "“处理中”表示请求已提交，尚未确认成功。网络中断或结果不明确时，先刷新抢购结果，并前往我的订单确认，避免反复新建请求。",
      },
    ],
  },
  {
    id: "order",
    number: "04",
    english: "ORDER & PAYMENT",
    title: "成功之后，继续确认。",
    lead: "在订单有效期内，完成后续操作。",
    items: [
      {
        title: "支付与取消",
        body: "未支付且仍在有效期内的订单可以取消；超时未支付会关闭并释放库存。已经模拟支付的订单不支持取消。具体支付截止时间，以订单显示为准。",
      },
      {
        title: "模拟支付说明",
        body: "当前项目使用模拟支付，操作只更新订单状态，不调用真实支付渠道、不扣款，也不涉及真实交易或物流发货。",
      },
    ],
  },
] as const;
