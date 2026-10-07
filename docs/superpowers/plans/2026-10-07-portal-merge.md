# 子项目 1：follow.art 复刻站整站并入 PeakRush 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `logn in/` 的 follow.art 复刻站（12 条路由）整站并入 `frontend/`，构成单 Vite 工程双入口 MPA：克隆站占根路径 `/` 作为系统门户，主应用迁到 `/app/`，并把 `/signin` `/signup` 接通 PeakRush 后端成为真实登录/注册页。

**Architecture:** 两个 HTML 入口 = 两个文档 = 两套全局 CSS 互不可见，因此克隆站的 4260 行全局样式原样搬入、一行不改，不需要任何前缀化/去层/rem 转换工程。两个入口共用一个 `node_modules`、一份 Vite 配置、一个 dev server（端口 5179），同源所以 localStorage 与 sessionStorage 直接共享，token 交接不需要 cookie 或 URL 传参。跨文档导航用 `window.location.href`。

**Tech Stack:** Vue 3.5 + Vite 7 + TypeScript 5.9（strict）+ vue-router 4 + Element Plus（主应用）+ three 0.176 / lenis 1.3.3 / pinia 3（克隆站）+ Spring Boot 网关 8080 / 后端 8081。单测用 `node --test`，渲染对照用克隆站自带的 Playwright 采集基建。

**设计文档：** `docs/superpowers/specs/2026-10-07-portal-merge-design.md`（下称 spec）。

**分支：** `feat/login-page-integration`。**全程禁止 push**，只在本地提交。

---

## 对已批准 spec 的三处偏离（均已在对话中报告并获准）

| # | spec 原文 | 本计划 | 理由 |
|---|---|---|---|
| 1 | §7.5 / §11：跨文档跳转导致 `requireLogin` 的三句上下文提示语必然丢失，登记为已知缺陷 | 用 `sessionStorage` 承载 `peakrush.authMessage`，提示语**保留**；`reason=expired` query 参数随之取消 | `window.location.href` 到同源 URL 是同标签页导航，sessionStorage 存活。spec 的判断是错的，这条缺陷可以消掉 |
| 2 | §10.2：基线用自动化浏览器截图 | 用克隆站自带的 `scripts/capture-local.mjs`（Playwright），`VIEWPORTS=inapp` = 1376×772@1.5 | 该脚本只要求 loopback 源，合并后仍可从 `logn in/` 指向 5179 采"后"基线；30 个检查点已覆盖全部 12 条路由；视口由脚本钉死，不会漂 |
| 3 | §7.1 只说改 `type="email"` → `type="text"` | 同时把字段标签 `"Email"` 改为 `"Username"` | 标签本身在骗用户：实际契约是 `[A-Za-z0-9_]{3,40}`，填邮箱会被后端拒。按 spec §1 判据（"说的与实际行为相反"）属本轮必修 |

### 写计划期间对 spec 本身做的两处更正与一处补明

下面三条**不是"计划偏离 spec"**，而是 spec 原文有误或没说，已就地改在 spec 里。
改的是理由与安全边界；决策本身（双入口 MPA、独立 `authApi`、`safeRedirect` 只回主应用）
一条没动。

| # | spec 位置 | 问题 | 更正 |
|---|---|---|---|
| A | §7.6 的 `safeRedirect` 示例代码 | `value.startsWith("/app")` 会把 `/application`、`/appfoo` 一并放行。它们虽是同源路径、构不成跳到外站，但绕过了"只回主应用"这条策略，也让返回值不再是可预期的主应用地址。**示例代码里的真 bug** | 改为按边界匹配：等于 `/app`，或以 `/app/`、`/app?`、`/app#` 开头。改完后 `//evil.com`、`https://evil.com`、`/`、`/signin` 都不满足边界，原来的两条前置判断变成冗余，删掉。已由 `safe-redirect.test.mjs` 的 6 个用例对着实现跑绿 |
| B | §7.3 末："不复用 `src/api.ts`（那会形成两个入口共享模块，破坏 §4.1 的隔离前提）" | 与 §4.1 末自己写的隔离条件（"没有共享模块同时 import 两边的 CSS"）不符，也与 §7.6 要求两个入口共用 `safeRedirect` 自相矛盾。共享纯逻辑 TS 模块不影响文档级 CSS 隔离 | 换成三条可从 `api.ts` 逐行核出的真实理由：① `:20-21` 给未认证的 login/register 挂上一次的陈旧 `Authorization`；② `:42` 派发 `peakrush:expired`，而门户文档里没有监听者；③ `:46-52` 的状态码兜底文案是主应用口气的中文 |
| C | §7.6 没说 `safeRedirect` 落在哪个文件 | 计划要两个入口都调它，spec 未指明是否共用一份 | 在 §7.6 补明：落在 `frontend/shared/safe-redirect.ts`，两个入口 import 同一份。**安全函数不复制两份**——一边修了另一边没修就是漏洞 |

---

## 文件结构

### 新建

| 路径 | 职责 |
|---|---|
| `frontend/welcome/` | 克隆站全部源码，从 `logn in/src/` 搬入（排除 `testing/`）。内部结构不变：`app/ components/ content/ features/ motion/ pages/ styles/ webgl/` |
| `frontend/app.html` | 主应用入口（由现 `frontend/index.html` 改名而来），服务 `/app/*` |
| `frontend/index.html` | 克隆站入口（由 `logn in/index.html` 搬入并改 entry 路径），服务 `/` |
| `frontend/shared/safe-redirect.ts` | 唯一的开放重定向校验函数，两个入口共用。**安全函数不复制两份** |
| `frontend/build/resolve-entry.ts` | MPA history fallback 的纯判定函数 |
| `frontend/build/mpa-fallback.ts` | 把 `resolveEntry` 包成 Vite 插件，同时挂 `configureServer` 与 `configurePreviewServer` |
| `frontend/welcome/app/auth-validation.ts` | 用户名/密码校验纯函数，对齐 `Auth.java:30` |
| `frontend/welcome/app/authApi.ts` | `POST /api/auth/login\|register` 的最小传输层。**不复用 `frontend/src/api.ts`**，理由见 Task 12 开头（不是"共享模块破坏隔离"） |
| `frontend/tests/resolve-entry.test.mjs` | fallback 判定测试 |
| `frontend/tests/safe-redirect.test.mjs` | 开放重定向测试 |
| `frontend/tests/auth-validation.test.mjs` | 校验规则测试 |
| `frontend/tests/auth-api.test.mjs` | 传输层测试 |
| `logn in/scripts/compare-local-dirs.mjs` | 两个本地采集目录的逐检查点像素比对。放在 `logn in/` 是因为 `pixelmatch`/`pngjs` 只装在它的 `node_modules` 里（spec §5.7 明确不给 frontend 加这两个依赖） |
| `docs/superpowers/evidence/2026-10-07-portal-merge-render-diff.md` | 渲染对照结论报告（PNG 留磁盘不进 git，结论进 git） |
| `docs/superpowers/evidence/2026-10-07-portal-merge-acceptance.md` | 功能实跑与验收结论报告 |

### 修改

| 路径 | 改动 |
|---|---|
| `frontend/vite.config.ts` | alias `@`→`./welcome`、`@shared`→`./shared`；`appType:'mpa'`；`build.assetsDir:'_app'`、`target:'es2022'`、双入口 input；挂 `mpaFallback()` |
| `frontend/tsconfig.json` | 取两边选项并集；加 `paths`；`include` 加 `welcome/**`、`shared/**`、`build/**` |
| `frontend/package.json` | 加 `three@0.176.0`、`lenis@1.3.3`、`pinia@^3.0.3`、`@types/three`、`@types/node` |
| `frontend/src/main.ts:9` | `createWebHistory()` → `createWebHistory("/app/")` |
| `frontend/src/session.ts` | `requireLogin` 改跨文档跳转 + sessionStorage 承载提示语；删 `authOpen`/`authMessage` 字段 |
| `frontend/src/App.vue:6,69` | 删 `AuthDialog` 的 import 与使用 |
| `frontend/welcome/app/App.vue:36-38,63-65,147-160` | `import.meta.glob('/src/motion/…')` → 动态 `import('@/motion/createMotionRuntime')` |
| `frontend/welcome/components/AuthPanel.vue` | 接后端、删 7 项功能性死元素、加确认密码字段与三处 reveal、词标改文本 |
| `frontend/welcome/pages/SignInPage.vue` / `SignUpPage.vue` | 删 `NOTICE` 常量与 `:notice` 传参 |
| `frontend/welcome/content/subpages/auth.ts:52-55,74-77` | `type:'email'`→`'text'`；`label:'Email'`→`'Username'` |
| `frontend/welcome/components/SiteHeader.vue:40`、`features/home/HomeCard.vue:21`、`HomeConnectory.vue:22`、`HomeGetSeen.vue:28`、`HomeTestimonials.vue:25` | 删 5 个只写不读的死模板 ref |
| `frontend/public/` | 并入克隆站的 `assets/`(23MB)、`fonts/`(244KB)、`icons.svg`(112KB) |
| `scripts/app-start.ps1:64` | 健康检查 URL 列表加 `http://127.0.0.1:5179/app/` |
| `README.md`、`docs/STARTUP_GUIDE.md`、`docs/ARCHITECTURE.md`、`frontend/README.md` | 抢购页入口 URL 从 `/` 改为 `/app/` |

### 删除

| 路径 | 理由 |
|---|---|
| `frontend/src/components/AuthDialog.vue` | 被 `/signin` `/signup` 路由页取代（spec §7.7） |
| `logn in/src/`（整体） | 搬到 `frontend/welcome/`，用 `git mv` 保留重命名检测 |

### 不动

`logn in/` 的 `scripts/ tests/ design/ quality/ docs/ evidence/ .scratch/ dist/ node_modules/ public/` 与顶层配置文件全部留在原地。`node_modules` 里的 `@playwright/test`、`pixelmatch`、`pngjs` 是 Task 1、16 的采集/比对工具依赖，**不能删**。

---

## Task 1: 采集合并前渲染基线

spec §14 的第一个锚点。基线必须在源码搬迁**之前**采集，否则 Task 16 没有对照对象。采集完成后不要再动 `logn in/` 的 `node_modules` 或任何配置。

**Files:**
- Read: `logn in/scripts/capture-local.mjs`、`logn in/design/checkpoints.json`
- Output（磁盘，不进 git）: `logn in/evidence/baseline-premerge/*.png` + `capture-report.json` + `env.json`

- [ ] **Step 1: 确认 Playwright 浏览器已安装**

```bash
cd "G:/高并发大作业项目/PeakRush/logn in"
node -e "const {chromium}=require('@playwright/test'); console.log('executable:', chromium.executablePath())"
```

Expected: 打印出一个存在的可执行文件路径。若报 "Executable doesn't exist"，先跑
`npx playwright install chromium` 再重试。**这一步不过就不要往下走** —— 后面所有渲染证据都依赖它。

- [ ] **Step 2: 后台启动克隆站 dev server**

```bash
cd "G:/高并发大作业项目/PeakRush/logn in"
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5175 --strictPort > /tmp/clone-dev.log 2>&1 &
echo $! > /tmp/clone-dev.pid
```

- [ ] **Step 3: 轮询就绪，不要 sleep 固定时长**

```bash
for i in $(seq 1 90); do curl -sf -o /dev/null http://127.0.0.1:5175/ && { echo "ready after ${i}s"; break; }; sleep 1; done
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:5175/
```

Expected: `ready after Ns` 且 `HTTP 200`。若 90 秒未就绪，`cat /tmp/clone-dev.log` 看错误并停止。

- [ ] **Step 4: 采集 30 个检查点，视口钉死 inapp（1376×772@1.5）**

```bash
cd "G:/高并发大作业项目/PeakRush/logn in"
LOCAL_BASE_URL=http://127.0.0.1:5175 VIEWPORTS=inapp node scripts/capture-local.mjs 2>&1 | tail -20
```

Expected: 无 `REFUSED`（该脚本只接受 loopback 源），`evidence/local/` 下生成 PNG 与 `capture-report.json`。

- [ ] **Step 5: 校验基线有效性，不接受空集合**

```bash
cd "G:/高并发大作业项目/PeakRush/logn in"
node -e "
const r=require('./evidence/local/capture-report.json').records;
console.log('records:', r.length);
console.log('viewports:', [...new Set(r.map(x=>x.viewport))].join(','));
const routes=[...new Set(r.map(x=>x.route))].sort();
console.log('routes('+routes.length+'):', routes.join(' '));
console.log('errored:', r.filter(x=>x.error||!x.file).length);
"
echo "PNG 数: $(ls evidence/local/*.png | wc -l)"
du -sh evidence/local
```

Expected: `records: 30`、`viewports: 1376x772@1.5`（**只有这一个值**）、`routes(12)` 含全部 12 条、`errored: 0`、`PNG 数: 30`。
若 `records` 是 0 或视口不是 `1376x772@1.5`，**基线无效**，停止并排查 —— 不要拿无效基线继续（空集合会给出假绿灯）。

- [ ] **Step 6: 记录采集环境（WebGL 是否真挂载）**

```bash
cd "G:/高并发大作业项目/PeakRush/logn in"
node -e "
const {chromium}=require('@playwright/test');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1376,height:772}});
  await p.goto('http://127.0.0.1:5175/',{waitUntil:'networkidle'});
  await p.waitForTimeout(3000);
  const info=await p.evaluate(()=>{
    const c=document.createElement('canvas');
    const gl=c.getContext('webgl2')||c.getContext('webgl');
    return {webgl:!!gl, renderer:gl?gl.getParameter(gl.RENDERER):null,
            canvases:document.querySelectorAll('canvas').length,
            liveCanvases:document.querySelectorAll('[data-webgl=\"live\"]').length,
            three:window.__THREE__??null, lenis:window.lenisVersion??null};
  });
  console.log(JSON.stringify(info,null,2));
  await b.close();
})();
" > /tmp/baseline-env.json 2>&1; cat /tmp/baseline-env.json
```

Expected: 打印 `webgl`、`renderer`、`canvases`、`liveCanvases`、`three`、`lenis`。
**把这份 JSON 原样抄进 Task 16 的报告。** 若 `webgl:false` 或 `renderer` 含
"SwiftShader"/"Software"，说明是软件渲染，WebGL 章节的像素不具代表性 ——
这必须写进报告，不能拿"两边都一样黑"当通过（spec §10.2）。

- [ ] **Step 7: 把基线移到不会被覆盖的位置**

```bash
cd "G:/高并发大作业项目/PeakRush/logn in"
rm -rf evidence/baseline-premerge
mv evidence/local evidence/baseline-premerge
cp /tmp/baseline-env.json evidence/baseline-premerge/env.json
echo "基线 PNG 数: $(ls evidence/baseline-premerge/*.png | wc -l)"
```

Expected: `基线 PNG 数: 30`。`capture-local.mjs` 固定写 `evidence/local`，不先移走会被 Task 16 覆盖。

- [ ] **Step 8: 停掉 dev server 并确认端口真的关了**

```bash
kill "$(cat /tmp/clone-dev.pid)" 2>/dev/null; sleep 2
curl -s -o /dev/null --max-time 3 http://127.0.0.1:5175/ && echo "WARNING: 5175 仍在响应" || echo "port 5175 closed"
```

Expected: `port 5175 closed`。杀父进程不代表子进程死了，必须用 curl 确认。

- [ ] **Step 9: 确认基线未进 git**

```bash
cd "G:/高并发大作业项目/PeakRush"
git status --short | grep "logn in/evidence" || echo "OK: evidence/ 未被跟踪"
git check-ignore -v "logn in/evidence/baseline-premerge" || echo "WARNING: 基线未被忽略"
```

Expected: `OK: evidence/ 未被跟踪` 且 `git check-ignore` 打印命中的 `.gitignore` 行。
本任务无源码变更，**不产生 commit**。

---

## Task 2: 搬迁克隆站源码到 frontend/welcome/

**Files:**
- Move: `logn in/src/{app,components,content,features,motion,pages,styles,webgl}` 与 `main.ts` → `frontend/welcome/`

- [ ] **Step 1: 用 git mv 搬迁，保留重命名检测**

```bash
cd "G:/高并发大作业项目/PeakRush"
mkdir -p frontend/welcome
for d in app components content features motion pages styles webgl; do
  git mv "logn in/src/$d" "frontend/welcome/$d"
done
git mv "logn in/src/main.ts" frontend/welcome/main.ts
```

`testing/` 不搬（spec §5.1：实测 0 引用，是散落的 scratch）。

- [ ] **Step 2: 确认搬迁完整、无残留**

```bash
cd "G:/高并发大作业项目/PeakRush"
echo "welcome 文件数: $(find frontend/welcome -type f | wc -l)"
echo "--- 源目录剩余 ---"; find "logn in/src" -type f | sed 's|^|  |'
echo "--- welcome 顶层 ---"; ls frontend/welcome
```

Expected: `welcome 文件数: 88`（8 个目录共 87 个文件，加 `main.ts` 1 个。实测
`logn in/src` 总计 94 = 87 + 1 + `testing/` 的 6）；`源目录剩余` 只列出
`logn in/src/testing/` 下的 6 个文件；`welcome 顶层` = `app components content features motion pages styles webgl main.ts`。

- [ ] **Step 3: 确认 git 识别为重命名而非删+增**

```bash
cd "G:/高并发大作业项目/PeakRush"
echo "R 条目数: $(git status --short | grep -c '^R')"
git status --short | grep '^R' | head -3
git diff --cached --stat -M | tail -3
```

Expected: `R 条目数: 88`；`--stat -M` 末行为 `88 files changed, 0 insertions(+), 0 deletions(-)`。

**不要用 `git status --short | head -5` 来看重命名** —— 短格式按路径排序，
`README.md`、`docs/*`、`frontend/*` 这些**本任务之前就存在的脏文件**会排在
`logn in/*` 前面，前 5 行一条 `R` 都看不到，会误判成"重命名检测没生效"。

- [ ] **Step 4: 提交**

```bash
cd "G:/高并发大作业项目/PeakRush"
git add -A frontend/welcome "logn in/src"
git commit -m "$(cat <<'EOF'
refactor: 克隆站源码搬到 frontend/welcome/

logn in/src/{app,components,content,features,motion,pages,styles,webgl} 与 main.ts
整体移入 frontend/welcome/，用 git mv 保留重命名检测。
src/testing/ 不搬：实测 0 引用，是散落的 scratch。

本步骤不改任何源文件内容；@/ 别名的指向在后续任务里配。
EOF
)"
```

---

## Task 3: 修 App.vue 的 import.meta.glob 绝对路径陷阱

spec §5.6。**这一步漏了不会报错，只会让全站 WebGL 静默退化成静态 poster**，且只在 DEV 下 `console.warn` 一句。

**Files:**
- Modify: `frontend/welcome/app/App.vue`（`RuntimeFactory` 接口、glob 声明、`onMounted` 里的 loader 分支、文件头注释）

- [ ] **Step 1: 确认要改的四处当前形态**

```bash
cd "G:/高并发大作业项目/PeakRush/frontend/welcome/app"
grep -n "RuntimeFactory\|runtimeModules\|import.meta.glob\|const loader\|await loader()\|createMotionRuntime\|being written concurrently" App.vue
```

Expected: 命中 `:20-23` 注释里的 "being written concurrently"、`:36` `interface RuntimeFactory {`、
`:63` `const runtimeModules = import.meta.glob<…>(`、`:64` `'/src/motion/createMotionRuntime.ts',`、
`:148` `const loader = runtimeModules['/src/motion/createMotionRuntime.ts'];`、`:156` `const module = await loader();`。

- [ ] **Step 2: 删掉 RuntimeFactory 接口**

删除 `App.vue` 中这三行（原 `:36-38`）：

```ts
interface RuntimeFactory {
  (options?: { container?: HTMLElement }): MotionRuntime;
}
```

`MotionRuntime` 的 type import（`:32`）**保留** —— `root` 的 `shallowRef<MotionRuntime|null>` 仍需要它。

- [ ] **Step 3: 删掉 glob 声明**

删除这三行（原 `:63-65`）：

```ts
const runtimeModules = import.meta.glob<{ createMotionRuntime?: RuntimeFactory }>(
  '/src/motion/createMotionRuntime.ts',
);
```

- [ ] **Step 4: 把 loader 分支换成直接动态 import**

