# PeakRush PR #1 合并决策审查报告

**结论：当前远程 PR 不适合合并，建议 Request changes。** 已证实 WebGL 存在重复所有权及路由资源泄漏，商品分类存在并发丢失更新；新的登录入口还暴露了历史恢复时的身份同步缺口。随附本地候选补丁与回归测试，修复尚未提交到远程 PR。未执行合并、推送、发布或 GitHub Review 操作。

## 审查对象与证据范围

- PR：[sherlockfeng07-ui/PeakRush #1](https://github.com/sherlockfeng07-ui/PeakRush/pull/1)，Open、未合并，提交者 `shengxie738-ops`。
- 本次锁定 HEAD：`70ca5d061250e18421a9c3fba3a13f9c947054af`；BASE/main：`415a6f83fd60e8173c3ab143dc4700c6201a6671`。
- 用户提供的 `a1e94ac…` 已被后续提交替换。最新统计为 **34 次提交、454 个文件、+53,062 / −148 行**。
- GitHub 快照记录于 2026-10-09，北京时间约 21:03；本地审查及测试均基于上述固定 HEAD，随后在隔离副本中验证候选补丁。
- 重点为实际构建入口 `frontend/`、后端迁移与 Store、库存链路、目录脚本及相关测试。新增图片、历史证据、课程实验和 `logn in/` 中的原始素材/测试增加了变更体积；本报告没有将它们全部视为已完成运行验收。
- 证据分为实际 MySQL/Redis/构建测试、执行真实源码的浏览器边界模拟测试、静态审查，以及尚待验证的风险。WebGL 测试执行真实控制器、注册表和 Three 资源对象，但 GPU、DOM、Vue 生命周期调度、图片交付及运动时钟边界使用模拟；不构成实机 FPS、显存或浏览器 BFCache 测量。

## 阻断项与建议修改项

P1 为高风险、P2 为中风险、P3 为低风险。以下位置均指远程固定 HEAD，而非补丁后的行号。

| ID | 等级 | 合并决策 | 主要位置 | 已证实的问题 |
|---|---|---|---|---|
| R1 | P1 高 | 阻断 | `welcome/app/App.vue:133–177`；`webgl/sceneRegistry.ts:117–119`；`mountScenes.ts:217–225,367–375,462–473` | 两条挂载路径可为 6 个画布创建 12 个渲染器；离开首页仍保留场景，返回时旧 host 抑制新画布挂载 |
| R2 | P2 中 | 阻断 | `backend/…/Store.java:40–42` | 省略 category 的旧客户端更新会覆盖并发写入的新分类 |
| R3 | P2 中 | 阻断 | `frontend/src/session.ts:71–73`；`AuthPanel.vue:68–70` | BFCache 恢复时仅重置跳转标志，不重新核验当前身份；可能保留上一账号及订单视图 |
| R4 | P2 中 | 阻断 | `webgl/mountScenes.ts:156–171,223–224`；`App.vue:149–152` | 无 WebGL、图片加载中或失败时仍隐藏真实备用图片，出现空白画面 |
| R5 | P2 中 | 建议修正，补丁已包含 | `motion/createMotionRuntime.ts:113–123`；`styles/layout.css:65` | 运行中开启减少动画会调用 Lenis.stop，裁剪滚动并阻止滚轮默认行为 |
| R6 | P2 中 | 建议修正，补丁已包含 | `HomeTestimonials.vue:33–38,90–108`；`createTestimonialCarousel.ts:176–181,210–215` | 前后切换按钮只改变 Vue index，未连接控制器；拖动与按钮状态也会不同步 |
| R7 | P2 中 | 建议修正，补丁已包含 | `webgl/textureRegistry.ts:58–64` | 相同商品广告 URL 的 sRGB 与原始颜色模式共享同一 Texture，忽略后续请求的颜色标签 |
| G1 | 验证门槛 | 合并前补齐 | GitHub checks、生产集成验证 | 当前缺少对应 HEAD 的 CI 成功记录，以及真实浏览器与完整 V0–V3 链路复测 |

### R1：WebGL 重复挂载、资源保留与首页返回失效

源码：[App 注册](https://github.com/shengxie738-ops/PeakRush/blob/70ca5d061250e18421a9c3fba3a13f9c947054af/frontend/welcome/app/App.vue#L133-L177)、[模块自动挂载](https://github.com/shengxie738-ops/PeakRush/blob/70ca5d061250e18421a9c3fba3a13f9c947054af/frontend/welcome/webgl/sceneRegistry.ts#L117-L119)、[按 ID 跳过既有场景](https://github.com/shengxie738-ops/PeakRush/blob/70ca5d061250e18421a9c3fba3a13f9c947054af/frontend/welcome/webgl/mountScenes.ts#L217-L225)。

App 直接创建场景；sceneRegistry 的模块副作用又启动 mountScenes。两者并不共享 App 的场景 Map。首页 DOM 在异步运行时导入完成前已存在时，两条路径可分别创建一套控制器。自动挂载注册表在路由离开时没有调用者负责释放，发现全部场景后 observer 还会停止。再次进入首页时，注册表只检查 section ID，继续持有断开的旧 host。

**复现：** 打开 `/`，通过 RouterLink 进入 `/signin` 或 `/about`，再返回 `/`。分别记录挂载场景、渲染器创建/释放、纹理引用及新画布是否绘制。初次 DOM 加载较早时，还应检查同一画布是否存在两个渲染器所有者。

**执行证据：** 真实源码模拟测试复现 12 个渲染器所有者对应 6 个画布；延迟首页挂载的独立路径在离开后仍保留 6 个所有者、21 个纹理引用、5 个场景，返回后的新画布没有被绘制。这里是逻辑对象计数，没有把它换算为实际 GPU 显存或 FPS。

**修复：** 移除 sceneRegistry 的自动模块副作用，由 App 唯一调用 `mountWebGLScenes`。路由离开与根组件销毁时先释放注册表，再销毁运行时；首页进入后 `nextTick` 重新挂载，保留已有迟到 DOM 发现机制。对异步导入和路由变化加版本/销毁保护。按 host/画布身份核对旧 entries，并移除窗口 resize 和轮播 click 监听器。场景 resize 使用自身 host 尺寸，更新共享滚动范围，避免运行时把小场景扩大为整屏。

**对应测试：** `welcome-webgl.test.mjs` 的每画布单一所有者、延迟挂载→signin→首页→销毁测试，以及 host 尺寸/范围测试。候选补丁释放后所有者、纹理引用、场景、待执行 RAF 和 resize 监听器均为零；返回首页使用新画布。

### R2：旧商品更新请求丢失并发分类修改

源码：[Store.java:37–44](https://github.com/shengxie738-ops/PeakRush/blob/70ca5d061250e18421a9c3fba3a13f9c947054af/backend/src/main/java/com/peakrush/Store.java#L37-L44)。

省略 category 时，代码先 SELECT 分类，再将这个快照带入稍后的 UPDATE。旧客户端表达的是“保持分类”，实现却写回了“读取时的分类”。

**复现时序：** 商品初始为“居家生活”；A 发出不包含 category 的旧格式 PUT，在类别读取之后暂停；B 将类别修改为“旅行出行”并完成；再放行 A。最终数据库回到“居家生活”。

**执行证据：** 在真实 MySQL 8.0.46 上，`CatalogLegacyConcurrencyReviewTest` 用 latch 控制上述写入次序。原 HEAD 失败：期望“旅行出行”，实际“居家生活”；补丁后通过。

**最小修复核心：** 省略字段的已有商品更新绑定 SQL NULL，在 UPDATE 内保留实时列值，避免预读。

```java
String c = b.containsKey("category") || id == null ? category(b.get("category")) : null;
// 原 UPDATE 的 category=? 改为：
// category=COALESCE(?,category)
```

创建时省略类别仍默认为“其他好物”；显式 null 仍按既有规则重置为默认类别；显式类别继续校验。该补丁解决类别省略的丢失更新，其他完整 PUT 字段的历史并发覆盖语义仍需要单独制定版本控制策略。

**对应测试：** 新增真实并发测试 1 项，继续执行原有 `ProductCategoryTest` 4 项及 `CatalogProductsIntegrationTest` 2 项。完整补丁为 `02-catalog.patch`。

### R3：跨文档登录后，历史恢复保留旧身份

源码：[历史恢复监听器](https://github.com/shengxie738-ops/PeakRush/blob/70ca5d061250e18421a9c3fba3a13f9c947054af/frontend/src/session.ts#L46-L73)、[登录成功保存与跳转](https://github.com/shengxie738-ops/PeakRush/blob/70ca5d061250e18421a9c3fba3a13f9c947054af/frontend/welcome/components/AuthPanel.vue#L64-L70)、[订单身份变更处理](https://github.com/shengxie738-ops/PeakRush/blob/70ca5d061250e18421a9c3fba3a13f9c947054af/frontend/src/pages/OrdersPage.vue#L112-L118)。

新增门户与业务页是不同文档。业务页的 `onMounted(restoreSession)` 在 BFCache 恢复时不会再次挂载；pageshow 处理只重置防重复跳转标志。若另一个文档更新了 localStorage 中的账号，缓存文档的响应式用户仍可能是旧账号，订单页的身份 watcher 也不会运行。

**条件性浏览器复现步骤：** Alice 登录 `/app/orders`；返回门户并用 Bob 登录；通过浏览器后退回到原先业务文档。若浏览器以 `pageshow.persisted=true` 恢复它，检查导航栏身份及旧订单视图。另一个文档退出登录后恢复旧页面亦应检查。实际 BFCache 是否可用需在目标浏览器确认。

**执行证据：** 对实际 session 模块注入 persisted pageshow，令存储中的 Bob 与缓存中的 Alice 不同：原 HEAD 不发起身份恢复，仍为 Alice；存储清空后恢复仍保留 Alice。另一个测试证实较早的 `/auth/me` 成功响应可覆盖后来登录的用户，这个响应竞态属于历史缺陷，与新增文档切换流程叠加。

**修复：** 记录当前响应式会话对应的 token；恢复时 token 变更或被删除才先清除旧身份，再核验 `/auth/me`。未变化的 token 遇到临时 503 时保留原身份。异步身份响应仅在请求 token 仍是当前 token 时写入。订单页已有用户 ID watcher，会清空订单并关闭详情。

**对应测试：** 新增 4 项：账号变更、别处退出、旧身份响应晚到、相同 token 的恢复遇 503；session 测试共 13 项通过。此问题涉及 UI 身份与缓存数据一致性，未证实绕过服务端权限校验。补丁为 `01-auth.patch`。

### R4：“构建成功”被错误当作“首帧可见”

源码：[live 标记与隐藏 poster](https://github.com/shengxie738-ops/PeakRush/blob/70ca5d061250e18421a9c3fba3a13f9c947054af/frontend/welcome/webgl/mountScenes.ts#L156-L171)、[无条件 RAF 信号](https://github.com/shengxie738-ops/PeakRush/blob/70ca5d061250e18421a9c3fba3a13f9c947054af/frontend/welcome/webgl/mountScenes.ts#L217-L225)、[初始化失败仍返回 host](https://github.com/shengxie738-ops/PeakRush/blob/70ca5d061250e18421a9c3fba3a13f9c947054af/frontend/welcome/webgl/createWebGLHost.ts#L54-L78)。

**复现：** 禁用 WebGL 或令 WebGLRenderer 初始化抛错；也可阻断广告纹理图片请求、延迟图片交付。等待一两帧后检查 hero、get-seen、card 的备用图片。

**执行证据：** 模拟六次初始化均失败、零次绘制时，原代码仍把五个场景标成 live，隐藏三个实际存在的备用 poster。图片失败和图片尚未交付的真实源码测试也复现备用图被隐藏。

**修复：** 去掉经过若干 RAF 就 live 的假设；只有真实 render 调用成功且场景依赖的纹理加载成功后才揭示画布。初始化/纹理失败继续显示备用图；上下文丢失或减少动画导致释放时恢复备用图。恢复后重新成功绘制才隐藏它。

**对应测试：** 无 WebGL、纹理失败、延迟纹理→成功绘制、上下文丢失→恢复、减少动画→恢复测试。浏览器真实 contextlost 恢复能力仍需实机验证；另外两个没有静态 poster 的场景建议补充可读备用内容。

### R5–R7：滚动、轮播状态与纹理颜色

- **R5 复现：** 页面正常启动后切换系统设置为减少动画。Lenis 1.3.3 的已安装源码明确在 stopped 状态阻止滚轮默认行为；仓库 CSS 对 `.lenis-stopped` 裁剪 overflow。修复为取消惯性后保持运行器未锁定，并关闭 smoothWheel，使滚动走原生路径；App 在 reduce 时释放装饰场景并恢复 poster。`motion-preference.test.mjs` 两项验证未锁定及 smoothWheel 策略，另有整页偏好切换资源测试。这些不是实际滚轮事件或 FPS 测量。
- **R6 复现：** 点击首页轮播 Next，DOM index/禁用状态变化，控制器仍停留在原 target；拖动则相反。修复为转发 `data-carousel-step`，控制器发布实际 index 事件供 Vue 同步，并在场景重建时从组件 index 恢复选择。事件/target/重建测试通过；真实 BrushLink 的事件冒泡及触控操作仍应浏览器验收。
- **R7 复现：** 先以 `{colorSpace:'srgb'}` 获取 `/peakrush/ads/phone.webp`，再以 `{colorSpace:'none'}` 获取同一 URL，返回同一对象且标签仍为 srgb。两个商品资源帮助函数使 hero 与轮播在正常首页确实共用这些 URL。颜色错误的方向由 shader 的 decode/encode 推导，未测量实机像素差异。修复按 URL 与 colorSpace 联合缓存，并使每个 release 使用匹配模式；测试验证对象/标签独立以及引用分别释放。

较低风险的匿名轮播 click 监听器和 App resize 监听器遗漏释放，已随 R1 补丁处理。上述 WebGL、轮播及运动修复统一放在 `03-webgl.patch`，避免拆开应用导致所有权与 readiness 契约不一致。

## 认证、跳转及 Token 的其他审查结论

1. **未证实开放重定向。** `shared/safe-redirect.ts:14–24` 限定同源 `/app`、`/app/…`，拒绝协议相对/绝对地址、反斜杠、控制字符，并检查 URL 标准化后的路径。原有 7 项跳转测试已独立执行，包含 `/app/../signin`、编码点段、`/application` 等。路径允许进入 `/app/admin` 不等于具备管理员权限。
2. **服务端权限依据来自验证后的用户。** `Auth.java:25–31,36–60` 使用 BCrypt、HMAC 签名与 exp；注册角色固定 USER；`WebConfig.java:17–19` 验证 Bearer，管理接口要求服务端 ADMIN。JWT、订单所有权和库存业务实现与 BASE 相比未改变。这里只确认静态代码约束，未新增真实 HTTP 的 JWT 篡改/过期/非管理员矩阵测试。
3. **localStorage 是风险面，不是已证实的盗号漏洞。** 新登录页保存 token 和用户信息，业务页原本也采用这个方案；当前令牌有效期为 8 小时，退出仅删除客户端存储，服务端没有这次新增的撤销机制。若发生同源 XSS，脚本可读取令牌；当前审查未找到可利用的新增用户输入→脚本注入链。建议评估 HttpOnly/Secure cookie、CSRF 配套与撤销策略，或在现有 Bearer 方案下加强 CSP、依赖治理和暴露时间控制，不能只用“存在 localStorage”声称认证可被绕过。
4. **失效处理总体可用，仍有历史缺口。** 业务保护 API 的 401 发 expired 事件，清除会话并带 reason 跳转；登录页 401 显示错误，18 秒超时且清理 timer，并检查组件销毁。历史跨标签页同步、被禁用的 localStorage、旧业务请求的迟到 401 清除新 token，以及客户端退出后的已盗 token 撤销仍未由本候选补丁完全解决。合并前建议增加对应浏览器/服务端测试，区分这些历史问题与 R3 新流程的回归。

## 数据迁移、库存及 V0–V3 兼容性

**旧 BASE 数据库升级未发现破坏性迁移缺陷。** `CatalogSchema.java:10–24` 在数据库初始化后执行；Store 显式依赖 catalogSchema。迁移只新增 category，默认“其他好物”；第二实例完成 ALTER 后的重复列异常由再次检查列存在处理。原来的目录集成测试仅在已经初始化的数据库上再次调用迁移，不能独立证明旧 schema 升级。

本次新增 `CatalogLegacyMigrationReviewTest` 使用 BASE 精确 schema 资源，在专用随机命名数据库中构造旧商品、V3 活动、8 件剩余库存、2 件 CREATED 订单、请求、ALLOCATE 日志及补偿 outbox。执行当前 schema 的 IF NOT EXISTS 后确认旧表仍无类别，再执行迁移与重复迁移，检查新增默认值和所有旧业务行逐字段一致；另用双线程 barrier 强制两个迁移实例都先观察到缺列。**两项在真实 MySQL 上通过，库存守恒为 8 + 2 = 10。** CREATE、ALTER、DROP 均限定于测试独有数据库，未操作用户生产数据。

尚待补齐的是 Spring Boot 全启动时的真实依赖顺序、生产低权限数据库用户的 ALTER 权限、超大表迁移耗时和异常结构漂移。这些是部署风险与覆盖缺口，不能描述为已复现数据库损坏。

**库存链路没有本次可证实的新增一致性缺陷。** 对 BASE→HEAD 的 `Orders`、`Purchases`、`Reservations`、`Admin`、`Workers` 与库存 Lua 文件比较未发现修改；Store 的活动/商品投影增加 category，未更改库存写入逻辑。独立运行的 MySQL 测试确认 100 个竞争请求恰好 10 个成功、重复请求/业务键不漏库存、失败 tombstone 阻止晚到事件、取消只返还一次、UTC outbox；Redis 测试覆盖并发预占不超卖、payload 冲突、非法 Stream 类型、元数据缺失时拒绝、重复预热不重置预占、释放幂等、日志命令及服务器时间。

目录 seeder 的正常路径不对运行中活动做全量重置；原有 14 项离线 Python 测试通过。前端原有目录/状态测试通过，覆盖分类回退、场次筛选、售罄和结束状态。**这些验证支持底层原有行为，仍不足以宣称 V0–V3 整体兼容验收完成。** 未执行完整 Kafka V3 消费→订单→补偿端到端、gateway+业务 HTTP 全链路、V0/V1/V2/V3 各版本压力/故障注入。V0 的教学并发特性也不能被本次目录改动解释为已获得新的强一致保证。

## GitHub 检查结果

| 查询 | 本次实际返回 | 解读 |
|---|---|---|
| HEAD combined commit status | `statuses=[]`，`total_count=0`，aggregate `pending` | 零个上下文的 pending 不代表某个 CI 正在运行 |
| HEAD check-runs | `total_count=0` | 没有查询到检查结果 |
| 主仓库 Actions，过滤 HEAD | `total_count=0` | 没有查询到该提交的工作流执行 |
| PR 合成 merge SHA 的 check-runs / Actions | 两者 `total_count=0` | 同时检查测试合并对象，避免只看 HEAD status |
| fork Actions，过滤 HEAD | `total_count=0` | fork 也没有查到对应执行 |
| 已提交 PR reviews | `reviews=[]` | 当前无已提交 Review |
| HEAD 的 `.github` Git tree | 无跟踪文件 | 没有看到仓库自带工作流配置 |
| GitHub mergeability | `mergeable=true`、`clean` | 仅说明可合并状态，不是正确性或测试合格证明 |

接口 URL 与响应摘要见补丁包 `evidence/github-snapshot.json`。上述证据不能排除未接入 GitHub 的外部人工流水线，但目前没有可用于合并的 GitHub CI 成功证据。README 第 18 行的 57 项 API、21 项目录、7 项不变量及实屏记录属于提交者已有证据，本次未将其记为独立执行通过。

## 本次独立执行结果

| 对象 | 原 HEAD | 本地候选补丁 | 范围与限制 |
|---|---|---|---|
| 前端 `npm test` | 69/69 通过 | **86/86 通过** | 新增会话 4、运动策略 2、WebGL 11 项；浏览器边界模拟范围已说明 |
| 前端 `npm run build` | 通过 | **通过** | vue-tsc 与 Vite 构建，执行退出码 0；不代表实机性能 |
| 后端原有测试，启用 MySQL/Redis | **21 通过、1 V4 跳过** | **24 通过、1 V4 跳过** | 新增类别并发 1、旧 schema 迁移 2；没有把 skip 计为通过 |
| Gateway Maven 测试 | **3/3 通过** | 代码未变 | 策略单测，未执行整条反向代理 HTTP 链路 |
| `scripts/tests` Python | **14/14 通过** | 代码未变 | 离线目录脚本测试，不是目录业务 HTTP 检查 |
| 新类别并发回归 | **真实 MySQL 失败** | **通过** | 原 HEAD 将“旅行出行”覆盖为“居家生活” |
| 新前端回归在原 HEAD 控制副本 | 失败，详见 RED 日志 | 上述 86 项中通过 | 控制副本从 Git HEAD 导出源码，只复制新增测试与依赖链接 |
| 补丁 `git apply --check`、文件一致性 | 不适用 | 交付前验证 | 见补丁包 verification.json |
| PR 整体 `git diff --check BASE HEAD` | **失败，退出码 2** | 候选新增差异检查通过 | 远程 PR 中 shader、许可证文本、文档存在空白问题；属 P3 整理项 |

环境：Java 17.0.20、Maven 3.9.11、Node/Vite 版本见包内记录；临时 MySQL **8.0.46**、Redis **7.0.15**。仓库 compose 声明 MySQL 8.0.30、Redis 7.4.2，本次没有在完全相同版本上复跑，部署验收需补齐。受环境限制，Mockito 默认自附加 agent 曾导致 4 项错误；显式预加载 `mockito-core-5.17.0.jar` 后单测及真实集成测试通过，未把环境附加失败列为产品缺陷。

浏览器二进制获取失败，因此 **未执行**真实 BFCache、桌面/手机触控、WebGL 实际上下文恢复、实机显存/FPS、弱网首屏验收。最终构建门户入口 JS 约 875.50 kB（gzip 219.33 kB），业务入口约 931.76 kB（gzip 301.63 kB）；public 总体积约 70 MB 只表示资源集合，不等于一次首屏下载。建议后续实测加载预算并评估首屏 WebGL 的延后加载。

## 补丁及复测方式

交付包 `PeakRush_PR1_Patches_Tests_20261009.zip` 包含三份补丁、合并补丁、新增测试、原 HEAD/候选执行日志、GitHub 快照及校验摘要。补丁以固定 HEAD 为起点；不要对已变更的后续 HEAD 直接视作已经审查通过。

```bash
# 在检出 70ca5d061250e18421a9c3fba3a13f9c947054af 的干净副本中：
git apply --check /path/to/patches/all-fixes.patch
git apply /path/to/patches/all-fixes.patch
cd frontend
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run build
# 仓库根目录：
python3 -m unittest discover -s scripts/tests -v
```

后端测试需要专用 MySQL/Redis，设置 `PEAKRUSH_INTEGRATION_TESTS=true`、`DB_URL`、`DB_USER`、`DB_PASSWORD` 和 Redis 端口（原测试默认 13306/16379）。旧 schema 测试另外设置 `PEAKRUSH_MIGRATION_TESTS=true`、`REVIEW_DB_ADMIN_URL`，后者须为空数据库路径，例如 `jdbc:mysql://127.0.0.1:13306/?serverTimezone=UTC`，账号只在专用测试实例拥有创建随机测试库的权限。本次执行使用预加载 Mockito agent；一般支持自附加的开发环境可按仓库普通 `mvn test` 执行。

**合并门槛：** 将 R1–R4 修复及对应测试纳入 PR；一并处理已提供的 R5–R7 修复；为最终 HEAD 建立可追溯的 CI 测试/构建成功结果；在声明部署版本和目标浏览器完成旧数据库启动、登录切换/失效、WebGL 路由循环与降级、V0–V3 下单/取消/退款/幂等及 Kafka 补偿验收。满足这些条件后再复核合并决定。当前本地测试通过，不改变远程未修复 PR 的不合并结论。
