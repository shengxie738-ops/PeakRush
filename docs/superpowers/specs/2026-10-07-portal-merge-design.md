# 子项目 1：follow.art 复刻站整站并入 PeakRush 作为入口，并接通登录

日期：2026-10-07
状态：已与用户逐项确认，待实施
取代：`2026-10-07-login-page-integration-design.md`（范围从"只搬登录面板"扩大到"整站并入"，
该文档的 §5 整章 CSS 隔离方案在新范围下作废；其 §3.2 后端契约、§4.3 home-overrides 归属、
§5.4 rem 机制、§5.5 尺寸链等实测结论在本文档 §4 重述）

## 1. 范围

用户的原始诉求是"把 `logn in/` 的前端页面作为 PeakRush 的登录页"，经澄清后确定为
**整个 follow.art 复刻站（12 条路由）作为 PeakRush 的入口站**，其 `/signin` `/signup`
接通 PeakRush 后端成为真实登录/注册页。

这个范围超出单个 spec 能承载的量，已拆为两个子项目，各自走一轮 spec → plan → 实施：

| | 内容 | 本文档 |
|---|---|---|
| **子项目 1** | 整站工程合并、双入口、克隆站占 `/`、主应用迁 `/app/`、auth 接后端 | ✅ 覆盖 |
| **子项目 2** | 全站中文化、品牌替换（FOLLOW.ART → PeakRush）、13 组 SVG 字模处置、CJK 排版与几何重建 | ❌ 另开 spec |

**拆分理由是硬依赖，不是偏好**：

1. 子项目 2 的验收需要"改动前基线"，而那个基线只能来自子项目 1 完成后的稳定状态。
   合并与中文化若同时发生，任何视觉偏差都无法归属是合并引入还是中文化引入。
2. 子项目 2 的主要风险（中文文字宽高改变按测量固定的几何）只有在子项目 1 的可运行
   状态上才量得出来。
3. 子项目 1 完成后系统即可演示（follow.art 门户 + 真实登录 + 中文抢购应用），
   是一个完整可交付的里程碑。

子项目 1 的原则：**功能正确性归本轮，内容本地化归下轮**。凡是"点了没反应"或
"说的与实际行为相反"的元素，本轮处理；凡是英文文案、FOLLOW.ART 品牌、法务文本，
本轮原样保留。

## 2. 已确认的决策

| # | 决策点 | 选择 | 备注 |
|---|---|---|---|
| 1 | 子应用形态 | 整站并入，全 12 条路由 | |
| 2 | 集成拓扑 | **单 Vite 工程 + 双 HTML 入口（MPA）** | |
| 3 | 入口分工 | 克隆站占 `/`，主应用迁 `/app/` | 用户打开系统先看到 follow.art 首页 |
| 4 | CSS 隔离 | **文档级隔离**（两个 HTML 入口 = 两个文档） | 取代旧文档 §5 的前缀化方案 |
| 5 | 本轮文案 | 全部保留 follow.art 英文原样 | 中文化推到子项目 2 |
| 6 | auth 功能 | `/signin` `/signup` 接通 PeakRush 后端 | |
| 7 | 登录后回跳 | 带 `redirect` query 回跳原页，不恢复抢购弹窗上下文 | |
| 8 | 校验契约 | 对齐 `Auth.java:30`，而非复刻站的测量值 | |
| 9 | 密码可见切换 | 登录页与注册页都加眼睛按钮 | |
| 10 | 验收门槛 | 功能实跑 + **与合并前单独运行的克隆站做渲染对照** | 基线换了，见 §10.2 |
| 11 | 工具链 | 统一到主应用的 Vite 7 / vue-tsc 3 / TS 5.9 | 已验证，见 §9 |
| 12 | 面板配色 | **推迟到子项目 2** | 属品牌替换的一部分 |

### 2.1 旧文档中被本轮取代的决策

| 旧决策 | 现状 | 原因 |
|---|---|---|
| 样式作用域化移植（`.auth-scope` 前缀化 + 去层 + rem 转换） | **作废** | 双入口 = 两个文档，克隆站的全局 CSS 天然不外泄，见 §4.1 |
| 登录页不带顶栏页脚、独占 100svh | **含义改变** | 登录页现在活在克隆站自己的 App 外壳里（`SiteHeader` + `RouterView`），外壳由克隆站提供，本来就是它测量时的形态 |
| 中文化 + 删除无后端支撑项（一揽子） | **拆分** | 功能性死元素本轮处理（§8），文案与品牌下轮 |
| 左侧面板换 PeakRush 橙 | **推迟** | 属品牌替换 |
| 词标改文本渲染 | **推迟** | 属 13 组字模的统一处置，见 §13 |
| 不搬 displayHeadings.json / assetRegistry / public/assets / three / lenis / pinia | **全部反转为要搬** | 整站并入 |

## 3. 目标架构

```
frontend/
  index.html          ← 克隆站入口（占 /，lang="en"，body class="clone-local"）
  app.html            ← 主应用入口（占 /app/*，lang="zh-CN"）
  vite.config.ts      ← 单份，MPA 双入口 + history fallback 插件
  tsconfig.json       ← 单份，两边选项取并集 + paths
  package.json        ← 单份，依赖取并集（新增 three / lenis / pinia）
  public/             ← 合并：主应用 4 个 PNG + 克隆站 23MB 资产 + fonts + icons.svg
  src/                ← 主应用（Storefront / OrdersPage / AdminPage / …），不动
  welcome/            ← 克隆站源码，原 logn in/src/ 整体搬入
    app/ components/ content/ features/ motion/ pages/ styles/ webgl/
  node_modules/       ← 单份
```

URL 分工：

| 路径 | 归属 | 内容 |
|---|---|---|
| `/` | 克隆站 | follow.art 首页（8 章节 + WebGL） |
| `/about` `/our-product` `/pricing` `/faq` `/community-board` `/gift-card` | 克隆站 | 展示页 |
| `/signin` `/signup` | 克隆站 | **真实登录 / 注册** |
| `/terms-and-conditions` `/privacy-policy` `/cookies-policy` | 克隆站 | 法务页 |
| 其余未匹配 | 克隆站 | `NotFoundPage`（`router.ts:91` 的 `/:catchAll(.*)`） |
| `/app/` | 主应用 | PeakRush 抢购主页 |
| `/app/activities/:id` `/app/orders` `/app/admin` | 主应用 | 活动详情 / 订单 / 管理 |
| `/api/*` `/actuator/*` | 网关 | Vite dev proxy → `127.0.0.1:8080`（`vite.config.ts` 现有配置） |
| `/assets/*` `/fonts/*` `/icons.svg` | 静态 | publicDir，两个入口共用 |

