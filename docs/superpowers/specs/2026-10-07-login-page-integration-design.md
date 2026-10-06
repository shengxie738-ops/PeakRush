# 把 follow.art 复刻站的登录页接入 PeakRush

> **⚠️ 已被取代（2026-10-07）**
>
> 本文档写于范围为"只搬登录面板"时。用户随后把范围扩大为"整个复刻站作为系统入口"，
> 现方案见 `2026-10-07-portal-merge-design.md`。
>
> 本文档的 **§5 整章（CSS 前缀化 / 去层 / rem 转换）在新范围下作废** ——
> 双入口 = 两个文档，克隆站的全局 CSS 天然不外泄，不需要任何隔离工程。
> §6（集成方式）、§7.1（`initSession` 注入）、§8.7（词标改文本渲染）、
> §9.2（对照测量文档数字的几何验收）也已被取代。
>
> 仍然有效并已在新文档 §4.2 / §7.1 重述的实测结论：
> §3.2 后端契约（`Auth.java:30`）、§4.3 `home-overrides.css` 承载按钮基元、
> §5.4 rem 与根字号机制、§5.5 尺寸链解析、§9.4 配色对比度核算、§10 授权状态。
>
> 保留本文档仅为审计轨迹。

日期：2026-10-07
状态：已被取代

## 1. 目标

把 `logn in/`（follow.art 桌面端高保真复刻站，Vue 3 + Vite）里的 `/signin` 页面接入
PeakRush 作为系统登录页，同时把 `/signup` 接入为注册页，彻底替换现有的
Element Plus 弹窗式登录。

两个工程同为 Vue 3 + Vite + vue-router，框架层面同源，可移植。

## 2. 已确认的八项决策

| # | 决策点 | 选择 |
|---|---|---|
| 1 | 接入范围 | `/signin` + `/signup` 两条路由，删除 `AuthDialog.vue` |
| 2 | 移植方式 | 样式作用域化移植（不做独立入口，不做视觉重写） |
| 3 | 内容取舍 | 中文化 + 删除所有无后端支撑的元素 |
| 4 | 登录后回跳 | 带 `redirect` query 回跳原页，不恢复抢购弹窗上下文 |
| 5 | 验收门槛 | 浏览器功能实跑 + 几何对照（不搬 Playwright 像素回归基建） |
| 6 | 页面布局 | 不带 PeakRush 顶栏与页脚，登录页独占 100svh |
| 7 | 面板配色 | 两页左面板都改用 PeakRush 橙，不保留 follow.art 绿 |
| 8 | 密码可见切换 | 登录页与注册页都加眼睛按钮 |

## 3. 现状：两边的真实形态

### 3.1 PeakRush 现有登录不是页面，是弹窗

`frontend/src/components/AuthDialog.vue` 是一个 440px 的 `el-dialog`，登录/注册两个 tab
在同一弹窗内切换。由 `frontend/src/session.ts:27` 的 `requireLogin(message)` 打开，
四个调用点：

| 调用点 | 上下文提示语 |
|---|---|
| `frontend/src/App.vue:59` | 默认「登录后，开启你的好物时刻。」 |
| `frontend/src/components/PurchaseDialog.vue:142` | 「登录后即可参与本场抢购。」 |
| `frontend/src/pages/OrdersPage.vue:136` | 默认 |
| `frontend/src/pages/AdminPage.vue:560` | 默认 |

另有 `frontend/src/session.ts:50` 监听 `peakrush:expired` 事件（由
`frontend/src/api.ts:42` 在非 auth 路径收到 401 时派发），执行 `logout()` +
`requireLogin('登录已过期，请重新登录后继续。')`。

弹窗语义是「原地打开、原地关闭」，用户停留在当前页面。改成路由页后这个语义会变，
见 §7。

### 3.2 后端契约比复刻站的表单严格

`backend/src/main/java/com/peakrush/Auth.java:28` 的 `login(input, register)` 一个方法
同时服务登录与注册，`backend/src/main/java/com/peakrush/Api.java:9-10` 分别映射到
`POST /api/auth/login` 和 `POST /api/auth/register`。请求体 `{username, password}`，
成功返回 `{token, user}`。

`Auth.java:30` 的校验：

```java
if(!name.matches("[A-Za-z0-9_]{3,40}")||password.length()<8
   ||password.getBytes(StandardCharsets.UTF_8).length>72)
  throw ApiException.bad("用户名须为3–40位字母数字下划线，密码须为8–72字节");
```

三条推论，全部影响本次实施：

1. **用户名不是邮箱**。正则 `[A-Za-z0-9_]{3,40}` 不含 `@` 与 `.`。复刻站
   `content/subpages/auth.ts:53` 把字段做成 `type: 'email'`，若照搬，浏览器会在提交前
   拦下 `admin_01` 这类合法用户名。必须改为 `type="text"`。
2. **现有前端校验已经和后端不一致**（先于本次改动就存在的缺陷）：
   `AuthDialog.vue:26` 只校验密码 ≥6 位，后端要 ≥8 位；`AuthDialog.vue:22` 只校验用户名
   ≥3 位，不校验字符集。用户填 6 位密码会通过前端、被后端打回一条含两套规则的长文案。
   本次一并对齐。
3. **JWT 有效期是 8 小时**（`Auth.java:41`，`plusSeconds(28800)`）。复刻站的
   「Remember me for 24 hours」连数字都与本系统不符。

注册是一步完成的：`Auth.java:31` 直接 `INSERT INTO app_user(...,'USER')` 并返回 token，
没有第二步、没有角色选择。复刻站的 `SIGNUP_STEP2`（角色 radio、姓名、国家选择器、头像）
在本系统无对应后端，整个不要。

### 3.3 复刻站 AuthPanel 的依赖面

`logn in/src/components/AuthPanel.vue`（805 行）不自包含，依赖：

- 五张全局样式表（`logn in/src/styles/`）
- HeadingNow 与 Hardbop 两个字体（`logn in/public/fonts/`，244KB）
- `DisplayHeading.vue` → `content/home.ts` → `displayHeadings.json`（44KB）渲染左侧词标
- `content/assetRegistry.ts` 的 `ICON_SPRITE` + `iconAttrs/iconId` 渲染 OAuth 按钮图标
- App 外壳的 `SiteHeader`、`CookieConsent`、`FixedSignUpButton`、Lenis 平滑滚动、
  motion runtime、WebGL 场景注册

