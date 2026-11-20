# PeakRush V4 PR #2 审查结果

结论：**建议请求修改，暂不批准或合并**。已确认两项 P2 问题；核心业务与数据兼容性验证通过，前端测试仍有 3 项失败。

提交状态：GitHub 连接器创建 REQUEST_CHANGES Review 返回 403（Resource not accessible by integration），没有创建正式 Review。浏览器回退被 Computer Use 停止，原因是无法可靠确认 Windows 浏览器当前 URL，不能执行后续页面操作。本地报告与证据已完整保存，PR 保持未批准、未合并。

- PR：https://github.com/sherlockfeng07-ui/PeakRush/pull/2
- BASE：`415a6f83fd60e8173c3ab143dc4700c6201a6671`
- HEAD：`f29db4add923c61bc13c2728dbfe4663a6ad4f75`
- 时间：2026-11-02（北京时间）。
- 范围：35 个提交、468 个变更文件。审查副本 559 个 Git blob 已逐一校验，全部与该 HEAD 一致；原工作区 main 文件保持干净。

## 必须修改

1. **P2：切换到规则、隐私等页面时保留旧滚动位置。** `frontend/welcome/app/App.vue:59–60` 仅在前后页面包含五个 editorial 页面之一时重置共用滚动容器。从首页底部打开“使用规则”，会保留原 scrollTop，实际浏览器可能将其限制到新页面底部，跳过正文开头；规则页跳隐私页也一样。执行真实 App setup 与 Vue 的诊断观察到 home→terms 保留 6000、terms→privacy 保留 800，而 privacy→pricing 重置为 0。请将这些普通跨页面导航纳入滚动策略，并验证首页页脚→规则→隐私→返回首页的行为。证据：`navigation-reproduction.json`。

2. **P2：WebGL 生命周期测试存在异步等待和清理竞态。** `frontend/tests/helpers/welcome-harness.mjs:139` 的十次 setImmediate 不能保证磁盘动态 import 完成；`mountApp:144` 提前返回后，测试观察到 0 个 renderer，而非预期的 6/1 个。`clean:164–168` 随后删除尚在加载的临时模块，产生缺失 lenis.mjs 的未处理拒绝。完整 npm test 和独立 welcome-webgl 测试均复现。独立诊断中，明确等待 motion/createMotionRuntime.ts 后可以创建 renderer 和 Lenis，说明这是**测试可靠性问题，不能据此声称页面生命周期本身损坏**。请等待明确的导入/就绪信号，并在断言失败时保证卸载 App、结束未完成导入后再删目录。证据：`frontend-test-full.log`、`welcome-test.log`。

## 实际验证

| 验证 | 结果 |
|---|---|
| 后端 mvn verify，JDK17，集成/迁移/V4 三个开关全部开启 | 26 通过，0 失败，0 跳过 |
| 网关 mvn verify | 3 通过；构建成功 |
| 前端 npm test，Node22.17.1，npm ci 按锁文件安装 | 87 项：84 通过、3 失败（上述 P2） |
| 前端 npm run build | vue-tsc 与 Vite 生产构建通过 |
| Python 目录脚本离线测试 | 14 通过 |
| 真实 gateway→backend→MySQL/Redis/Kafka API 验收，V0–V4 | 71 项检查全部通过 |
| 验收后数据库不变量 | 7 项全部通过，违反数均为 0 |
| V4 小规模负载冒烟 | 20 用户、20 请求、10 库存：10 PENDING 最终均 SUCCESS，另 10 SOLD_OUT，无 5xx/网络错误 |

集成环境为独立端口的 MySQL 8.0.30、Redis 5.0.9、Kafka 4.3.0，以及 JDK17；未使用原业务数据库。测试服务已经清理，旧业务文件没有修改。

旧库迁移测试使用旧 schema 构造商品、订单、请求、库存日志和 outbox，检查新增分类、重复/并发迁移后原业务行保持一致。旧格式商品 PUT 省略 category 的并发更新测试通过。V0–V4 每版均完成 100 买家争抢 10 库存，以及取消回补、重复取消、支付、请求幂等、不同 payload 冲突、限购、预热不覆盖库存、订单归属检查。V4 Stream 测试覆盖新事件、遗留 PEL 接管、Kafka 确认后 ACK 和重复落单幂等。

## 验证边界和后续建议

- 上述 V4 负载只是功能冒烟，不证明 2000 用户、1000 QPS 或生产容量。原 PR 未提供可定位到本 HEAD 的 V4 专属压测报告；本次生成的新数据保存在本地审查目录 `load-smoke/`。
- GitHub 当前 HEAD 的 check-runs、状态检查均为空；新增 CI 明确设置 `PEAKRUSH_V4_TESTS: 'false'`，没有 Kafka 服务。建议补入 Kafka 并启用 V4，修复前端测试后再取得该 HEAD 后续版本的绿色 CI。
- 门户已登录用户访问 signin/signup 不执行规格中的自动回业务页；自定义滚动条样式变量没有绑定到模板。这两项为补充静态发现，本次阻塞结论以以上两项已复现 P2 为依据。
- 本次没有声称完成全部视觉/GPU/移动端或长时间故障注入验收。旧 /orders 与 /admin 迁移到 /app/ 是规格中的明确设计，未按意外回归报告。

原始证据位于本文件同目录：`backend-integration.log`、`verification-api-V0-V4.json`、`verification-invariants.json`、`load-smoke/`、`frontend-test-full.log`、`navigation-reproduction.json`、`verification-source.json`。