把 `onMounted` 里这一段（原 `:147-160`）：

```ts
  /* the reference mounts its SVG sprite and teleports outside the scroll area */
  const loader = runtimeModules['/src/motion/createMotionRuntime.ts'];
  if (!loader) {
    if (import.meta.env.DEV) {
      console.warn('[clone] @/motion/createMotionRuntime is not on disk yet — WebGL scenes stay on their static posters.');
    }
    return;
  }
  if (reducedMotion) return;
  const module = await loader();
  const factory = module.createMotionRuntime;
  if (typeof factory !== 'function') return;
  const runtime = factory({ container: scrollArea.value ?? undefined });
```

整体替换为：

```ts
  if (reducedMotion) return;
  const { createMotionRuntime } = await import('@/motion/createMotionRuntime');
  const runtime = createMotionRuntime({ container: scrollArea.value ?? undefined });
```

理由：`import.meta.glob` 那层间接当初只因为该模块"正在并行编写"（`App.vue:20-23` 注释），
而它现在已在盘上（`welcome/motion/createMotionRuntime.ts`，235 行，`:46` 导出
`createMotionRuntime`）。glob 用绝对路径 `/src/…`，搬到 `welcome/` 后会解析到
`frontend/src/motion/…`（不存在），静默返回空对象。

- [ ] **Step 5: 同步更新文件头注释**

`App.vue:18-24` 那段描述 glob 间接存在理由的注释已不成立，替换为：

```
 * Motion: `createMotionRuntime({container})` from @/motion/createMotionRuntime is
 * created once on mount and disposed on unmount; every WebGL section of the page is
 * registered with its scroll range. It is a plain dynamic import now — the module is
 * on disk, so the glob-keyed runtime-module indirection this file used to carry (and
 * whose absolute /src/… module path silently resolves to nothing once the tree lives
 * under welcome/) is gone.
 */
```

**措辞是有意选的，别改回字面 token。** 本节初稿写的是 "the `import.meta.glob` indirection"
和 "absolute `'/src/…'` path"，那两句会同时踩中 Step 6 的两道闸——grep 分不清注释散文和
代码，于是"照 Step 5 逐字写完"这件事本身就让 Step 6 永远红。实施时已按上面这版
（`glob-keyed runtime-module indirection`、不带引号的 `absolute /src/…`）落地，语义不变。

- [ ] **Step 6: 验证 glob 与绝对 /src/ 引用已从 welcome/ 彻底消失**

```bash
cd "G:/高并发大作业项目/PeakRush/frontend"
grep -rnE "runtimeModules|RuntimeFactory" welcome/ && echo "FAIL: glob 间接的符号仍在" || echo "OK: glob 符号已彻底移除"
grep -rnE "'/src/|\"/src/" welcome/ && echo "FAIL: 仍有绝对 /src/ 模块说明符" || echo "OK: welcome/ 内无绝对 /src/ 说明符"
grep -rnE "import\.meta\.glob[(<]" welcome/ && echo "FAIL: 仍有 glob 调用" || echo "OK: 无 import.meta.glob 调用"
```

Expected: 三行都打印 `OK: …`。

**闸口查的是代码形态，不是词面。** `runtimeModules` / `RuntimeFactory` 这两个符号只为 glob
而存在，它们消失即等价于间接消失，且不会被散文误触发；`'/src/` 只匹配带引号的模块说明符，
注释里提一句"absolute /src/… path"（不带引号）不算命中；第三条用 `import.meta.glob` 后
紧跟 `(` 或 `<` 来只抓真实调用。这样后来人在注释里解释这段历史时不会把检查弄红——
初稿正是没做这个区分，才让 Step 5 与 Step 6 互相矛盾。

第三条尤其重要——spec §5.6 实测这是克隆站源码里**唯一**的路径脆弱点，这里确认它确实只有一处。

- [ ] **Step 7: 提交**

```bash
cd "G:/高并发大作业项目/PeakRush"
git add frontend/welcome/app/App.vue
git commit -m "$(cat <<'EOF'
fix: 移除 App.vue 里会静默失效的 import.meta.glob 间接

glob 用绝对路径 '/src/motion/createMotionRuntime.ts'，源码搬到 welcome/ 后会解析成
frontend/src/motion/…（不存在），glob 返回空对象，代码走"loader 不存在"分支：
只在 DEV 下 console.warn 一句然后 return。后果是全站 WebGL 静默退化为静态
poster，页面看起来"基本正常"，是最难发现的一类退化。

该模块已在盘上（welcome/motion/createMotionRuntime.ts:46 导出 createMotionRuntime），
glob 这层间接当初只因为它在并行编写，现改为普通动态 import。
EOF
)"
```

---

## Task 4: 删除 5 个只写不读的死模板 ref

spec §9.1。这 5 处是 vue-tsc 3 报 `TS6133` 的唯一原因，必须在 Task 9 的 typecheck 之前修完。

**Files:**
- Modify: `frontend/welcome/components/SiteHeader.vue:40`
- Modify: `frontend/welcome/features/home/HomeCard.vue:21`
- Modify: `frontend/welcome/features/home/HomeConnectory.vue:22`
- Modify: `frontend/welcome/features/home/HomeGetSeen.vue:28`
- Modify: `frontend/welcome/features/home/HomeTestimonials.vue:25`

- [ ] **Step 1: 逐个确认 script 内确实无读取（删之前必须验，不能照抄清单）**

对每一对 `<FILE>` / `<VAR>` 跑：

```bash
cd "G:/高并发大作业项目/PeakRush/frontend/welcome"
grep -n "<VAR>" <FILE>
```

| 文件 | 变量 |
|---|---|
| `components/SiteHeader.vue` | `headerEl` |
| `features/home/HomeCard.vue` | `content` |
| `features/home/HomeConnectory.vue` | `webgl` |
| `features/home/HomeGetSeen.vue` | `webgl` |
| `features/home/HomeTestimonials.vue` | `webgl` |

Expected：每个变量**恰好命中 2 处** —— 一处 `const <VAR> = ref<HTMLElement | null>(null);`
声明，一处模板里的 `ref="<VAR>"` 属性。
**若命中 3 处或以上，说明 script 里有读取，停下来报告，不要删。**

注意 `HomeCard.vue` 的 `content` 会额外命中 `@/content/home` 这类 import 路径与注释里的
`src/content/`，要人工区分：只有 `const content = ref<…>` 与 `ref="content"` 是目标。

- [ ] **Step 2: 删除声明与模板属性**

对每个文件删两处。以 `HomeConnectory.vue` 为例，删除 script 里的：

```ts
const webgl = ref<HTMLElement | null>(null);
```

再删除模板里 `ref="webgl"` 这**一个属性**（保留该元素其余属性与内容）。原形态：

```vue
              <div
                ref="webgl"
                class="landing-7-connectory-webgl"
                data-evidence="pending-T00-webgl-scene"
```

改成：

```vue
              <div
                class="landing-7-connectory-webgl"
                data-evidence="pending-T00-webgl-scene"
```

其余四个文件同理。`ref` 属性编译后不进 DOM，所以**零运行时、零渲染影响**，
Task 16 的像素对照不受这一步影响。

实测五处的准确位置（声明行 / 模板绑定行，模板行是**删除前的当前行号**）：

| 文件 | 死声明 | 模板 `ref=` 绑定 | 绑定形态 |
|---|---|---|---|
| `components/SiteHeader.vue` | `:40` `const headerEl` | `:172` `<header ref="headerEl" :class="rootClass">` | 行内，删属性保留标签其余部分 |
| `features/home/HomeCard.vue` | `:21` `const content` | `:61` `<div ref="content" class="landing-5-nexus-webgl__content">` | 行内 |
| `features/home/HomeConnectory.vue` | `:22` `const webgl` | `:80` 独占一行 `ref="webgl"` | 整行删 |
| `features/home/HomeGetSeen.vue` | `:28` `const webgl` | `:93` 独占一行 `ref="webgl"` | 整行删 |
| `features/home/HomeTestimonials.vue` | `:25` `const webgl` | `:80` 独占一行 `ref="webgl"` | 整行删 |

**先按内容定位，别照抄行号连删两次** —— 删掉声明会让下面所有行号上移 1。
同一批文件里**还有别的 `ref=` 绑定是活的，绝对不能碰**：`ref="root"`（四个 home 组件
各一处：HomeCard `:42`、HomeConnectory `:66`、HomeGetSeen `:83`、HomeTestimonials `:55`；
`SiteHeader.vue` 没有 root，它全文只有 `ref="headerEl"` 这一个绑定）、
`ref="canvasEl"`（HomeCard `:66`、HomeGetSeen `:100`、HomeTestimonials `:88`）、
`ref="dialog"`（HomeGetSeen `:166`）。上表第五列只列了每个文件要删的那一个，
其余一律保留。判据是"这个标识符在 script 里有没有 `.value` 读取"，表中五个已逐个确认没有。

列绑定时要用 `(^|[[:space:]])ref="` 而不是裸 `ref="` —— 后者会命中 `href="`，
`SiteHeader.vue` 用裸模式会多出 `:238`、`:272` 两处 `BrushLink :href="…"` 假阳性。

- [ ] **Step 3: 确认 `ref` 导入仍被使用（本任务里是空操作，但仍要跑）**

```bash
cd "G:/高并发大作业项目/PeakRush/frontend/welcome"
for f in components/SiteHeader.vue features/home/HomeCard.vue features/home/HomeConnectory.vue features/home/HomeGetSeen.vue features/home/HomeTestimonials.vue; do
  printf "%-26s 删后剩余 ref( 调用:%s\n" "$(basename $f)" "$(grep -oE '\bref[(<]' "$f" | wc -l)"
done
```

**这一步跑在 Step 2 之后，数的是删完声明以后的真实文件，所以不要再 `- 1`。**
初稿写的是 `$(… | wc -l) - 1`，那是给"删除前的文件"做补偿的；Step 3 的位置在删除之后，
两个补偿叠在一起会把每个数都少数 1（实测报出 2/2/1/4/1，真实值是 3/3/2/5/2）。

实测**五个文件删掉那一个死声明后都还剩 ≥2 处 `ref(...)`**（SiteHeader 3、HomeCard 3、
HomeConnectory 2、HomeGetSeen 5、HomeTestimonials 2），所以 **`ref` 必须留在
`import { … } from 'vue'` 里，一个都不许删**。这一步是防手滑：若把 `ref` 从 import
删了，其余 `ref()` 调用会立刻报错；反之若某个文件真的只剩那一个 `ref()`，
`noUnusedLocals` 才会要求清掉导入。跑完确认五个数都 > 0 即可。

- [ ] **Step 4: 提交**

```bash
cd "G:/高并发大作业项目/PeakRush"
git add frontend/welcome/components/SiteHeader.vue frontend/welcome/features/home/
git commit -m "$(cat <<'EOF'
fix: 删除 5 个只写不读的死模板 ref

vue-tsc 3.3.11 对这 5 处报 TS6133，vue-tsc 2.2.12 不报：后者把模板里的字符串
ref="x" 算作对绑定 x 的使用，前者不算。

逐个核实过：都是 const x = ref<HTMLElement|null>(null) 声明 + 模板 ref="x" 绑定，
script 内从未读取。WebGL 挂载走的是 App.vue:97 的
document.querySelector('[data-section-id="…"]')，不经过这些 ref。
ref 属性编译后不进 DOM，故删除零运行时、零渲染影响。

不采用 noUnusedLocals:false —— 那会削弱两边全部源码的检查强度。
EOF
)"
```

- [ ] **Step 5: 记一条 Task 9 的已知非问题**

`HomeTestimonials.vue` 的模板有 `ref="canvasEl"`（现 `:86`）但 script 内**没有**
`const canvasEl` 声明，与 `HomeCard.vue:21` / `HomeGetSeen.vue:28` 不同（那两个既声明又读
`canvasEl.value` 来造 scene descriptor）。

这**不是缺陷，别去补声明**。该组件 `:44` 的 `mount()` 直接 `return null`，注释写明
"no captured scene: the poster/placeholder stays visible by design"，`markLive()` 也是空转
——它本就没有 WebGL 场景，那个 `<canvas>` 只是量出来的占位。所以 `ref="canvasEl"` 是惰性的。

写进 Task 9 的口径：等 `welcome/**` 进 tsconfig 后若这里报任何模板 ref 相关的错，
按"该组件无场景"处理，不要新增变量。

---

## Task 5: 搬迁 public 资产（⚠️ 单向门）

spec §12 末段。**这一步把 23MB 抓取资产（含 `assets/people/` 12MB 真实人物照片）写进 git 历史，删也删不掉。** 若要改用 Git LFS、或把资产留在 `logn in/public/` 由构建脚本复制，**必须在执行 Step 1 之前决定并停止本任务**。

**Files:**
- Move: `logn in/public/assets/` → `frontend/public/assets/`（cp，原本未被跟踪）
- Move: `logn in/public/fonts/` → `frontend/public/fonts/`（git mv）
- Move: `logn in/public/icons.svg` → `frontend/public/icons.svg`（git mv）

- [x] **Step 0: 单向门确认（已获授权，2026-10-07）**

向发起人确认后定案：**全部提交进 git 历史**。已否决的两条退路记录在案——
"LFS 跟踪 assets"（本任务严禁 push，无远端时 LFS 只剩工具链负担，且 `.gitattributes`
会与仓库已配置的 content filter 相互影响）；"留磁盘不进历史"（可逆但换机即失效）。

授权前实测的规模，供日后评估撤除成本：`logn in/public/assets/` **102 个文件、23MB**，
其中 `people/` 12MB / 36 张真实人物照片，单文件最大的是 `product/video-preview.png` 4.5MB；
另有 `fonts/` 244KB（4 个文件）与 `icons.svg` 114,527 字节。manifest 里 107 条记录的
`rights` 全部是 `permission-required`，`nextAction` 写着
"confirm redistribution rights before any public deployment"。

注意 `.gitignore:29` 的 `logn in/public/assets/` 使这 102 个文件**从未进过版本控制**
（`git ls-files -- 'logn in/public'` 只有 5 个：4 个字体 + icons.svg），
本任务它们是第一次入历史。目的地 `frontend/public/assets/` 不在忽略规则内，`git add` 正常。

- [ ] **Step 1: 复核无文件名冲突（Task 前的实测结论要重跑，不能沿用）**

```bash
cd "G:/高并发大作业项目/PeakRush"
(cd frontend/public && find . -type f | sort) > /tmp/main-pub.txt
(cd "logn in/public" && find . -type f | sort) > /tmp/clone-pub.txt
echo "--- 主应用 public ---"; cat /tmp/main-pub.txt
echo "--- 交集条数（必须为 0）---"; comm -12 /tmp/main-pub.txt /tmp/clone-pub.txt | wc -l
comm -12 /tmp/main-pub.txt /tmp/clone-pub.txt
```

Expected: 主应用只有 `./assets/hero-earbuds.png`、`./assets/product-camera.png`、
`./assets/product-earbuds.png`、`./assets/product-watch.png` 四个平铺文件；交集条数 `0`。
**若非 0，停止并报告** —— 覆盖会静默破坏主应用的图片。

- [ ] **Step 2: 搬迁**

```bash
cd "G:/高并发大作业项目/PeakRush"
cp -r "logn in/public/assets/." frontend/public/assets/
git mv "logn in/public/fonts" frontend/public/fonts
git mv "logn in/public/icons.svg" frontend/public/icons.svg
```

`assets/` 用 `cp -r` 而非 `git mv`：它在 `logn in/` 下本就未被跟踪
（`.gitignore` 里有 `logn in/public/assets/`），搬到 `frontend/public/assets/`
后才第一次进入版本控制。

- [ ] **Step 3: 校验搬迁完整性（按文件数与体量，不看目录名）**

```bash
cd "G:/高并发大作业项目/PeakRush"
echo "源 assets:   $(find 'logn in/public/assets' -type f | wc -l) files"
echo "目标 assets: $(find frontend/public/assets -type f | wc -l) files"
du -sh "logn in/public/assets" frontend/public/assets
echo "--- fonts ---"; ls frontend/public/fonts
echo "--- icons.svg ---"; ls -l frontend/public/icons.svg
echo "--- 主应用原有 4 张图仍在 ---"; ls frontend/public/assets/*.png
```

Expected: 目标文件数 = 源文件数 + 4；`fonts` 下 4 个文件
（`Hardbop-Bold.woff`、`Hardbop-Bold.woff2`、`HeadingNow-73Book.woff`、`HeadingNow-73Book.woff2`）；
`icons.svg` 约 112KB；主应用原有 4 张 PNG 仍在 `frontend/public/assets/` 顶层。

- [ ] **Step 4: 校验字体 url 与 publicDir 路径吻合**

```bash
cd "G:/高并发大作业项目/PeakRush/frontend"
grep -oE "url\(/fonts/[^)'\"]+\)" welcome/styles/typography.css | sed -E "s|url\((.*)\)|\1|" | sort -u > /tmp/fonturls.txt
echo "抓到 $(wc -l < /tmp/fonturls.txt) 条（期望 4）"
while read -r f; do [ -f "public$f" ] && echo "OK       $f" || echo "MISSING  $f"; done < /tmp/fonturls.txt
```

Expected: 恰好 4 条，全部 `OK`（`Hardbop-Bold.woff`、`Hardbop-Bold.woff2`、
`HeadingNow-73Book.woff`、`HeadingNow-73Book.woff2`）。

**初稿这里设计错了，别用裸 grep。** 原写法是
`for f in $(grep -o "/fonts/[^)\"']*" welcome/styles/typography.css | sort -u)`，
实测它抓到 **14 条而不是 4 条**：`typography.css:23` 的注释散文
`were downloaded into public/fonts/, so the woff url()` 里含 `/fonts/`，
`[^)"']*` 把整句按非引号字符一路吃进去，再被 shell 的单词分割炸成
`to` / `the` / `local` / `so` / `woff` / `url(` 这些垃圾项。
于是这道闸**永远红**——照原样跑会把一次正确的搬迁判成失败。
改成只吃 `url(/fonts/….woff2)` 这种真实声明，并且用文件而不是命令替换来迭代。

`@font-face` 用的是根绝对路径，publicDir 合并后仍在根，**CSS 一行都不用改**。

- [ ] **Step 5: 提交**

```bash
cd "G:/高并发大作业项目/PeakRush"
git add frontend/public "logn in/public"
git status --short | head -5
git commit -m "$(cat <<'EOF'
feat: 克隆站 public 资产并入 frontend/public

assets/(23MB) + fonts/(244KB) + icons.svg(112KB) 合并进 frontend/public/。
实测与主应用原有 4 张平铺 PNG 无文件名冲突。

@font-face 的 url(/fonts/…) 是根绝对路径，publicDir 合并后仍在根，CSS 零改动。
icons.svg 被 content/assets.manifest.json:1787 按路径引用。

授权状态记录在设计文档 §12：这批资产在复刻站的 assets.manifest.json 里全部标记
permission-required，其中 assets/people/ 12MB 是真实人物照片。本步骤已把它们写入
git 历史，属单向门，公开部署前须重新评估授权。
EOF
)"
```

---

## Task 6: 合并 package.json 与 tsconfig.json

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/tsconfig.json`

- [ ] **Step 1: package.json 加依赖**

`frontend/package.json` 的 `dependencies` 改为（新增 `lenis`、`pinia`、`three`，
版本取自 `logn in/package.json:26-28`，**精确版本不加 `^`**，因为原站实测
`window.__THREE__ === '176'`、`window.lenisVersion === '1.3.3'`）：

```json
  "dependencies": {
    "@element-plus/icons-vue": "^2.3.2",
    "element-plus": "^2.11.0",
    "lenis": "1.3.3",
    "pinia": "^3.0.3",
    "three": "0.176.0",
    "vue": "^3.5.21",
    "vue-router": "^4.5.1"
  },
```

`devDependencies` 改为（新增 `@types/node`、`@types/three`；`@types/three` 取自
`logn in/package.json:35`，`@types/node` 是 `types:["node"]` 需要的）：

```json
  "devDependencies": {
    "@types/node": "^24.0.0",
    "@types/three": "^0.176.0",
    "@vitejs/plugin-vue": "^6.0.1",
    "typescript": "~5.9.2",
    "vite": "^7.1.7",
    "vue-tsc": "^3.0.7"
  }