其中后三类**在决策 3 之下全部可以砍掉**，见 §4。

## 4. 搬运面

### 4.1 搬

| 来源 | 去向 | 说明 |
|---|---|---|
| `logn in/src/styles/reset.css`(49 行) | `frontend/src/auth/auth-scope.css` | 前缀化 + 去层，见 §5 |
| `logn in/src/styles/tokens.css`(856) | 同上 | |
| `logn in/src/styles/typography.css`(270) | 同上 | |
| `logn in/src/styles/layout.css`(1013) | 同上 | |
| `logn in/src/styles/home-overrides.css`(1036) | 同上 | **必须搬**，见 §4.3 |
| `logn in/src/components/AuthPanel.vue` | `frontend/src/auth/AuthPanel.vue` | 重写模板与 script，样式并入 auth-scope.css |
| `logn in/src/content/subpages/auth.ts` | `frontend/src/auth/auth-content.ts` | 中文文案与字段定义 |
| `logn in/public/fonts/*`(4 文件 244KB) | `frontend/public/fonts/` | 授权状态见 §10 |
| — | `frontend/src/auth/SignInPage.vue`、`SignUpPage.vue` | 新建，各自只渲染 `<AuthPanel mode=…>` |

### 4.2 不搬

- `displayHeadings.json`(44KB)、`content/home.ts`、`DisplayHeading.vue` ——
  词标改走文本渲染。`DisplayHeading.vue:82-84` 本来就有 `v-if="!svg"` 的文本回退分支
  （输出 `title.toUpperCase()`），说明这条路是复刻站自己承认的降级路径。既然确定不用
  SVG 字形，就不必引入 `DisplayHeading.vue`，直接渲染一个文本元素，省掉 44KB JSON 与
  `content/home.ts` 整条依赖链。
- `content/assetRegistry.ts`、`public/icons.svg`(112KB) —— AuthPanel 只在 OAuth 按钮
  循环里用 `iconAttrs/iconId`（`AuthPanel.vue:205-207`），OAuth 删除后无消费者。
- `public/assets/`(23MB) —— 全部是首页章节的图片资产，登录页不用。
- Lenis、three、pinia —— 登录页不滚动、无 WebGL 场景、无跨组件状态。
- `SiteHeader.vue`、`CookieConsent.vue`、`FixedSignUpButton.vue`、`PromoFooter.vue`、
  `app/App.vue` 外壳 —— 决策 6 之下登录页不带这些。
- `logn in/` 的 Playwright、capture/compare/verify 脚本、`evidence/`、`quality/`、
  `design/`、`.scratch/` —— 决策 5 之下不引入。

**本次需要新增的 npm 依赖：0 个。**

### 4.3 为什么 home-overrides.css 必须搬

初判时因为它 0 条 auth/layout-split/input-text/form-label/error-list 规则而打算跳过。
实测推翻：AuthPanel 按钮类列所依赖的基元**只在这个文件里**。

各类名的定义分布（命中数）：

| 类 | tokens | typography | layout | home-overrides |
|---|---|---|---|---|
| `.btn` | 14 | — | — | **180** |
| `.btn--primary` | — | — | — | **1** |
| `.btn--full` | — | — | — | **6** |
| `.btn--link--small` | — | — | — | **1** |
| `.btn--text-card-h1` | — | — | — | **3** |
| `.btn--text-right` / `--text-left` | — | — | — | **1 / 1** |
| `.btn__text` | — | — | — | **14** |
| `.btn__icon` | — | — | — | **2** |
| `.btn--accent` | — | 1 | — | 11 |
| `.btn--smallish` | 1 | — | — | 1 |
| `.btn--link` | 2 | — | — | 15 |

`layout.css` 与 `reset.css` 里 "btn" 出现 0 次。`AuthPanel.vue:415` 的注释
「the button primitives live in @layer overrides」指的正是 home-overrides.css。

另有两个类名全仓 0 命中：`.btn--space-between`、`.btn--start`。它们是复刻站从参考站
类列里照抄来的惰性类名，无规则，无需处理。

### 4.4 不做 CSS 子集筛选

五张表合计约 4260 行 / 143KB 全量搬运并前缀化。理由：筛选子集需要人工判断每条规则是否
被登录页命中，漏一条就是一个视觉缺陷，且这类缺陷只在特定状态下出现、极难发现；
前缀化后未命中的规则是惰性的，代价只是 CSS 体积（gzip 后约 25KB），且按 §6 会被切进
路由级 chunk，其他路由根本不加载。

## 5. CSS 隔离机制

### 5.1 冲突是真实的，不是理论上的

复刻站五张表都声明 `@layer reset, base, utilities, components-base, components, overrides;`
并使用具名层。而 `frontend/src/style.css`（1873 行）与 `element-plus/dist/index.css`
都是**无层**样式。CSS 层叠规则里无层样式优先级高于任何具名层，与特异性无关。

`style.css` 中会实际压掉登录页样式的无层全局规则：

| style.css | 行 | 后果 |
|---|---|---|
| `button{color:inherit}` | 44 | 压掉 `.btn` 的 `--btn-text`，提交按钮文字失色 |
| `button,input,textarea,select{font:inherit}` | 28-33 | 压掉 `@layer base` 的 HeadingNow 字体栈 |
| `button:focus-visible,a:focus-visible{outline:3px solid #ff966e}` | 51-55 | PeakRush 橙色焦点环出现在登录页 |
| `:root{font-family:Inter,"Noto Sans SC",…}` | 1-21 | 与复刻站字体栈竞争，见 §9.3 |
| `#app{min-height:100vh;display:flex;flex-direction:column}` | 66-70 | 与 `.layout-split{min-height:100svh}` 叠加 |

### 5.2 解法：给搬来的 CSS 去层，而不是给现有 CSS 加层

**不**把 `style.css` 或 Element Plus 包进层。因为 `style.css:12-20` 那批
`--el-color-primary` 覆盖正是靠「无层、后加载」才压过 Element Plus 自己的
`:root{--el-color-primary:#409eff}`。一旦给 `style.css` 降层，全站主色会退回 Element 蓝。
这个回归风险远大于收益。

改走反方向：把搬来的五张表**去掉 `@layer` 包装**，按
`reset → base → utilities → components-base → components → overrides` 顺序拼接成单一
`auth-scope.css`。结果全是无层样式，靠两个优势赢过 `style.css`：

