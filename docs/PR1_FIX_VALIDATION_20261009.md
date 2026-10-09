# PR1 修复与验证记录（2026-10-09）

已根据 `PeakRush_PR1_Review_20261009.md` 完成 R1–R7 的本地代码修复，补充回归测试和 GitHub Actions 配置。当前起点是本地 `a1e94ac8937080e40305f9f577a8ace94c5b49dd`，与原报告固定的远程 HEAD 不同，因此采用逐项源码核验与修复。未提交、推送、合并或发布。

## 修复对应关系

| 项目 | 修改与结果 | 主要文件/回归 |
| --- | --- | --- |
| R1 | 移除 sceneRegistry 自动挂载副作用；App 唯一装配首页场景。离开、减少动画或销毁时先清理场景注册表再销毁运行时，异步导入有版本保护；检查 host/画布身份，释放监听器和纹理引用，按 host 尺寸更新范围 | `frontend/welcome/app/App.vue`、`webgl/mountScenes.ts`、`motion/createMotionRuntime.ts`；`welcome-webgl.test.mjs` |
| R2 | 更新时省略 category 绑定 SQL NULL，`COALESCE(?,category)` 保留执行时的分类；创建默认值、显式 null 重置和分类校验保持兼容 | `backend/.../Store.java`；`CatalogLegacyConcurrencyTest`、`CatalogProductsIntegrationTest` |
| R3 | persisted pageshow 重新核验身份，换 token 或删除 token 清空旧用户；响应只有仍属于当前 token 才能更新身份；同 token 临时 503 保留用户 | `frontend/src/session.ts`；新增四项 session 回归 |
| R4 | 纹理加载成功并实际绘制成功后才隐藏备用图；初始化、加载、绘制失败或上下文丢失继续展示备用图；恢复绘制后重新揭示画布。轮播与 connectory 增加已有商品图备用内容 | `webgl/createWebGLHost.ts`、各场景控制器、`mountScenes.ts`、两个首页组件；WebGL 回归 |
| R5 | Lenis 取消惯性后恢复未锁定状态，减少动画时关闭 smoothWheel；App 释放装饰场景，让页面保持原生滚动 | `motion/createMotionRuntime.ts`、`App.vue`；`motion-preference.test.mjs` |
| R6 | 实际 BrushLink 按钮转发步骤；控制器发布选中索引，Vue 同步禁用状态及备用图；拖动、重建和监听器释放覆盖回归 | `HomeTestimonials.vue`、`createTestimonialCarousel.ts`；真实 Vue/BrushLink 模板回归 |
| R7 | 按 URL 与颜色模式缓存、就绪检查和计数，各场景按相同模式释放纹理 | `textureRegistry.ts`、场景控制器；颜色模式隔离与引用释放回归 |
| G1 | 新增 PR/push/manual 的前端、后端、网关、Python CI；后端使用 MySQL 8.0.30 / Redis 7.4.2 专用服务并初始化 schema、启用旧库迁移测试 | `.github/workflows/ci.yml` |

新增旧 schema fixture 来自仓库提交 `415a6f8`。迁移测试创建并删除随机专用数据库，验证旧业务列逐字段保留、重复及并发迁移，以及库存 `8 + 2 = 10`。Redis/Kafka 测试增加环境变量配置，原默认端口保留。

## 本次执行结果

| 检查 | 结果 | 说明 |
| --- | --- | --- |
| 前端 `npm test` | 87/87 通过 | 原 69 项，新增会话 4 项、WebGL/运动/实际组件绑定 14 项 |
| 前端 `npm run build` | 通过，退出 0 | vue-tsc + Vite；门户入口约 874.83 kB / gzip 219.14 kB |
| 后端 Maven 全套测试 | 25 通过、V4 1 跳过 | 主代理独立复跑，MySQL 8.0.30 / Redis 7.4.2；跳过不计为通过 |
| 后端额外完整验证/独立打包 | 26/26 通过，verify 退出 0 | 子代理另启用 V4，使用专用 Kafka 4.3.0；V4 不是本次新增交付能力 |
| Gateway Maven `verify` | 3/3 通过，打包成功 | 原策略测试 |
| Python `scripts/tests` | 14/14 通过 | 原目录脚本离线回归 |
| 真实 gateway→backend API 验收 | 57/57 通过 | V0–V3 各 100 买家恰好 10 成功，取消、回补、模拟支付、幂等、限购及订单权限；V3 使用真实 Kafka |
| 真实 SQL 不变量 | 7/7 通过 | 库存守恒、重复订单、支付/请求/释放日志对应关系均零违规 |
| 真实 Gateway admission | 通过 | 45 请求中 25 次限流，窗口恢复返回 403 而非 429，篡改 token 返回 401 |
| 旧库完整 Spring Boot 启动 | 通过 | 专用旧 schema 初始无 category；启动后迁移完成、默认分类为“其他好物”、健康检查 UP、演示数据初始化成功 |
| 独立代码复审 | 未发现新的确定性缺陷 | 独立执行会话、运动和 WebGL 27 项回归通过 |
| CI 文件 | YAML 结构与官方 Action tags 已核验 | 尚未在 GitHub 执行，不能计为远程 HEAD 的成功记录 |
| 本次 `git diff --check` | 通过 | Git 的 LF→CRLF 提示属于当前 Windows checkout 配置 |