```

**不引入**克隆站的 `@playwright/test`、`@vue/test-utils`、`eslint*`、`jsdom`、
`vitest`、`pixelmatch`、`pngjs`（spec §5.7、决策 10）。
`scripts` 四项（`dev`/`build`/`preview`/`test`）保持不变。

- [ ] **Step 2: 安装并核对版本**

```bash
cd "G:/高并发大作业项目/PeakRush/frontend"
npm install --no-audit --no-fund 2>&1 | tail -15
echo "install exit=${PIPESTATUS[0]}"
node -e "const fs=require('fs');for(const p of ['three','lenis','pinia','vite','vue-tsc','typescript','@types/three','@types/node'])console.log(p, JSON.parse(fs.readFileSync('node_modules/'+p+'/package.json')).version)"
```

Expected: 无 `ERESOLVE` 冲突；打印 `three 0.176.0`、`lenis 1.3.3`、`pinia 3.x`、
`vite 7.x`、`vue-tsc 3.x`、`typescript 5.9.x`。

**不要用 `require(p+'/package.json')` 读版本** —— 初稿那样写，实测在
`three@0.176.0` 上直接失败：它的 `package.json` 有 `exports` 封装，子路径
`./package.json` 没有导出，`require` 报
`ERR_PACKAGE_PATH_NOT_EXPORTED`（或 MODULE_NOT_FOUND），一次正确的安装会被这条
核对命令自己弄红。改用 `fs.readFileSync` 绕过封装，或 `npm ls --depth=0`。

顺带核对**没有**被引入的东西（spec §5.7 的排除项）：

```bash
cd "G:/高并发大作业项目/PeakRush/frontend"
for d in playwright @playwright/test vitest eslint jsdom pixelmatch pngjs @vue/test-utils; do
  printf "  %-22s %s\n" "$d" "$(ls -d "node_modules/$d" 2>/dev/null >/dev/null && echo PRESENT-BAD || echo absent)"
done
```

Expected: 全部 `absent`。

- [ ] **Step 3: 整份替换 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "useDefineForClassFields": true,
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "esModuleInterop": true,
    "noImplicitOverride": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "skipLibCheck": true,
    "jsx": "preserve",
    "noEmit": true,
    "types": ["vite/client", "node"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["welcome/*"],
      "@shared/*": ["shared/*"]
    }
  },
  "include": [
    "src/**/*.ts",
    "src/**/*.vue",
    "welcome/**/*.ts",
    "welcome/**/*.vue",
    "shared/**/*.ts",
    "build/**/*.ts",
    "vite.config.ts"
  ]
}
```

选项来源（spec §5.5）：`lib` 取克隆站的 `ES2023`（高于主应用的 `ES2022`）；
`useDefineForClassFields`/`allowImportingTsExtensions` 来自主应用；
`noImplicitOverride`/`esModuleInterop`/`jsx`/`types` 来自克隆站；其余两边本就相同。

`include` **不含** `welcome/scripts/**` 与 `welcome/tests/**`（本轮不引入
`@playwright/test`）。`welcome/**/*.ts` 已覆盖 `welcome/webgl/shaders/glsl.d.ts`
—— tsconfig 的 `**/*.ts` glob 匹配 `.d.ts`，不需要单列一项。

- [ ] **Step 4: 提交**

```bash
cd "G:/高并发大作业项目/PeakRush"
git add frontend/package.json frontend/package-lock.json frontend/tsconfig.json
git commit -m "$(cat <<'EOF'
build: 合并两边依赖与 tsconfig

新增 three@0.176.0、lenis@1.3.3（均精确版本，原站实测 window.__THREE__==='176'、
window.lenisVersion==='1.3.3'）、pinia@^3.0.3、@types/three、@types/node。

tsconfig 取两边选项并集：lib 用 ES2023（克隆站的，高于主应用 ES2022），
paths 加 @/*→welcome/* 与 @shared/*→shared/*。实测主应用 src/ 使用 @/ 导入 0 次，
所以 @ 可以独占给克隆站，其源码零改动。

include 不含克隆站的 scripts/ 与 tests/：本轮不引入 @playwright/test。
EOF
)"
```

---

## Task 7: MPA history fallback 判定函数（TDD）

`appType:'mpa'` 关掉了 Vite 默认的 SPA 回退，深层 URL 直接访问会 404。判定逻辑写成纯函数先测，再在 Task 8 包成插件。

**Files:**
- Create: `frontend/build/resolve-entry.ts`
- Test: `frontend/tests/resolve-entry.test.mjs`

- [ ] **Step 1: 写失败测试**

创建 `frontend/tests/resolve-entry.test.mjs`（沿用 `api.test.mjs:7-9` 的
"读 .ts → `ts.transpileModule` → `data:` URL 导入"范式）：

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'