1. **加载顺序更晚** —— 由路由组件引入，见 §6
2. **特异性更高** —— `.auth-scope .btn{color:…}` 是 (0,2,0)，`button{color:inherit}`
   是 (0,0,1)

**拼接顺序的第六项**：`AuthPanel.vue:403-805` 自己的 `<style>` 块在源工程里是**无层**的
（`:415` 注释明说「Unlayered on purpose: the button primitives live in @layer overrides
and the tab / submit geometry has to beat them」）。无层在原层叠里优先级最高，所以去层后
它必须排在拼接结果的**最末尾**，即
`reset → base → utilities → components-base → components → overrides → AuthPanel 自有规则`。
放错位置会让 `.btn--*` 基元反压 tab 与提交按钮的几何。

去层的**前提条件**：源顺序不得与层顺序矛盾。若某个低层规则在源文件里出现在高层规则之后，
去层后它会反胜。五张表各自在文件头声明层顺序、内部有多个 `@layer X{}` 块，需要机械校验
「按文件内出现顺序排列的层名序列是非递减的」。这一步写进实施计划（§11 第 1 步），
校验不通过就不能去层，必须改为保留层 + 另想隔离办法。

`@media print{@layer reset{…}}`（`reset.css:43-49`）去层后变成普通 `@media print{}`，
其中 `body,html{overflow:visible}` 这类无法前缀的规则按 §5.3 处理。

### 5.3 前缀化规则

朴素前缀化（给每个选择器前面加 `.auth-scope `）对**祖先元素**无效：`.auth-scope body`
永不命中，因为 `body` 是 `.auth-scope` 的祖先。五张表里有大量 `body` 出现在选择器列表中，
必须按语义改写而非机械加前缀。

| 原选择器头 | 改写为 | 理由 |
|---|---|---|
| `:root` | `.auth-scope` | 自定义属性靠继承下发，挂在作用域根等效 |
| `body` | `.auth-scope` | `.auth-scope` 在本作用域内扮演 body 的角色（子树的顶） |
| `html` | **丢弃该分支** | 无法在子树内表达；逐条判断见下表 |
| `main`、`picture` | **丢弃该分支** | 是 `.auth-scope` 的祖先（`App.vue:64`） |
| `*`、`:before`、`:after` | `.auth-scope *`、`.auth-scope:before`、`.auth-scope:after`、`.auth-scope *,:before,:after` | 需覆盖作用域根本身 |
| 其他任意 `X` | `.auth-scope X` | 常规 |

选择器列表里混合了可前缀与不可前缀项时（如 `tokens.css:144` 的
`.ui-blue,.ui-dark,.ui-green,.ui-light,.ui-orange,.ui-pink,.ui-print,body`），
**逐项分别改写**，不可前缀的项按上表处理，不能整条丢弃。

`@font-face`（`typography.css:29-30`）**必须留在顶层**，不能前缀化 —— `@font-face`
只在顶层生效。其 `src:url(/fonts/…)` 是绝对路径，字体搬到 `frontend/public/fonts/`
后原样可用。

`@media` 查询块本身保持不变，只改写块**内部**的选择器。

### 5.3.1 逐条处理清单

| 原规则 | 位置 | 处理 |
|---|---|---|
| `html{height:100%;font-size:.625em;overflow-x:hidden;scroll-behavior:smooth}` | `reset.css:28` | **整条丢弃**。根字号见 §5.4；`overflow-x`/`scroll-behavior` 交给 PeakRush 现有全局设置 |
| `body{background:var(--t-background);margin:0;min-height:100svh}` | `reset.css:29` | `body`→`.auth-scope`。`min-height:100svh` 与 `.layout-split` 的同值声明叠加无害 |
| `body,button,input,select,textarea{font-feature-settings…}` | `reset.css:30` | `body`→`.auth-scope`，其余加前缀 |
| `blockquote,dd,…,h1..h6,hr,p{margin:0}` | `reset.css:31` | 常规前缀化 |
| `a{text-decoration:none}` | `reset.css:32` | 常规前缀化 |
| `dialog{…}`、`dialog[open]{…}`、`iframe,video{…}` | `reset.css:33-34`、`:39` | **丢弃**。登录页无 dialog / iframe / video 元素 |
| `*,:after,:before{box-sizing:border-box}` | `reset.css:35` | 按 §5.3 表改写；与 `style.css:22-24` 的同名规则一致，无冲突 |
| `main,picture{display:block}` | `reset.css:36` | **丢弃**。二者是祖先，且默认就是 `display:block`，无副作用 |
| `img{user-select:none;vertical-align:top}` | `reset.css:37` | 常规前缀化 |
| `@media print{@layer reset{html{height:auto}body,html{overflow:visible}body{min-height:0;width:100%}}}` | `reset.css:43-49` | **整块丢弃**。全是 html/body 规则，去层后也无法前缀 |
| `:root{--scale-px:1px;--scale-rem:1rem;--scale-text-px:1px;--scale-text-rem:1rem}` | `tokens.css:105` | `:root`→`.auth-scope`，且 `rem` 值按 §5.4 转换 |
| `@media (…){:root{--scale-px:clamp(…);--scale-text-rem:clamp(.7rem,…)}}` | `tokens.css:107` | 媒体查询保留，内层 `:root`→`.auth-scope`，`rem` 值按 §5.4 转换。**这条是全部尺寸的真实来源**，漏掉它登录页会退到 105 行的兜底值，所有字号与间距放大到 1/0.9555 倍 |
| `:root{--spacing:…;--spacing-header:…}` | `tokens.css:122` | `:root`→`.auth-scope` |
| `:root{--c-white:…;--c-orange:#f4793a;--c-green:#8e9487;--c-error:#ea1b4f}` | `tokens.css:129` | `:root`→`.auth-scope` |
| `.ui-blue,.ui-dark,.ui-green,.ui-light,.ui-orange,.ui-pink,.ui-print,body{…}` | `tokens.css:144` | 逐项改写：7 个 `.ui-*` 加前缀，`body`→`.auth-scope` |
| `.ui-*-background` 系列含 `body` | `tokens.css:787`、`:800`、`:802` | 逐项改写。注意 `:802` 的 `.body` 是**类名**（有点号），照常加前缀；同行的 `.ui-background body` 里 `body` 是元素，改为 `.auth-scope` |
| `:root{--is-visible--sm-down:…}` | `tokens.css:813` | `:root`→`.auth-scope` |
| `:root{--promo-header-height:…}` | `tokens.css:819` | **丢弃**，登录页不渲染 promo-header |
| `body{--cookie-message-mobile-height:0px;…}body.cookie-message-active{…}.cookie-message{…}` | `tokens.css:825` | **丢弃**，不搬 CookieConsent |
| `body,button,input,select,textarea{color:var(--t-text);font-size:…;font-family:HeadingNow,…;letter-spacing:-.03em;--fos:-.169em;--foe:-.088em}` | `typography.css:44` | `body`→`.auth-scope`，其余加前缀。**登录页排版的主规则**，见 §9.3 |
| `.win body,.win button,.win input,.win select,.win textarea{--fos:-.169em;--foe:-.088em}` | `typography.css:57` | 加前缀后为 `.auth-scope .win …`，**惰性但无害**。`.win` 全仓从未被任何 TS/Vue 代码加上（只在 CSS 里作为 `.btn,.win .btn` 这种重复分支出现），在复刻站里本身就不生效；`--fos`/`--foe` 已由 `typography.css:44` 提供 |
| `body:has(.scrollable--root),html:has(.scrollable--root){overflow:clip}` | `layout.css:59` | **丢弃**，不搬滚动外壳 |
| `html.lenis,html.lenis body{height:auto}` 等 Lenis 规则 | `layout.css:65` | **丢弃** |
| `@media (prefers-reduced-motion:reduce){…html{scroll-behavior:auto}}` | `home-overrides.css:832` | **丢弃该行**（块内其余规则照常前缀化）。因为 `reset.css:28` 的 `scroll-behavior:smooth` 也已丢弃，无处需要还原 |
| `.ui-light,.ui-print,:root body{--t-background:var(--c-white);…}` | `home-overrides.css:865` | 逐项改写：`.ui-light`/`.ui-print` 加前缀，`:root body` 即 body → `.auth-scope` |
| `:root{--sign-up-width:…;--sign-up-height:…}` | `home-overrides.css:1009-1012` | **丢弃**，属 FixedSignUpButton，不搬 |
| `body:has(.layout-split-page) .promo-header{background:none}` | `AuthPanel.vue:455-458` | **丢弃**，登录页无 promo-header |
| `body:has(.layout-split-page) .fixed-sign-up-button{display:none}` | `AuthPanel.vue:802-804` | **丢弃**，不搬 FixedSignUpButton |
| `@layer reset, base, …;` 层顺序声明 | 五张表各自文件头 | 去层后**丢弃** |