## 4. 为什么文档级隔离让旧方案整章作废

### 4.1 两个入口 = 两个文档 = 两套全局 CSS 互不可见

旧文档 §5 花了一整章处理"复刻站的具名层 CSS 与 PeakRush 的无层 CSS 在同一文档里互相
压制"的问题，方案是前缀化 + 去层 + rem 转换。

**双入口之后这个问题不存在了。** `index.html` 只加载克隆站的 `welcome/main.ts`
（它 import `styles/reset.css` 等五张表，见克隆站 `main.ts:6-12`）；`app.html` 只加载
`src/main.ts`（它 import `element-plus/dist/index.css` 与 `./style.css`）。
两个文档各自一套 CSS，Vite 各自打成独立 chunk，互不可见。

因此本轮**不需要**：

- 给 4260 行 CSS 加 `.auth-scope` 前缀
- 去掉 `@layer` 并校验层顺序与源顺序不矛盾
- 把 `:root`/`body`/`html` 选择器逐条改写（旧文档 §5.3.1 的 30 行清单）
- 把 `tokens.css:105`/`:107` 的 `rem` 转成 `px`
- 丢弃 `html{font-size:.625em}`

克隆站的 CSS **原样搬入、一行不改**。这同时意味着它的渲染结果与今天单独运行时
逐像素相同 —— 这正是 §10.2 验收基线成立的前提。

唯一需要确认的是**没有共享模块同时 import 两边的 CSS**。克隆站的五张表只被
`welcome/main.ts` 引用，`style.css` 与 Element Plus 只被 `src/main.ts` 引用，
两者无交集。实施时用一次构建产物检查确认（§10.1）。

### 4.2 顺带保留的正确结论

旧文档 §5.4 查出 `html{font-size:.625em}`（`reset.css:28`）是整套尺寸的根，且
`--scale-text-rem` 是 `tokens.css:107` 那条超长媒体查询里的 viewport clamp
（1376 视口下 9.7333px，`tokens.css:91-94` 与 `typography.css:39` 互证）。
本轮**不需要**动它，但这个机制在子项目 2 做几何重建时是必须知道的前提，故在此留档。

同理旧文档 §4.3 查出按钮基元只在 `home-overrides.css`（`.btn` 180 处、`.btn--primary`、
`.btn--full`、`.btn__text`、`.btn__icon` 等），`layout.css` 与 `reset.css` 里 "btn"
出现 0 次。本轮五张表全搬，这条不再是风险，但子项目 2 若考虑裁剪 CSS 时会用到。

## 5. 工程合并的具体改动

### 5.1 源码搬迁

`logn in/src/` → `frontend/welcome/`，整体搬入，**除 §5.6 那一处 glob 路径外不改任何源文件**。

不搬 `logn in/src/testing/`（6 文件 212K，含 `_colour_live.png`）—— 实测 0 引用，
是散落的 scratch。

不搬 `logn in/` 的这些顶层目录：`scripts/`（49 文件，capture/compare/verify 取证脚本，
决策 10 之下不引入）、`tests/`（9 文件，Playwright）、`evidence/`、`quality/`、`design/`、
`.scratch/`、`test-results/`、`dist/`、`node_modules/`。
它们已在 git 里（上一次提交），保留在 `logn in/` 原地作为溯源，不参与构建。

`logn in/public/` → 合并进 `frontend/public/`：

| 来源 | 体量 | 说明 |
|---|---|---|
| `public/assets/` | 23MB | people 12M、product 4.5M、decor 3.2M、cards 2.1M、subpages 1.3M；`brand/` 与 `media/` 为空目录 |
| `public/fonts/` | 244KB | HeadingNow-73Book + Hardbop-Bold，各 woff/woff2 |
| `public/icons.svg` | 112KB | 被 `content/assets.manifest.json:1787` 按路径引用、由 `scripts/integrate-scaffold.mjs:28` 生成 |

**已实测 `frontend/public/` 现有 4 个文件与克隆站资产的文件名交集为空**
（主应用是 `assets/hero-earbuds.png` 等 4 个平铺 PNG，克隆站是 `assets/cards/`
`assets/decor/` 等嵌套子目录），合并无覆盖风险。

`@font-face` 的 `src:url(/fonts/…)`（`typography.css:29-30`）是绝对路径，
合并后 publicDir 仍在根，**原样可用**。

### 5.2 入口 HTML

| 文件 | 来源 | 改动 |
|---|---|---|
| `frontend/index.html` | 克隆站 `logn in/index.html` | `<script src>` 从 `/src/main.ts` 改为 `/welcome/main.ts`。保留 `lang="en"`、`<body class="clone-local">`（`:10`）、FOLLOW.ART 标题与 `theme-color:#F57D32` —— 这些属品牌，子项目 2 处理 |
| `frontend/app.html` | 现 `frontend/index.html` | `<script src="/src/main.ts">` 不变。保留 `lang="zh-CN"`、`PeakRush · 限量抢购` 标题、`theme-color:#fffaf7` |

`<body class="clone-local">` 实测无任何 CSS 规则命中（只有 `.clone-local-note`
是另一个类，用于 `GiftCardPage.vue:56`），是个无样式的标记类，照搬保留。

两个 HTML 都有 `<div id="app">`，分属两个文档，不冲突。

### 5.3 vite.config.ts

以主应用现有的 `frontend/vite.config.ts` 为基底（它已有 `server.host/port/strictPort`
与 `/api`、`/actuator` proxy），合入克隆站 `logn in/vite.config.ts:7,9` 的两项：

```ts
resolve: { alias: { '@': fileURLToPath(new URL('./welcome', import.meta.url)) } },
appType: 'mpa',
build: {
  assetsDir: '_app',
  target: 'es2022',
  chunkSizeWarningLimit: 1200,
  rollupOptions: { input: { index: 'index.html', app: 'app.html' } },
},
plugins: [vue(), mpaFallback()],
```

四项改动各自的理由：