const source = await fs.readFile(new URL('../build/resolve-entry.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const { resolveEntry } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))

const HTML = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'

test('clone routes fall back to the clone entry', () => {
  for (const p of ['/', '/about', '/our-product', '/pricing', '/faq', '/community-board',
                   '/signin', '/signup', '/gift-card', '/terms-and-conditions',
                   '/privacy-policy', '/cookies-policy', '/no-such-page']) {
    assert.equal(resolveEntry(p, HTML), '/index.html', p)
  }
})

test('main app routes fall back to the app entry, with or without trailing slash', () => {
  for (const p of ['/app', '/app/', '/app/orders', '/app/admin', '/app/activities/12',
                   '/app/no-such-page']) {
    assert.equal(resolveEntry(p, HTML), '/app.html', p)
  }
})

test('a path that merely starts with the letters app is not an app route', () => {
  assert.equal(resolveEntry('/application', HTML), '/index.html')
  assert.equal(resolveEntry('/app-evil', HTML), '/index.html')
  assert.equal(resolveEntry('/apple/orders', HTML), '/index.html')
})

test('static and internal prefixes are never rewritten', () => {
  for (const p of ['/assets/cards/Card-1.png', '/assets/product-earbuds.png',
                   '/fonts/HeadingNow-73Book.woff2', '/icons.svg',
                   '/welcome/main.ts', '/src/main.ts', '/_app/index-abc123.js',
                   '/api/auth/login', '/actuator/health',
                   '/@vite/client', '/@id/__x00__plugin-vue:export-helper',
                   '/node_modules/vue/dist/vue.js',
                   '/index.html', '/app.html']) {
    assert.equal(resolveEntry(p, HTML), null, p)
  }
})

test('anything containing a dot in its last segment is treated as a file', () => {
  assert.equal(resolveEntry('/favicon.ico', HTML), null)
  assert.equal(resolveEntry('/about/team.photo', HTML), null)
})

test('non-html requests are never rewritten, whatever the path', () => {
  assert.equal(resolveEntry('/about', 'application/json'), null)
  assert.equal(resolveEntry('/app/orders', '*/*'), null)
  assert.equal(resolveEntry('/signin', undefined), null)
  assert.equal(resolveEntry('/signin', ''), null)
})
```

- [ ] **Step 2: 跑测试，确认因文件不存在而失败**

```bash
cd "G:/高并发大作业项目/PeakRush/frontend"
npm test 2>&1 | tail -20
```

Expected: FAIL，报 `ENOENT: no such file or directory … build/resolve-entry.ts`。

- [ ] **Step 3: 写实现**

创建 `frontend/build/resolve-entry.ts`：

```ts
/**
 * Decides which MPA entry serves a navigation request.
 *
 * Vite's appType:'mpa' turns off the SPA fallback, so a deep link into either app
 * would 404 on a direct load or a refresh. This is the whole decision, kept pure so
 * it can be tested without a server; mpa-fallback.ts only wires it into middlewares.
 *
 * Returning null means "leave the request alone" — it is a static asset, an internal
 * Vite/dev URL, an API proxy path, or not an HTML navigation at all.
 */
const RESERVED_PREFIXES = [
  '/src/',
  '/welcome/',
  '/assets/',
  '/fonts/',
  '/_app/',
  '/@',
  '/node_modules/',
  '/api',
  '/actuator',
] as const;

export function resolveEntry(pathname: string, accept: string | undefined): string | null {
  if (!accept || !accept.includes('text/html')) return null;
  if (RESERVED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;
  const lastSegment = pathname.slice(pathname.lastIndexOf('/') + 1);
  if (lastSegment.includes('.')) return null;
  const isApp = pathname === '/app' || pathname.startsWith('/app/');
  return isApp ? '/app.html' : '/index.html';
}
```

- [ ] **Step 4: 跑测试，确认通过**

```bash
cd "G:/高并发大作业项目/PeakRush/frontend"
npm test 2>&1 | tail -20
```

Expected: PASS。`resolve-entry` 6 个测试全绿，且原有 `api.test.mjs` 的 7 个测试仍全绿。
**特别看 `/application`、`/app-evil`、`/apple/orders` 那三条** —— 它们验证的是
"只以字母 app 开头不算 app 路由"，实现写成 `startsWith('/app')` 就会全部漏过。

- [ ] **Step 5: 提交**

```bash
cd "G:/高并发大作业项目/PeakRush"
git add frontend/build/resolve-entry.ts frontend/tests/resolve-entry.test.mjs
git commit -m "feat: MPA history fallback 的入口判定纯函数"
```

---

## Task 8: 拆入口 HTML 与配置 vite.config.ts

**Files:**
- Create: `frontend/build/mpa-fallback.ts`
- Rename: `frontend/index.html` → `frontend/app.html`
- Create: `frontend/index.html`（克隆站入口）
- Modify: `frontend/vite.config.ts`

`frontend/build/` 已由 Task 7 创建（Step 1 只是往里加 `mpa-fallback.ts`），
`frontend/shared/` 由下面 Step 5 创建。

- [ ] **Step 1: 写插件包装**

创建 `frontend/build/mpa-fallback.ts`：

```ts
import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolveEntry } from './resolve-entry';

/**
 * Serves the right MPA entry for deep links, in both `vite dev` and `vite preview`.
 *
 * Both hooks are required: scripts/app-start.ps1:62 starts the DEV server, while
 * `npm run preview` is the other documented way to serve this app. Mounting only one
 * of them would leave deep links 404-ing in the other.
 */
function rewrite(req: IncomingMessage, _res: ServerResponse, next: () => void): void {
  const url = req.url ?? '/';
  const qIndex = url.indexOf('?');
  const pathname = qIndex === -1 ? url : url.slice(0, qIndex);
  const entry = resolveEntry(pathname, req.headers.accept);
  if (entry === null) {
    next();
    return;
  }
  req.url = entry + (qIndex === -1 ? '' : url.slice(qIndex));
  next();
}

export function mpaFallback(): Plugin {
  return {
    name: 'peakrush-mpa-fallback',
    configureServer(server) {
      server.middlewares.use(rewrite);
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite);
    },
  };
}
```

- [ ] **Step 2: 把现有 index.html 改名为 app.html**

```bash
cd "G:/高并发大作业项目/PeakRush/frontend"
git mv index.html app.html
cat app.html
```

Expected: 内容是原主应用 HTML —— `<html lang="zh-CN">`、
`<title>PeakRush · 限量抢购</title>`、`<script type="module" src="/src/main.ts">`。
**`src` 路径不改**，主应用源码仍在 `src/`。

- [ ] **Step 3: 创建克隆站入口 index.html**

创建 `frontend/index.html`：

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FOLLOW.ART | Digital Infrastructure for Curators &amp; Artists</title>
    <meta name="description" content="A digital Card that brings everything together. One practice. One card." />
    <meta name="theme-color" content="#F57D32" />
  </head>
  <body class="clone-local">
    <div id="app"></div>
    <script type="module" src="/welcome/main.ts"></script>
  </body>
</html>
```

与 `logn in/index.html` 逐字相同，**只有 `<script src>` 从 `/src/main.ts` 改成
`/welcome/main.ts`**。`lang="en"`、FOLLOW.ART 标题、`theme-color`、
`<body class="clone-local">` 全部保留 —— 这些属品牌，spec 决策 5 推到子项目 2。
（`clone-local` 实测无任何 CSS 规则命中，是无样式的标记类。）

- [ ] **Step 4: 整份替换 vite.config.ts**

```ts
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { mpaFallback } from "./build/mpa-fallback";

export default defineConfig({
  plugins: [vue(), mpaFallback()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./welcome", import.meta.url)),
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
    },
  },
  // 'spa' would fall every unknown path back to /index.html, which would serve the
  // clone for /app/orders. mpaFallback() owns that decision instead.
  appType: "mpa",
  server: {
    host: "127.0.0.1",
    port: 5179,
    strictPort: true,
    proxy: {
      "/api": { target: "http://127.0.0.1:8080", changeOrigin: true },
      "/actuator": { target: "http://127.0.0.1:8080", changeOrigin: true },
    },
  },
  build: {
    // Not the default 'assets': publicDir also holds the clone's 23MB public/assets/,
    // and both would land in dist/assets/. Filenames do not actually collide (Vite
    // hashes its own), but keeping them apart makes a broken asset obvious.
    assetsDir: "_app",
    target: "es2022",
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL("./index.html", import.meta.url)),
        app: fileURLToPath(new URL("./app.html", import.meta.url)),
      },
    },
  },
});
```

`server` 块逐字沿用原配置（host/port/strictPort/两个 proxy）。
`alias`/`appType`/`assetsDir`/`target`/`input` 是新增，理由见 spec §5.3。

- [ ] **Step 5: 建 shared 目录，避免 alias 指向不存在的路径**

```bash
cd "G:/高并发大作业项目/PeakRush/frontend"
mkdir -p shared
ls -d shared build
```

Expected: 两个目录都在（`build/` 由 Task 7 创建）。`shared/safe-redirect.ts` 在
Task 10 创建；目录先建好，否则 Vite 解析 `@shared` 会报无法解析。

- [ ] **Step 6: 提交**

```bash
cd "G:/高并发大作业项目/PeakRush"
git add frontend/index.html frontend/app.html frontend/vite.config.ts frontend/build/mpa-fallback.ts
git commit -m "$(cat <<'EOF'
build: 双入口 MPA 配置与 history fallback 插件

index.html 改为克隆站入口（entry 指向 /welcome/main.ts），原主应用 HTML 改名为
app.html。appType 从默认 spa 改为 mpa —— spa 会把所有未知路径回退到 /index.html，
那样 /app/orders 会加载到克隆站；回退判定改由 mpaFallback() 接管，dev 与 preview
两条路径都挂（app-start.ps1:62 起的是 dev server）。

alias @ 指向 welcome/（实测主应用 src/ 用 @/ 导入 0 次，可安全独占），
@shared 指向 shared/。build.assetsDir 从默认 assets 改为 _app，避免 Vite 产物与
publicDir 里克隆站的 23MB assets/ 挤在同一目录。
EOF
)"
```

---

## Task 9: 构建 abort 判据验证（锚点）

spec §9.2 与 §14 步骤 7。**这是不能移位的第二个锚点。** 若构建在 Vite 7 / plugin-vue 6 下失败且无法在合理代价内修复，**停止子项目 1，报告并退回拓扑 C**（spec §9.2 末段），不要临时改方案继续。

**Files:** 无（纯验证）

- [ ] **Step 1: typecheck**

```bash
cd "G:/高并发大作业项目/PeakRush/frontend"
npx vue-tsc --noEmit 2>&1 | tee /tmp/typecheck.txt | tail -30
echo "exit=${PIPESTATUS[0]}"
grep -c "error TS" /tmp/typecheck.txt || echo "0 errors"
```

Expected: `exit=0`、`0 errors`。
Task 3/4 应已消掉 glob 与 5 个 `TS6133`。若仍有错误：
`@/` 解析失败 → 查 Task 8 的 alias 或 Task 6 的 `paths`；
`.glsl?raw` 类型报错 → `welcome/webgl/shaders/glsl.d.ts` 没被 include 覆盖。

- [ ] **Step 2: 构建**

```bash
cd "G:/高并发大作业项目/PeakRush/frontend"
rm -rf dist
npm run build 2>&1 | tee /tmp/build.txt | tail -40
echo "exit=${PIPESTATUS[0]}"
```

Expected: `exit=0`。

- [ ] **Step 3: 验产物结构（spec §10.1）**

```bash
cd "G:/高并发大作业项目/PeakRush/frontend"
echo "--- 两个入口 HTML ---"; ls dist/index.html dist/app.html
echo "--- Vite 产物目录 _app 文件数 ---"; ls dist/_app | wc -l
echo "--- publicDir 资产 ---"; ls -d dist/assets dist/fonts dist/icons.svg
echo "--- dist/assets 里不应有 js/css ---"
find dist/assets -name "*.js" -o -name "*.css" | head -5
echo "（上面应为空）"
echo "--- 字体 ---"; ls dist/fonts
```

Expected: 两个 HTML 都在；`dist/_app` 有内容；`dist/assets`、`dist/fonts`、
`dist/icons.svg` 都在；`find` 输出为空；`dist/fonts` 4 个文件。

- [ ] **Step 4: 验 CSS 隔离（spec §10.1 的关键项）**

```bash
cd "G:/高并发大作业项目/PeakRush/frontend"
node -e "
const fs=require('fs'),path=require('path');
const cssOf=(h)=>[...h.matchAll(/href=\"([^\"]+\.css)\"/g)].map(m=>m[1]);
for (const entry of ['dist/index.html','dist/app.html']) {
  const html=fs.readFileSync(entry,'utf8');
  const files=cssOf(html);
  const css=files.map(f=>fs.readFileSync(path.join('dist',f.replace(/^\//,'')),'utf8')).join('\n');
  console.log('---',entry,'->',files.length,'css file(s),',(css.length/1024).toFixed(0)+'KB');
  for (const probe of ['--el-color-primary','#ff4e16','.el-button','HeadingNow','--scale-text-rem','.layout-split'])
    console.log('   ', probe.padEnd(22), css.includes(probe));
}
"
```

Expected（这是 spec §4.1 文档级隔离的直接证据）：

| 探针 | `dist/index.html`（克隆站） | `dist/app.html`（主应用） |
|---|---|---|
| `--el-color-primary` | **false** | true |
| `#ff4e16` | **false** | true |
| `.el-button` | **false** | true |
| `HeadingNow` | true | **false** |
| `--scale-text-rem` | true | **false** |
| `.layout-split` | true | **false** |

**任一格的期望值不符，说明两个入口的 CSS 串了。** 停下来查是哪个共享模块同时
import 了两边的样式，不要继续。

- [ ] **Step 5: 单测仍绿**

```bash
cd "G:/高并发大作业项目/PeakRush/frontend"
npm test 2>&1 | tail -12
```

Expected: PASS，`api.test.mjs` 7 个 + `resolve-entry.test.mjs` 6 个全绿。

- [ ] **Step 6: 留档**

`/tmp/typecheck.txt` 与 `/tmp/build.txt` 的实际输出要在 Task 19 的报告里引用。
本任务无源码变更，**不产生 commit**。

---

## Task 10: 共享的开放重定向校验（TDD）

spec §7.6。**安全函数不复制两份** —— 两个入口都 import 同一个模块，否则一边修了另一边没修就是漏洞。

**Files:**
- Create: `frontend/shared/safe-redirect.ts`
- Test: `frontend/tests/safe-redirect.test.mjs`

- [ ] **Step 1: 写失败测试**

创建 `frontend/tests/safe-redirect.test.mjs`：

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'

const source = await fs.readFile(new URL('../shared/safe-redirect.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const { safeRedirect } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))

test('main app paths are accepted unchanged', () => {
  for (const p of ['/app', '/app/', '/app/orders', '/app/admin', '/app/activities/12',
                   '/app/orders?page=2', '/app/#top']) {
    assert.equal(safeRedirect(p), p)
  }
})

test('protocol-relative and absolute URLs are refused', () => {
  for (const p of ['//evil.com', '///evil.com', 'https://evil.com', 'http://evil.com/app/',
                   'javascript:alert(1)', 'data:text/html,x']) {
    assert.equal(safeRedirect(p), '/app/', p)
  }
})

test('paths outside the main app are refused, even though they are same-origin', () => {
  for (const p of ['/', '/signin', '/about', '/pricing', '/gift-card']) {
    assert.equal(safeRedirect(p), '/app/', p)
  }
})

test('paths that merely start with the letters app are refused', () => {
  for (const p of ['/application', '/app-evil', '/apple/orders', '/appx']) {
    assert.equal(safeRedirect(p), '/app/', p)
  }
})

test('non-string query values are refused', () => {
  assert.equal(safeRedirect(undefined), '/app/')
  assert.equal(safeRedirect(null), '/app/')
  assert.equal(safeRedirect(['a', 'b']), '/app/')
  assert.equal(safeRedirect({}), '/app/')
  assert.equal(safeRedirect(123), '/app/')
  assert.equal(safeRedirect(''), '/app/')
})

test('a custom fallback is honoured', () => {
  assert.equal(safeRedirect('//evil.com', '/app/orders'), '/app/orders')
  assert.equal(safeRedirect('/app/admin', '/app/orders'), '/app/admin')
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd "G:/高并发大作业项目/PeakRush/frontend"
npm test 2>&1 | tail -12
```

Expected: FAIL，`ENOENT … shared/safe-redirect.ts`。

- [ ] **Step 3: 写实现**

创建 `frontend/shared/safe-redirect.ts`：

```ts
/**
 * The only place that decides where a post-login navigation may go.
 *
 * `redirect` comes from a query string, so it is attacker-controlled, and it is handed
 * straight to window.location.href — which happily accepts absolute URLs. Both entries
 * import this one copy on purpose: duplicating a security check is how one side gets
 * fixed and the other stays open.
 *
 * Only same-origin paths under /app are allowed. There is no legitimate reason to land
 * a freshly authenticated user on one of the portal's marketing routes, so everything
 * else — including same-origin '/' and '/signin' — falls back.
 */
export function safeRedirect(value: unknown, fallback = '/app/'): string {
  if (typeof value !== 'string') return fallback;
  const isAppPath =
    value === '/app' ||
    value.startsWith('/app/') ||
    value.startsWith('/app?') ||
    value.startsWith('/app#');
  return isAppPath ? value : fallback;
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd "G:/高并发大作业项目/PeakRush/frontend"
npm test 2>&1 | tail -12
```

Expected: PASS，6 个新测试全绿。
**特别看 `/application`、`/app-evil`、`/appx` 那组** —— 实现写成
`startsWith('/app')` 会全部漏过。

- [ ] **Step 5: 提交**

```bash
cd "G:/高并发大作业项目/PeakRush"
git add frontend/shared/safe-redirect.ts frontend/tests/safe-redirect.test.mjs
git commit -m "feat: 两个入口共用的开放重定向校验"
```

---

## Task 11: auth 校验规则（TDD）

spec §7.2。规则对齐 `Auth.java:30`，不是复刻站的测量值。

**Files:**
- Create: `frontend/welcome/app/auth-validation.ts`
- Test: `frontend/tests/auth-validation.test.mjs`

- [ ] **Step 1: 写失败测试**

创建 `frontend/tests/auth-validation.test.mjs`：

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'

const source = await fs.readFile(new URL('../welcome/app/auth-validation.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const { validateCredentials, passwordByteLength } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))

const ok = { username: 'admin_01', password: 'longenough', confirm: 'longenough' }

test('a credential pair matching Auth.java:30 produces no errors', () => {
  assert.deepEqual(validateCredentials(ok, 'signup'), {})
  assert.deepEqual(validateCredentials({ username: 'admin_01', password: 'longenough' }, 'signin'), {})
})

test('username must be 3-40 chars of letters, digits and underscore only', () => {
  for (const bad of ['ab', 'a'.repeat(41), '张三', 'a@b.com', 'a-b', 'a b', 'a.b', '']) {
    const errors = validateCredentials({ ...ok, username: bad }, 'signin')
    assert.ok(errors.username, JSON.stringify(bad) + ' should be rejected')
  }
  for (const good of ['abc', 'a_1', 'A'.repeat(40), 'user01']) {
    assert.equal(validateCredentials({ ...ok, username: good }, 'signin').username, undefined, good)
  }
})

test('an email address is rejected as a username, which is why the field is type=text', () => {
  assert.ok(validateCredentials({ ...ok, username: 'someone@example.com' }, 'signin').username)
})

test('password must be at least 8 characters, matching the backend rather than the old dialog', () => {
  assert.ok(validateCredentials({ ...ok, password: '1234567', confirm: '1234567' }, 'signup').password)
  assert.equal(validateCredentials({ ...ok, password: '12345678', confirm: '12345678' }, 'signup').password, undefined)
})

test('password is capped at 72 bytes, counted in UTF-8 not characters', () => {
  assert.equal(passwordByteLength('a'.repeat(72)), 72)
  assert.equal(passwordByteLength('a'.repeat(73)), 73)
  assert.equal(passwordByteLength('中'.repeat(24)), 72)
  assert.equal(passwordByteLength('中'.repeat(25)), 75)
  // 24 CJK chars clear the 8-character floor and sit exactly on the byte ceiling.
  assert.equal(validateCredentials({ ...ok, password: '中'.repeat(24), confirm: '中'.repeat(24) }, 'signup').password, undefined)
  assert.ok(validateCredentials({ ...ok, password: '中'.repeat(25), confirm: '中'.repeat(25) }, 'signup').password)
})

test('confirm is only checked on signup', () => {
  assert.ok(validateCredentials({ ...ok, confirm: 'mismatched' }, 'signup').confirm)
  assert.equal(validateCredentials({ username: 'admin_01', password: 'longenough' }, 'signin').confirm, undefined)
  assert.deepEqual(validateCredentials({ username: 'admin_01', password: 'longenough', confirm: 'whatever' }, 'signin'), {})
})

test('all applicable fields are reported at once, not one per submit', () => {
  const errors = validateCredentials({ username: 'x', password: 'short', confirm: 'other' }, 'signup')
  assert.deepEqual(Object.keys(errors).sort(), ['confirm', 'password', 'username'])
})

test('username is trimmed before validating, matching Auth.java:29', () => {
  assert.equal(validateCredentials({ ...ok, username: '  admin_01  ' }, 'signin').username, undefined)
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd "G:/高并发大作业项目/PeakRush/frontend"
npm test 2>&1 | tail -12
```

Expected: FAIL，`ENOENT … welcome/app/auth-validation.ts`。

- [ ] **Step 3: 写实现**

创建 `frontend/welcome/app/auth-validation.ts`：

```ts
/**
 * Client-side mirror of the single validation guard in Auth.java:30, which runs BEFORE
 * the register branch and therefore applies to login and signup alike:
 *
 *   !name.matches("[A-Za-z0-9_]{3,40}")
 *     || password.length() < 8
 *     || password.getBytes(UTF_8).length > 72
 *
 * The username pattern admits no '@' or '.', which is why the field is type="text" and
 * not the reference's type="email" — a browser would block a legitimate username like
 * admin_01 before it ever reached us.
 *
 * The password floor is 8, not the 6 that AuthDialog.vue used to check. That mismatch
 * pre-dated this work: a 6-character password passed the old dialog and was then
 * rejected by the backend.
 */
export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,40}$/;
export const PASSWORD_MIN_CHARS = 8;
export const PASSWORD_MAX_BYTES = 72;

export type FieldName = 'username' | 'password' | 'confirm';
export type FieldErrors = Partial<Record<FieldName, string>>;

export interface CredentialInput {
  username: string;
  password: string;
  confirm?: string;
}

export function passwordByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function validateCredentials(
  input: CredentialInput,
  mode: 'signin' | 'signup',
): FieldErrors {
  const errors: FieldErrors = {};
  const username = input.username.trim();

  if (!USERNAME_PATTERN.test(username)) {
    errors.username = 'Username must be 3-40 letters, digits or underscores.';
  }
  if (input.password.length < PASSWORD_MIN_CHARS) {
    errors.password = `Password must be at least ${PASSWORD_MIN_CHARS} characters.`;
  } else if (passwordByteLength(input.password) > PASSWORD_MAX_BYTES) {
    errors.password = `Password must be at most ${PASSWORD_MAX_BYTES} bytes.`;
  }
  if (mode === 'signup' && input.confirm !== input.password) {
    errors.confirm = 'The two passwords do not match.';
  }
  return errors;
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd "G:/高并发大作业项目/PeakRush/frontend"
npm test 2>&1 | tail -12
```

Expected: PASS，8 个新测试全绿。
**特别看 `'中'.repeat(24)` 与 `'中'.repeat(25)` 那两条** —— 它们验证字节上限按 UTF-8
计而非按字符计（24 个汉字 = 72 字节，恰好压线通过；25 个 = 75 字节，拒）。
用 `password.length` 判上限会两条都错。

- [ ] **Step 5: 提交**

```bash
cd "G:/高并发大作业项目/PeakRush"
git add frontend/welcome/app/auth-validation.ts frontend/tests/auth-validation.test.mjs
git commit -m "feat: 对齐 Auth.java:30 的登录/注册校验规则"
```

---

## Task 12: welcome 侧的 auth 传输层（TDD）

spec §7.3。**不复用 `frontend/src/api.ts`**，但不是因为"共享模块会破坏隔离"——
spec §7.3 原来那么写是错的，且与 §7.6 要求的共享 `frontend/shared/safe-redirect.ts`
自相矛盾。§4.1 的隔离是**文档级 / CSS 级**的：两个 HTML 入口各拿一份构建产物，
互不可见对方的样式表；共享一个纯逻辑 TS 模块完全不影响它（Task 10 就在这么做）。

不复用 `api.ts` 的真实理由有三条，都可从该文件核出：

1. `api.ts:20-21` 给**每一个**请求挂 `Authorization: Bearer <localStorage token>`。
   门户的 login/register 是未认证端点，不该带着上一次的陈旧 token 出门。
2. `api.ts:42` 在任何非 `/api/auth/` 的 401 上派发 `peakrush:expired`——那是主应用的
   会话概念，门户文档里没有监听者（`session.ts` 不在门户 bundle 内），纯属死代码。
3. `api.ts:46-52` 的状态码兜底文案是中文、按主应用语气写的；门户这一份是英文，
   留到子项目 2 统一中文化。

**Files:**
- Create: `frontend/welcome/app/authApi.ts`
- Test: `frontend/tests/auth-api.test.mjs`

- [ ] **Step 1: 写失败测试**

创建 `frontend/tests/auth-api.test.mjs`：

```js
import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'

const source = await fs.readFile(new URL('../welcome/app/authApi.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const { submitAuth, AuthRequestError } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))

const TOKEN_RESULT = { token: 'header.body.sig', user: { id: 7, username: 'admin_01', role: 'USER' } }
let sent

beforeEach(() => {
  sent = undefined
  globalThis.window = { setTimeout, clearTimeout }
})

test('signin posts to /api/auth/login with only username and password', async () => {
  globalThis.fetch = async (path, options) => {
    sent = { path, options }
    return new Response(JSON.stringify(TOKEN_RESULT))
  }
  const result = await submitAuth('signin', 'admin_01', 'longenough')
  assert.equal(sent.path, '/api/auth/login')
  assert.equal(sent.options.method, 'POST')
  assert.equal(sent.options.body, '{"username":"admin_01","password":"longenough"}')
  // A plain object literal, not a Headers instance: submitAuth has no caller-supplied
  // headers to merge, which is the only reason frontend/src/api.ts:17 builds one.
  assert.equal(sent.options.headers['Content-Type'], 'application/json')
  assert.equal(sent.options.headers['Accept'], 'application/json')
  assert.deepEqual(result, TOKEN_RESULT)
})

test('signup posts to /api/auth/register', async () => {
  globalThis.fetch = async (path, options) => {
    sent = { path, options }
    return new Response(JSON.stringify(TOKEN_RESULT))
  }
  await submitAuth('signup', 'newuser', 'longenough')
  assert.equal(sent.path, '/api/auth/register')
})

test('the username is trimmed before it is sent, matching Auth.java:29', async () => {
  globalThis.fetch = async (_path, options) => {
    sent = options
    return new Response(JSON.stringify(TOKEN_RESULT))
  }
  await submitAuth('signin', '  admin_01  ', 'longenough')
  assert.equal(sent.body, '{"username":"admin_01","password":"longenough"}')
})

test('a 401 keeps the backend message and its code', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ code: 'INVALID_CREDENTIALS', message: '用户名或密码不正确' }), { status: 401 })
  await assert.rejects(
    () => submitAuth('signin', 'admin_01', 'wrongpassw'),
    (error) => error instanceof AuthRequestError && error.status === 401
      && error.code === 'INVALID_CREDENTIALS' && error.message === '用户名或密码不正确',
  )
})

test('a 409 duplicate username surfaces as such', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ code: 'USERNAME_EXISTS', message: '用户名已存在' }), { status: 409 })
  await assert.rejects(
    () => submitAuth('signup', 'admin_01', 'longenough'),
    (error) => error instanceof AuthRequestError && error.status === 409 && error.code === 'USERNAME_EXISTS',
  )
})

test('a 400 validation rejection carries the backend wording, not a locally invented one', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ code: 'BAD_REQUEST', message: '用户名须为3–40位字母数字下划线，密码须为8–72字节' }), { status: 400 })
  await assert.rejects(
    () => submitAuth('signup', 'x', 'short'),
    (error) => error.message === '用户名须为3–40位字母数字下划线，密码须为8–72字节',
  )
})

test('a network failure is reported as such and never mistaken for a rejection', async () => {
  globalThis.fetch = async () => { throw new TypeError('network unavailable') }
  await assert.rejects(
    () => submitAuth('signin', 'admin_01', 'longenough'),
    (error) => error instanceof AuthRequestError && error.status === 0 && error.code === 'NETWORK_ERROR',
  )
})

test('a timeout aborts at 18s and says it is safe to retry', async () => {
  let seenMs
  // The stub runs the callback synchronously, so the implementation's real
  // controller.abort() has already fired by the time fetch is called. That reproduces
  // the state an 18s stall produces instead of faking an 'abort' event by hand —
  // a synthetic dispatchEvent would leave signal.aborted false and test nothing.
  globalThis.window = { setTimeout: (fn, ms) => { seenMs = ms; fn(); return 1 }, clearTimeout: () => {} }
  const abortError = () => Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' })
  globalThis.fetch = (_path, options) => options.signal.aborted
    ? Promise.reject(abortError())
    : new Promise((_resolve, reject) => { options.signal.addEventListener('abort', () => reject(abortError())) })
  await assert.rejects(
    () => submitAuth('signin', 'admin_01', 'longenough'),
    (error) => error instanceof AuthRequestError && error.code === 'TIMEOUT' && error.status === 0,
  )
  assert.equal(seenMs, 18000)
})

test('a 200 carrying HTML instead of JSON is rejected, not treated as a login', async () => {
  globalThis.fetch = async () => new Response('<html>proxy response</html>', { status: 200 })
  await assert.rejects(
    () => submitAuth('signin', 'admin_01', 'longenough'),
    (error) => error instanceof AuthRequestError && error.code === 'INVALID_RESPONSE',
  )
})

test('a 503 gets an actionable message', async () => {
  globalThis.fetch = async () => new Response('{}', { status: 503 })
  await assert.rejects(
    () => submitAuth('signin', 'admin_01', 'longenough'),
    (error) => error instanceof AuthRequestError && error.status === 503,
  )
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd "G:/高并发大作业项目/PeakRush/frontend"
npm test 2>&1 | tail -12
```

Expected: FAIL，`ENOENT … welcome/app/authApi.ts`。

- [ ] **Step 3: 写实现**

创建 `frontend/welcome/app/authApi.ts`：

```ts
/**
 * The portal's own auth transport. Deliberately NOT frontend/src/api.ts, for three
 * checkable reasons rather than any isolation rule: src/api.ts:20-21 attaches a stale
 * Authorization header to every call, and these two endpoints are unauthenticated;
 * src/api.ts:42 dispatches peakrush:expired, a main-app session event with no listener
 * in this document; and its status fallbacks are Chinese copy tuned to the main app.
 * Sharing a pure logic module across the two entries is fine — shared/safe-redirect.ts
 * does exactly that. Spec §4.1's isolation is document/CSS level, not JS level.
 *
 * Error text: the backend already answers in Chinese (ApiException.bad("用户名须为
 * 3–40位字母数字下划线…"), "用户名或密码不正确", "用户名已存在"), so its message is
 * passed through verbatim rather than re-worded. Chinese copy on an otherwise English
 * page is expected in sub-project 1 and gets fixed wholesale by sub-project 2. Only
 * the locally-generated fallbacks are English.
 */
export interface AuthUser {
  id: number;
  username: string;
  role: string;
}

export interface AuthResult {
  token: string;
  user: AuthUser;
}

export class AuthRequestError extends Error {
  constructor(
    message: string,
    public status = 0,
    public code = 'NETWORK_ERROR',
  ) {
    super(message);
    this.name = 'AuthRequestError';
  }
}

const TIMEOUT_MS = 18000;

const STATUS_FALLBACK: Record<number, string> = {
  400: 'The form was rejected. Check the fields and try again.',
  401: 'Incorrect username or password.',
  403: 'You are not allowed to do that.',
  404: 'That endpoint does not exist.',
  409: 'That username is already taken.',
  429: 'Too many attempts. Wait a moment and try again.',
  503: 'The service is busy. Try again shortly.',
};

function isAbort(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  return error instanceof Error && error.name === 'AbortError';
}

export async function submitAuth(
  mode: 'signin' | 'signup',
  username: string,
  password: string,
): Promise<AuthResult> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(mode === 'signin' ? '/api/auth/login' : '/api/auth/register', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), password }),
      signal: controller.signal,
    });
    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        if (response.ok) {
          throw new AuthRequestError(
            'The server sent something unreadable. Try again.',
            response.status,
            'INVALID_RESPONSE',
          );
        }
      }
    }
    if (!response.ok) {
      const body = data as { message?: string; code?: string } | null;
      throw new AuthRequestError(
        body?.message || STATUS_FALLBACK[response.status] || 'That did not work. Try again.',
        response.status,
        body?.code || String(response.status),
      );
    }
    return data as AuthResult;
  } catch (error) {
    if (error instanceof AuthRequestError) throw error;
    const timedOut = isAbort(error);
    throw new AuthRequestError(
      timedOut
        ? 'The request timed out. It is safe to try again.'
        : 'Cannot reach the service. Check the connection and try again.',
      0,
      timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
    );
  } finally {
    window.clearTimeout(timer);
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd "G:/高并发大作业项目/PeakRush/frontend"
npm test 2>&1 | tail -15
```

Expected: PASS，10 个新测试全绿。
若 `a timeout aborts at 18s…` 失败在 `seenMs` 上，检查实现用的是 `window.setTimeout`
而非裸 `setTimeout` —— 测试 stub 的是 `window.setTimeout`，与 `api.test.mjs:16`
的既有范式一致。

- [ ] **Step 5: 提交**

```bash
cd "G:/高并发大作业项目/PeakRush"
git add frontend/welcome/app/authApi.ts frontend/tests/auth-api.test.mjs
git commit -m "feat: 门户侧独立的 auth 传输层"
```

---

## Task 13: AuthPanel 接后端并删除功能性死元素

spec §7.1–§7.4、§8.1。本计划最大的一处代码改动。

**Files:**
- Modify: `frontend/welcome/content/subpages/auth.ts:52-55,74-77`
- Modify: `frontend/welcome/components/AuthPanel.vue`
- Modify: `frontend/welcome/pages/SignInPage.vue`
- Modify: `frontend/welcome/pages/SignUpPage.vue`

- [ ] **Step 1: 改字段类型与标签**

`frontend/welcome/content/subpages/auth.ts`，把 `SIGNIN_FIELDS`（原 `:51-55`）改为：

```ts
/** Field rows of /signin. `type` and `label` depart from the measured reference on
 *  purpose: Auth.java:30 requires `[A-Za-z0-9_]{3,40}`, which admits no '@' or '.',
 *  so an email input would block a legitimate username like admin_01 before submit,
 *  and an "Email" label would tell the user to type something the backend rejects. */
export const SIGNIN_FIELDS = [
  { name: 'username', type: 'text', label: 'Username', required: true, autocomplete: 'username' },
  { name: 'password', type: 'password', label: 'Password', required: true, autocomplete: 'current-password' },
] as const;
```

同文件把 `SIGNUP_STEP1.fields`（原 `:74-77`）改为：

```ts
  fields: [
    { name: 'username', type: 'text', label: 'Username', required: true, autocomplete: 'username' },
    { name: 'password', type: 'password', label: 'Password (8 characters min)', required: true, autocomplete: 'new-password' },
  ] as const,
```

`'Password (8 characters min)'` 保留原样 —— 它恰好与后端 `Auth.java:30` 的
`password.length()<8` 一致。

- [ ] **Step 2: 整份替换 AuthPanel.vue 的 `<script setup>` 块**

把 `frontend/welcome/components/AuthPanel.vue` 从 `<script setup lang="ts">` 到
`</script>`（原 `:1-131`）整体替换为：

```vue
<script setup lang="ts">
/**
 * AuthPanel.vue — the /signin and /signup panel, now wired to the real backend.
 *
 * Geometry is untouched from the measured reference (evidence/reference/
 * {signin,signup}-measured.md); what changed is behaviour. The reference clone was a
 * zero-network demo: its form was @submit.prevent with a no-op handler and its OAuth
 * buttons were type="button" going nowhere. Both are gone, along with the
 * "forgot password" and "remember me for 24 hours" controls — PeakRush has no recovery
 * endpoint (Api.java:9-10 exposes only login and register) and no 24-hour session
 * (Auth.java:41 issues an 8-hour JWT, and session.ts stores it with no expiry logic).
 *
 * Deliberate departures from the measurement, all marked CLONE-LOCAL in the CSS:
 *  - a third field on /signup (confirm password). The reference's signup is a two-step
 *    flow whose step 1 has only email + password; PeakRush registers in one POST
 *    (Auth.java:31), so the confirmation lives here. This is why /signup is ~66px
 *    taller than the frozen frame.
 *  - a reveal toggle on every password field. The reference has one only on /signup;
 *    a login form is where mistyping is most costly, so all three get it.
 *  - the left panel wordmark is text, not the reference's traced SVG glyph set.
 */
import { computed, onMounted, reactive, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { safeRedirect } from '@shared/safe-redirect';
import { submitAuth, AuthRequestError } from '@/app/authApi';
import { validateCredentials, type FieldErrors, type FieldName } from '@/app/auth-validation';
import {
  AUTH_SPLIT,
  FORM_TABS,
  SIGNIN_COPY,
  SIGNIN_FIELDS,
  SIGNUP_STEP1,
} from '@/content/subpages/auth';

interface AuthField {
  name: FieldName;
  type: string;
  label: string;
  required: boolean;
  autocomplete: string;
  reveal: boolean;
}

const props = defineProps<{ mode: 'signin' | 'signup' }>();

const isSignIn = computed(() => props.mode === 'signin');
const tagline = computed(() =>
  isSignIn.value ? AUTH_SPLIT.lines.join('\n') : AUTH_SPLIT.signupLines.join(' '),
);

/**
 * Tab pair, in DOM order Join then Login. The pair is MIRRORED between the routes and
 * active/inactive are different ELEMENT TYPES: the active tab is a bare
 * `h2.text-card-h1` (28.91px, black), the inactive one an `a.btn--link…` (48.01px,
 * rgb(156,156,156)).
 */
const tabs = computed(() =>
  FORM_TABS.items.map((tab) => ({
    label: tab.label,
    to: tab.to,
    active: (tab.to === '/signin') === isSignIn.value,
  })),
);

const fields = computed<AuthField[]>(() => {
  const base: AuthField[] = (isSignIn.value ? SIGNIN_FIELDS : SIGNUP_STEP1.fields).map((f) => ({
    name: f.name as FieldName,
    type: f.type,
    label: f.label,
    required: f.required,
    autocomplete: f.autocomplete,
    reveal: f.type === 'password',
  }));
  if (!isSignIn.value) {
    base.push({
      name: 'confirm',
      type: 'password',
      label: 'Confirm password',
      required: true,
      autocomplete: 'new-password',
      reveal: true,
    });
  }
  return base;
});

const agreements = computed(() => (isSignIn.value ? [] : SIGNUP_STEP1.agreements));
const orEmail = computed(() => (isSignIn.value ? SIGNIN_COPY.orEmail : SIGNUP_STEP1.orEmail));
const submitLabel = computed(() => (isSignIn.value ? SIGNIN_COPY.submit : SIGNUP_STEP1.submit));

/**
 * Measured, full list — `btn--primary` is what brings `--btn-background:#000`, and all
 * button paint in this system lives on `.btn:after{inset:0}`, so a bare `.btn` would
 * render transparent. `btn--smallish` is what makes it 28.66 tall.
 */
const submitClass = [
  'btn',
  'btn--space-between',
  'btn--primary',
  'btn--accent',
  'btn--full',
  'btn--block',
  'btn--smallish',
];

const form = reactive<Record<FieldName, string>>({ username: '', password: '', confirm: '' });
const errors = reactive<FieldErrors>({});
const revealed = reactive<Partial<Record<FieldName, boolean>>>({ password: false, confirm: false });
const formError = ref('');
const guidance = ref('');
const busy = ref(false);

function inputType(field: AuthField): string {
  return field.reveal && revealed[field.name] ? 'text' : field.type;
}

function busyLabel(): string {
  return isSignIn.value ? 'Logging in…' : 'Signing up…';
}

function redirectTarget(): string {
  return safeRedirect(new URLSearchParams(window.location.search).get('redirect'));
}

/**
 * session.ts sets peakrush.authMessage before it navigates here. sessionStorage
 * survives the jump because window.location.href to a same-origin URL is a same-tab
 * navigation — that is what keeps "登录后即可参与本场抢购。" alive across the two MPA
 * entries. Read-once, so a later refresh falls back to the plain form.
 */
onMounted(() => {
  const stored = sessionStorage.getItem('peakrush.authMessage');
  if (stored) {
    guidance.value = stored;
    sessionStorage.removeItem('peakrush.authMessage');
  }
  if (localStorage.getItem('peakrush.token')) window.location.href = redirectTarget();
});

async function onSubmit(): Promise<void> {
  if (busy.value) return;
  formError.value = '';
  for (const key of Object.keys(errors) as FieldName[]) delete errors[key];

  const found = validateCredentials(
    { username: form.username, password: form.password, confirm: form.confirm },
    props.mode,
  );
  Object.assign(errors, found);
  if (Object.keys(found).length > 0) return;

  busy.value = true;
  try {
    const result = await submitAuth(props.mode, form.username, form.password);
    localStorage.setItem('peakrush.token', result.token);
    localStorage.setItem('peakrush.user', JSON.stringify(result.user));
    window.location.href = redirectTarget();
    // busy stays true on purpose: a full-page navigation follows, and resetting it
    // would flash the button back to its clickable state on the way out.
  } catch (error) {
    formError.value =
      error instanceof AuthRequestError ? error.message : 'That did not work. Please try again.';
    busy.value = false;
  }
}
</script>
```

- [ ] **Step 3: 整份替换 AuthPanel.vue 的 `<template>` 块**

把原 `:133-401` 的整个 `<template>` 替换为：

```vue
<template>
  <section class="auth-page layout-split-page" :data-section-id="props.mode">
    <div class="layout-split row layout-split--mobile-background">
      <!-- --------------------------------------------------- sticky decoration side -->
      <div class="layout-split__bg col col--6:md ui-background auth-panel-bg">
        <!-- CLONE-LOCAL: text wordmark. The reference renders a traced SVG glyph set
             from displayHeadings.json; DisplayHeading.vue:82-84 already treats text as
             its own fallback path, so this is that path taken deliberately. -->
        <h1 class="auth-wordmark">PEAKRUSH</h1>
        <p class="layout-split__tagline text-card-h1 text-box-trim">{{ tagline }}</p>
      </div>

      <!-- -------------------------------------------------------------- the form -->
      <div class="layout-split__overlay-container col col--6:md ui-light ui-light-background">
        <div class="layout-split__content">
          <div class="section">
            <div class="section__layer">
              <div class="row row--gx px-1">
                <div
                  class="col col--12 mx-auto:md layout-split__side layout-split-stretch pt-header:md"
                >
                  <div class="pb-2 pt-0.75 py-4.5:md layout-split-stretch auth-column">
                    <!-- tabs: y=134, two 213.07px slots, underline at y=182 -->
                    <div class="auth-tabs">
                      <div
                        v-for="tab in tabs"
                        :key="tab.to"
                        class="auth-tabs__item"
                        :class="{ 'is-active': tab.active }"
                      >
                        <h2
                          v-if="tab.active"
                          class="text-card-h1 text-box-trim text-nowrap auth-tabs__active"
                        >
                          {{ tab.label }}
                        </h2>
                        <RouterLink
                          v-else
                          class="btn btn--link btn--link--small btn--full btn--text-card-h1 auth-tabs__inactive"
                          :class="tab.to === '/signin' ? 'btn--text-right' : 'btn--text-left'"
                          :to="tab.to"
                        >
                          <span class="btn__content">
                            <span class="btn__text">
                              <span class="btn__text-text">{{ tab.label }}</span>
                            </span>
                          </span>
                        </RouterLink>
                      </div>
                    </div>

                    <p class="auth-or">{{ orEmail }}</p>

                    <form class="auth-form" novalidate @submit.prevent="onSubmit">
                      <template v-for="field in fields" :key="field.name">
                        <div
                          class="input-text is-with-label input--base"
                          :class="{ 'is-empty': form[field.name] === '' }"
                        >
                          <label
                            :for="'auth-' + mode + '-' + field.name"
                            class="form-label form-label--floating input-text__label"
                          >
                            {{ field.label }}
                            <span v-if="field.required" class="text-color-error">*</span>
                          </label>
                          <div class="input-text__group">
                            <input
                              :id="'auth-' + mode + '-' + field.name"
                              class="input-text__group-input"
                              :class="{
                                'input-text__group-input--password':
                                  field.type === 'password' && !revealed[field.name],
                              }"
                              :type="inputType(field)"
                              :name="field.name"
                              :autocomplete="field.autocomplete"
                              spellcheck="false"
                              autocapitalize="off"
                              v-model="form[field.name]"
                            />
                            <!-- CLONE-LOCAL: the reference has a reveal toggle on
                                 /signup's password only, measured [1208,418,17.2,17.2].
                                 Every password field gets one here — a login form is
                                 where a mistyped password costs the user most. -->
                            <button
                              v-if="field.reveal"
                              class="btn btn--start btn--link btn--link--heading auth-reveal"
                              type="button"
                              :aria-pressed="revealed[field.name] ? 'true' : 'false'"
                              :aria-label="revealed[field.name] ? 'Hide password' : 'Show password'"
                              @click="revealed[field.name] = !revealed[field.name]"
                            >
                              <span class="btn__content">
                                <svg class="btn__icon" viewBox="0 0 18 18" aria-hidden="true">
                                  <circle
                                    cx="9"
                                    cy="9"
                                    r="8.1"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="1.6"
                                  />
                                  <path
                                    d="M3.5 9c1.6-2.3 3.4-3.4 5.5-3.4S12.9 6.7 14.5 9c-1.6 2.3-3.4 3.4-5.5 3.4S5.1 11.3 3.5 9Z"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="1.3"
                                  />
                                  <circle cx="9" cy="9" r="1.9" fill="currentColor" />
                                </svg>
                              </span>
                            </button>
                          </div>
                        </div>
                        <!-- Measured empty: height 10.7067px, padding-top 9.55494px. The
                             reference renders it empty purely to reserve the gap; here
                             it carries the field's own validation message. A real <ul>,
                             because that is what the reference uses, and a SIBLING of the
                             field block: the block is 55.2px tall and its
                             .input-text__group is 56.75px, so the list cannot live inside
                             a box the group already overflows. -->
                        <ul class="error-list transition-height">
                          <li v-if="errors[field.name]">{{ errors[field.name] }}</li>
                        </ul>
                      </template>

                      <!-- /signup: consent (with its two inline links) + newsletter. The
                           newsletter box has no backend and is a known defect (spec §8.2,
                           §11); it stays because removing it would change the measured
                           geometry, and sub-project 2 drops it with the rest of the copy.
                           The two policy links are NOT dead: /terms-and-conditions and
                           /privacy-policy are real routes on this portal. -->
                      <label
                        v-for="(row, index) in agreements"
                        :key="row.name"
                        class="form-label form-label--with-input input-checkbox input--checkbox auth-consent"
                        :class="index === 0 ? 'auth-consent--terms' : 'auth-consent--news'"
                        :for="'auth-signup-' + row.name"
                      >
                        <input
                          :id="'auth-signup-' + row.name"
                          class="input-checkbox__input sr-only"
                          type="checkbox"
                          :name="row.name"
                        />
                        <span class="input-checkbox__box" aria-hidden="true" />
                        <span class="input-checkbox__text">
                          {{ row.label }}
                          <RouterLink
                            v-if="row.linkA"
                            class="btn btn--link btn--link--underline auth-consent__link"
                            :to="row.hrefA"
                            ><span class="btn__content"
                              ><span class="btn__text">{{ row.linkA }}</span></span
                            ></RouterLink
                          >
                          {{ row.linkB ? 'and' : '' }}
                          <RouterLink
                            v-if="row.linkB"
                            class="btn btn--link btn--link--underline auth-consent__link"
                            :to="row.hrefB"
                            ><span class="btn__content"
                              ><span class="btn__text">{{ row.linkB }}</span></span
                            ></RouterLink
                          >
                        </span>
                      </label>

                      <!-- CLONE-LOCAL: form-level rejection (401 / 409 / network), in the
                           gutter the reference leaves blank above the submit. role=alert
                           so a screen reader announces it without a focus move. -->
                      <p v-if="formError" class="auth-form-error" role="alert">{{ formError }}</p>

                      <div class="row row--gx auth-submit">
                        <div class="col col--6">
                          <button :class="submitClass" type="submit" :disabled="busy">
                            <span class="btn__content">
                              <span class="btn__text">
                                <span class="btn__text-text">{{
                                  busy ? busyLabel() : submitLabel
                                }}</span>
                              </span>
                              <svg
                                class="btn__icon auth-submit__icon"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                              >
                                <circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" />
                                <path d="M8 12h8M13 8l4 4-4 4" fill="none" stroke="currentColor" />
                              </svg>
                            </span>
                          </button>
                        </div>
                        <div class="col col--6" />
                      </div>

                      <!-- CLONE-LOCAL: the guidance line session.ts handed over. Chinese
                           copy on an English page is expected in sub-project 1 (spec
                           decision 5) and gets fixed wholesale by sub-project 2. -->
                      <p v-if="guidance" class="auth-demo-notice" role="note">{{ guidance }}</p>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="layout-split__footer" />
      </div>
    </div>
  </section>
</template>
```

与参考模板相比**删除**的（spec §8.1）：OAuth 按钮块、`data-page-header-theme` 属性、
artist/curator radio 对、remember-me 勾选、forgot-password 链接、两条
`auth-demo-notice`（含 `data-evidence="pending-T00-subpage"` 那条）。
`panelTheme` / `headerTheme` 两个 computed 随 `ui-green` / `ui-orange` 类一起删除，
左侧面板改用下面的 `.auth-panel-bg`。

- [ ] **Step 4: 改 AuthPanel 的 `<style>` 块**

**删除**这两条已无消费者的规则：

- `.layout-split__bg .intro__title { … }`（原 `:462-466`）—— `.intro__title` 是首页 hero
  的类名，AuthPanel 从来没渲染过它（它传的是 `visual-class="layout-split__word"`），
  在复刻站里本就是惰性规则
- `.layout-split__bg .title path { … }`（原 `:470-472`）—— 词标改文本渲染后无 `<path>`

**保留**这两条 `body:has()` 规则（原 `:455-458`、`:802-804`）—— 登录页现在活在自己的
App 外壳里，外壳确实渲染 `SiteHeader`（`.promo-header`）与 `FixedSignUpButton`，
这两条仍然需要。

**保留** `.auth-demo-notice` 的样式（原 `:789-796`）—— guidance 行复用它。

在 `</style>` 之前**追加**：

```css
/* ==========================================================================
   CLONE-LOCAL — what this integration adds and the reference does not have. Kept in
   one block at the end so the departures from the measurement are obvious.
   ========================================================================== */

/* The left panel. Spec decision 12 defers the PeakRush-orange recolour to
   sub-project 2, so this keeps the reference's own signin green rather than
   inventing a colour now. */
.auth-panel-bg {
  background: var(--c-green);
}
/* The wordmark is text now, so the rule that painted the reference's SVG paths has
   nothing to match. Black is still the measured colour — sampled at (50,100) in the
   frozen V21 frame as rgb(0,0,0). */
.auth-wordmark {
  color: var(--c-black);
  font-family: HeadingNow, Helvetica, Arial, sans-serif;
  font-size: calc(var(--scale-text-rem) * 6.4);
  font-weight: 400;
  letter-spacing: -0.03em;
  line-height: 1;
  margin: 0;
}
/* Form-level rejection, in the system's own error colour (tokens.css:129). */
.auth-form-error {
  color: var(--c-error);
  font-family: HeadingNow, Helvetica, Arial, sans-serif;
  font-size: calc(var(--scale-text-rem) * 1.3);
  letter-spacing: -0.02em;
  line-height: calc(var(--scale-text-rem) * 2);
  margin-top: calc(var(--scale-px) * 20);
}
/* The reference never disables a .btn because it never really submits. */
.btn[disabled] {
  cursor: not-allowed;
  opacity: 0.55;
}
/* A populated .error-list keeps the measured 10.7067px reserve and grows from it. */
.error-list li {
  color: var(--c-error);
  font-family: HeadingNow, Helvetica, Arial, sans-serif;
  font-size: calc(var(--scale-text-rem) * 1.1);
  letter-spacing: -0.02em;
  line-height: calc(var(--scale-text-rem) * 1.6);
}
```

- [ ] **Step 5: 删掉两个页面的 demo notice**

`frontend/welcome/pages/SignInPage.vue` 整份替换为：

```vue
<script setup lang="ts">
/**
 * SignInPage — /signin, the real PeakRush login. Rendered from AuthPanel.vue, whose
 * geometry still cites evidence/reference/signin-measured.md.
 *
 * The "Local clone demo — nothing you type leaves this page" notice this file used to
 * carry is gone because it became false: the form now POSTs to /api/auth/login.
 */
import AuthPanel from '@/components/AuthPanel.vue';
</script>

<template>
  <AuthPanel mode="signin" />
</template>
```

`frontend/welcome/pages/SignUpPage.vue` 整份替换为：

```vue
<script setup lang="ts">
/**
 * SignUpPage — /signup, the real PeakRush registration. One step, because Auth.java:31
 * inserts the user and returns a token in the same POST; the reference's two-step flow
 * (its SIGNUP_STEP2 role/name/country/avatar step) has no backend here and is not
 * rendered.
 *
 * The "no account is created and nothing is stored" notice is gone because it became
 * false. The confirm-password field AuthPanel adds for this mode is why the page is
 * ~66px taller than the frozen frame.
 */
import AuthPanel from '@/components/AuthPanel.vue';
</script>

<template>
  <AuthPanel mode="signup" />
</template>
```

- [ ] **Step 6: 确认死元素确实清空**

```bash
cd "G:/高并发大作业项目/PeakRush/frontend/welcome"
echo "--- 下列各项应为 0 命中 ---"
for pat in OAUTH_PROVIDERS iconAttrs iconId keepLocal auth-signin-remember auth-forgot "Local clone demo" pending-T00-subpage 'type="radio"' DisplayHeading assetRegistry; do
  n=$(grep -rc "$pat" components/AuthPanel.vue pages/SignInPage.vue pages/SignUpPage.vue 2>/dev/null | awk -F: '{s+=$2} END{print s+0}')
  printf "  %-24s %s\n" "$pat" "$n"
done
echo "--- notice prop 应已从 AuthPanel 消失 ---"
grep -n "notice" components/AuthPanel.vue || echo "  OK: 无 notice"
```

Expected: 10 个 pattern 全部 `0`；最后打印 `OK: 无 notice`。

- [ ] **Step 7: typecheck**

```bash
cd "G:/高并发大作业项目/PeakRush/frontend"
npx vue-tsc --noEmit 2>&1 | tail -20; echo "exit=${PIPESTATUS[0]}"
```

Expected: `exit=0`。若报 `Cannot find module '@shared/safe-redirect'`，说明 Task 10 的
文件不在盘上或 Task 6 的 `paths` 没配对。

- [ ] **Step 8: 提交**

```bash
cd "G:/高并发大作业项目/PeakRush"
git add frontend/welcome/components/AuthPanel.vue frontend/welcome/pages/SignInPage.vue frontend/welcome/pages/SignUpPage.vue frontend/welcome/content/subpages/auth.ts
git commit -m "$(cat <<'EOF'
feat: /signin 与 /signup 接通 PeakRush 后端

AuthPanel 从 zero-network 演示改为真实表单：POST /api/auth/login|register，成功后写
peakrush.token / peakrush.user 并整页跳到 safeRedirect(redirect)。

字段按 Auth.java:30 的真实契约而非参考站的测量值：type 从 email 改 text（用户名正则
[A-Za-z0-9_]{3,40} 不含 @ 与 .，email 输入框会在提交前拦下 admin_01 这类合法用户名），
标签从 Email 改 Username（原标签在骗用户）。

删除 7 项功能性死元素：OAuth 按钮、忘记密码（后端无恢复接口）、Remember me for
24 hours（session.ts 无过期逻辑，JWT 实际 8 小时）、artist/curator radio（注册一律
role='USER'）、两条 demo notice（接通后端后"nothing you type leaves this page"是假的）、
pending 取证标记行。

有意偏离测量并标 CLONE-LOCAL：注册页加确认密码字段（后端一步建号，参考站是两步流程）、
三处密码框都加 reveal（参考站只有 signup 有）、左侧词标改文本渲染。
EOF
)"
```

---

## Task 14: 删除 AuthDialog（必须在 session 改造之前）

顺序不是偏好而是硬依赖：`AuthDialog.vue:11,50` 读 `session.authOpen`、`:57` 读
`session.authMessage`，而 Task 15 要把这两个字段从 `session` 的类型上删掉。
先改 session 会让 `vue-tsc --noEmit` 直接变红，Task 15 的 typecheck 步骤过不去。

**Files:**
- Delete: `frontend/src/components/AuthDialog.vue`
- Modify: `frontend/src/App.vue:6,69`

- [ ] **Step 1: 删掉 App.vue 的两处引用**

删除 `frontend/src/App.vue:6`：

```ts
import AuthDialog from "./components/AuthDialog.vue";
```

删除 `frontend/src/App.vue:69`：

```vue
  <AuthDialog />
```

- [ ] **Step 2: 删文件**

```bash
cd "G:/高并发大作业项目/PeakRush/frontend"
git rm src/components/AuthDialog.vue
```

- [ ] **Step 3: 确认无残留引用**

```bash
cd "G:/高并发大作业项目/PeakRush/frontend"
grep -rn "AuthDialog" src/ && echo "FAIL: 仍有引用" || echo "OK: 无 AuthDialog 引用"
echo "--- AuthDialog 独占，可登记为待清理 ---"
grep -nE "\.(auth-dialog|auth-tabs)" src/style.css
echo "--- 仍被主应用其他页面使用，绝对不能删 ---"
for c in dialog-lead field-label form-error; do
  printf "%-12s style.css:%s  使用者:%s\n" "$c" \
    "$(grep -nE "\.$c" src/style.css | cut -d: -f1 | tr '\n' ',')" \
    "$(grep -rln "$c" src/ | grep -v style.css | grep -v AuthDialog | tr '\n' ' ')"
done
```

Expected: 第一条 `OK: …`。**这条 grep 只在本任务内有效**：Task 15 写进 `session.ts` 的
注释里会出现 "AuthDialog.vue and the `authOpen` flag it drove are gone"，届时裸词
`AuthDialog` 会命中一行注释。后续复验要限定为真引用：
`grep -rnE "import .*AuthDialog|<AuthDialog" src/`。

后两段把 `style.css` 的相关规则按**能否删**分成两类，实测结果（写计划时已核）：

- **AuthDialog 独占，5 条**：`.auth-dialog .fine-print`（`:632`）、`.auth-tabs`（`:582`）、
  `.auth-tabs button`（`:587`）、`.auth-tabs .selected`（`:596`）、
  `.auth-tabs .selected:after`（`:600`）
- **仍被其他页面使用，4 条，不能删**：`.dialog-lead`（`:552`，AdminPage 也在用）、
  `.field-label`（`:609` 与媒体查询里的 `:1772`，AdminPage 也在用）、
  `.form-error`（`:623`，PurchaseDialog / AdminPage / OrdersPage 都在用）

两类**本轮都不改**。独占那 5 条留着是因为它们是无层全局 CSS，删除要重新验证全站层叠，
收益不抵风险；共享那 4 条更是删不得——它们根本不是残留。把两段的输出分别抄进 Task 19
报告的待清理清单，两条要分开写，不能并成一句"只被 AuthDialog 用过的规则"。

- [ ] **Step 4: typecheck + 单测**

```bash
cd "G:/高并发大作业项目/PeakRush/frontend"
npx vue-tsc --noEmit 2>&1 | tail -10; echo "typecheck exit=${PIPESTATUS[0]}"
npm test 2>&1 | tail -8
```

Expected: `typecheck exit=0`，测试 PASS。

- [ ] **Step 5: 提交**

```bash
cd "G:/高并发大作业项目/PeakRush"
git add frontend/src/App.vue
git commit -m "$(cat <<'EOF'
refactor: 删除 AuthDialog 弹窗

登录/注册已由门户的 /signin、/signup 路由页承担，弹窗与之重复。这是本轮唯一删除的
主应用文件。

style.css 的 9 条相关规则本轮一条都不改，按可删性分两类：.auth-tabs 的 4 条（:582/587/
596/600）与 .auth-dialog .fine-print（:632）是 AuthDialog 独占的残留，留着是因为删除
无层全局 CSS 需重新验证全站层叠，收益不抵风险；.dialog-lead（:552）、.field-label
（:609 与 :1772）、.form-error（:623）则仍被 AdminPage、PurchaseDialog、OrdersPage 使用，
根本不是残留，删了会破页。两类都记入验收报告的待清理清单，口径按上面这一版。
EOF
)"
```

---

## Task 15: 主应用迁到 /app/ 与 session 跨文档交接

**前置：Task 14 必须已完成** —— 本任务把 `authOpen`/`authMessage` 从 `session` 的类型上
删掉，只要 `AuthDialog.vue` 还在读它们，Step 5 的 `vue-tsc --noEmit` 就过不去。

**Files:**
- Modify: `frontend/src/main.ts:9`
- Modify: `frontend/src/session.ts`

- [ ] **Step 1: router base**

`frontend/src/main.ts` 里 `createRouter({ history: createWebHistory(), … })` 改为：

```ts
const router = createRouter({
  history: createWebHistory("/app/"),
```

**15 处路由跳转全部零改动** —— 实测都走 `RouterLink to="/…"` 或 `router.push("/…")`，
vue-router 的 history base 会自动加前缀：`App.vue:11,12,19,25,30,33`、
`PurchaseDialog.vue:280`、`AdminPage.vue:562,724`、`OrdersPage.vue:171`、
`Storefront.vue:273,285`。

不受 base 影响的：`api.ts` 的 `fetch('/api/…')` 是绝对 URL；`format.ts:36-37` 的
`productImage()` 返回 `/assets/product-earbuds.png` 是 publicDir 裸 URL。两者都不用改。

- [ ] **Step 2: 整份替换 session.ts**

```ts
import { reactive } from "vue";
import { api } from "./api";
import type { User } from "./types";

let saved: User | null = null;
try {
  saved = JSON.parse(localStorage.getItem("peakrush.user") || "null");
} catch {
  localStorage.removeItem("peakrush.user");
}

export const session = reactive<{ user: User | null }>({ user: saved });

export function setSession(token: string, user: User) {
  localStorage.setItem("peakrush.token", token);
  localStorage.setItem("peakrush.user", JSON.stringify(user));
  session.user = user;
}

export function logout() {
  localStorage.removeItem("peakrush.token");
  localStorage.removeItem("peakrush.user");
  session.user = null;
}

/**
 * Login now lives in the other MPA entry (the portal at /), so this is a real document
 * navigation rather than opening a dialog. Same origin, same tab — which is why
 * sessionStorage survives and the caller's guidance line still reaches the portal.
 * AuthDialog.vue and the `authOpen` flag it drove are gone.
 */
export function requireLogin(message = "登录后，开启你的好物时刻。") {
  sessionStorage.setItem("peakrush.authMessage", message);
  const back = window.location.pathname + window.location.search;
  window.location.href = "/signin?redirect=" + encodeURIComponent(back);
}

export async function restoreSession() {
  if (!localStorage.getItem("peakrush.token")) {
    logout();
    return;
  }
  try {
    const user = await api<User>("/api/auth/me");
    session.user = user;
    localStorage.setItem("peakrush.user", JSON.stringify(user));
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 401
    )
      logout();
  }
}

window.addEventListener("peakrush:expired", () => {
  logout();
  requireLogin("登录已过期，请重新登录后继续。");
});
```

与原文件相比：删掉 `authOpen`、`authMessage` 两个 reactive 字段与 `setSession` 里对它们
的赋值；`requireLogin` 改为跨文档跳转 + sessionStorage 承载提示语；
`peakrush:expired` 监听器**不改**（它调 `requireLogin`，提示语经 sessionStorage 送达，
所以 spec §7.3 设计的 `reason=expired` query 参数不再需要）。

`back` 用 `window.location.pathname`，它已含 `/app` 前缀，所以 redirect 天然是
`/app/orders` 这种形态，正好是 `safeRedirect` 接受的。

- [ ] **Step 3: 确认没有别处还在读被删掉的字段**

```bash
cd "G:/高并发大作业项目/PeakRush/frontend"
grep -rnE "session\.auth(Open|Message)" src/ tests/ && echo "FAIL: 仍在读被删掉的字段" || echo "OK: src/ 与 tests/ 内已无属性读取"
```

Expected: `OK: …`。若命中，说明还有代码把这两个字段当 `session` 的属性读，必须一并改掉。

**模式必须锚成属性访问 `session.authOpen|session.authMessage`，不能 grep 裸词。** 实测两处
会误报：`session.ts` 自己的注释里写着 "AuthDialog.vue and the `authOpen` flag it drove
are gone"，以及 `sessionStorage.setItem("peakrush.authMessage", …)` 这个键名——两者都是
正确改动的一部分，裸词 grep 会把它们报成残留引用。

- [ ] **Step 4: 跑既有单测，确认 expired 事件契约没被破坏**

```bash
cd "G:/高并发大作业项目/PeakRush/frontend"
npm test 2>&1 | tail -12
```

Expected: PASS。特别是 `api.test.mjs:47-51` 那条
`expired protected-session response opens reauthentication` —— 它断言的是 `api.ts`
派发 `peakrush:expired` 事件，与 `session.ts` 怎么响应无关，应当照旧绿。
**若它变红，说明误改了 `api.ts`，回退。**

- [ ] **Step 5: typecheck**

```bash
cd "G:/高并发大作业项目/PeakRush/frontend"
npx vue-tsc --noEmit 2>&1 | tail -20; echo "exit=${PIPESTATUS[0]}"
```

Expected: `exit=0`。`session.ts` 删了两个字段，任何仍在读它们的地方会在这里暴露。

- [ ] **Step 6: 提交**

```bash
cd "G:/高并发大作业项目/PeakRush"
git add frontend/src/main.ts frontend/src/session.ts
git commit -m "$(cat <<'EOF'
feat: 主应用迁到 /app/，requireLogin 改为跨文档跳转

main.ts 的 createWebHistory 加 base "/app/"。实测 15 处路由跳转全走
RouterLink/router.push，vue-router 自动加前缀，故调用点零改动；api.ts 的 /api/… 与
format.ts 的 /assets/… 是绝对 URL，同样不受影响。

session.ts 删掉 authOpen/authMessage 两个 reactive 字段，requireLogin 改为写
sessionStorage 后 window.location.href 跳门户的 /signin。同源同标签页导航，所以
sessionStorage 存活、三句上下文提示语不丢 —— 这修正了设计文档 §7.5
"提示语必然丢失"的判断，也让 reason=expired query 参数变得多余。

peakrush:expired 监听器不改，它调 requireLogin 即可。
EOF
)"
```

---

## Task 16: 采集合并后渲染并逐检查点比对

spec §10.2。基线来自 Task 1。**`/signin` 与 `/signup` 是预期会变的**，其余 10 条路由应当像素一致。

**Files:**
- Create: `logn in/scripts/compare-local-dirs.mjs`
- Output（磁盘）: `logn in/evidence/local/`、`logn in/evidence/diffs-merge/`

- [ ] **Step 1: 写比对脚本**

创建 `logn in/scripts/compare-local-dirs.mjs`。放在 `logn in/` 是因为
`pixelmatch`/`pngjs` 只装在它的 `node_modules` 里（spec §5.7 明确不给 frontend 加这两个依赖）。
阈值与 `compare-reference.mjs:61,65` 一致（`threshold: 0.1`、`ratio <= 0.05` 为过），
这样两份报告可比：

```js
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

/**
 * compare-local-dirs — diffs two LOCAL captures of this same clone, checkpoint by
 * checkpoint. compare-reference.mjs cannot do this: it hard-codes
 * evidence/reference/captured as one side. Used by the portal-merge plan to prove that
 * moving the tree into frontend/welcome/ and rebuilding it under Vite 7 did not change
 * a pixel on the ten routes we did not touch.
 *
 * Usage: node scripts/compare-local-dirs.mjs <baselineDir> <currentDir> <outDir>
 * Thresholds match compare-reference.mjs so the two reports stay comparable.
 */
const [BASE, CUR, OUT] = process.argv.slice(2);
if (!BASE || !CUR || !OUT) {
  console.error('usage: node scripts/compare-local-dirs.mjs <baselineDir> <currentDir> <outDir>');
  process.exit(2);
}
for (const dir of [BASE, CUR]) {
  if (!existsSync(`${dir}/capture-report.json`)) {
    console.error(`MISSING capture-report.json in ${dir}`);
    process.exit(2);
  }
}
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const load = (dir) => JSON.parse(readFileSync(`${dir}/capture-report.json`, 'utf8')).records ?? [];
const base = load(BASE);
const cur = load(CUR);

/** The two routes Task 13 changed on purpose. Everything else must be pixel-identical. */
const EXPECTED_CHANGED = new Set(['/signin', '/signup']);

const rows = [];
for (const b of base) {
  const c = cur.find((r) => r.id === b.id && r.viewport === b.viewport);
  if (!c) {
    rows.push({ id: b.id, route: b.route, status: 'MISSING_CURRENT', pass: false });
    continue;
  }
  const a = PNG.sync.read(readFileSync(b.file));
  const d = PNG.sync.read(readFileSync(c.file));
  if (a.width !== d.width || a.height !== d.height) {
    rows.push({
      id: b.id, route: b.route, status: 'SIZE_MISMATCH', pass: false,
      baseline: [a.width, a.height], current: [d.width, d.height],
    });
    continue;
  }
  const diff = new PNG({ width: a.width, height: a.height });
  const changed = pixelmatch(a.data, d.data, diff.data, a.width, a.height, { threshold: 0.1 });
  const diffImage = `${OUT}/${b.id}-diff.png`;
  writeFileSync(diffImage, PNG.sync.write(diff));
  const ratio = changed / (a.width * a.height);
  const expected = EXPECTED_CHANGED.has(b.route);
  rows.push({
    id: b.id, route: b.route, viewport: b.viewport,
    diffPixels: changed, diffRatio: +ratio.toFixed(5),
    expectedToChange: expected,
    identical: changed === 0,
    pass: expected ? true : ratio <= 0.05,
    diffImage,
    baseScroll: b.actualScrollPx ?? b.requestedScrollPx,
    curScroll: c.actualScrollPx ?? c.requestedScrollPx,
  });
}

writeFileSync(`${OUT}/compare-report.json`, JSON.stringify({
  generatedAt: new Date().toISOString(), baseline: BASE, current: CUR, rows,
}, null, 2));

const unexpected = rows.filter((r) => r.pass !== true);
console.log(JSON.stringify({
  compared: rows.length,
  byteIdentical: rows.filter((r) => r.identical).length,
  expectedChanged: rows.filter((r) => r.expectedToChange)
    .map((r) => ({ id: r.id, route: r.route, diffRatio: r.diffRatio })),
  UNEXPECTED: unexpected.map((r) => ({
    id: r.id, route: r.route, why: r.status ?? r.diffRatio,
    baseScroll: r.baseScroll, curScroll: r.curScroll,
  })),
}, null, 2));
process.exit(unexpected.length === 0 && rows.length === base.length && base.length > 0 ? 0 : 1);
```

- [ ] **Step 2: 启动合并后的 dev server**

```bash
cd "G:/高并发大作业项目/PeakRush/frontend"
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5179 --strictPort > /tmp/merged-dev.log 2>&1 &
echo $! > /tmp/merged-dev.pid
for i in $(seq 1 90); do curl -sf -o /dev/null http://127.0.0.1:5179/ && { echo "ready after ${i}s"; break; }; sleep 1; done
curl -s -o /dev/null -w "clone /     -> HTTP %{http_code}\n" http://127.0.0.1:5179/
curl -s -o /dev/null -w "app  /app/  -> HTTP %{http_code}\n" http://127.0.0.1:5179/app/
```

Expected: `ready after Ns`，两条都 `HTTP 200`。
若 `/app/` 不是 200，说明 Task 8 的 fallback 插件没生效，停下来查。

- [ ] **Step 3: 用克隆站自己的采集脚本指向合并后的服务器**

```bash
cd "G:/高并发大作业项目/PeakRush/logn in"
LOCAL_BASE_URL=http://127.0.0.1:5179 VIEWPORTS=inapp node scripts/capture-local.mjs 2>&1 | tail -20
node -e "
const r=require('./evidence/local/capture-report.json').records;
console.log('records:',r.length,'| viewports:',[...new Set(r.map(x=>x.viewport))].join(','));
"
```

Expected: `records: 30 | viewports: 1376x772@1.5` —— 与基线**完全一致**，否则比对无意义。
`capture-local.mjs` 只校验 loopback 源，5179 合法。

**Step 3b: 先证明两侧用的是同一个光栅化器，否则后面的像素差没有意义**

Task 1 实测本机基线是**软件渲染**：`chromium.launch()` 解析到
`chrome-headless-shell.exe`（Playwright `chromium-headless_shell-1243`，Chrome 153.0.8010.12），
`WEBGL_debug_renderer_info` 的非掩码值是
`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`。
基线目录里的 `env-deep.json` 记了这些。而 Step 6 原设计的 `gl.getParameter(gl.RENDERER)`
只会返回 Chromium 的隐私掩码串 `"WebKit WebGL"`，**分辨不出硬件还是软件渲染**，
所以必须另外采非掩码值并和基线对齐：

```bash
cd "G:/高并发大作业项目/PeakRush/logn in"
node -e "
const {chromium}=require('@playwright/test');const fs=require('fs');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1376,height:772}});
  await p.goto(process.env.U||'http://127.0.0.1:5179/',{waitUntil:'networkidle'});
  await p.waitForTimeout(2000);
  const g=await p.evaluate(()=>{const c=document.createElement('canvas');
    const gl=c.getContext('webgl2')||c.getContext('webgl'); if(!gl) return {webgl:false};
    const dbg=gl.getExtension('WEBGL_debug_renderer_info');
    return {webgl:true, masked:gl.getParameter(gl.RENDERER),
      unmaskedRenderer:dbg?gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL):null,
      unmaskedVendor:dbg?gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL):null};});
  console.log(JSON.stringify({...g, executable:chromium.executablePath()},null,2));
  await b.close();
})();
" > evidence/local/env-deep.json && cat evidence/local/env-deep.json
node -e "
const a=require('./evidence/baseline-premerge/env-deep.json');
const b=require('./evidence/local/env-deep.json');
const same=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
const checks={
  unmaskedRenderer:same(a.unmaskedRenderer,b.unmaskedRenderer),
  browserSame:/headless_shell-1243/.test(b.executable||''),
};
console.log(JSON.stringify(checks));
process.exit(Object.values(checks).every(Boolean)?0:1);
" && echo "RASTERISER MATCHES BASELINE" || echo "STOP: 光栅化器与基线不一致，像素比对无效"
```

Expected: `RASTERISER MATCHES BASELINE`，且 `unmaskedRenderer` 仍是 SwiftShader 那条。

**这一条不通过就停下，不要开始 Step 4。** 换了 GPU、换了浏览器构建、加了
`--use-angle=d3d11` 之类开关，都会让两侧像素整体漂移或整体一致，两种结果都不能结论化。

**读结果的口径**（写进 Task 19 报告时不许含糊）：两侧同用一个软件光栅化器时，像素一致
只能证明**「同一份代码在同一个软件光栅化器下输出相同」**，即搬迁与构建没改变渲染；
它**不证明**真实 GPU 上渲染正确。SwiftShader 静默降级的 shader 会在两侧同时降级，
所以"两边一样黑/一样破"绝不能记为通过。WebGL 章节（Task 1 实测是 V01–V14，
其余 16 个检查点 `liveWebgl` 为 0）要判硬件正确性仍需人工用真 GPU 看一次。

- [ ] **Step 4: 逐检查点比对**

```bash
cd "G:/高并发大作业项目/PeakRush/logn in"
node scripts/compare-local-dirs.mjs evidence/baseline-premerge evidence/local evidence/diffs-merge 2>&1 | tee /tmp/render-diff.json
echo "exit=${PIPESTATUS[0]}"
```

Expected: `exit=0`，且 JSON 里
- `compared: 30`
- `byteIdentical`：至少 28（30 减去 `/signin`、`/signup` 两个检查点）
- `expectedChanged`：恰好 2 条，route 为 `/signin` 与 `/signup`
- `UNEXPECTED`：**空数组**

**若 `UNEXPECTED` 非空，这是真实的渲染退化，停下来定位。** 最可能的三个原因：
1. 某条路由的资产 404（`diffRatio` 接近 1 且集中在图片区域）→ 查 publicDir 合并
2. 字体没加载（文字区域整体偏移）→
   `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:5179/fonts/HeadingNow-73Book.woff2`
3. WebGL 静默失效（首页 14 个检查点大面积差异）→ Task 3 的 glob 修改没生效，
   查 dev server 日志有没有 `createMotionRuntime is not on disk yet`

- [ ] **Step 5: 正面证明 motion runtime 真的被构造了（Task 3 的生效证据）**

**这道闸原来设计错了，先说清楚为什么。** 初稿用 `document.querySelectorAll('[data-webgl="live"]').length > 0`
当作"Task 3 的 glob 修好了"的证据。实测 `data-webgl="live"` 有**三条互不相干的来源**：

- `welcome/app/App.vue:128` —— `host.setAttribute('data-webgl','live')`，只有 motion runtime
  真的构造并注册上才会走到
- `welcome/webgl/mountScenes.ts:165` —— 同样 `setAttribute(…, 'live')`，由
  `sceneRegistry.ts:117` 的 `void import('./mountScenes')` 独立驱动，**完全不经过 App.vue**
- `HomeCard.vue:60`、`HomeGetSeen.vue:95`、`HomeHero.vue:98` —— 组件自己用
  `:data-webgl="live ? 'live' : 'pending'"` 绑定

所以 `liveCanvases > 0` 在 Task 3 修没修的情况下**都可能为正**，它证明不了任何事。
（顺带：`App.vue:123` 那句注释"data-webgl is owned here (never bound by the section
components)"本身是不成立的，三个组件确实在绑它。）

改用直接证据：Vite dev 下 `await import('@/motion/createMotionRuntime')` 会真的发一个
HTTP 请求去取那个模块。请求到了，就说明这行动态 import 执行了。

```bash
cd "G:/高并发大作业项目/PeakRush/logn in"
node -e "
const {chromium}=require('@playwright/test');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1376,height:772}});
  const issues=[]; p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')issues.push(m.type()+': '+m.text())});
  p.on('requestfailed',r=>issues.push('requestfailed: '+r.url()));
  const requested=[]; p.on('request',r=>{ if(/createMotionRuntime/.test(r.url())) requested.push(r.url()); });
  await p.goto('http://127.0.0.1:5179/',{waitUntil:'networkidle'});
  await p.waitForTimeout(3000);
  const info=await p.evaluate(()=>({
    canvases:document.querySelectorAll('canvas').length,
    liveAttr:document.querySelectorAll('[data-webgl=\"live\"]').length,
    pendingAttr:document.querySelectorAll('[data-webgl=\"pending\"]').length,
    scrollArea:!!document.querySelector('.scrollable__area'),
    rootFontSize:getComputedStyle(document.documentElement).fontSize,
    bodyFont:getComputedStyle(document.body).fontFamily,
    emptyImgSrc:document.querySelectorAll('img[src=\"\"], img:not([src])').length,
  }));
  console.log(JSON.stringify({motionModuleRequested:requested.length, urls:requested.slice(0,3),
                              info, consoleIssues:issues.slice(0,12)},null,2));
  await b.close();
})();
" | tee /tmp/merged-env.json
```

Expected：
- **`motionModuleRequested >= 1`** —— 这是 Task 3 生效的正证。若为 0，说明 `App.vue` 那次
  动态 import 没执行（别名没接、或 `reducedMotion` 为真、或 `welcome/app/App.vue:139` 之前
  就 return 了），必须先查清楚再往下走
- `consoleIssues` 里**不含** `createMotionRuntime is not on disk yet`（旧文案，代码已删，
  出现即说明跑的是旧构建），也不含解析不出 `@/motion/createMotionRuntime` 的报错
- `canvases > 0`、`rootFontSize: "10px"`、`bodyFont` 以 `HeadingNow` 开头
- `emptyImgSrc` **记下来但不当失败**：`assetRegistry` 的 schema 不匹配是本轮明确不修的
  已知缺陷（spec §11），基线里同样是空的，两侧应当一致

**`liveAttr` 只作辅助记录，不作为 Task 3 的判据**，理由见上。

- [ ] **Step 6: 验主应用文档没被克隆站 CSS 污染（运行时证据，补 Task 9 Step 4 的构建期证据）**

```bash
cd "G:/高并发大作业项目/PeakRush/logn in"
node -e "
const {chromium}=require('@playwright/test');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1376,height:772}});
  await p.goto('http://127.0.0.1:5179/app/',{waitUntil:'networkidle'});
  await p.waitForTimeout(1500);
  const info=await p.evaluate(()=>{
    const cs=getComputedStyle(document.documentElement);
    const btn=document.querySelector('.el-button');
    return {rootFontSize:cs.fontSize, rootFontFamily:cs.fontFamily,
            elPrimary:cs.getPropertyValue('--el-color-primary').trim(),
            bodyOverflow:getComputedStyle(document.body).overflow,
            hasSiteHeader:!!document.querySelector('.site-header'),
            hasScrollableArea:!!document.querySelector('.scrollable__area'),
            elButtonColor:btn?getComputedStyle(btn).color:null};
  });
  console.log(JSON.stringify(info,null,2));
  await b.close();
})();
" | tee /tmp/app-isolation.json
```

Expected：
- `rootFontSize: "16px"`（**不是 10px** —— 证明 `html{font-size:.625em}` 没漏进主应用文档）
- `rootFontFamily` 以 `Inter` 开头（不是 `HeadingNow`）
- `elPrimary: "#ff4e16"`（**不是 `#409eff`** —— 证明 Element Plus 主色覆盖仍生效）
- `bodyOverflow` 不是 `clip`
- `hasSiteHeader: true`、`hasScrollableArea: false`
- `elButtonColor` 非空

