# FOLLOW.ART 桌面端高保真复刻

本地复刻 `https://follow.art/` 的桌面端页面、排版、鼠标交互、滚动编排与 WebGL 视觉。
执行规格见 `FOLLOW_ART_Desktop_Codex_Goal_Clone_Plan_v1.0.md`；当前真实状态见 `progress.md`
与 `quality/scorecard.json`，未取得的证据全部登记在 `evidence/reference/pending.json`。

## 环境

- Node `>=24`（开发时实测 v24.11.1），npm 11。
- 依赖只装在本目录 `node_modules/`，无全局安装，无 C 盘写入。
- 浏览器：Chromium 系（WebGL2）。Safari/Firefox 未做兼容验证。

```bash
npm install
npm run dev        # http://127.0.0.1:5175
npm run build      # 产物在 dist/
npm run preview    # http://127.0.0.1:5176
```

## 命令契约

| 命令 | 作用 |
|---|---|
| `npm run typecheck` | `vue-tsc --noEmit`，严格模式 |
| `npm run lint` | eslint 扁平配置 |
| `npm run test:unit` | vitest，纯函数与几何/运行时测试 |
| `npm run test:e2e` | Playwright，路由/控件/网络隔离 |
| `npm run capture:local` | 按 `design/checkpoints.json` 截本地状态（只允许 loopback 地址） |
| `npm run capture:reference` | 冻结参考截图（只允许 `https://follow.art`，需 `FREEZE_NEW_VERSION=yes` 显式确认） |
| `npm run compare:reference` | 参考 vs 本地逐状态像素差与失败清单 |
| `npm run verify:assets` | 资产路径/字节/哈希/授权状态审计 |
| `npm run verify:evidence` | 参考锁、哈希漂移、证据可定位性、占位文本检测 |
| `npm run verify:release` | 汇总门槛；任一必需检查缺失即失败 |

环境变量：`LOCAL_BASE_URL`、`REFERENCE_URL`、`VIEWPORTS=primary,wide,narrow,retina`、`ONLY=V01,V05`。
参考捕获与本地捕获是两个物理分开的脚本，各自硬编码允许访问的源。

## 技术选型（实测与原站一致）

| 职责 | 选型 | 依据 |
|---|---|---|
| 框架 | Vue 3 + Nuxt 风格的语义 DOM | 原站实测为 Nuxt 3（`window.__NUXT__`、`#__nuxt`） |
| 构建 | Vite 6 + TypeScript 5.8 严格模式 | 复刻工程选择 |
| WebGL | three.js **r176** | 原站 `window.__THREE__ === '176'` |
| 平滑滚动 | Lenis **1.3.3**，绑定 `.scrollable__area` | 原站 `window.lenisVersion === '1.3.3'` |
| 动画编排 | 自写单一 rAF 时钟（`src/motion/`） | 原站 34 个 JS 分块中 **无 GSAP、无 ScrollTrigger** |
| 状态 | Pinia | 原站 payload 含 `pinia` |

## 路由

`/` `/about` `/our-product` `/pricing` `/faq` `/community-board` `/signin` `/signup`
`/gift-card` `/terms-and-conditions` `/privacy-policy` `/cookies-policy`，其余落到 `NotFoundPage`。

静态部署需自行配置 history fallback；`dist/` 直接打开深层 URL 会 404。

## 本地演示边界

- `/signin` `/signup` `/gift-card` 为本地演示，页面常驻可见的演示提示；
  不发送凭据、不存储密码、不发起任何网络请求、不产生真实订阅或购买。
- 不接入原站的 DataDog / reCAPTCHA / Google Places / Facebook / GTM / Cloudflare Insights
  配置项——那是运营方的追踪凭据，不是设计的一部分。
- 社区列表使用确定性 fixture，不批量复制真实用户数据。

## 资产与授权

`src/content/assets.manifest.json` 记录 105 个资产的真实来源 URL、字节、sha256 与权利状态。
**全部为 `permission-required`**：从公开页面抓取不等于再分发许可。因此本项目仅限本地研究，
不做公开部署，不把字体文件与艺术家卡面作为交付物分发。需要发布时按 §5.3 换成已授权替代并记录可见误差。

## WebGL 降级

- 每个 WebGL 区域都有承担布局的 DOM 占位与静态回退图，首帧成功后才切换。
- 初始化失败或 context lost 时保留静态回退，不出现无限加载。
- `prefers-reduced-motion` 下取消持续旋转与大幅位移，内容与状态保持可读。
- 降级只保证可访问，不代表视觉验收通过。

## 目录

```
src/app/        应用外壳与路由（滚动容器 + 场景挂载）
src/content/    内容模型与资产清单（价格只有一处数据源）
src/components/ 导航、页脚、Cookie 层、显示标题、笔刷链接、可访问弹窗
src/features/   首页八个章节
src/pages/      12 条路由的页面模板
src/motion/     统一时钟、滚动输入、章节进度、reduced motion
src/webgl/      场景、几何、着色器、纹理与渲染宿主
src/styles/     从参考站逐条转写的令牌/重置/排版/版式
scripts/        取证、捕获、比对与验收脚本
evidence/       参考基线（只读）、本地产物、差异图、动态轨迹
quality/        backlog、scorecard、迭代日志、最终报告
design/         参考令牌与检查点定义
docs/           DOM 契约与目标状态
```