1. **`alias '@' → ./welcome`**：克隆站源码大量使用 `@/components/…`、`@/content/…`
   （其 `tsconfig.json:20` 是 `"@/*": ["src/*"]`）。实测**主应用 `frontend/src/` 使用
   `@/` 导入 0 次**（全是相对路径），所以 `@` 可以安全地独占给克隆站，其源码零改动。
2. **`appType: 'mpa'`**：默认的 `'spa'` 会把所有未命中路径回退到 `/index.html`，
   那样 `/app/orders` 会加载克隆站。改成 mpa 关掉默认回退，由 §5.4 的插件接管。
3. **`build.assetsDir: '_app'`**：默认值 `assets` 会让 Vite 的打包产物落进 `dist/assets/`，
   而 publicDir 里的克隆站 `assets/`（23MB）也落进同一目录。实测两者文件名不撞
   （Vite 产物是 `HomePage-<hash>.js` 这类哈希名），但混在一起脆弱且难排查，
   故把产物目录改名。publicDir 的 `/assets/…` URL 不受 `assetsDir` 影响。
4. **`target: 'es2022'`**：取自克隆站配置。主应用未设（用 Vite 默认），
   es2022 对两边都安全。

`server.proxy` 保持主应用现有配置。克隆站自己的 `vite.config.ts:8` 是
`port: 5175`，合并后不再需要（单一 dev server 5179）。
克隆站原本不发任何网络请求，合并后 `/signin` 要 POST `/api/auth/login`，
走主应用已有的 `/api` proxy 即可，**同源，无 CORS**。

### 5.4 MPA history fallback 插件

`appType:'mpa'` 关掉了回退，需要自己实现，否则克隆站的 `/about` 与主应用的
`/app/orders` 这类深层 URL 在直接访问或刷新时 404。

**必须同时挂 `configureServer` 与 `configurePreviewServer`** —— 实测
`scripts/app-start.ps1:62` 启动的是 Vite **dev server**
（`node frontend/node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5179 --strictPort`），
不是 preview；但 `frontend/package.json` 的 `preview` 脚本也在，两条路径都要覆盖。

重写规则（全部满足才重写）：

- `req.headers.accept` 含 `text/html`
- 路径不是 `/index.html` 或 `/app.html`
- 路径不以下列任一前缀开头：`/src/`、`/welcome/`、`/assets/`、`/fonts/`、`/_app/`、
  `/@`、`/node_modules/`、`/api`、`/actuator`
- 路径不含 `.`（即没有文件扩展名）

然后：路径等于 `/app` 或以 `/app/` 开头 → 重写为 `/app.html`；其余 → `/index.html`。

### 5.5 tsconfig.json 合并

两边已高度相似（都是 `strict` + `noUnusedLocals` + `noUnusedParameters` +
`verbatimModuleSyntax` + `isolatedModules` + `resolveJsonModule` +
`moduleResolution:"Bundler"` + `target:"ES2022"` + `noEmit`），取并集：

| 选项 | 主应用 | 克隆站 | 合并后 |
|---|---|---|---|
| `lib` | `ES2022,DOM,DOM.Iterable` | `ES2023,DOM,DOM.Iterable` | **`ES2023,…`**（取高） |
| `useDefineForClassFields` | `true` | 无 | `true` |
| `allowImportingTsExtensions` | `true` | 无 | `true` |
| `noImplicitOverride` | 无 | `true` | `true` |
| `esModuleInterop` | 无 | `true` | `true` |
| `jsx` | 无 | `preserve` | `preserve` |
| `skipLibCheck` | `true` | `true` | `true` |
| `types` | 无 | `["vite/client","node"]` | `["vite/client","node"]` |
| `baseUrl` / `paths` | 无 | `"."` / `{"@/*":["src/*"]}` | `"."` / **`{"@/*":["welcome/*"]}`** |
| `include` | `src/**/*.ts`,`src/**/*.vue`,`vite.config.ts` | 另加 `scripts/**/*.mjs`,`tests/**/*.ts` | `src/**/*.ts`,`src/**/*.vue`,`welcome/**/*.ts`,`welcome/**/*.vue`,`vite.config.ts` |

`include` **不含** `scripts/**` 与 `tests/**`：克隆站的 Playwright 测试依赖
`@playwright/test`，本轮不引入该依赖（决策 10）。

`welcome/**/*.ts` 已经覆盖 `welcome/webgl/shaders/glsl.d.ts`（声明 `*.glsl?raw`）
与主应用的 `src/env.d.ts` —— tsconfig 的 `**/*.ts` glob 匹配 `.d.ts`，
不需要单独列一项。

### 5.6 唯一需要改的克隆站源文件：App.vue 的 glob 路径

`welcome/app/App.vue:63-64` 用**绝对路径** glob 解析 motion runtime：

```ts
const runtimeModules = import.meta.glob<{ createMotionRuntime?: RuntimeFactory }>(
  '/src/motion/createMotionRuntime.ts',
);
```

`:148` 再按同一个绝对字符串取值。搬到 `frontend/welcome/` 后，`/src/…` 会从项目根
解析成 `frontend/src/motion/createMotionRuntime.ts` —— 主应用的 `src/` 下没有 `motion/`，
glob 返回空对象，`:149-154` 走"loader 不存在"分支，**只在 DEV 下 console.warn 一句
然后 return**。后果是**全站 WebGL 动画静默失效**，页面仍渲染静态 poster，
看起来"基本正常"，是最难发现的一类退化。

修法：该模块**已经在盘上**（`motion/createMotionRuntime.ts`，235 行，`:46` 导出
`createMotionRuntime`），glob 这层间接当初只是因为"模块正在并行编写"
（`App.vue:20-23` 注释）。直接换成动态 import：

```ts
const module = await import('@/motion/createMotionRuntime');
```

删掉 `runtimeModules`、`RuntimeFactory` 接口与 `:148-154` 的存在性判断，
保留 `reducedMotion` 的提前 return。

**实测这是克隆站源码里唯一的路径脆弱点**：全仓再无其他绝对 `/src/` 引用、
无 `import.meta.url`、无 `new URL(…)` 形式的资源解析。资产 URL 是 135 处
`/assets/…` 字面量（102 处在 `content/assets.manifest.json`、33 处散在 10 个源文件），
但 `base` 保持 `/`，它们全部原样可用。

### 5.7 package.json 合并

新增 3 个依赖（取自克隆站 `package.json:26-28`）：