任一不符 = 文档级隔离破了，停下来查是哪个共享模块串了样式。

- [ ] **Step 7: 保持 server 运行，进 Task 17**

**不要杀 5179** —— Task 17 的功能实跑要用同一个 server，且需要后端与网关在线。
若已停，Task 17 Step 1 会重新拉起整套。

---

## Task 17: auth 功能实跑取证

spec §10.3。用 Playwright 脚本而非手工点击，这样证据可复现、可重跑。脚本放在
`logn in/scripts/`（`@playwright/test` 只装在那里）。

**Files:**
- Create: `logn in/scripts/verify-portal-auth.mjs`
- Create: `docs/superpowers/evidence/2026-10-07-portal-merge-acceptance.md`

- [ ] **Step 1: 起完整后端栈**

按 `docs/STARTUP_GUIDE.md` 的口径（Redis 16379 + Kafka + gateway 8080 + backend 8081 +
MySQL 复用本机 3306）。从 git bash 调 PowerShell：

```bash
cd "G:/高并发大作业项目/PeakRush"
powershell -NoProfile -Command ". '依赖环境\env.ps1'; & '依赖环境\start-runtime.ps1'" > /tmp/runtime.log 2>&1
powershell -NoProfile -Command ". '依赖环境\env.ps1'; & 'scripts\app-start.ps1' -SkipBuild -SkipInfra" > /tmp/app-start.log 2>&1
```