### 5.4 根字号与 rem 转换

`reset.css:28` 的 `html{font-size:.625em}` 把根字号设为 10px（`.625 × 16px`）。
复刻站的 `rem` 全部建立在这个前提上。前缀化碰不到 `html`，而**在容器上设
`font-size:10px` 不会让 `1rem` 变成 10px** —— `rem` 永远相对根元素。

实测影响面极小：**真正的 `rem` 只出现在 2 行 CSS 声明里**，其余 6 处全在注释文字中。

| 位置 | 内容 | 转换 |
|---|---|---|
| `tokens.css:105` | `--scale-rem:1rem;--scale-text-rem:1rem` | → `--scale-rem:10px;--scale-text-rem:10px` |
| `tokens.css:107` | `--scale-rem:clamp(.5rem, calc(.5rem + .69444vw - 5px), 1rem)` | → `clamp(5px, calc(5px + .69444vw - 5px), 10px)` |
| `tokens.css:107` | `--scale-text-rem:clamp(.7rem, calc(.7rem + .41667vw - 3px), 1rem)` | → `clamp(7px, calc(7px + .41667vw - 3px), 10px)` |

注释里的 rem（`reset.css:25`、`tokens.css:93-95`、`typography.css:39`、
`home-overrides.css:917`）**不转换**，它们是说明文字。

验算（1376 视口）：`clamp(7px, 7px + 0.41667×13.76 - 3px, 10px)`
= `clamp(7px, 9.7333px, 10px)` = **9.7333px**，与 `typography.css:39` 记载的
「`--scale-text-rem` = 0.9734rem = 9.7336px」吻合（差值为四舍五入）。

**丢弃 `html{font-size:.625em}` 对全站无副作用**：实测 `frontend/src/style.css` 的 rem
用量为 **0**，`element-plus/dist/index.css` 的 rem 用量也为 **0**。两者全部使用 px。

`--scale-px:clamp(.5px,.06944vw,1px)` 与 `--scale-text-px:clamp(.7px,calc(.4px + .04167vw),1px)`
本来就是 px 单位，**不转换**。

`em` 相对值（如 `--fos:-.169em` / `--foe:-.088em`，`typography.css:44`；
`.btn__text` 的 `.3em` 下划线偏移）**绝对不能转换** —— `em` 相对元素自身字号，
与根字号无关。五张表里 `em` 共 173 处（typography 99、home-overrides 67、tokens 5、
reset 2），转换脚本必须只匹配 `rem` 而不匹配 `em`，并在事后断言 `em` 计数不变。

`--scale-rem` 全仓 **0 消费者**（只有定义，没有 `var(--scale-rem)`），转换后保留即可，
不必特殊处理。

### 5.5 尺寸链已可解析，只剩两处需实测

`tokens.css:91-94` 给出了 1376×772 下的解析值，`tokens.css:112-119` 给出了间距合成值：

```
--scale-px        = clamp(.5px, .06944vw, 1px)  → 0.9555px @1376
--scale-text-rem  = 9.7336px                   @1376（§5.4 已验算）
--spacing         = 20 × --scale-px = 19.11px  （xxxxl 断点下 30 → 28.67px）
--spacing-header  = 50 × --scale-px = 47.77px  （md 以下 40 → 38.22px）
```

所以 `AuthPanel.vue:451` 注释里的 47.77px 与 `tokens.css:122` 的
`calc(var(--scale-px)*50)` 是**一致的** —— 50 与 40 是 `--scale-px` 的乘数而非 px 值，
先前的「三者不符」是误读。

仍需实测裁定的只有两点，都必须排在实施第一步：

1. **1376×772 是否命中 `tokens.css:107` 那条超长媒体查询**。该查询是十几个条件的逗号
   并列，其中 `(min-width:980px) and (max-width:1439px)` 应当命中 1376，但要实测确认。
   若不命中，登录页会退到 `tokens.css:105` 的兜底值（`--scale-px:1px`），
   所有尺寸放大 1/0.9555 ≈ 4.66%。