```
three: 0.176.0        ← 精确版本，原站 window.__THREE__ === '176'
lenis: 1.3.3          ← 精确版本，原站 window.lenisVersion === '1.3.3'
pinia: ^3.0.3
```

`@types/three: ^0.176.0`（克隆站 `package.json:35`）进 devDependencies。

版本冲突处理：

| 包 | 主应用 | 克隆站 | 合并后 |
|---|---|---|---|
| `vite` | `^7.1.7` | `^6.3.5` | **`^7.1.7`** |
| `@vitejs/plugin-vue` | `^6.0.1` | `^5.2.4` | **`^6.0.1`** |
| `typescript` | `~5.9.2` | `~5.8.3` | **`~5.9.2`** |
| `vue-tsc` | `^3.0.7` | `^2.2.10` | **`^3.0.7`** |
| `vue` | `^3.5.21` | `^3.5.16` | `^3.5.21` |
| `vue-router` | `^4.5.1` | `^4.5.1` | `^4.5.1` |

克隆站的 `@playwright/test`、`@vue/test-utils`、`eslint*`、`jsdom`、`vitest`、
`pixelmatch`、`pngjs` **不引入**（决策 10）。
克隆站的 eslint 扁平配置与 vitest/playwright 配置也不搬。

`build` 脚本保持主应用的 `vue-tsc --noEmit && vite build`，合并后它会同时
typecheck 两边源码 —— §9 已验证可行。

`test` 脚本保持 `node --test tests/*.test.mjs`（主应用的 `frontend/tests/api.test.mjs`）。

### 5.8 启动脚本

`scripts/app-start.ps1` 的改动：

- `:23-27`（`cd frontend` → `npm ci` → `npm run build`）不变
- `:60-62`（用 `frontend/node_modules/vite/bin/vite.js` 起 dev server）不变
- `:64` 健康检查 URL 列表建议加 `http://127.0.0.1:5179/app/`，
  否则只检查 `/`（现在是克隆站首页）无法发现主应用挂了
- `:72` 的 `PeakRush ready: http://127.0.0.1:5179` 提示语可保留，
  但该 URL 现在打开的是 follow.art 门户，建议在 `docs/STARTUP_GUIDE.md` 里说明

## 6. 主应用迁到 /app/

### 6.1 只需改一行

`frontend/src/main.ts:8-9`：

```ts
const router = createRouter({
  history: createWebHistory("/app/"),
```

**实测主应用 15 处路由跳转全部走 `RouterLink to="/…"` 或 `router.push("/…")`**，
vue-router 的 history base 会自动为两者加前缀，所以这 15 处**零改动**：

| 位置 | 用法 |
|---|---|
| `App.vue:11` | `router.push("/")`（退出登录后） |
| `App.vue:12` | `router.push(value)`（下拉菜单 command：`/orders`、`/admin`） |
| `App.vue:19,25,30,33` | `RouterLink to="/" / "/orders" / "/admin"` |
| `PurchaseDialog.vue:280` | `router.push({…})` |
| `AdminPage.vue:562` | `RouterLink to="/"` |
| `AdminPage.vue:724` | `RouterLink :to="'/activities/' + row.id"` |
| `OrdersPage.vue:171` | `router.push('/')` |
| `Storefront.vue:273,285` | `router.push('/')` / `router.push('/activities/' + id)` |

### 6.2 不受 base 影响的部分

- `api.ts` 的 `fetch(path)` 用 `/api/…` **绝对 URL**，不经 router，base 变更无影响；
  dev proxy 匹配的是路径前缀 `/api`，也不受影响
- `format.ts:36-37` 的 `productImage()` 返回 `"/assets/product-earbuds.png"`，
  是 publicDir 的裸 URL，同样不经 router。合并后该文件仍在 `frontend/public/assets/`，
  URL 不变
- `session.ts` 的 localStorage 键名（`peakrush.token`、`peakrush.user`）不含路径，不变

### 6.3 需要同步更新的文档

`README.md`、`docs/STARTUP_GUIDE.md`、`docs/ARCHITECTURE.md`、`frontend/README.md`
里凡是写"前端在 `/`"或给出 `http://127.0.0.1:5179/` 作为抢购页入口的地方，
都要改成 `/app/`。`design-qa.md` 按项目既有惯例保留历史值不改。

## 7. auth 接后端

### 7.1 后端契约（实测，比复刻站的表单严格）

`backend/src/main/java/com/peakrush/Api.java:9-10` 把
`POST /api/auth/login` 与 `POST /api/auth/register` 都映射到
`Auth.java:28` 的 `login(input, register)`。请求体 `{username, password}`，
成功返回 `{token, user}`。

`Auth.java:30`：

```java
if(!name.matches("[A-Za-z0-9_]{3,40}")||password.length()<8
   ||password.getBytes(StandardCharsets.UTF_8).length>72)
  throw ApiException.bad("用户名须为3–40位字母数字下划线，密码须为8–72字节");
```

三条推论：

1. **用户名不是邮箱**。正则不含 `@` 与 `.`。复刻站 `content/subpages/auth.ts:53`、`:75`
   把字段做成 `type:'email'`，照搬会让浏览器在提交前拦下 `admin_01` 这类合法用户名。
   必须改为 `type="text"` + `autocomplete="username"`。
2. **主应用现有前端校验已经和后端不一致**（先于本次改动就存在的缺陷）：
   `AuthDialog.vue:26` 只校验密码 ≥6 位（后端要 ≥8），`:22` 只校验用户名 ≥3 位
   （不校验字符集）。本轮接通时一并对齐；`AuthDialog.vue` 本身在 §7.6 删除。
3. **JWT 有效期 8 小时**（`Auth.java:41`，`plusSeconds(28800)`）。
   复刻站的 "Remember me for 24 hours" 连数字都与本系统不符。

注册一步完成：`Auth.java:31` 直接 `INSERT INTO app_user(…,'USER')` 并返回 token，
无第二步、无角色选择。复刻站的 `SIGNUP_STEP2`（角色 radio、姓名、国家选择器、头像）
无对应后端，`AuthPanel.vue` 也只渲染 step 1。

### 7.2 字段与校验

| 字段 | 登录页 | 注册页 |
|---|---|---|
| 用户名 | `type="text"`、`name="username"`、`autocomplete="username"`、`spellcheck="false"`、`autocapitalize="off"` | 同左 |
| 密码 | `type="password"`、`autocomplete="current-password"` | `autocomplete="new-password"` |
| 确认密码 | — | **新增**，复用同一 `.input-text` 结构 |