轮询就绪（**不要 sleep 固定时长**）：

```bash
for i in $(seq 1 180); do
  g=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://127.0.0.1:8080/actuator/health)
  b=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://127.0.0.1:8081/actuator/health)
  f=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://127.0.0.1:5179/)
  [ "$g" = "200" ] && [ "$b" = "200" ] && [ "$f" = "200" ] && { echo "stack ready after ${i}s (gw=$g backend=$b front=$f)"; break; }
  sleep 2
done
```

Expected: `stack ready after Ns (gw=200 backend=200 front=200)`。
未就绪则 `tail -40 /tmp/runtime.log /tmp/app-start.log` 排查后停止 —— **不要在没有真后端
的情况下跑功能取证**，那只会得到一堆假失败或假通过。

- [ ] **Step 2: 写取证脚本**

创建 `logn in/scripts/verify-portal-auth.mjs`：

```js
import { chromium } from '@playwright/test';

/**
 * verify-portal-auth — functional evidence for spec §10.3. Drives the REAL UI against
 * the REAL backend; nothing here stubs fetch. Every check records what it observed
 * (DOM text, response status, final URL) rather than asserting silently, so a failure
 * says what actually happened.
 *
 * Run: node scripts/verify-portal-auth.mjs   (expects the full stack on 5179/8080/8081)
 */
const BASE = 'http://127.0.0.1:5179';
const results = [];
function record(name, pass, observed) {
  results.push({ name, pass, observed });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}\n      ${JSON.stringify(observed)}`);
}