2. **1376 是否落在 md-up 分支**，即 `--md`/`--n-md` 谁取 `initial`。这决定
   `--spacing-header` 是 47.77px 还是 38.22px，进而决定 §6.3 那块顶部留白的高度。
   `tokens.css:116` 记载 1376×772 下是 47.77px（md 分支），但这是注释断言，需实测。

复刻站的 `--md`/`--n-md` 走「双值 + 兜底」技巧：`var(--md, A) var(--n-md, B)`，
媒体查询命中时把 `--md` 置为 `initial` 使第一项失效、落到第二项。这套机制在去层与
前缀化后不变（媒体查询块保留、只改内层选择器），但**必须实测而非假设**。

## 6. 集成方式

### 6.1 路由与懒加载

`frontend/src/main.ts:10-19` 的路由表新增两条，均带 `meta.bare`：

```ts
{ path: "/signin", component: () => import("./auth/SignInPage.vue"), meta: { bare: true } },
{ path: "/signup", component: () => import("./auth/SignUpPage.vue"), meta: { bare: true } },
```

`auth-scope.css` 只由 `SignInPage.vue` / `SignUpPage.vue` 引入。因为二者是异步路由组件，
Vite 会把这份 CSS 抽成独立的路由级 chunk，只在访问 `/signin` `/signup` 时加载，
主应用 bundle 与其他路由不受影响。

现有 `{ path: "/:pathMatch(.*)*", redirect: "/" }` 兜底规则（`main.ts:18`）保持在路由表
末尾。

### 6.2 满屏布局

`frontend/src/App.vue` 按 `route.meta.bare` 跳过 `.site-header`（`App.vue:18-63`）与
`.site-footer`（`App.vue:65-68`）：

```
#app (flex column, min-height:100vh)   ← style.css:66-70，不改
  └ main (flex:1)                      ← style.css:71-74，不改
      └ .auth-scope > section.layout-split (min-height:100svh)
```

`#app` 与 `main` 的现有规则**不需要修改**：bare 路由下 flex 列里只剩 `main`，
`flex:1` 使其填满 100vh，`.layout-split` 的 `min-height:100svh` 正好落位。

`.skip-link`（`App.vue:17`）保留，它是无障碍设施，视觉隐藏至聚焦。

`AuthDialog` 从 `App.vue:69` 移除，文件删除。

### 6.3 左侧面板顶部 47.77px 留白的用途

`.layout-split__bg{margin-top:var(--spacing-header)}`（`AuthPanel.vue:445`）原本是给
复刻站自己的短 header 留位。bare 布局下没有 header，这块留白会露出页面底色。

用途改为：只放一个「← 返回抢购」链接（`RouterLink to="/"`）。**不放品牌行** ——
左侧面板上已有 PEAKRUSH 词标（§8.6），再加一行品牌是重复。
加返回入口的理由是登录页在决策 6 之下没有任何导航，不加就是死胡同。
该元素标 `CLONE-LOCAL`（复刻站无此物）。

具体高度以 §5.5 实测的 `--spacing-header` 为准。

## 7. 会话流改造

### 7.1 requireLogin 内部改造，四个调用点零改动

`frontend/src/session.ts:27-30` 的 `requireLogin(message)` 从「设 `authOpen=true`」
改为路由跳转。

`session.ts` 目前不持有 router（`main.ts:8` 内联创建、`:22` 直接 `.use(router)`）。
两种接法：把 router 从 `main.ts` 具名导出供 `session.ts` import，或新增
`initSession(router)` 在挂载前注入。**选后者** —— 前者会形成
`main.ts → App.vue → session.ts → main.ts` 的循环导入。

```ts
// session.ts
let nav: Router | null = null;
export function initSession(router: Router) { nav = router; }

export function requireLogin(message = "登录后，开启你的好物时刻。") {
  session.authMessage = message;
  nav?.push({
    path: "/signin",
    query: { redirect: nav.currentRoute.value.fullPath },
  });
}
```

`main.ts` 在 `.mount("#app")` 之前调用 `initSession(router)`。

四个调用点（§3.1 表格）与 `session.ts:50` 的 `peakrush:expired` 监听器**代码不改**，
只是行为从「弹窗」变成「跳转」。

`session.authMessage` 继续在内存里承载上下文提示语，`/signin` 读取它显示。SPA 内跳转
不刷新页面，值能存活；若用户直接刷新 `/signin`，回落到默认文案。

### 7.2 回跳与开放重定向防护

登录/注册成功后 `router.replace(redirect || "/")`。

`redirect` 来自 URL query，是用户可控输入，**必须校验**，否则构成开放重定向：

```ts
function safeRedirect(value: unknown): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
```

拒绝 `//evil.com`（协议相对 URL）与 `https://evil.com`（绝对 URL）。
query 参数经 vue-router 解析可能是数组（`?redirect=a&redirect=b`），故先做类型判定。

已登录用户访问 `/signin` 或 `/signup`：直接 `router.replace(safeRedirect(redirect) || "/")`，
不渲染表单。

### 7.3 过期重登

`session.ts:50` 的 `peakrush:expired` 路径走同一个 `requireLogin`，额外在 query 加
`reason=expired`。`/signin` 据此显示「登录已过期，请重新登录后继续。」，
替代现有 `authMessage` 机制在过期场景下的作用。

### 7.4 setSession 清理

`session.ts:15-21` 的 `setSession` 中 `session.authOpen = false` 一行删除
（不再有弹窗）。`session.authMessage = ""` 保留（清空上下文提示）。
`session` reactive 对象上的 `authOpen` 字段整体删除。

### 7.5 抢购弹窗上下文的丢失是已接受的

`PurchaseDialog.vue:141-144` 在用户点击「抢购」那一刻才检查登录。改为路由跳转后，
`/activities/:id` 上的 Storefront 会卸载，`quantity`（`PurchaseDialog.vue:21`）与弹窗
打开状态丢失，回跳后用户需重新点开商品。

这是决策 4 明确接受的代价（选项 A 而非 B）。理由：为恢复弹窗上下文要把
`activityId`/`itemId`/`quantity` 序列化进 query，并给 Storefront 与 PurchaseDialog 各加
一套「从 URL 恢复受控状态」的逻辑，复杂度与收益不匹配 —— `quantity` 默认值就是 1。

## 8. 表单契约、校验与错误呈现

### 8.1 字段

