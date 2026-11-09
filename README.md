# PeakRush 高并发抢购课设 · V5

V5 是 2026-11-02 的交付版本：在 V4 的 Redis Stream 异步落单与实时指标之上，完成 V4 审查整改、Stream 条目压缩、bridge 故障恢复优化和压测快照收敛。V0–V4 仍是可创建的活动架构版本；**V5 是项目整体发布版本，不新增 V5 活动协议**。

2026-11-07 完成 PR #3 评审整改收尾：补齐 bridge 故障隔离回归、压测门禁默认强制、CI 证据上传、网关限流测试和四类故障演练 RUNBOOK。

## V5 更新

| 领域 | 本次完成 |
| --- | --- |
| 前端导航 | 所有路由切换都会把共享滚动容器归零，覆盖普通页与 editorial 页；滚动条 thumb/position 已绑定样式 |
| 前端测试 | WebGL harness 跟踪真实动态 import，`clean` 先卸载 App、等待导入结束再删临时目录；新增跨页滚动回归测试，`npm test` 88/88 |
| 登录页 | 已登录访问 `/signin`、`/signup` 直接跳 `safeRedirect(redirect)`（默认 `/app/`），不渲染表单 |
| V4 bridge | Kafka 发送按 32 条分块并发等待；单条流发送失败不再跳过其他活动；ACK 后 XDEL 已处理条目，未确认条目继续留在 PEL 可恢复 |
| 监控 | V4 消费组尚未创建时只忽略 `NOGROUP`，不再让 Redis 指标整体不可用；事件量统计改为当前 Stream 条目数 |
| 压测脚本 | 订单终态后等待 `pendingReservations` 与 `outbox` 收敛（最多 45 秒）再取最终指标，报告新增 `convergence` 字段 |
| 启动脚本 | 修复 PowerShell 5.1 下 `app-stop.ps1` 对 JSON 数组的嵌套解析，停止服务不再静默失败 |

## 2026-11-07 收尾整改

| 领域 | 现状与边界 |
| --- | --- |
| bridge 故障隔离 | 按活动、按记录分别隔离：单条坏记录、同步 producer 异常、单个 Stream 读写异常都不会让其他活动整轮跳过；未确认条目保留在 PEL 中等待恢复 |
| 发送并发上限 | 每个 Workers 实例用 Semaphore 限制为 32 个未完成发送；claim 与 XREADGROUP 都以当前可用名额为上限，名额为 0 时既不 claim 也不读取。单轮软预算 256 条 / 5 秒（按批检查，单批可能超出），同时 inFlight 跟踪达到 64 条时本轮暂停 claim/read 形成背压；失败记录不阻塞同轮新消息读取。等待 12 秒超时后不归还名额，只有 Kafka 发送真正完成才释放；成功结果按 32 条分批进入 Lua 确认，超时后完成的 Future 只补确认、不重发 |
| 接管保护 | 未完成发送按 `(stream, recordId)` 跟踪，在每轮开始、每条 `enqueue` 前后以及 `awaitSends` 分段等待期间按 1 秒间隔续租；续租前逐条 `XPENDING` 精确校验条目仍归本消费者所有，已被接管的条目不再抢回。`claim-idle-seconds` 默认 20 秒只用于覆盖“单次同步阻塞 3 秒 + 确认”，不覆盖整批等待；Kafka ACK 后的故障暂停被钳制在 `claim-idle-seconds - 12s`（默认 8 秒）以内。`pauseBridge` 暂停交付时仍保留续租，暂停不等于安全 drain |
| 至少一次窗口 | 进程停顿（如长 GC）超过 `claim-idle-seconds`，或 Redis 确认持续失败导致条目被其他实例接管时，同一 `requestId` 可能被重复投递；业务侧以稳定 `requestId` 幂等约束订单与库存唯一性 |
| ACK/DEL 原子化 | `ack_delete.lua` 先对 `0-0` 执行空操作 `XDEL` 预校验命令/键/类型，再在同一脚本内 `XACK` + `XDEL`；XACK 或 XDEL 失败时条目仍留在 PEL，可再次恢复 |
| claim 阈值 | `peakrush.bridge.claim-idle-seconds` 默认 20 秒，用于覆盖逐条同步发送最长阻塞（`max.block.ms=3000`）与 Redis 确认，而不是覆盖整批 12 秒等待（等待期间已分段续租）。故障暂停必须小于 `claim-idle-seconds - 12s`，否则条目会在确认前被接管；仅大于 `delivery.timeout.ms`（10000）不足以避免存活实例被提前接管 |
| 接管演练判据 | 实例可用 `BRIDGE_INSTANCE_NAME` 设置稳定名（consumer 为 `bridge-<name>`，未设置为随机 UUID）。接管时输出 `Stream ... claimed ... consumer=bridge-<name> firstId=...`；演练只认该 consumer 名与演练前记录的“另一实例”稳定名一致，同名重启不算接管 |
| XPENDING 轮转 | 单次只取 256 条 PEL，并按每个流的游标轮转扫描，避免第 256 条之后的陈旧条目永远得不到处理 |
| 指标缺失 | `Admin.metrics` 在 Redis 读取失败时把 `pendingReservations` 置为 `null`，不再默认 0；收敛校验把 `null` 判为“未知/未收敛”，不允许误报收敛 |
| 压测门禁 | `verification_load.py` 默认启用 `--require-targets`，未达标即 exit 1；targets 覆盖 QPS、P95、错误率、收敛、数据库库存守恒、Redis 投影一致和订单终态 `ordersTerminal`；`gate_report.py` 只对当前脚本新生成、带 `targets` 的报告生效，`artifacts/` 下 V4 历史报告不参与门禁 |
| 网关降级 | Redis 不可用时购买入口快速返回 503 `ADMISSION_UNAVAILABLE`，不把下游请求误判为成功；Lua 限流与 503 路径均有测试覆盖 |
| CI 与演练 | CI 增加 Redis/Kafka 服务、慢用例独立步骤和失败也上传的证据；四类故障演练写入 [RUNBOOK.md](RUNBOOK.md) |