校验规则（前后端一致）：

| 规则 | 实现 |
|---|---|
| 用户名 | `/^[A-Za-z0-9_]{3,40}$/` |
| 密码长度 | `>= 8` 字符 |
| 密码字节 | `new TextEncoder().encode(pw).length <= 72` |
| 两次一致 | 仅注册页 |

登录页也执行同一套：`Auth.java:30` 在 `if(register)` 分支**之前**，对登录同样生效。
文案直接拆分后端那句「用户名须为3–40位字母数字下划线，密码须为8–72字节」，
避免两套措辞。

确认密码是复刻站没有的字段，新增后注册页比原页高约一个字段块（55.2px）+ 一个
`.error-list`（10.7067px）≈ 66px。这是 §10.2 对照时**注册页高度允许不同**的原因。

### 7.3 错误呈现与提交态

`AuthPanel.vue:276` 的 `.error-list`（复刻站故意空渲染、占位 10.7067px）接字段级错误，
写成 `<li>`，保留占位高度以免无错时布局跳动。

表单级错误（`401 INVALID_CREDENTIALS`「用户名或密码不正确」、
`409 USERNAME_EXISTS`「用户名已存在」、网络与超时）放提交按钮上方，
用 `--c-error`（`tokens.css:129`，`#ea1b4f`）着色。

提交期间按钮 `disabled` + 文案改为 "Logging in…" / "Signing up…"。
复刻站的 `.btn` 没有 disabled 视觉（它从不真正提交），需新增一条规则并标 `CLONE-LOCAL`。

**克隆站没有 API 层** —— 它是 zero-network 的演示站。需要新建一个最小的
`welcome/app/authApi.ts`，只做 `POST /api/auth/login|register`，
不复用主应用的 `src/api.ts`（那会形成两个入口共享模块，破坏 §4.1 的隔离前提）。
错误文案在这个文件里独立给一份英文的（本轮不中文化）。

### 7.4 密码可见切换

决策 9：登录页与注册页都加。复刻站只有 signup 的密码框有
（`AuthPanel.vue:244-268` 的 `.auth-reveal`，测量自 `[1208,418,17.2,17.2]`）。
登录页与确认密码框复用同一结构与 18×18 图标，标 `CLONE-LOCAL`（有意偏离测量）。

### 7.5 跨文档会话交接

登录页与主应用现在是**两个文档**，`router.push` 不能跨文档，必须用
`window.location`。同源，所以 localStorage 直接共享，**不需要 cookie 或 URL 传 token**。

**克隆站侧（登录成功后）**：

```ts
localStorage.setItem("peakrush.token", token);
localStorage.setItem("peakrush.user", JSON.stringify(user));
window.location.href = safeRedirect(redirect) ;   // 默认 "/app/"
```

**主应用侧 `session.ts:27-30`**：`requireLogin(message)` 从"设 `authOpen=true`"
改为跨文档跳转：

```ts
export function requireLogin(message = "登录后，开启你的好物时刻。") {
  const back = window.location.pathname + window.location.search;  // 已含 /app 前缀
  window.location.href = "/signin?redirect=" + encodeURIComponent(back);
}
```

`session.authMessage` 在跨文档跳转后**必然丢失**（新文档、新 JS 上下文），
所以那三句上下文提示语（「登录后即可参与本场抢购。」等）本轮无法保留。
`/signin` 改为读 `reason` query：`reason=expired` 时显示过期提示，否则显示默认引导语。
这是文档级隔离带来的真实代价，记录在此。

四个 `requireLogin` 调用点**代码不改**，只是行为从弹窗变成整页跳转：

| 调用点 | 原提示语 | 现状 |
|---|---|---|
| `App.vue:59` | 默认 | 跳 `/signin?redirect=/app/` |
| `PurchaseDialog.vue:142` | 「登录后即可参与本场抢购。」 | 提示语丢失 |
| `OrdersPage.vue:136` | 默认 | 跳 `/signin?redirect=/app/orders` |
| `AdminPage.vue:560` | 默认 | 跳 `/signin?redirect=/app/admin` |

`session.ts:50` 的 `peakrush:expired` 监听器（由 `api.ts:42` 在非 auth 路径收到 401 时
派发）改为跳 `/signin?redirect=…&reason=expired`。

`session.ts:15-21` 的 `setSession` 中 `authOpen = false` 一行删除；
`session` reactive 上的 `authOpen` 字段整体删除。
`session.ts` 不再需要 router，所以旧文档 §7.1 设计的 `initSession(router)` 注入
**不再需要**。

已登录用户访问 `/signin` 或 `/signup`：读 localStorage 里的 token，
直接 `window.location.href = safeRedirect(redirect) || "/app/"`，不渲染表单。

### 7.6 redirect 校验（安全）

`redirect` 来自 URL query，用户可控，**必须校验**，否则构成开放重定向。
且它现在是跨文档跳转的目标，`window.location.href` 会接受绝对 URL，风险更实际：

```ts
function safeRedirect(value: unknown): string {
  if (typeof value !== "string") return "/app/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/app/";
  if (!value.startsWith("/app")) return "/app/";   // 只允许回主应用
  return value;
}
```

比旧文档更严：不仅拒绝 `//evil.com` 与 `https://evil.com`，还**只接受 `/app` 前缀** ——
登录后没有正当理由把人送到克隆站的展示页。
query 参数经解析可能是数组（`?redirect=a&redirect=b`），故先做类型判定。

### 7.7 删除 AuthDialog

`frontend/src/components/AuthDialog.vue` 删除，`App.vue:6` 的 import 与 `:69` 的
`<AuthDialog />` 一并删除。它是本轮唯一删除的主应用文件。

## 8. 12 条路由的接通状态