RED 证据：新增类别并发回归在修复前的真实 MySQL 上失败；四项会话回归在原模块上失败；14 项首页回归在从原 HEAD 导出的控制副本上全部按预期失败，修复后通过。

本次版本：Node 24.11.1、npm 11.6.2、JDK 17.0.2、Maven 3.9.11、Python 3.14.3；专用 Docker MySQL 8.0.30、Redis 7.4.2、Kafka 4.3.0。CI 配置 Node 22、Java 17、Python 3.13，使用官方 [checkout](https://github.com/actions/checkout)、[setup-node](https://github.com/actions/setup-node)、[setup-java](https://github.com/actions/setup-java)、[setup-python](https://github.com/actions/setup-python)。

## 浏览器检查与边界

使用 Codex 内置浏览器访问运行中的 Vite 开发服务 `http://127.0.0.1:5400/`，1280 × 720。

- 首页 → 登录页 → 首页：离开后 DOM 无画布，返回重新创建 6 个画布，hero 达到 live 并实际显示商品图。
- 首页 → 关于我们 → 首页：说明页无画布，返回重新绘制；干净页面控制台没有 error/warn，页面非空白，无 Vite 错误浮层。
- 使用原生可访问控件点击轮播 Next：索引从 0 变为 1，Previous 启用；点击 Previous 回到 0 并禁用。绘制画面和实际 DOM 状态均已核验。
- 实际滚动可进入后续章节，画面正常。

开发时中间文件热更新曾出现旧 `scenes` 变量的 HMR 错误，完整重新加载稳定源码后消失。内置浏览器的 locator click 曾只滚动而未激活轮播按钮，改用原生可访问控件点击后验证通过；未据此修改产品代码。

自动首页测试执行实际 TS 场景、Three 几何/材质及 Vue/BrushLink 模板；GPU、DOM 布局、图片交付和 Lenis 浏览器边界使用替身。无 WebGL、纹理失败/延迟、减少动画切换、contextlost→restore、拖动、迟到导入及资源计数属于该模拟范围。尚未完成真实 BFCache 恢复、系统减少动画偏好切换、真实 GPU 上下文恢复、手机触控、显存/FPS、弱网加载预算或生产压测。

## 本机运行与复测

原后端 PID 4988 在 9081 端口持有 `backend/target/peakrush-backend-1.0.0.jar`，普通 verify 的 repackage 遇到 Windows 文件锁。为保留原进程，使用临时 POM 和独立输出完成新包构建，再在专用数据库上启动并验收。可执行包保存在 `.runtime/review-backend-target/peakrush-backend-review.jar`。

8080/8081 位于 Windows 系统排除端口区间，专用验收进程改用 gateway 12880 / backend 12881。该变化仅存在忽略的测试脚本中。原运行进程、数据库和四个既有未提交文件未被改写；测试结束清理本次专用进程及容器。

源码修复要在原后端服务上生效，需要停止原进程后重新构建并启动；本次没有替换正在运行的旧后端。

常规复测：

```powershell
cd frontend
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run build
cd ..
python -m unittest discover -s scripts/tests -v
mvn -f gateway/pom.xml verify
# 先为专用 MySQL 测试库导入 backend/src/main/resources/schema.sql
# 设置 DB_URL / DB_USER / DB_PASSWORD / REDIS_HOST / REDIS_PORT
$env:PEAKRUSH_INTEGRATION_TESTS='true'
$env:PEAKRUSH_MIGRATION_TESTS='true'
# REVIEW_DB_ADMIN_URL 必须指向专用测试实例、数据库路径为空；需创建/删除随机库权限
mvn -f backend/pom.xml verify
```

本地详细日志和验收数据位于 `.runtime/pr1-*`；首页控制副本 RED 与 GREEN 日志位于 `output/welcome-regressions-red.log`、`output/frontend-tests-green.log`、`output/frontend-build-green.log`。这些文件遵循仓库忽略规则，不作为远程 CI 记录。

G1 仍需补齐提交后 GitHub 对最终 HEAD 的执行结果和上述未执行实机验收。文档列出的历史 protected API 迟到 401、禁用 localStorage、跨标签页同步和令牌存储/撤销策略没有扩大到本次 R1–R7 修复范围。