| 字段 | 登录页 | 注册页 |
|---|---|---|
| 用户名 | `type="text"`、`name="username"`、`autocomplete="username"`、`spellcheck="false"`、`autocapitalize="off"`、标签「用户名」 | 同左 |
| 密码 | `type="password"`、`autocomplete="current-password"`、标签「密码」 | `autocomplete="new-password"`、标签「密码（至少 8 位）」 |
| 确认密码 | — | **新增**，`type="password"`、`autocomplete="new-password"`、标签「确认密码」，复用同一 `.input-text` 结构 |

复刻站的 `type="email"`（`content/subpages/auth.ts:53`、`:75`）必须改掉，见 §3.2 推论 1。

确认密码是复刻站没有的字段（它的注册是两步流程，第一步只有邮箱+密码）。新增后注册页
比复刻站原页高约一个字段块（55.2px）+ 一个 `.error-list`（10.7px）≈ 66px，
这是几何对照不能拿整页高度当指标的原因之一（§9.2）。

### 8.2 校验规则（前后端对齐）

| 规则 | 前端 | 后端 |
|---|---|---|
| 用户名 | `/^[A-Za-z0-9_]{3,40}$/` | `Auth.java:30` 同 |
| 密码长度 | `>= 8` 字符 | `Auth.java:30` 同 |
| 密码字节 | `new TextEncoder().encode(pw).length <= 72` | `Auth.java:30` 同 |
| 两次密码一致 | 注册页校验 | 后端无此概念（只有一个 password 字段） |

前端文案直接用后端 `ApiException.bad` 的那句「用户名须为3–40位字母数字下划线，
密码须为8–72字节」拆分成字段级提示，避免两套措辞。

登录页也执行同一套校验：`Auth.java:30` 在 `if(register)` 分支**之前**，对登录同样生效，
所以登录时填 6 位密码也会被打回。前端提前拦下更好。

### 8.3 错误呈现

`.error-list`（`AuthPanel.vue:276`，复刻站故意空渲染、占位 10.7067px）接真实字段级错误，
写成 `<li>`。保留其占位高度以免无错时布局跳动。

表单级错误（`401 INVALID_CREDENTIALS`「用户名或密码不正确」、
`409 USERNAME_EXISTS`「用户名已存在」、网络与超时错误）放提交按钮上方，
用 `--c-error`（`tokens.css:129`，`#ea1b4f`）着色。

错误文案来自 `frontend/src/api.ts:44-56` 的 `ApiError.message`，
经 `api.ts:76` 的 `errorMessage()` 提取，与现有各页一致。

### 8.4 提交态

提交期间按钮 `disabled`。复刻站的 `.btn` 没有 disabled 视觉（它从不真正提交），
需在 `auth-scope.css` 新增一条 `.auth-scope .btn[disabled]{…}`，标 `CLONE-LOCAL`。
按钮文案在提交中改为「登录中…」/「注册中…」。

焦点环：`style.css:51-55` 的橙色 `outline:3px solid #ff966e` 会落到登录页的按钮与链接上
（无层，且 `.btn` 规则去层后与其同为无层，需比特异性 —— `button:focus-visible` 是
(0,1,1)，`.auth-scope .btn:focus-visible` 若声明则是 (0,3,1)，可胜）。
**决定保留 PeakRush 的橙色焦点环**，不做覆盖：它是全站一致的无障碍设施，
登录页没有理由例外。这条要写进 auth-scope.css 的注释，说明是有意为之而非漏改。

### 8.5 删除清单

复刻站上在 PeakRush 语境里无后端支撑的元素，全部删除：

| 元素 | 位置 | 删除理由 |
|---|---|---|
| Facebook / Google OAuth 按钮 | `AuthPanel.vue:194-210` | 复刻站自己就是死按钮（`type="button"` 无 handler）；本系统无第三方登录 |
| 「or login with e-mail」 | `AuthPanel.vue:212`、`content/subpages/auth.ts:61` | **不删，改文案为「使用账号密码登录」**。删掉会让 tab 与表单之间失去 `margin-top:34px` + 一行 10.71px 文字的过渡（`AuthPanel.vue:454-461`）；该行原本的作用是分隔 OAuth 与邮箱表单，去掉 OAuth 后仍可作 tab 与表单之间的分隔，且改后是事实陈述、不构成误导 |
| 「I forgot my password」 | `AuthPanel.vue:294-318` | 后端只有 `/auth/login` 与 `/auth/register`（`Api.java:9-10`），无找回密码接口 |
| 「Remember me for 24 hours」 | `AuthPanel.vue:280-293` | `session.ts:16` 无期限写 localStorage，无 24 小时逻辑；JWT 实际 8 小时（`Auth.java:41`） |
| 服务条款 / 隐私政策链接 | `content/subpages/auth.ts:79` | 指向 `/terms-and-conditions`、`/privacy-policy`，PeakRush 路由表无此二页 |
| newsletter 订阅勾选 | `content/subpages/auth.ts:80` | 本系统无订阅功能 |
| 两条 demo notice | `AuthPanel.vue:386-389` | 「nothing you type leaves this page」接上真后端后与实际行为直接矛盾 |
| artist / curator radio | `AuthPanel.vue:217-220` | `Auth.java:31` 注册一律 `role='USER'`，无角色选择 |
| pending 说明行 | `AuthPanel.vue:387-389` | 同上，是复刻站的取证待办标记，不属于产品 UI |
| `data-page-header-theme` | `AuthPanel.vue:136` | 消费者是复刻站的 SiteHeader，不搬 |
| `SIGNUP_STEP2` 全部内容 | `content/subpages/auth.ts:93-108` | 本系统注册一步完成 |

### 8.6 中文文案

| 位置 | 复刻站 | 移植后 |
|---|---|---|
| tab（左） | Join | 注册 |
| tab（右） | Login | 登录 |
| 左侧词标 | FollowArt（SVG 字形） | PeakRush（文本渲染） |
| 左侧 tagline（登录） | Webby-awarded / digital infrastructure / for artists and curators | 让好物与热爱，准点相遇。（取自 `App.vue:66` 现有品牌语） |
| 左侧 tagline（注册） | Create your profile to showcase your practice… | 每一次开抢，都是生活的新起点。（取自 `App.vue:67`） |
| 提交按钮 | Login / Continue | 登录 / 注册并登录 |

`auth-content.ts` 保留复刻站「文案只有一处数据源」的组织方式。

### 8.7 词标改文本渲染带来的两处连带修改