| 路由 | 状态 | 本轮改动 |
|---|---|---|
| `/` | 展示 | 无。8 个章节 + 5 个 WebGL 场景照常；`SiteHeader` 的 Login/Join 链接已指向 `/signin` `/signup`（`SiteHeader.vue:84-85`），`FixedSignUpButton.vue:49` 已指向 `/signup` |
| `/about` `/our-product` `/pricing` `/faq` `/community-board` | 展示 | 无 |
| `/signin` | **接后端** | §7 全部 |
| `/signup` | **接后端** | §7 全部 |
| `/gift-card` | 本地演示 | 无。`GiftCardPage.vue:56` 的 `.clone-local-note` 保留 —— 它确实不发请求，提示是真的 |
| `/terms-and-conditions` `/privacy-policy` `/cookies-policy` | 展示 | 无。内容是 follow.art 的法务文本，子项目 2 处理。**注意 `content/subpages/auth.ts:79` 的注册页服务条款链接指向这两条路由，它们现在真实存在，不再悬空** |
| `/:catchAll(.*)` | 404 | 无，落 `NotFoundPage` |

### 8.1 本轮删除的元素（功能性死元素）

判据是 §1 的原则：**点了没反应、或说的与实际行为相反**。

| 元素 | 位置 | 理由 |
|---|---|---|
| `Local clone demo — nothing you type leaves this page.` | `pages/SignInPage.vue:17` | 接通后端后这句话是**假的** |
| `Local clone demo — no account is created and nothing is stored.` | `pages/SignUpPage.vue:15` | 同上，注册会真的建号 |
| Facebook / Google OAuth 按钮 | `AuthPanel.vue:194-210` | 复刻站自己就是死按钮（`type="button"` 无 handler），本系统无第三方登录。点了没反应 = 缺陷 |
| `I forgot my password` | `AuthPanel.vue:294-318` | 后端只有 `/auth/login` 与 `/auth/register`（`Api.java:9-10`），无找回密码接口 |
| `Remember me for 24 hours` | `AuthPanel.vue:280-293` | `session.ts:16` 无期限写 localStorage，无 24 小时逻辑；JWT 实际 8 小时（`Auth.java:41`）。勾了没效果 = 缺陷 |
| artist / curator radio | `AuthPanel.vue:217-220` | `Auth.java:31` 注册一律 `role='USER'`，无角色选择 |
| `Artist / curator radio pair: presentation unmeasured.` | `AuthPanel.vue:387-389` | 是复刻站的取证待办标记，且描述的控件已随上一项删除 |

### 8.2 本轮**保留**的元素（属内容，子项目 2 处理）

| 元素 | 位置 | 保留理由 |
|---|---|---|
| `or login with e-mail` / `or join with e-mail` | `AuthPanel.vue:212`、`content/subpages/auth.ts:61`、`:73` | 删掉会让 tab 与表单之间失去 `margin-top:34px` + 一行 10.71px 文字的过渡（`AuthPanel.vue:454-461`）。文案是英文但**不矛盾**（确实是用邮箱样式的字段登录）。子项目 2 中文化时一并处理 |
| 全部英文文案与 FOLLOW.ART 品牌 | `content/` 18 文件 | 决策 5 |
| 13 组 SVG 字模 | `content/displayHeadings.json` | §13 |
| newsletter 订阅勾选 | `content/subpages/auth.ts:80` | 勾了确实没效果，属缺陷；但它同时是**测量到的 DOM 结构**的一部分，删除会改变注册页几何。本轮保留并在 §11 记为已知缺陷，子项目 2 随中文化一并删除 |
| 服务条款 / 隐私政策链接 | `content/subpages/auth.ts:79` | 目标路由真实存在（见 §8 表），链接不悬空 |

## 9. 工具链统一：已验证与未验证

### 9.1 已验证：typecheck 通过（5 个死引用）

合并后只能有一套工具链，取主应用的版本。已用主应用的二进制直接跑克隆站源码验证
（只读操作，未改任何文件、未装任何包）：

| 工具链 | 结果 |
|---|---|
| 基线：vue-tsc **2.2.12** + TS **5.8.3**（克隆站自带） | exit 0，零输出 → **基线有效** |
| 待测：vue-tsc **3.3.11** + TS **5.9.3**（主应用自带） | exit 2，**5 个错误，全部 `TS6133`** |

5 处全部是"声明未使用"，**零类型错误、零 API 不兼容**：

| 文件 | 变量 |
|---|---|
| `components/SiteHeader.vue:40` | `headerEl` |
| `features/home/HomeCard.vue:21` | `content` |
| `features/home/HomeConnectory.vue:22` | `webgl` |
| `features/home/HomeGetSeen.vue:28` | `webgl` |
| `features/home/HomeTestimonials.vue:25` | `webgl` |

**定性：这 5 个是只写不读的死模板 ref，不是 vue-tsc 3 的误报。**
逐个核实过：都以 `const x = ref<HTMLElement|null>(null)` 声明、在模板里绑 `ref="x"`，
但 script 里**从未读取**。WebGL 挂载走的是 `App.vue:105` 的
`document.querySelector('[data-section-id="…"]')`，不经过这些 ref。
vue-tsc 2 把字符串 `ref="x"` 算作对绑定 `x` 的使用，vue-tsc 3 不算了。

修法：删除这 5 个声明与对应的 `ref="…"` 属性。
`ref` 属性编译后不进 DOM，所以**零运行时、零渲染影响**，§10.2 的对照基线不受影响。
实施时对每一处都要先确认 script 内确实无读取，再删。

不采用 `noUnusedLocals:false` —— 那会削弱两边全部源码的检查强度。

### 9.2 未验证：Vite 7 + plugin-vue 6 的实际构建

typecheck 覆盖了最高风险的面（93 个严格模式 TS/Vue 文件），但**构建无法在不做合并
脚手架的前提下忠实测试**：直接拿主应用的 Vite 7 二进制跑克隆站配置，
`@vitejs/plugin-vue` 会从克隆站自己的 `node_modules` 解析成 v5，
那不是合并后的真实组合，测出来的结果无论成败都会误导。

降低风险的已核实事实：

- `.glsl` 走标准 `?raw` 导入（`createCardRing.ts:54-57` 等 5 个文件、12 处），
  Vite 6→7 稳定；`webgl/shaders/glsl.d.ts` 提供了比 `vite/client` 更具体的模块声明
- **无 PostCSS / Sass / Tailwind 配置**（已实测），避开 Vite 7 移除 Sass legacy API 的坑
- Node **v24.18.0**，满足 Vite 7 的 20.19+ / 22.12+ 要求
- `import.meta.glob`（§5.6）与 `resolveJsonModule`（`displayHeadings.json` 44KB、
  `assets.manifest.json`）都是稳定特性