const run = String(Date.now()).slice(-8);
const USER = `qa_${run}`;
const PASSWORD = 'qa-password-1';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1376, height: 772 } });
const page = await ctx.newPage();

const goto = async (path) => {
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
};
const text = async (sel) => (await page.locator(sel).first().isVisible().catch(() => false))
  ? (await page.locator(sel).first().innerText()).trim()
  : null;
const field = (name) => page.locator(`#auth-signup-${name}, #auth-signin-${name}`);

// ---- 1. signup: a fresh username registers and lands in the main app -------------
await goto('/signup?redirect=%2Fapp%2Forders');
const signupResponse = page.waitForResponse((r) => r.url().includes('/api/auth/register'));
await field('username').fill(USER);
await field('password').fill(PASSWORD);
await field('confirm').fill(PASSWORD);
await page.locator('.auth-submit button[type=submit]').click();
const res1 = await signupResponse;
await page.waitForURL(/\/app/, { timeout: 15000 });
const stored = await page.evaluate(() => ({
  token: (localStorage.getItem('peakrush.token') || '').slice(0, 12),
  user: localStorage.getItem('peakrush.user'),
}));
record('signup posts to /api/auth/register and lands on the redirect target',
  res1.status() === 200 && page.url().includes('/app/orders') && stored.token.length > 0,
  { status: res1.status(), url: page.url(), storedUser: stored.user });

// ---- 2. a username with no '@' is accepted (why the field is type=text) ---------
const inputType = await field('username').getAttribute('type');
record('username field is type=text so admin_01 style names can be submitted',
  inputType === 'text', { type: inputType, registeredUsername: USER });

// ---- 3. logged-in visit to /signin bounces straight to the app ------------------
await goto('/signin');
await page.waitForURL(/\/app\/$/, { timeout: 10000 }).catch(() => {});
record('an authenticated visit to /signin does not render the form',
  page.url().endsWith('/app/'), { url: page.url() });

// ---- 4. logout, then login with the real credentials ----------------------------
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await goto('/signin?redirect=%2Fapp%2Fadmin');
const loginResponse = page.waitForResponse((r) => r.url().includes('/api/auth/login'));
await field('username').fill(USER);
await field('password').fill(PASSWORD);
await page.locator('.auth-submit button[type=submit]').click();
const res2 = await loginResponse;
await page.waitForURL(/\/app\/admin/, { timeout: 15000 }).catch(() => {});
record('signin posts to /api/auth/login and honours the redirect target',
  res2.status() === 200 && page.url().includes('/app/admin'),
  { status: res2.status(), url: page.url() });

// ---- 5. wrong password surfaces the backend wording -----------------------------
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await goto('/signin');
const badLogin = page.waitForResponse((r) => r.url().includes('/api/auth/login'));
await field('username').fill(USER);
await field('password').fill('definitely-wrong');
await page.locator('.auth-submit button[type=submit]').click();
const res3 = await badLogin;
const shown = await text('.auth-form-error');
record('a 401 shows the backend message in the form-level error slot',
  res3.status() === 401 && shown === '用户名或密码不正确',
  { status: res3.status(), shown, stillOn: page.url() });

// ---- 6. duplicate username surfaces as 409 --------------------------------------
await goto('/signup');
const dup = page.waitForResponse((r) => r.url().includes('/api/auth/register'));
await field('username').fill(USER);
await field('password').fill(PASSWORD);
await field('confirm').fill(PASSWORD);
await page.locator('.auth-submit button[type=submit]').click();
const res4 = await dup;
const dupShown = await text('.auth-form-error');
record('re-registering the same username shows the 409 message',
  res4.status() === 409 && dupShown === '用户名已存在',
  { status: res4.status(), shown: dupShown });

// ---- 7. field validation fires client-side, no request leaves -------------------
let sawRequest = false;
page.on('request', (r) => { if (r.url().includes('/api/auth/')) sawRequest = true; });
await goto('/signup');
await field('username').fill('张三');
await field('password').fill('short');
await field('confirm').fill('mismatch');
await page.locator('.auth-submit button[type=submit]').click();
await page.waitForTimeout(600);
const items = await page.locator('.error-list li').allInnerTexts();
record('illegal username + short password + mismatched confirm are all reported at once, with no request sent',
  items.length === 3 && sawRequest === false, { items, sawRequest });

// ---- 8. the 72-byte ceiling counts UTF-8 bytes, not characters ------------------
await goto('/signup');
await field('username').fill(`qa2_${run}`);
await field('password').fill('中'.repeat(25));   // 75 bytes, 25 characters
await field('confirm').fill('中'.repeat(25));
await page.locator('.auth-submit button[type=submit]').click();
await page.waitForTimeout(600);
const byteItems = await page.locator('.error-list li').allInnerTexts();
record('a 25-character CJK password (75 bytes) is rejected on the byte ceiling',
  byteItems.length === 1 && sawRequest === false, { byteItems, sawRequest });

// ---- 9. reveal toggles on all three password fields -----------------------------
await goto('/signup');
const before = await field('password').getAttribute('type');
await page.locator('.auth-reveal').first().click();
const after = await field('password').getAttribute('type');
const revealCount = await page.locator('.auth-reveal').count();
await goto('/signin');
const signinReveals = await page.locator('.auth-reveal').count();
record('reveal toggles exist on both routes and flip the input type',
  before === 'password' && after === 'text' && revealCount === 2 && signinReveals === 1,
  { before, after, signupReveals: revealCount, signinReveals });

// ---- 10. open-redirect attempts all fall back to /app/ -------------------------
const redirectCases = [];
for (const bad of ['//evil.com', 'https://evil.com', '/', '/signin', '/application']) {
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await goto('/signin?redirect=' + encodeURIComponent(bad));
  const r = page.waitForResponse((x) => x.url().includes('/api/auth/login'));
  await field('username').fill(USER);
  await field('password').fill(PASSWORD);
  await page.locator('.auth-submit button[type=submit]').click();
  await r;
  await page.waitForURL(/127\.0\.0\.1:5179/, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  redirectCases.push({ bad, landed: page.url() });
}
record('every hostile redirect falls back to /app/ on this origin',
  redirectCases.every((c) => c.landed.startsWith(BASE + '/app')), { redirectCases });

// ---- 11. requireLogin is click-driven and carries the right redirect --------------
// main.ts has no router guard, so an unauthenticated visit to /app/orders does NOT
// auto-redirect: OrdersPage.vue:132-138 renders a state-panel whose button is
// @click="requireLogin()". The check has to click it.
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await goto('/app/orders');
const panelVisible = await page.locator('.state-panel.large').isVisible();
const stillOnOrders = page.url();
await page.locator('.state-panel.large .el-button').click();
await page.waitForURL(/\/signin/, { timeout: 10000 }).catch(() => {});
const ordersRedirect = new URL(page.url()).searchParams.get('redirect');
record('the logged-out orders panel waits for a click, then requireLogin carries redirect=/app/orders',
  panelVisible === true && stillOnOrders.endsWith('/app/orders') && ordersRedirect === '/app/orders',
  { panelVisible, beforeClick: stillOnOrders, afterClick: page.url(), ordersRedirect });

// ---- 12. the guidance line survives the cross-document jump ---------------------
const guidance = await text('.auth-demo-notice');
record('the guidance message set by requireLogin survives via sessionStorage',
  typeof guidance === 'string' && guidance.length > 0, { guidance });

// ---- 13. an expired token routes back through /signin ---------------------------
// NOT reproducible by seeding localStorage and reloading. App.vue's onMounted(restoreSession)
// calls /api/auth/me, which api.ts:42 excludes from the peakrush:expired dispatch; its 401
// handler just logs out, after which OrdersPage.vue:39-42 early-returns and never calls
// /api/orders. Whether the event fires at all then depends on which async mount wins.
// Deterministic route instead: log in for real, let restoreSession settle, corrupt the token
// in place without reloading (session.user stays non-null in memory), then click 刷新订单
// (OrdersPage.vue:128 @click="load") to force an authenticated call the backend rejects.
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await goto('/signin');
const relogin = page.waitForResponse((r) => r.url().includes('/api/auth/login'));
await field('username').fill(USER);
await field('password').fill(PASSWORD);
await page.locator('.auth-submit button[type=submit]').click();
await relogin;
// Registered before the navigation so we can prove restoreSession has settled, i.e. the
// in-memory session.user is the real one rather than the localStorage seed.
const settled = page.waitForResponse((r) => r.url().includes('/api/auth/me'), { timeout: 15000 });
await page.evaluate(() => { window.location.href = '/app/orders'; });
await settled;
await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.setItem('peakrush.token', 'expired.header.sig'); });
const rejected = page.waitForResponse((r) => r.url().includes('/api/orders') && r.status() === 401, { timeout: 10000 });
await page.getByRole('button', { name: '刷新订单' }).click();
await rejected.catch(() => {});
await page.waitForURL(/\/signin/, { timeout: 10000 }).catch(() => {});
const afterExpiry = page.url();
const expiredGuidance = await text('.auth-demo-notice');
record('a token the backend rejects mid-session sends the user back to /signin with the expiry wording',
  afterExpiry.includes('/signin') && typeof expiredGuidance === 'string' && expiredGuidance.includes('过期'),
  { url: afterExpiry, expiredGuidance });

await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===`);
if (failed.length) { console.log('FAILED:'); for (const f of failed) console.log(' -', f.name); }
process.exit(failed.length === 0 ? 0 : 1);
```

- [ ] **Step 3: 跑取证脚本**

```bash
cd "G:/高并发大作业项目/PeakRush/logn in"
node scripts/verify-portal-auth.mjs 2>&1 | tee /tmp/auth-evidence.txt | tail -60
echo "exit=${PIPESTATUS[0]}"
```

Expected: `exit=0`，末行 `=== 13/13 passed ===`。

任何 FAIL 都要定位到根因再重跑，**不要改断言让它变绿**。几个常见的真实缺陷信号：
- 第 1 条卡在 `waitForURL(/\/app/)` → `safeRedirect` 或 localStorage 写入没生效
- 第 5 条 `shown` 为 null → `.auth-form-error` 没渲染，查 `formError` 绑定
- 第 7 条 `sawRequest: true` → 客户端校验没拦住，请求已经发出去了
- 第 10 条某个 `landed` 不在 `/app` → **开放重定向漏洞，最高优先级修**
- 第 11 条 `panelVisible: false` → `OrdersPage.vue:132` 的 `v-if="!session.user"` 为假，
  即 `session.user` 非空，说明前一步的 `localStorage.clear()` 没生效；也可能是
  `.state-panel.large` 类名变了