决策是不搬 `displayHeadings.json` 与 `DisplayHeading.vue`（§4.2），左侧面板的词标改为
直接渲染文本「PEAKRUSH」（大写形式取自 `DisplayHeading.vue:65` 的
`textVisual = title.toUpperCase()` 这一既有降级行为）。连带两处：

1. **`.layout-split__bg .title path{fill:var(--c-black)}`（`AuthPanel.vue:470-472`）失效** ——
   文本渲染没有 `<path>`。词标颜色必须显式声明，按 §9.4 用黑字。原规则的注释说明黑色是
   从 V21 帧 (50,100) 采样得 `rgb(0,0,0)`，所以黑字是测量结论，不是新发明。
2. **`.layout-split__bg .intro__title`（`AuthPanel.vue:462-466`）本就惰性** ——
   `.intro__title` 是首页 hero 的类名，AuthPanel 传的是
   `visual-class="layout-split__word"`，两者不同名，该规则在复刻站里也不命中。**丢弃。**

`.layout-split__tagline{color:var(--c-white)}`（`AuthPanel.vue:474-478`）按 §9.4 改为
`var(--c-black)`，标 `CLONE-LOCAL`。

## 9. 验收标准

### 9.1 功能实跑（浏览器，逐步留 DOM 与网络证据）

- 登录成功 → token 与 user 落 localStorage、回跳 `redirect`
- 登录失败 401 → 表单级错误显示「用户名或密码不正确」
- 注册成功 → 直接登录态、回跳
- 注册重名 409 → 显示「用户名已存在」
- 各条字段校验：用户名含非法字符、用户名 <3 / >40、密码 <8、密码 >72 字节、两次密码不一致
- 四个 `requireLogin` 入口逐个验证回跳目标正确：顶栏、抢购弹窗、`/orders`、`/admin`
- `reason=expired` 显示过期提示
- 开放重定向拦截：`?redirect=//evil.com`、`?redirect=https://evil.com`、
  `?redirect=a&redirect=b` 三种都回落到 `/`
- 已登录访问 `/signin` 直跳不渲染表单
- 从 `/activities/12` 触发登录后回跳到 `/activities/12`
- `npm run build`（含 `vue-tsc --noEmit`）绿
- `npm test`（`frontend/tests/api.test.mjs`）绿

### 9.1.1 CSS 转换的机械断言

§5.2/§5.3/§5.4 的三项转换都可用脚本断言，不靠人眼：

| 断言 | 期望 |
|---|---|
| `auth-scope.css` 中 `@layer` 出现次数 | **0** |
| `auth-scope.css` 中 CSS 声明里的 `rem` 单位出现次数 | **0**（注释里的 rem 文字不计） |
| `auth-scope.css` 中 `em`（非 rem）单位出现次数 | **173**，与五张源表之和一致（typography 99 + home-overrides 67 + tokens 5 + reset 2）。多或少都说明转换脚本误伤了 `em` |
| `auth-scope.css` 中以 `html`、`body`、`:root`、`main`、`picture` 开头的选择器 | **0**（全部已改写或丢弃） |
| `@font-face` 块数量 | **2**（HeadingNow、Hardbop），且必须在顶层、未被前缀化 |
| `.auth-scope ` 前缀未命中的选择器（即不以 `.auth-scope` 开头且不是 `@font-face`/`@media` 内层） | **0** |
| 层顺序与源顺序不矛盾（§5.2 去层前提） | 逐文件检查层名出现序列非递减 |

最后一项若失败，**不得去层**，必须回到 §5.2 改用「保留层 + 另想隔离办法」，
并重新评估 §5.1 的冲突表。

### 9.2 几何对照

基线是**移植前的复刻站 `/signin` 原页**，不是 follow.art 线上站 —— 我们有意中文化并
删除了元素，对线上站的像素基线已经失效。

同一台机器、同一视口 **1376×772**（复刻站的测量基准，
`AuthPanel.vue:5-6`）。视口必须显式设定并在证据里记录实际值，不假设它不漂移。

**不能拿整页高度当指标**。移植后的高度必然与基线不同：登录页删了 OAuth 行
（28.66px + 60px margin）、忘记密码（18px + 40px margin）、两条 notice；
注册页加了确认密码字段（约 +66px）。

要比的是**保留元素自身的尺寸**：

| 量 | 期望值 | 出处 |
|---|---|---|
| 分栏宽度 | 688 / 688 @1376 | `content/subpages/auth.ts:18` |
| 表单栏宽度与位置 | 426.82px @ x=819 | `content/subpages/auth.ts:18-19` |
| 输入框 | 425.49 × 55.42 | `AuthPanel.vue:620-622` |
| 输入框外层 wrapper | 55.2px | `AuthPanel.vue:608` |
| `.error-list` 占位 | 10.7067px（padding-top 9.55494px） | `AuthPanel.vue:657-658` |
| tab 槽宽 | 213.07 + 213.08 | `AuthPanel.vue:511` |
| 提交按钮 | 203.85 × 28.66 | `AuthPanel.vue:770` |
| 勾选框 | 15.29px（16 --scale-px + 1px 边框） | `AuthPanel.vue:687-688` |
| `.text-card-h1` 字号 | 28.91px | `AuthPanel.vue:83` |
| 输入框字号 | 12.6534px | `AuthPanel.vue:644` |
| 面板顶部留白 | 47.77px（= 50 × `--scale-px` 0.9555px @1376，md 分支；待 §5.5 实测确认分支） | `tokens.css:116`、`AuthPanel.vue:451` |

**同样不覆盖文字墨迹尺寸**：中文化必然改变墨迹宽度与行高，见 §9.3。

### 9.3 中文排版的内在张力（已知、接受）

HeadingNow 是纯拉丁字体（`logn in/public/fonts/HeadingNow-73Book.woff2`，76KB）。
中文字符会沿 `font-family: HeadingNow, Helvetica, Arial, sans-serif`
（`typography.css:44`）回落到系统 sans-serif（Windows 上是微软雅黑）。三个后果：

1. **混排**：英文词标「PEAKRUSH」走 HeadingNow，中文文案走微软雅黑
2. **负字距不适合中文**：`typography.css:44` 的 `letter-spacing:-.03em` 与
   `AuthPanel.vue` 各处的 `-0.02em` 是为 HeadingNow 的拉丁字距调的，负字距加在 CJK 上
   视觉上过挤