**Abort 判据**：实施第 1 步就是一次 `npm install` + `vue-tsc --noEmit` + `vite build`。
若构建在 Vite 7 / plugin-vue 6 下失败且无法在合理代价内修复，**停止子项目 1，
退回拓扑 C**（双工程同源反代：克隆站留在 `logn in/` 用自己的 Vite 6 工具链占根路径，
主应用退到 `/app/`，新增 nginx 进 `deploy/compose.yml`）。
拓扑 C 的代价是主应用 URL 同样要迁到 `/app/`（§6 的结论不变）、
且要新增并维护一个项目目前没有的 nginx，但克隆站工具链零改动。
这个判据必须在动手前就认下，不能构建失败后再临时改方案。

## 10. 验收标准

### 10.1 构建与产物

- `npm install` 成功，`frontend/package.json` 含 three / lenis / pinia
- `npm run build`（= `vue-tsc --noEmit && vite build`）**exit 0，零错误**
- `npm test`（`frontend/tests/api.test.mjs`）绿
- `dist/index.html` 与 `dist/app.html` 都存在
- Vite 产物落在 `dist/_app/`，publicDir 资产落在 `dist/assets/`、`dist/fonts/`，
  两者不混
- **CSS 隔离检查**：`dist/index.html` 引用的 CSS 里**不含** `--el-color-primary`
  与 PeakRush 的 `#ff4e16`；`dist/app.html` 引用的 CSS 里**不含** `HeadingNow`
  与 `--scale-text-rem`。这是 §4.1 隔离前提的直接证据

### 10.2 渲染对照（基线换了）

**基线是合并前单独运行的克隆站**（`logn in/` 原地 `npm run dev`，端口 5175），
不是 follow.art 线上站，也不是测量文档里的数字。

理由：本轮**不改克隆站任何一行 CSS**（§4.1），所以合并后的渲染应当与合并前逐像素相同。
这比旧文档 §9.2 那套"对照测量文档数字"的口径强得多 —— 测量数字是给复刻工程验收用的，
而这里要验的是"合并有没有引入退化"。

对照范围：12 条路由 + 404，视口 **1376×772**（克隆站的测量基准，
`AuthPanel.vue:5-6`）。视口必须显式设定并在证据里记录实际值，不假设它不漂移。

**注册页 `/signup` 允许高度不同**：本轮给它加了确认密码字段（§7.2，约 +66px）
并删了两条 notice 与 radio 说明行（§8.1）。登录页 `/signin` 也因删除 OAuth 行
（28.66px + 60px margin）、忘记密码（18px + 40px margin）、两条 notice 而变矮。
所以对照的判据是**未改动区域的像素一致**，改动区域单独列清单说明。

WebGL 需要真实 GPU 上下文。若采集环境是软件渲染，WebGL 内容可能根本不挂载 ——
这种情况下**必须把采集环境写进证据**，不能拿"两边都一样黑"当作通过。

### 10.3 auth 功能实跑（浏览器，逐步留 DOM 与网络证据）

- `/signin` 登录成功 → token 与 user 落 localStorage → 跳 `/app/`，主应用显示登录态
- `/signin` 登录失败 401 → 表单级错误显示后端那句「用户名或密码不正确」
- `/signup` 注册成功 → 直接登录态 → 跳 `/app/`
- `/signup` 重名 409 → 显示「用户名已存在」
- 字段校验逐条：用户名含非法字符（如 `张三`、`a@b`）、用户名 <3 / >40、
  密码 <8、密码 >72 字节（用多字节字符构造）、两次密码不一致
- 用 `type="text"` 的用户名框能提交 `admin_01` 这类无 `@` 的合法用户名
  （这是 §7.1 推论 1 的直接验证）
- 四个入口逐个验证回跳目标：`/app/` 顶栏、抢购弹窗、`/app/orders`、`/app/admin`
- `reason=expired` 显示过期提示
- 开放重定向拦截：`?redirect=//evil.com`、`?redirect=https://evil.com`、
  `?redirect=/signin`、`?redirect=a&redirect=b` 四种都回落到 `/app/`
- 已登录访问 `/signin` 直跳 `/app/`，不渲染表单
- 密码眼睛按钮在登录页、注册页密码框、确认密码框三处都能切换 `type`

### 10.4 主应用零回归

`/app/`、`/app/activities/:id`、`/app/orders`、`/app/admin` 四条路由逐个实跑：

- 全站主色仍是 `#ff4e16` 而非 Element 蓝
- 抢购全流程（含排队、幂等重试、不确定态）与改动前一致
- 深层 URL 直接访问与刷新都能正确加载（验 §5.4 的 fallback 插件）
- `format.ts` 的 `/assets/product-*.png` 4 张图仍能加载

### 10.5 深层 URL 与刷新

- `/about`、`/pricing`、`/gift-card` 直接访问与刷新 → 200 且渲染正确
- `/app/orders`、`/app/admin` 直接访问与刷新 → 200 且渲染正确
- `/nonexistent` → 克隆站 `NotFoundPage`
- `/app/nonexistent` → 主应用的兜底重定向（`main.ts:18`）到 `/app/`

## 11. 已知缺陷（本轮接受，登记待办）

| 缺陷 | 位置 | 处理时机 |
|---|---|---|
| newsletter 勾选框勾了没效果 | `content/subpages/auth.ts:80` | 子项目 2 随中文化删除（§8.2） |
| `requireLogin` 的三句上下文提示语丢失 | `session.ts:27`、`PurchaseDialog.vue:142` | 文档级隔离的固有代价，无法在不用 cookie/URL 传参的前提下解决（§7.5）。若日后认为不可接受，需改为同源单入口方案 |
| 登录后整页刷新（非 SPA 跳转） | §7.5 | 同上，双入口的固有代价 |
| 全站仍是 follow.art 英文品牌 | 全站 | 子项目 2 |
| 法务页是 follow.art 的条款文本 | `/terms-and-conditions` 等 3 条 | 子项目 2 |
| `logn in/README.md:5` 引用的 `evidence/reference/pending.json` 在 git 里不存在（`evidence/` 已忽略） | — | 接受，属溯源材料的已知缺口 |

## 12. 授权与风险（记录在案）

`logn in/README.md:64-68` 明确写：

> `src/content/assets.manifest.json` 记录 105 个资产的真实来源 URL、字节、sha256 与权利
> 状态。**全部为 `permission-required`**：从公开页面抓取不等于再分发许可。因此本项目仅限
> 本地研究，不做公开部署，不把字体文件与艺术家卡面作为交付物分发。