## 已实现的阶段

| 阶段 | 实现与对比重点 |
| --- | --- |
| V0 | MySQL 事务与行锁，同步扣库存、创建订单 |
| V1 | 条件更新库存、唯一约束和请求幂等 |
| V2 | Redis Lua 原子资格校验、库存预占，同步落单与补偿 |
| V3 | Kafka 异步落单、PENDING 结果轮询、重复消费幂等；Gateway 限流、动态路径、售罄短路 |
| V4 | Redis Stream 事件日志、PEL/XCLAIM 恢复、Kafka 确认后 ACK、Stream 实时指标；V5 主链路 |
| V5 | 交付版本：上述可靠性整改与压测证据，不改变 V0–V4 活动协议 |

完整业务包括注册登录、商品与活动管理、活动预热与上下线、限购、订单查询、模拟支付、取消与超时关闭、库存回补、监控和实验报告。一个用户在同一活动的同一商品只能下一单；取消归还库存，但不恢复购买资格。支付仅模拟，不产生真实扣款。

## 报告任务补充交付

详见 [本次完成说明](docs/REPORT_COMPLETION.md) 和 [课程实验说明](docs/COURSE_LABS.md)。课程套件覆盖竞态与互斥、真实死锁栈、wait/notify 与 Condition、同步工具、有界线程池及同负载对照、并发容器、ThreadLocal 清理、串行与异步接口组合，以及真实 TCP 阻塞 I/O 的平台/虚拟线程对照。独立课程进程使用 JDK17/23 验证，业务后端仍使用 JDK17。

```powershell
.\scripts\verify_course_labs.ps1
# 应用健康后，创建或恢复目录场次；不重置历史库存、不下线历史活动
python scripts/seed_catalog.py
python scripts/verification_catalog.py
```

商品目录包括耳机、相机、手表、咖啡机、音箱、机械键盘、台灯、越野鞋和登机箱，业务页支持数码影音、居家生活、运动户外、旅行出行分类筛选。

## 当前机器启动

在 PowerShell 中进入项目根执行：