3. **字号观感不同**：CJK 字形填满 em 方框的程度远高于拉丁，28.91px 的中文比 28.91px 的
   拉丁看起来更大更重

处理：

- **§5.1 表里那条 `:root{font-family:Inter,…}` 竞争在此解决**：`style.css:1-21` 是
  无层的、作用在 `<html>` 上；而 `typography.css:44` 前缀化后成为
  `.auth-scope,.auth-scope button,…{font-family:HeadingNow,…}`，是**直接声明**在
  `.auth-scope` 上。直接声明胜过从祖先继承，所以作用域内 HeadingNow 生效，
  全站其余部分仍是 Inter，两者互不干扰。
- 给 `.auth-scope` 显式声明中文字体栈，与 `frontend/src/style.css:2` 现有的
  `Inter, "Noto Sans SC", "Microsoft YaHei", sans-serif` 保持一致的后两项，即
  `HeadingNow, "Noto Sans SC", "Microsoft YaHei", Helvetica, Arial, sans-serif`
- 作用于中文文本的 `letter-spacing` 归零（保留拉丁词标的负字距）
- 字号**不因观感调整**，保持测量值 —— 一旦按观感调字号，§9.2 的几何对照就失去意义

这条张力的代价是：登录页的中文文案观感不会像复刻站的英文那样精致。这是「保真移植视觉
+ 中文化内容」这两个决策叠加的必然结果，不是实施缺陷。

### 9.4 面板配色的对比度核算

决策 7 把左侧面板从 follow.art 绿改为 PeakRush 橙。核算（WCAG 2.x 相对亮度）：

| 组合 | 对比度 | 判定 |
|---|---|---|
| 白字 tagline on `#ff4e16`（`style.css:6` `--orange`） | 3.31:1 | tagline 是 `.text-card-h1` 38.93px，属 WCAG 大字号（阈值 24px），大字号 AA 要求 3:1 → **过**，余量 0.31 |
| 黑字词标 on `#ff4e16` | 6.35:1 | **过** AA |
| 白字 on `#d93808`（`style.css:7` `--orange-dark`） | 4.68:1 | **过** AA（含正常字号） |
| 参照：白字 tagline on `#8e9487`（follow.art 原绿，`tokens.css:129`） | 3.12:1 | 原设计本身就在这个量级 |

换橙没有让对比度变差（3.31 > 3.12）。

**推荐方案**：面板底色用 `#ff4e16`（品牌主色），词标与 tagline **都用黑字**。
理由：词标按测量本来就是黑字（`AuthPanel.vue:470`
`.layout-split__bg .title path{fill:var(--c-black)}`，注释说明是从 V21 帧 (50,100) 采样
得 `rgb(0,0,0)`），黑词标 + 黑 tagline 在橙底上内部一致，且 6.35:1 稳过 AA，
不必依赖大字号豁免。

代价：tagline 从复刻站的白字改黑字，是一处有意的视觉偏离，标 `CLONE-LOCAL`。
若坚持白字 tagline，则面板底色应改用 `#d93808` 以取得 4.68:1。

### 9.5 现有页面零回归

`/`、`/activities/:id`、`/orders`、`/admin` 四条既有路由必须在改动后逐一目视确认无变化，
重点是：

- 全站主色仍是 `#ff4e16` 而非 Element 蓝（验证 §5.2 没有误降 `style.css` 的层）
- 根字号未变（验证 §5.4 的 `html{font-size:.625em}` 确实被丢弃而非漏进全局）
- 既有页面上 `rem` 单位的元素尺寸未漂移

## 10. 记录在案的风险与授权状态

`logn in/README.md:64-68` 明确写：

> `src/content/assets.manifest.json` 记录 105 个资产的真实来源 URL、字节、sha256 与权利
> 状态。**全部为 `permission-required`**：从公开页面抓取不等于再分发许可。因此本项目仅限
> 本地研究，不做公开部署，不把字体文件与艺术家卡面作为交付物分发。

本方案会：

- 复制 **HeadingNow**（商用字体）与 **Hardbop** 两个字体文件到 `frontend/public/fonts/`
- 保留 follow.art 的视觉设计语言（分栏布局、按钮基元、输入框样式、栅格与令牌体系）
- 不复制任何图片资产（`public/assets/` 23MB 全部不搬）
- 不复制 SVG 字形词标（`displayHeadings.json` 不搬）

用户已在知情前提下选择保真移植（决策 2 与决策 7），此项记录在案以免日后遗忘。
**若本作业需要公开部署或对外分发，字体与视觉设计语言的授权状态需要重新评估。**

## 11. 实施顺序建议

1. **前置校验（结论可能推翻后续步骤，必须最先做）**：
   - 逐文件检查五张表的层名出现序列是否非递减（§5.2 去层前提）。不通过则整个隔离方案
     要改，不能继续
   - 在 1376×772 视口下实测 §5.5 的两点：`tokens.css:107` 的媒体查询是否命中、
     `--md`/`--n-md` 谁取 `initial`（决定 `--spacing-header` 是 47.77px 还是 38.22px）
   - 记录 `--scale-px` 与 `--scale-text-rem` 的实测计算值，与 §5.4 的验算
     （0.9555px / 9.7333px）对照
2. 生成 `auth-scope.css`：合并 → 去层 → 按 §5.3 规则改写选择器 → 按 §5.4 转换
   `tokens.css:105`/`:107` 的 rem → 跑 §9.1.1 的全部机械断言
3. 搬字体到 `frontend/public/fonts/`
4. 写 `auth-content.ts`（§8.6 中文文案 + §8.1 字段定义）
5. 写 `AuthPanel.vue`（模板按 §8.5 裁剪、script 接 §8.2 校验与 §8.3 错误呈现）
6. 写 `SignInPage.vue` / `SignUpPage.vue`，加路由与 `meta.bare`（§6.1）
7. 改 `App.vue` 支持 bare 布局、移除 AuthDialog（§6.2）
8. 改 `session.ts`：`initSession(router)` 注入、`requireLogin` 转跳转、删 `authOpen`、
   加 `safeRedirect`（§7）
9. 删除 `frontend/src/components/AuthDialog.vue`
10. 按 §9.1 / §9.2 / §9.5 逐项取证

第 1 步的两项校验都可能推翻后续步骤的前提（层顺序矛盾 → 去层方案作废；媒体查询不命中
→ §5.4 的转换目标值要重算），所以必须排在最前面，不能边做边验。