- 第 11 条点击后仍停在 `/app/orders` → `session.ts` 的 `requireLogin` 没改成跨文档跳转
- 第 12 条 `guidance` 为 null → sessionStorage 承载失败，查 `session.ts` 与
  `AuthPanel.vue` 的 `onMounted` 读写键名是否都是 `peakrush.authMessage`
- 第 13 条 `url` 仍是 `/app/orders` → `api.ts:42` 的 401 分派条件被改动了，或
  Task 15 重写后的 `session.ts` 末尾那个 `peakrush:expired` 监听器没接上 `requireLogin`
- 第 13 条 `expiredGuidance` 为 null 但 URL 对 → 跳转发生了但提示语没经 sessionStorage 送达

- [ ] **Step 4: 补验深层 URL 与刷新（spec §10.5）**

```bash
cd "G:/高并发大作业项目/PeakRush"
for p in / /about /pricing /gift-card /terms-and-conditions /signin /signup /nonexistent \
         /app/ /app/orders /app/admin /app/nonexistent; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:5179$p")
  printf "  %-28s %s\n" "$p" "$code"
done
echo "--- 静态资产 ---"
for p in /fonts/HeadingNow-73Book.woff2 /icons.svg /assets/product-earbuds.png /assets/cards/Card-1.png; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:5179$p")
  printf "  %-40s %s\n" "$p" "$code"
done
```

Expected: 12 条路径**全部 200**（含 `/nonexistent` 与 `/app/nonexistent` ——
它们分别由克隆站的 `NotFoundPage` 与主应用的兜底重定向处理，都返回 200 而非 404）；
4 条静态资产全部 200。

- [ ] **Step 5: 主应用抢购链路零回归抽查（spec §10.4）**

```bash
cd "G:/高并发大作业项目/PeakRush/logn in"
node -e "
const {chromium}=require('@playwright/test');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1376,height:772}});
  const out={};
  await p.goto('http://127.0.0.1:5179/signin',{waitUntil:'networkidle'});
  await p.locator('#auth-signin-username').fill(process.env.QA_USER||'qa_admin');
  await p.locator('#auth-signin-password').fill(process.env.QA_PASS||'qa-password-1');
  await p.locator('.auth-submit button[type=submit]').click();
  await p.waitForURL(/\/app/,{timeout:15000}).catch(()=>{});
  out.landedAfterLogin=p.url();
  out.activities=(await p.evaluate(()=>fetch('/api/seckill/activities').then(r=>r.json()))).length??null;
  out.headerUser=await p.locator('.account-copy strong').innerText().catch(()=>null);
  out.productImgs=await p.evaluate(()=>[...document.images].filter(i=>i.src.includes('/assets/product')).map(i=>({src:i.src.split('/').pop(),ok:i.naturalWidth>0})));
  await p.goto('http://127.0.0.1:5179/app/orders',{waitUntil:'networkidle'});
  out.ordersUrl=p.url(); out.ordersHasTable=await p.locator('.el-table').count();
  await b.close(); console.log(JSON.stringify(out,null,2));
})();
"
```

Expected: `landedAfterLogin` 在 `/app`；`headerUser` 非空（顶栏显示登录用户名）；
`productImgs` 每项 `ok:true`（主应用原有 4 张图仍能从合并后的 publicDir 加载）；
`ordersUrl` 是 `/app/orders`、`ordersHasTable` ≥ 1。
需要一个真实存在的账号 —— 用 Step 3 注册出来的那个用户名与密码，
通过 `QA_USER` / `QA_PASS` 环境变量传入。

- [ ] **Step 6: 写验收报告**

创建 `docs/superpowers/evidence/2026-10-07-portal-merge-acceptance.md`，
**填实际输出，不要留空模板**：

```markdown
# 子项目 1 验收报告

日期：（实际执行日）
分支：feat/login-page-integration（未 push）
栈：gateway 8080 / backend 8081 / frontend 5179 / Redis 16379 / Kafka / MySQL 3306

## 构建（Task 9）

- `vue-tsc --noEmit`：exit （填），错误数 （填）
- `vite build`：exit （填）
- 产物：`dist/index.html` （填存在与否）、`dist/app.html` （填）、
  `dist/_app/` 文件数 （填）、`dist/assets` 内有无 js/css （填）

## CSS 隔离（Task 9 Step 4 构建期 + Task 16 Step 6 运行时）

| 探针 | index.html 期望/实测 | app.html 期望/实测 |
|---|---|---|
| `--el-color-primary` | false / （填） | true / （填） |
| `#ff4e16` | false / （填） | true / （填） |
| `.el-button` | false / （填） | true / （填） |
| `HeadingNow` | true / （填） | false / （填） |
| `--scale-text-rem` | true / （填） | false / （填） |
| `.layout-split` | true / （填） | false / （填） |

运行时（`/app/`）：rootFontSize （填，期望 16px）、elPrimary （填，期望 #ff4e16）、
bodyOverflow （填，期望非 clip）、hasScrollableArea （填，期望 false）。

## 渲染对照（Task 16）

基线：`logn in/evidence/baseline-premerge/`（合并前，5175，1376×772@1.5）
现状：`logn in/evidence/local/`（合并后，5179，同视口）
比对：`compare-local-dirs.mjs`，pixelmatch threshold 0.1，pass 判据 ratio ≤ 0.05

- compared: （填，期望 30）
- byteIdentical: （填，期望 ≥28）
- expectedChanged: （填，期望恰好 /signin 与 /signup 两条，附 diffRatio）
- UNEXPECTED: （填，期望空数组）

采集环境（基线 / 合并后）：webgl （填）、masked renderer （填）、
**unmasked renderer** （填，用 `WEBGL_debug_renderer_info`，掩码值分辨不出软硬件）、
canvases （填）、liveWebglAttr （填，仅记录，不作判据）、three （填）、lenis （填）、
浏览器二进制与版本 （填）。
两侧 unmasked renderer 必须逐字相同，否则整份像素比对作废（Step 3b）。
若含 SwiftShader/Software，注明"软件渲染，WebGL 章节像素不具代表性"。

Task 3 生效证据：motionModuleRequested （填，**必须 ≥1**）、
consoleIssues 是否含 `createMotionRuntime is not on disk yet` （填，必须不含）。
已知缺陷核对：emptyImgSrc （填，两侧都应约 22，来自 spec §11 的 assetRegistry 缺陷，
本轮明确不修，只核对两侧一致）。

## auth 功能（Task 17 Step 3）

`=== N/13 passed ===` → 填实际值。逐条列 PASS/FAIL 与 observed 摘要。

## 深层 URL 与静态资产（Task 17 Step 4）

12 条路径的 HTTP 码：（填表）。4 条静态资产的 HTTP 码：（填表）。

## 主应用零回归（Task 17 Step 5）

landedAfterLogin / headerUser / productImgs 各项 ok / ordersUrl / ordersHasTable：（填）。

## 已知缺陷与待清理

- newsletter 勾选框无后端（spec §8.2）→ 子项目 2 删
- `style.css` 的 AuthDialog 独占规则未删（`.auth-tabs` 4 条 + `.auth-dialog .fine-print`），
  行号：（填 Task 14 Step 3 第一段的输出）
- `.dialog-lead` / `.field-label` / `.form-error` **不是残留**，仍被 AdminPage、
  PurchaseDialog、OrdersPage 使用，不得删除
- 全站仍为 follow.art 英文品牌 → 子项目 2
- 23MB 抓取资产与商用字体已入 git 历史（spec §12），公开部署前须重新评估授权
```

- [ ] **Step 7: 提交**

```bash
cd "G:/高并发大作业项目/PeakRush"
git add "logn in/scripts/verify-portal-auth.mjs" "logn in/scripts/compare-local-dirs.mjs" docs/superpowers/evidence/
git commit -m "$(cat <<'EOF'
test: 门户接入的功能取证与渲染对照脚本及报告

verify-portal-auth.mjs 驱动真实 UI 打真实后端，13 项覆盖 spec §10.3：
注册/登录/401/409、字段级校验（含 72 字节 UTF-8 上限）、type=text 让
admin_01 这类用户名可提交、三处 reveal、5 种敌意 redirect 全部回落 /app/、
requireLogin 回跳目标、sessionStorage 承载的提示语、过期 token 重登。

compare-local-dirs.mjs 比对合并前后两次本地采集，阈值与 compare-reference.mjs
一致。两个脚本都放在 logn in/scripts/，因为 @playwright/test、pixelmatch、pngjs
只装在那里的 node_modules（spec §5.7 明确不给 frontend 加这三个依赖）。
EOF
)"
```

---

## Task 18: 启动脚本与文档更新

spec §5.8、§6.3。

**Files:**
- Modify: `scripts/app-start.ps1:64`
- Modify: `README.md`、`docs/STARTUP_GUIDE.md`、`docs/ARCHITECTURE.md`、`frontend/README.md`

- [ ] **Step 1: 找出所有需要改的 URL 说法**

```bash
cd "G:/高并发大作业项目/PeakRush"
grep -rn "127.0.0.1:5179\|localhost:5179" README.md docs/ frontend/README.md scripts/ --include=*.md --include=*.ps1 | grep -v "design-qa.md"
```

Expected: 列出所有把 `http://127.0.0.1:5179/` 当作抢购页入口的地方。
`design-qa.md` 按项目既有惯例**保留历史值不改**（已在 grep 里排除）。

- [ ] **Step 2: 改健康检查**

`scripts/app-start.ps1:64` 的 URL 列表从

```powershell
foreach($url in @('http://127.0.0.1:8081/actuator/health','http://127.0.0.1:8080/actuator/health','http://127.0.0.1:5179')){
```

改为

```powershell
foreach($url in @('http://127.0.0.1:8081/actuator/health','http://127.0.0.1:8080/actuator/health','http://127.0.0.1:5179','http://127.0.0.1:5179/app/')){
```

理由：`http://127.0.0.1:5179` 现在打开的是门户（克隆站），只检查它无法发现主应用挂了。

- [ ] **Step 3: 改就绪提示语**

`scripts/app-start.ps1:72` 从

```powershell
Write-Host 'PeakRush ready: http://127.0.0.1:5179'
```

改为

```powershell
Write-Host 'PeakRush ready: portal http://127.0.0.1:5179/  app http://127.0.0.1:5179/app/'
```

**注意（已更新）**：本计划初稿写这一段时，`scripts/app-start.ps1` 上趴着上次会话
遗留的未提交修改（端口 5173→5179 与一处 PS 5.1 的 `ConvertFrom-Json` 数组缺陷修复）。
那份遗留工作**已在 Task 6 之前作为独立提交 `031c3ec` 落地**，`docs/STARTUP_GUIDE.md`
也同时纳入版本控制，所以现在 `git status` 应当是干净的，`:64` 与 `:72` 的行号即当前值。
若你开工时发现这两个文件又出现非本任务产生的改动，停下来报告，不要顺带提交。

- [ ] **Step 4: 改文档里的 URL 说明**

对 Step 1 列出的每一处，把"前端在 `http://127.0.0.1:5179/`"这类说法改为明确的两段：

```markdown
- 门户（follow.art 复刻站，含登录/注册）：http://127.0.0.1:5179/
- 抢购应用（限时抢购 / 我的订单 / 管理工作台）：http://127.0.0.1:5179/app/
```

`README.md` 与 `docs/ARCHITECTURE.md` 里描述路由表的地方，补上双入口 MPA 的说明：
`index.html` → `welcome/main.ts`（12 条门户路由），`app.html` → `src/main.ts`
（`/app/` 下 4 条路由），回退由 `build/mpa-fallback.ts` 判定。

`docs/STARTUP_GUIDE.md` 现已是**已跟踪**文件（在 `031c3ec` 里随端口改动一并入库），
本任务直接改它即可，不需要再 `git add` 首次入库。

- [ ] **Step 5: 重启验证脚本改动生效**

```bash
cd "G:/高并发大作业项目/PeakRush"
powershell -NoProfile -Command ". '依赖环境\env.ps1'; & '依赖环境\stop-all.ps1' -Only frontend" > /tmp/stop.log 2>&1
powershell -NoProfile -Command ". '依赖环境\env.ps1'; & 'scripts\app-start.ps1' -SkipBuild -SkipInfra" > /tmp/app-start2.log 2>&1
grep -iE "ready|health|fail|error" /tmp/app-start2.log | tail -20
```

Expected: 日志里出现新的就绪提示语，且四个健康检查 URL 全过（含新增的 `/app/`）。

- [ ] **Step 6: 提交**

```bash
cd "G:/高并发大作业项目/PeakRush"
git add scripts/app-start.ps1 README.md docs/STARTUP_GUIDE.md docs/ARCHITECTURE.md frontend/README.md
git status --short
git commit -m "$(cat <<'EOF'
docs: 双入口 URL 分工写进启动脚本与文档

门户（follow.art 复刻站，含登录/注册）在 http://127.0.0.1:5179/，
抢购应用在 http://127.0.0.1:5179/app/。

app-start.ps1 的健康检查加 /app/ —— 原来只检查 /，而 / 现在是门户，
主应用挂了也发现不了。就绪提示语同时给出两个入口。

注：本任务只写双入口分工这一件事。上次会话遗留的"前端端口 5173→5179"改动
已在 Task 6 之前作为独立提交 031c3ec 落地，不混进本提交。
design-qa.md 按既有惯例保留历史 5173 不改。
EOF
)"
```

---

## Task 19: 全量验证与收尾

**Files:** 无（纯验证 + 报告）

- [ ] **Step 1: 从零构建一遍（不复用增量产物）**

```bash
cd "G:/高并发大作业项目/PeakRush/frontend"
rm -rf dist node_modules/.vite
npm run build 2>&1 | tee /tmp/final-build.txt | tail -25
echo "exit=${PIPESTATUS[0]}"
npm test 2>&1 | tee /tmp/final-test.txt | tail -15
echo "test exit=${PIPESTATUS[0]}"
```

Expected: 两个 `exit=0`。测试总数应为 **37**（原 `api.test.mjs` 7 +
`resolve-entry` 6 + `safe-redirect` 6 + `auth-validation` 8 + `auth-api` 10 = 37；
这四组新测试的 30 个用例已在写计划时对着实现逐条跑绿过）。
以实际输出为准，**逐个数清并写进报告**，不要只看"全绿"。

- [ ] **Step 2: 用项目自己的启动脚本起一遍完整栈**

```bash
cd "G:/高并发大作业项目/PeakRush"
powershell -NoProfile -Command ". '依赖环境\env.ps1'; & '依赖环境\stop-all.ps1'" > /tmp/stop2.log 2>&1
powershell -NoProfile -Command ". '依赖环境\env.ps1'; & 'scripts\app-start.ps1' -SkipInfra" > /tmp/final-start.txt 2>&1
tail -30 /tmp/final-start.txt
```

Expected: 走完整 `npm ci` + `npm run build` + 起进程的路径，四个健康检查全过。
**这一步验证的是"别人 clone 下来能不能跑起来"**，比 Step 1 的裸构建更接近真实交付。

- [ ] **Step 3: 重跑 Task 17 的取证脚本确认无回归**

```bash
cd "G:/高并发大作业项目/PeakRush/logn in"
node scripts/verify-portal-auth.mjs 2>&1 | tail -20
echo "exit=${PIPESTATUS[0]}"
```

Expected: `exit=0`。用户名带时间戳后缀，不会与 Task 17 那次撞 409。

- [ ] **Step 4: 确认工作区干净、无遗漏文件**

```bash
cd "G:/高并发大作业项目/PeakRush"
git status --short
echo "--- 本分支相对 main 的提交 ---"
git log --oneline main..HEAD
echo "--- 改动文件统计 ---"
git diff --stat -M main..HEAD | tail -5
echo "--- @ 别名独占性守卫（Task 6 建立的隐含契约，必须仍为 0）---"
grep -rnE "from ['\"]@/" frontend/src/ | tee /tmp/alias-collision.txt | wc -l
```

Expected: `git status --short` **为空**。

本计划初稿在这里写的是"只剩上次会话遗留的 8 个未提交修改"，那个前提已不成立：
这批遗留改动（前端端口 5173→5179、`app-start.ps1` 的 PS 5.1 修复、新增
`docs/STARTUP_GUIDE.md`）**已在 Task 6 之前作为独立提交 `031c3ec` 落地**，
所以本轮从开工起工作区就是干净的。若此处出现任何非本轮产生的改动，停下来报告，
不要顺手提交别人的在途工作。

最后一条是**别名独占守卫**。Task 6 写的 `paths: {"@/*": ["welcome/*"]}` 对整个
tsconfig 生效，不只对 `welcome/**`。于是主应用 `frontend/src/**` 里一旦出现
`import … from '@/foo'`，它会静默解析到**克隆站**的 `welcome/foo`——同名模块时拿到
错的那一个，文档级样式隔离也随之破掉，而且不会报错。实测本轮开工时主应用用 `@/`
是 **0 次**，`@` 才能独占给克隆站；但这是一个需要持续成立的前提，不是一次性事实，
所以在收尾再钉一次：命中数必须仍为 0。若不为 0，说明有主应用文件开始用 `@/`，
必须改成相对路径或 `@shared/`，不能让主应用隔着入口 import 克隆站的模块。

- [ ] **Step 5: 把最终数字补进验收报告并提交**

在 `docs/superpowers/evidence/2026-10-07-portal-merge-acceptance.md` 末尾追加：

```markdown
## 最终验证（Task 19）

- 清理后全量构建：exit （填）
- 单测：exit （填），通过数 （填）/ 总数 （填）
- `app-start.ps1 -SkipInfra` 完整启动：（填成功/失败与四个健康检查的码）
- 取证脚本重跑：（填 N/13）
- 工作区剩余未提交项：（填 Step 4 的实际输出，并说明为何与本轮无关）
```

```bash
cd "G:/高并发大作业项目/PeakRush"
git add docs/superpowers/evidence/
git commit -m "docs: 补最终验证结果"
```

- [ ] **Step 6: 报告完成，等待合并授权**

向发起本计划的人报告：
- 本分支 `feat/login-page-integration` 的提交列表与改动统计
- 验收报告路径与关键数字
- **不 push、不合并进 main** —— 按既定规则，合并需逐次授权
- 已知缺陷与待清理项（spec §11 + 报告末节）
- 子项目 2 的阻塞问题（spec §13：13 组 SVG 字模怎么处置）

---

## 完成判据

全部满足才算完成，**不得缩小标准**：

1. `npm run build` exit 0，`vue-tsc --noEmit` 零错误
2. `npm test` 全绿，且测试总数与逐条清单对得上
3. Task 9 Step 4 的 CSS 隔离表 12 格全部符合期望
4. Task 16 Step 3b 的 `RASTERISER MATCHES BASELINE` 成立（两侧同一 headless-shell 构建、
   同一 SwiftShader 非掩码 renderer），且 Step 4 的 `UNEXPECTED` 是空数组、
   `byteIdentical ≥ 28`。结论必须按 Step 3b 的口径写：这只证明"同一份代码在同一个
   软件光栅化器下渲染一致"，不得写成"渲染在真实 GPU 上正确"
5. Task 16 Step 5 的 `motionModuleRequested >= 1`（动态 import 真发出了请求，是 Task 3
   生效的正证）。**不再用 `liveCanvases > 0` 当判据** —— `data-webgl="live"` 还由
   `webgl/mountScenes.ts:165` 与 HomeCard/HomeGetSeen/HomeHero 自己的 `:data-webgl`
   绑定设置，Task 3 修没修都可能为正
6. Task 16 Step 6 的 `/app/` 运行时探针：`rootFontSize: "16px"`、
   `elPrimary: "#ff4e16"`、`hasScrollableArea: false`
7. Task 17 Step 3 的 13 项全 PASS，其中开放重定向那项**必须**全回落 `/app/`
8. Task 17 Step 4 的 12 条路径 + 4 条静态资产全部 200
9. Task 17 Step 5 的主应用抽查：登录态、顶栏用户名、4 张商品图、订单页表格全在
10. Task 19 Step 2 的完整启动脚本走通
11. 验收报告两份都填了实际数字，无空模板
12. 全程未 push，仍在 `feat/login-page-integration` 本地分支