```powershell
. .\依赖环境\env.ps1                     # 仅当前会话；JDK17、Maven、Redis、Kafka 均在 G 盘
.\scripts\runtime-start.ps1              # MySQL 13306 + Redis 16379 + Kafka 19092
.\scripts\app-start.ps1 -SkipInfra       # backend 8081 + gateway 8080 + frontend 5400
```

> `依赖环境/` 是本开发机的私有包装目录（JDK/Maven/Redis/Kafka 二进制与 `env.ps1`），**未纳入仓库且无法从仓库获取**。fresh clone 请跳过上面第 1 步，直接设置 `PEAKRUSH_JAVA_HOME`、`PEAKRUSH_MYSQL_BIN`、`PEAKRUSH_REDIS_BIN`、`PEAKRUSH_KAFKA_HOME` 等变量（变量名见 `scripts/runtime-start.ps1` 顶部），或改用本机已运行的服务并通过 `DB_URL` / `REDIS_HOST` / `KAFKA_BOOTSTRAP_SERVERS` 覆盖。`scripts/runtime-start.ps1`、`scripts/app-start.ps1`、`scripts/app-stop.ps1` 本身都在仓库内，不依赖 `依赖环境/`。

首次启动或修改代码后去掉 `-SkipBuild`（会执行 Maven、`npm ci` 与前端构建）。打开 [本地页面](http://127.0.0.1:5400/)；业务页为 http://127.0.0.1:5400/app/。

收尾验收使用显式端口：backend 18081、gateway 18080，backend 额外启用 `local,lab` 故障开关。用 `.\scripts\app-start.ps1 -BackendPort 18081 -GatewayPort 18080 -Lab -SkipInfra` 启动，压测脚本加 `--base http://127.0.0.1:18080`；`app-start.ps1` 的默认端口仍是 8080/8081。

| 角色 | 账号 | 密码 |
| --- | --- | --- |
| 演示用户 | demo | demo12345 |
| 管理员 | admin | admin12345 |

管理员登录后可进入「管理工作台」，创建 V0–V4 活动，依次预热、启用。未来开始时间的活动会保持等待开抢；演示活动过期后请创建新活动，不要重置已有库存。

停止应用（保留数据）：

```powershell
.\scripts\app-stop.ps1
# 停止应用与本项目启动的 Redis/Kafka（带归属校验，不触碰系统 MySQL 服务）：
.\依赖环境\stop-all.ps1
```

所有服务面向本机开发，绑定回环地址。默认应用端口为 5400 / 8080 / 8081；依赖端口为 MySQL **13306**、Redis 16379、Kafka 19092/19093（由 `scripts/runtime-start.ps1` 启动，应用默认 `DB_URL` 即指向 127.0.0.1:13306）。本机系统 MySQL 8.1 仍占用 3306，只有显式覆盖 `DB_URL` 时应用才会连 3306，默认口径不依赖它。数据和日志位于 `.runtime/`；不复用既有 Kafka 数据目录。端口口径以本节为准；[启动指导](docs/STARTUP_GUIDE.md) 里 MySQL 3306 / `依赖环境/start-runtime.ps1` 的描述是早期本机口径，属历史说明。

## 验证与实测

2026-11-02 V5 本机验证结果（历史基线，保留）：

| 验证 | 结果 |
| --- | --- |
| 后端 `mvn package`（集成开关关闭） | 构建通过；InputRules 2 + ProductCategory 4 = 6 项通过，集成/迁移/V4 共 12 项按开关跳过 |
| 网关 `mvn verify` | 3 项策略测试通过，构建成功 |
| 前端 `npm test` / `npm run build` | 88 项全部通过；`vue-tsc` 与 Vite 生产构建通过 |
| 真实浏览器回归 | 首页页脚 → 平台使用规则 → 隐私说明 → 返回首页，每次切换后共享容器 `scrollTop=0` |
| V4 持续负载 | 2000 用户、1100 RPS、30 秒、1000 库存：33000 请求，1098.2 QPS，P50 22.0 ms，P95 40.76 ms，P99 53.89 ms，0 个 5xx/网络错误，0 次限流，1000/1000 订单 SUCCESS |
| V4 突发负载 | 2000 请求一次性释放、1000 库存：P50 1449.14 ms，P95 1899.70 ms，788 次 429、212 次 SOLD_OUT，0 个 5xx/网络错误，1000/1000 订单 SUCCESS |
| 数据一致性 | 库存 1000 = 数据库可用 0 + 订单占用 1000；1000 个不同买家、0 个重复用户；1000 条请求 SUCCESS；outbox DONE 1000；Stream XLEN 0、XPENDING 0；Kafka lag 0；死信 0 |
| 收敛时间 | 持续场景 0.433 秒；突发场景 19.349 秒（等待 Redis 投影与 outbox 全部落盘后再取指标） |

证据：[V4 持续压测](artifacts/load-V4-1793608514.json)、[V4 突发压测](artifacts/load-V4-1793608594.json)。

> 这两份是 V4 历史基线报告，只用于对照，**不参与验收门禁**：它们没有当前脚本的 `targets` 字段，`gate_report.py` 对它们实跑会 exit 1（持续报告缺 `targets.passed`，突发报告 qps/p95 不达标）。门禁只对 `verification_load.py` 新生成、带完整 `targets` 的报告生效。

### 2026-11-07 收尾验证（本地）

| 范围 | 结果 |
| --- | --- |
| backend 单元（不启用集成开关） | 37 项，执行 6、跳过 31，BUILD SUCCESS |
| backend Redis 集成 | `RedisReliabilityTest` 8 + `StreamBridgeFaultIsolationTest` 11 = 19/19 通过 |
| 慢用例 | 跨 12 秒发送超时保容量 1/1 通过，约 14.15 秒；用 `@Tag("slow")` 隔离，常规测试集默认排除 |
| gateway | `GatewayPolicyTest` 3 + `PurchaseLimitFilterTest` 2 = 5/5 通过（含真实 Lettuce Redis 下的 Lua 限流与 Redis 故障 503） |
| Python 脚本 | `python -m unittest discover -s scripts/tests` 共 45 项全部通过 |
| frontend | `npm test` 88/88；`npm run build` 通过（`vue-tsc` + Vite） |
| backend `mvn verify` | 跳过 repackage 时 BUILD SUCCESS；本机 plain `verify` 因主栈 backend 正锁定 `peakrush-backend-1.0.0.jar` 无法重命名 `.original`，属文件锁而非代码失败 |

**只能由 CI 覆盖**：依赖真实 Kafka + MySQL 的 `StreamBridgeIntegrationTest`（V4 端到端）、三个 service 容器的启动与健康检查、slow 标签步骤。本地已用隔离 Redis 覆盖其余 bridge 与限流路径。

### 2026-11-09 PR3 增量修复验证（本地隔离依赖）

| 范围 | 结果 |
| --- | --- |
| `StreamBridgeFaultIsolationTest` 常规 | 15/15 通过（含容量为 0 不 claim、坏记录不阻塞同轮新读、已被接管的条目不续租抢回、ACK 后暂停超上限被拒绝） |
| `StreamBridgeFaultIsolationTest` slow | 2/2 通过，28.38 秒（含超时后成功 Future 只补确认不重发、默认 20 秒下 B 不接管） |
| backend 全量（跳过 slow） | 41 项全部通过，0 失败、0 跳过（启用 Kafka/MySQL/迁移/Redis 开关） |
| 真实 Kafka 4.3.0 + MySQL 8.1（本机 3306）+ Redis 7.4.2 | `StreamBridgeIntegrationTest` 1/1、`CatalogLegacyMigrationTest` 2/2 通过 |
| Python 脚本（真实 Redis 7.4.2） | 51/51 通过，0 跳过 |

### 2026-11-07 多进程突发复验（新口径）

口径先说明：旧基线是单进程 aiohttp、全部请求同源 127.0.0.1、无连接预热，2000 个 barrier 任务在同一事件循环内创建，P95 含 429。新口径用 4–8 个独立压测进程绑定不同源 IP，按同一 epoch 绝对时刻触发 barrier；barrier 前用 `GET /api/seckill/activities/{id}` 预热 keep-alive 连接，barrier 时刻只发 POST。`admitted` 只统计 HTTP 200（含业务 PENDING/SOLD_OUT），`all` 含 429/500，客户端调度延迟单列。

| 场景 | 请求 | 200 准入 | 429 | 500 | QPS | admitted P95 | all P95 | 错误率 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 稳态 1000 RPS×30s | 30000 | 16400 | 0 | 0 | 999.43 | 23.79ms | 23.30ms | 0% |
| 稳态 1100 RPS×30s | 33000 | 19042 | 0 | 0 | 1099.49 | 25.03ms | 24.85ms | 0% |
| 突发 2000 / 8 IP 第 1 轮（冷 JVM） | 2000 | 1500 | 500 | 0 | 3007.52 | 490.14ms | 549.12ms | 0% |
| 突发 2000 / 8 IP 第 2 轮 | 2000 | 1500 | 500 | 0 | 4672.90 | 304.63ms | 303.85ms | 0% |
| 突发 2000 / 8 IP 第 3 轮 | 2000 | 1448 | 500 | 52 | 4608.29 | 344.39ms | 340.79ms | 2.6% |
| 突发 2000 / 直连后端（无网关） | 2000 | 2000 | — | 0 | 5899.71 | 261.26ms | 261.26ms | 0% |
| 突发 2000 / 关闭网关限流 | 2000 | 1891 | — | 109 | 2159.83 | 802.82ms | 801.31ms | 5.45% |

每轮均在收敛后取值：`pendingReservations=0`、`v4StreamEvents/v4StreamPending=0`、`outboxPending=0`、Kafka lag 0；库存 1000 = 可用 0 + 订单占用 1000，订单恰好 1000 条 SUCCESS 且 `request_id` 无重复。稳态表中的 409 是“重复购买”业务拒绝，不计入订单。

按 RUNBOOK 6.1 的结论表述：**业务准入 P95 为 490.14 / 304.63 / 344.39ms（3 轮），三次都低于 500ms，但贴边且不稳定；冷 JVM 下含 429 的全量口径 P95 为 549.12ms 超阈值，第 3 轮错误率 2.6% 也超过 1%。因此不能笼统写“已达标”，旧的单进程 `p95Below500ms=false` 结论保留。** 瓶颈在网关限流整形（单 IP 1200/s、全局 1500/s）与压测端调度/连接建立：直连后端 2000 并发全部准入、P95 257.82–261.26ms，关闭限流反而升到 716–803ms。详见 [RUNBOOK](RUNBOOK.md) 6.1 与 `G:\高并发大作业项目\临时数据文件目录\PeakRush-20261107\mp\` 下的原始报告。

**验证边界**：测试运行在单台 Windows 主机，压测器、网关、后端、MySQL、Redis、Kafka 共享 CPU 与磁盘；这不是生产容量承诺。旧口径突发场景 P95 1899.70 ms，未达到 500 ms 目标，与 V3 基线一致；持续场景达到 1000 QPS、P95 < 500 ms、错误率 < 1% 的目标。2026-11-07 已在隔离栈完成 Kafka 停机、Redis 中断、消费者崩溃、DB 提交断点四类演练（见 [RUNBOOK](RUNBOOK.md)），但未在主栈执行破坏性注入；也未验证多机水平扩容、真实支付和 Compose Redis7 方案。V5 不新增活动协议，活动创建仍使用 V0–V4。

## 复现

应用健康后执行：

```powershell
python -m pip install -r scripts/requirements.txt
python scripts/verification_api.py
python scripts/verification_gateway.py
python scripts/verification_invariants.py
python scripts/verification_load.py --versions V4 --users 2000 --rps 1100 --seconds 30 --stock 1000
python scripts/verification_load.py --versions V4 --users 2000 --burst --stock 1000
# 对本次新生成的报告单独跑验收门禁；全部 targets.passed=true 才 exit 0
# PowerShell 不展开 glob：显式列文件名，或用 Get-ChildItem 取最新两份
$reports = Get-ChildItem artifacts\load-V4-*.json | Sort-Object LastWriteTime |
  Select-Object -Last 2 | ForEach-Object { $_.FullName }
python scripts/gate_report.py @reports
# 等价显式写法：python scripts/gate_report.py artifacts\load-<新报告>.json
```

`verification_load.py` 默认就是验收门禁：QPS、P95、错误率、收敛、订单终态、数据库库存守恒和 Redis 投影任一不达标都会 exit 1。只写报告、不因未达标中断的探索性运行加 `--report-only`。脚本默认访问 `http://127.0.0.1:8080`，收尾验收栈用 `--base http://127.0.0.1:18080`。

脚本使用独立测试用户和新活动，保留原有业务数据；压测结束后只下线本次创建的活动，不重置历史库存。

## 运维与故障演练

四类演练（Kafka 停机、Redis 中断、消费者崩溃、DB 提交断点）的注入方式、预期表现、观察命令、恢复判据和实测记录见 [故障演练 RUNBOOK](RUNBOOK.md)。演练使用隔离端口 18082/16380/19095 与 `peakrush_drill` 库，不触碰主栈。

历史遗留的“已 ACK 但未 XDEL”条目用定向清理脚本处理。脚本只删除 `ID <= last-delivered-id` 且不在 PEL 的条目，未投递和仍在 PEL 的条目一律保留：

```powershell
# 停机窗口内执行：先停 backend，或把 faults.pauseBridge 置为 true
python scripts/cleanup_stream_residue.py --host 127.0.0.1 --port 16379 --dry-run
python scripts/cleanup_stream_residue.py --host 127.0.0.1 --port 16379 --apply
```

脚本可重复执行；`remaining=0` 表示该流已清理干净。整改后 bridge 已用 Lua 原子完成 XACK + XDEL，不再产生新的孤儿条目。

## CI 门禁

工作流 [ci.yml](.github/workflows/ci.yml) 在 `pull_request`、`push` 和手动触发时运行：

| Job | 服务与步骤 |
| --- | --- |
| frontend | Node 22；`npm ci --ignore-scripts`、`npm test`、`npm run build` |
| backend | MySQL 8.0.30（13306）、Redis 7.4.2（16379）、Kafka 4.3.0 KRaft（19092）；导入 `schema.sql`、等待 Kafka 端口、`mvn verify`；slow 标签用例单独执行 |
| gateway | Redis 7.4.2（16379）；`mvn verify`（含真实 Lua 限流与 Redis 故障 503） |
| catalog-scripts | Python 3.13；`pip install -r scripts/requirements.txt`、`unittest discover` |

失败时也会上传证据：backend 的 Surefire XML、`backend/target/**/*.json`、MySQL/Redis/Kafka 容器日志和 `artifacts/**/*.json`；gateway 的 Surefire XML 与 Redis 日志。V4 端到端 `StreamBridgeIntegrationTest` 只在 CI 的真实 Kafka + MySQL 组合下执行。

## 文件索引

- [架构与一致性边界](docs/ARCHITECTURE.md)
- [接口约定](docs/API_CONTRACT.md)
- [实现计划与验收映射](docs/IMPLEMENTATION_PLAN.md)
- [V5 验收报告](docs/VALIDATION.md)
- [故障演练 RUNBOOK](RUNBOOK.md)
- [界面验收](design-qa.md)
- [GitHub 项目选型](docs/GITHUB_SELECTION.md)
- backend/、gateway/、frontend/：Java17 / Spring Boot3 / MySQL / Redis Lua / Kafka / Vue3 / Element Plus
- scripts/：压测（`verification_load.py`）、门禁（`gate_report.py`）、Stream 残留清理（`cleanup_stream_residue.py`）与各层验证脚本
- artifacts/：原始接口报告、分阶段压测数据、环境与界面截图

## 来源

参考项目 [daydreamdev/seconds-kill](https://github.com/daydreamdev/seconds-kill/tree/57a31cb2c15b082bc84472b479e17534ee9ace53) 固定于版本 57a31cb2c15b082bc84472b479e17534ee9ace53，MIT 许可证和来源说明保留在 references/。当前应用沿用分阶段实验思路，重新实现库存与异步一致性流程；其他项目用于选型与设计比较，未直接复制无许可证项目源码。