本轮会把以下内容并入 PeakRush 的构建产物与 git 历史：

- **23MB 抓取资产**（people 12M、product 4.5M、decor 3.2M、cards 2.1M、subpages 1.3M）
  —— 其中 `assets/people/` 12MB 是真实人物照片
- **HeadingNow（商用字体）与 Hardbop** 244KB
- **follow.art 的整套视觉设计语言**：分栏布局、按钮基元、输入框样式、栅格与令牌体系、
  13 组描摹自参考站的 SVG 字模

这比旧文档 §10 记录的暴露面大一个数量级（旧方案只搬 2 个字体文件）。
用户已在知情前提下选择整站并入，此项记录在案。

**若本作业需要公开部署或对外分发，23MB 抓取资产与商用字体的授权状态必须先解决。**
子项目 2 的品牌替换只改文案与字模，**不会**降低资产与字体的授权风险。

另需注意：把 23MB 资产提交进 git 历史后，即使日后删除，历史里仍占空间。
若这不可接受，应在实施第 3 步（搬 public）**之前**提出，改用 Git LFS 或
把资产留在 `logn in/public/` 由构建脚本软链/复制。

## 13. 子项目 2 的待决问题（本轮不展开，仅登记）

子项目 2 开工前必须先定这一项，因为它决定子项目 2 是文案工作还是设计工作，
量级差很多：

**13 组 SVG 字模怎么处置。** `content/displayHeadings.json` 里约 36KB 的手工描摹路径，
被 7 处 `svg-key` 使用（`AuthPanel.vue:145`、`HomeCard.vue:50`、
`HomeConnectory.vue:75`、`HomeHero.vue:86`、`HomeJoinUs.vue:70`、
`HomeTestimonials.vue:67`）：

| key | 体量 | 内容 |
|---|---|---|
| `follow-art` | 2537B | 首页 hero 的巨型 FOLLOW.ART 字模 |
| `card` `testimonials` `connectory` `join-us` | 1973–3323B | 首页章节标题字模 |
| `get-seen-icon-1/2` | 4819B + 4827B | 装饰图标 |
| `about-title` `product-intro` `pricing-title` `gift-card-title` | 2229–4022B | 子页标题字模 |
| `signin-wordmark` `signup-wordmark` | 2868B ×2 | auth 页左侧字模 |

矢量路径无法用文本替换改成中文或 PeakRush。三个方向：文本回退
（`DisplayHeading.vue:82-84` 已有 `v-if="!svg"` 分支，零设计成本，但 hero 大字模
变成一行文本、且那些标题块的测量几何全部失效）、重新绘制字模（保真，但是矢量设计
工作而非代码工作）、保留英文字模（站内中英混杂，首页最大的字仍是 FOLLOW.ART）。

子项目 2 的其余已知项：`content/` 18 文件 383KB 文案重写、CJK 字体栈与负字距处理
（HeadingNow 是纯拉丁字体，`typography.css:44` 的 `letter-spacing:-.03em`
不适合 CJK）、左侧面板配色（旧文档 §9.4 已算过：白字 on `#ff4e16` 是 3.31:1，
黑字 6.35:1，白字 on `#d93808` 是 4.68:1）、中文化后的几何重建与基线重立。

## 14. 实施顺序

顺序有硬依赖，不能调换：基线必须在搬迁**之前**采集（否则 §10.2 没有对照对象）；
abort 判据必须在源码与配置都就位**之后**才能执行（否则 `vite build` 无物可编译）。

1. **采集合并前基线**。`logn in/` 原地 `npm run dev`（端口 5175），
   按 §10.2 的口径截 12 条路由 + 404，视口 1376×772，把实际视口与采集环境
   （是否软件渲染）写进证据。这一步之后不要再动 `logn in/` 的
   `node_modules` 或任何配置，否则基线不再代表"合并前"
2. 搬源码：`logn in/src/` → `frontend/welcome/`（排除 `testing/`）
3. 修 `welcome/app/App.vue:63-64,148` 的 glob → 动态 import（§5.6）。
   **这一步漏了不会报错，只会让全站 WebGL 静默失效**
4. 修 5 个 `TS6133` 死引用（§9.1）。逐个先确认 script 内确实无读取再删。
   必须在第 6 步的 typecheck 之前做完，否则构建红
5. 搬 `public/`：克隆站的 `assets/`(23MB) + `fonts/` + `icons.svg` 合并进
   `frontend/public/`。**⚠️ 这一步把 23MB 抓取资产带进 git 历史，是单向门，
   见 §12 的最后一段。若要改用 LFS 或留在原地由构建脚本复制，必须在此步之前决定**
6. 合并配置：`package.json`（§5.7）、`tsconfig.json`（§5.5）、
   `vite.config.ts`（§5.3）、拆入口 HTML（§5.2）
7. **`npm install` + `npm run build`（= `vue-tsc --noEmit && vite build`）。
   abort 判据在此**：失败且无法在合理代价内修复 → 停止子项目 1，
   退回拓扑 C（§9.2）。这个判据必须在动手前就认下，不能失败后再临时改方案
8. 验 §10.1 的产物检查，特别是 CSS 隔离那一项
9. 主应用 `main.ts:9` 改 `createWebHistory("/app/")`（§6.1）
10. 实现 §5.4 的 MPA history fallback 插件，验 §10.5 的深层 URL 与刷新
11. 新建 `welcome/app/authApi.ts`，改 `AuthPanel.vue` 接后端（§7.1–§7.4）
12. 删 §8.1 表里的 7 项功能性死元素
13. 改 `session.ts`（`requireLogin` 跨文档跳转、删 `authOpen`、`safeRedirect`）
    与过期事件路径（§7.5、§7.6）
14. 删 `AuthDialog.vue` 及其在 `App.vue:6`、`:69` 的两处引用（§7.7）
15. 改 `scripts/app-start.ps1:64` 健康检查（§5.8）
16. 更新 `README.md`、`docs/STARTUP_GUIDE.md`、`docs/ARCHITECTURE.md`、
    `frontend/README.md` 里的 URL 说法（§6.3）
17. 按 §10.2–§10.5 逐项取证

第 1 步与第 7 步是两个不能移位的锚点：一个定义了验收基线，一个定义了 abort 时机。
其余步骤在满足这两个约束的前提下可以微调。

