# PeakRush 故障演练 RUNBOOK

本文档用于复现和验收四条可靠性链路：Kafka 停机、Redis 中断、消费者进程崩溃、DB 提交断点。
除第 5.1 节的双实例接管演练外，演练应使用隔离实例，不得直接操作主栈（18080/18081/16379）。5.1 需要两个实例共享同一 Redis/Kafka，是受控例外。

## 1. 环境与隔离

| 组件 | 演练端口 | 说明 |
|---|---|---|
| 后端 | 18082 | `--spring.profiles.active=local,lab`，演练直连，不经过网关 |
| MySQL | 3306 / `peakrush_drill` | 独立库，演练结束可整库丢弃 |
| Redis | 16380 | 独立实例，开启 AOF |
| Kafka | 19095 | 独立单节点 broker（controller 19096） |

> 上表是历史演练口径。当前仓库脚本只支持 MySQL 13306 / Redis 16379 / Kafka 19092（`scripts/runtime-start.ps1` 固定端口），16380/19095 需要复制脚本改端口与 RuntimeRoot，**未实测**。第 5.1 节因此改用共享依赖栈 + 18081/18082，并在该节明确标注。

观察口径统一使用 `requestId`：HTTP 响应、`seckill_request`、`seckill_order`、Kafka 消息和 Redis Stream 必须能按同一个 `requestId` 对上。
禁止用“HTTP 200”单独判定成功；必须同时满足订单唯一、库存守恒、PEL/outbox 归零。

**验收前提（多实例 PEL 接管）**：多实例部署时默认 `claim-idle-seconds=20s`；某实例的 PEL 只有在其它实例的 claim 空闲阈值到点后才会被接管。容量为 0 时不会 claim（避免无容量实例空转抢占）。`pauseBridge` 只暂停交付，已有 inFlight 仍会续租，**不能把 pause 当成安全 drain**。因此演练判据中的“PEL 归零”允许最长约 20s 的接管延迟，超出该窗口仍不收敛才算失败。进程停顿超过阈值或确认长期失败时按至少一次交付验收，以 `requestId` 幂等为准。

## 2. Kafka 停机

**注入**

1. 启动隔离栈并确认健康检查为 UP。
2. 停止 19095 的 Kafka broker。
3. 以 V4 架构连续提交 20 次购买请求。
4. 12 秒后重启 broker，等待收敛。

**预期表现**

- 停机期间 HTTP 返回 `PENDING`，不是 5xx；请求已被接受。
- DB 不扣库存、不产生订单。
- 事件保留在 Redis Stream / PEL 或 outbox 中，恢复后逐条投递。
- 恢复后每个 `requestId` 恰好一条订单；重复投递保持幂等。

**观察命令**

```bash
# 订单与请求
mysql -uroot -p peakrush_drill -e "SELECT request_id,COUNT(*) FROM seckill_order GROUP BY request_id HAVING COUNT(*)>1;"
# Stream 残留
redis-cli -p 16380 KEYS 'pr:*:events'
redis-cli -p 16380 XPENDING '<上一步返回的 stream key>' bridge
# outbox
mysql -uroot -p peakrush_drill -e "SELECT COUNT(*) FROM recovery_outbox WHERE status='PENDING';"
```

**恢复判据**

- 所有被接受的 `requestId` 都有且只有一条订单。
- `XPENDING` 为 0，`XLEN` 为 0（V4 流已排空）。
- `recovery_outbox` 无 `PENDING`。
- 库存守恒：`total_stock = available_stock + SUM(quantity)`。

**实测记录（2026-11-07 22:01:58，隔离栈）**

- 停机期间 20 次请求全部 `PENDING`，最大 HTTP 耗时 31ms。
- 恢复耗时 59.39s；20 个 `requestId` 全部恰好一条订单。
- 幂等重放检查通过；没有事件丢失或在停机期间扣减 DB。

## 3. Redis 中断

**注入**

1. 停止 16380 的 Redis。
2. 提交一次 V4 购买请求。
3. 重启 Redis，再提交一次新请求。

**预期表现**

- 故障请求快速返回 503 `ADMISSION_UNAVAILABLE`，不得产生半写入。
- DB 库存和订单不变。
- 后端进程不重启；Redis 恢复后连接自动恢复。
- AOF 保留故障前的 key；新请求可正常结算。
- 无遗留 Stream/outbox 工作。

**观察命令**

```bash
redis-cli -p 16380 INFO persistence
redis-cli -p 16380 KEYS 'pr:*'
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18082/api/seckill/<path>/<aid>/<iid>
# 期望 503，且响应体 code=ADMISSION_UNAVAILABLE
```

**恢复判据**

- 503 为快速失败而非超时堆积。
- DB 无新增订单/扣减。
- Redis 重启后 `KEYS 'pr:*'` 仍能看到故障前数据。
- 新请求正常进入 `SUCCESS`/`PENDING` 并最终收敛。

**实测记录（2026-11-07 隔离栈）**

- 故障请求返回 503，耗时 2016.5ms。
- DB 库存未变化；后端进程未重启；AOF 保留故障前 key。
- 恢复后新购买正常结算，无滞留 Stream/outbox。

## 4. 消费者进程崩溃

**注入**

1. 暂停消费者组（lab 故障开关）。
2. 提交 10 次购买，形成 Kafka backlog，HTTP 保持 `PENDING`。
3. `kill -9` 后端 JVM。
4. 重启后端，等待恢复。

**预期表现**

- 崩溃期间 backlog 存在，HTTP 不回滚为失败。
- 重启后健康检查恢复，lab 故障开关复位。
- 10 条请求全部恰好一条订单；重复消费幂等。

**观察命令**

```bash
curl -s http://127.0.0.1:18082/actuator/health
kafka-consumer-groups.sh --bootstrap-server 127.0.0.1:19095 --describe --group peakrush
mysql -uroot -p peakrush_drill -e "SELECT request_id,COUNT(*) FROM seckill_order GROUP BY request_id HAVING COUNT(*)>1;"
```

**恢复判据**

- 后端 PID 变化且 `/actuator/health` 为 UP。
- 所有排队请求进入终态，无重复订单。
- 故障开关不再生效。

**实测记录（2026-11-07 隔离栈）**

- 排队 10 条；恢复耗时 36.24s；10 条全部恰好一条订单；重放幂等检查通过。

## 5. DB 提交断点

**注入**

1. 下单事务提交后，在 Kafka offset 确认前暂停 30 秒（`FAULT_AFTER_DB_COMMIT`）。
2. 在暂停窗口内 `kill -9` 后端。
3. 重启后端，等待消息重投。

**预期表现**

- 订单在崩溃前已持久化。
- 重投不会产生第二条订单，也不会二次扣库存。
- 故障开关在重启后复位。

**观察命令**

```bash
mysql -uroot -p peakrush_drill -e "SELECT request_id,status FROM seckill_order WHERE request_id='<requestId>';"
mysql -uroot -p peakrush_drill -e "SELECT COUNT(*) FROM recovery_outbox WHERE status='PENDING';"
```

**恢复判据**

- 同一 `requestId` 只有一条订单。
- 库存守恒式成立。
- 无 `PENDING` outbox 或悬挂 PEL。

**实测记录（2026-11-07 隔离栈）**

- `requestId=22.22.895e5949875c01626d80c3a8cd53988d`。
- 订单在崩溃前已持久化；重投未重复下单/扣库存；故障开关复位。四项检查全部通过。

### 5.1 Kafka ACK 后、Redis XACK+XDEL 前的崩溃窗口

第 5 节复现的是“DB 已提交、Kafka 未 ACK”；本小节复现另一半：**broker 已 ACK、Redis 仍 pending**。此时 `kill -9` 会让
条目留在 PEL 而 Kafka 不会重投，只能依赖其它实例 claim 接管。

**前提与端口**

- 至少需要**两个独立后端进程**，且必须连接**同一个 Redis 和同一个 Kafka**（共享 PEL 与订阅关系，否则接管无从发生）；MySQL 可共用同一个库。
- `scripts/runtime-start.ps1` / `依赖环境/start-runtime.ps1` 固定 Redis 16379、Kafka 19092、MySQL 13306；`scripts/app-start.ps1` 一次只管理一套 backend/gateway/frontend。因此第二实例必须直接 `java -jar` 启动，不能再走 app-start。
- 隔离端口版（16380/19095）当前脚本不支持，需要复制 runtime 脚本并修改端口与 RuntimeRoot；本文不提供未经验证的命令。以下步骤使用共享依赖栈 + 18081/18082，**本机未实测**（只验证了代码与自动化测试），执行时以日志为准。
- `依赖环境\env.ps1` 不在仓库内（fresh clone 没有）：没有该目录时跳过这一行，按 README「当前机器启动」的说明设置 `PEAKRUSH_JAVA_HOME` / `PEAKRUSH_REDIS_BIN` / `PEAKRUSH_KAFKA_HOME` 等变量，或改用本机已运行且端口一致的依赖服务。
- 第二实例使用已构建的后端 jar：若 `backend\target\peakrush-backend-1.0.0.jar` 不存在，先执行 `mvn --batch-mode -f backend\pom.xml package -DskipTests`。

**注入**

1. 准备两个**独立终端**（不能在同一 shell 连续设置，`$env` 会互相覆盖）。

   终端 A（主实例，18081，稳定名 a）：
   ```powershell
   . .\依赖环境\env.ps1
   $env:BRIDGE_INSTANCE_NAME='a'
   .\scripts\app-start.ps1 -BackendPort 18081 -GatewayPort 18080 -Lab -SkipInfra
   ```

   终端 B（第二实例，18082，稳定名 b，只起后端）：
   ```powershell
   . .\依赖环境\env.ps1
   $env:BRIDGE_INSTANCE_NAME='b'
   java -jar backend\target\peakrush-backend-1.0.0.jar `
     --spring.profiles.active=local,lab --server.port=18082
   ```

   分别确认启动日志出现 `Stream bridge started consumer=bridge-a ...` 与 `consumer=bridge-b ...`，演练前记录这两个名字。未设置 `BRIDGE_INSTANCE_NAME` 时会打 WARN，`bridge-<uuid>` 不能作为演练判据。
2. 确认两个实例的 `/api/health` 都是 UP。
3. 向实例 A 打开故障钩子。`GET /api/admin/faults` 返回 `maxAckPauseMs`（= `claim-idle-seconds*1000-12000`，默认 8000）；超过上限直接返回 400：
   ```powershell
   Invoke-RestMethod -Method Post -Uri http://127.0.0.1:18081/api/admin/faults `
     -ContentType 'application/json' -Body '{"afterKafkaAckPauseMs":8000}'
   ```
4. 提交 1 次 V4 购买请求，记录 `requestId`。
5. 在实例 A 日志出现 `FAULT_AFTER_KAFKA_ACK ... pauseMs=8000` 后、**暂停结束前**强制终止 A（等价 `kill -9`）：
   ```powershell
   $pidA = (Get-NetTCPConnection -LocalPort 18081 -State Listen).OwningProcess
   Stop-Process -Id $pidA -Force
   ```
6. **保持 A 停止，不要重启**。`afterKafkaAckPauseMs` 是纯内存态，A 重启后天然为 0；提前重启只会让“接管是否由 B 完成”不可判定。
7. 在终端 B 等待 `claim-idle-seconds`（默认 20s）后的接管，或轮询 PEL：
   ```powershell
   redis-cli -p 16379 XPENDING pr:<activity>:<item>:events bridge
   ```
   PEL 归零即完成接管。
8. 演练结束后再启动 A（保持 `BRIDGE_INSTANCE_NAME=a`），确认 A 不会重复处理 B 已接管的条目。

钩子语义：暂停插在 **Kafka 发送成功之后、Redis Lua 的 `XACK`+`XDEL` 之前**，日志前缀 `FAULT_AFTER_KAFKA_ACK`，
因此窗口内崩溃会同时满足“broker 认为已投递”和“Redis 认为仍在 PEL”。

**预期表现**

- 崩溃后 Kafka 不再重投该消息（offset 已确认）。
- 该 `requestId` 对应条目留在该实例 PEL 中，直到其它实例 claim。
- 订单/库存崩溃前已持久化，不会二次扣减。

**恢复判据**

- 同一 `requestId` 可观测到重投（日志/`seckill_request` 可见重复处理），但 `seckill_order` 与 SQL 库存分配各只有一次。
- 实例 B 日志出现 `Stream <key> claimed <n> stale entries consumer=bridge-b firstId=<id>`，且该行时间戳晚于实例 A 的 `FAULT_AFTER_KAFKA_ACK` 行。A 被 kill 后不再续租，B 在 `claim-idle-seconds`（默认 20s）后才接管，因此“晚于暂停”是正常且必需的现象。
- **判据只认 consumer 名**：B 的 claim 日志里 consumer 必须等于演练前记录的实例 B 稳定名（如 `bridge-b`）；若是 `bridge-a`，说明是实例 A 重启后自处理，不能判定演练通过。没有 `claimed` info 日志时同样判为不通过。
- 接管后 `XPENDING` 归零、`XLEN` 归零。
- 库存守恒式成立，`recovery_outbox` 无 `PENDING`。

## 6. 突发 P95 的已知瓶颈

以下数字来自工作区 `artifacts/` 的原始报告，不调整验收标准：

| 负载 | 请求数 | QPS | P95 | 429 |
|---|---:|---:|---:|---:|
| 持续 | 33000 | 1098.20 | 40.76ms | — |
| 突发 | 2000 | 969.87 | 1899.697ms | 788（39.4%） |

结论：突发 P95 未达 500ms，瓶颈在网关限流整形（全局/令牌桶容量与 429 返回）以及单机压测端的调度/连接竞争，不是后端订单处理能力。
持续负载下 P95 40.76ms 说明后端处理链路本身不是瓶颈。`p95Below500ms=false` 必须保留，不得通过放宽阈值或剔除 429 来“变绿”。

### 6.1 2026-11-07 23:00 前后多进程/多源 IP 复验（新口径；上面 6 节旧基线保留不动）

**口径差异（先读这一条，再对比数字）**

- 旧基线（上表）：单进程 aiohttp，全部请求同源 127.0.0.1，无连接预热；2000 个 barrier 任务在同一事件循环内创建，客户端调度延迟 P95 535ms 被计入端到端；P95 取全部样本（含 429）。
- 新口径：8 个独立压测进程分别绑定 127.0.0.10–127.0.0.17，按同一 epoch 绝对时刻触发 barrier；每个进程在 barrier 前用 `GET /api/seckill/activities/{id}` 预热 250 条 keep-alive 连接（该请求不进入购买限流键），barrier 时刻只发 POST。
- 指标分两栏：`admitted` 只统计 HTTP 200（业务 PENDING/SOLD_OUT），`all` 含 429/500；429、500 与客户端调度延迟 P95 单列。

| 场景 | 压测端 | 请求 | 200 准入 | 429 | 500（连接拒绝） | QPS | admitted P95 / P99 | all P95 | 调度 P95 | 错误率 | 守恒/收敛 |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 稳态 1000 RPS×30s | 4 进程/同 IP | 30000 | 16400（另 13600×409） | 0 | 0 | 999.43 | 23.79 / 42.94ms | 23.30ms | 7.77ms | 0% | 是/是 |
| 稳态 1100 RPS×30s | 4 进程/同 IP | 33000 | 19042（另 13958×409） | 0 | 0 | 1099.49 | 25.03 / 33.24ms | 24.85ms | 8.06ms | 0% | 是/是 |
| 突发 2000，单 IP | 4 进程/127.0.0.1 | 2000 | 1064 | 800 | 136 | 3100.78 | 485.40 / 504.70ms | 479.51ms | 200.81ms | 6.8% | 是/是 |
| 突发 2000，4 源 IP | 4 进程/127.0.0.2–5 | 2000 | 1468 | 500 | 32 | 3139.72 | 549.48 / 566.68ms | 528.11ms | 192.20ms | 1.6% | 是/是 |
| 突发 2000，8 源 IP（第 1 轮，冷 JVM） | 8 进程/127.0.0.10–17，预热 | 2000 | 1500 | 500 | 0 | 3007.52 | 490.14 / 513.57ms | 549.12ms | 57.78ms | 0% | 是/是 |
| 突发 2000，8 源 IP（第 2 轮） | 同上 | 2000 | 1500 | 500 | 0 | 4672.90 | 304.63 / 306.71ms | 303.85ms | 106.10ms | 0% | 是/是 |
| 突发 2000，8 源 IP（第 3 轮） | 同上 | 2000 | 1448 | 500 | 52 | 4608.29 | 344.39 / 369.71ms | 340.79ms | 76.41ms | 2.6% | 是/是 |
| 突发 2000，直连后端（无网关） | 8 进程/8 IP，预热 | 2000 | 2000 | — | 0 | 5899.71 | 261.26 / 262.27ms | 261.26ms | 53.32ms | 0% | 是/是 |
| 突发 2000，直连后端（重复） | 同上 | 2000 | 2000 | — | 0 | 5988.02 | 257.82 / 261.71ms | 257.82ms | 48.18ms | 0% | 是/是 |
| 突发 2000，网关关闭限流（冷 JVM） | 8 进程/8 IP，18082 | 2000 | 1891 | — | 109 | 2159.83 | 802.82 / 827.10ms | 801.31ms | 120.90ms | 5.45% | 是/是 |
| 突发 2000，网关关闭限流（重复） | 同上 | 2000 | 1814 | — | 186 | 2400.96 | 716.27 / 750.31ms | 715.02ms | 97.06ms | 9.3% | 是/是 |

每轮都在收敛后才采指标：`pendingReservations=0`、`v4StreamEvents/v4StreamPending=0`、`outboxPending=0`、`kafkaLag=0`；库存 `total=available+occupied`（1000/1000/0）；订单恰好 1000 条 SUCCESS、`request_id` 无重复；409 为“重复购买”业务拒绝、429 未创建 `requestId`，都不计入订单。

**限流阈值与并发的对应关系**

- 单 IP 突发：准入上限 = 单 IP 1200/s（1064×200 + 136×500 的连接失败也占用了令牌），429=800，与「单 IP 1200/s」完全吻合。
- 4 源 IP：单 IP 桶被摊薄到 4800/s，实际生效的是全局 1500/s，准入 = 1500（1468×200 + 32×500），429=500，与「全局 1500/s」吻合。
- 结论：2000 并发 > 全局 1500/s，因此“至少 500 个 429”是限流设计的必然结果，不是随机错误；单 IP 限制只影响同 IP 压测端的准入量。

**突发 P95 结论**

- 限流生效 + 连接预热的新口径下，业务准入口径 P95 = **490.14 / 304.63 / 344.39ms**（3 轮），三次都 <500ms；但第 1 轮（网关冷 JVM）的全量口径 P95 = **549.12ms** 超阈值，且第 3 轮错误率 2.6% 超过 1%。
- 因此不能笼统写“已达标”：**业务准入 P95 达标，但贴边且不稳定；含 429 的全量口径和错误率在冷启动/连接抖动时仍不达标。** 旧的单进程 `p95Below500ms=false` 结论保留。

**瓶颈归属**

1. `429` 来自网关限流（单 IP 1200/s、全局 1500/s），属设计行为，可用 `Retry-After: 1` 引导重试。
2. `500` 全部是网关到后端的 TCP 连接建立失败：捕获到日志的轮次里，18080 共 80 条、18082 共 295 条，全部为 `java.net.ConnectException: Connection refused: /127.0.0.1:18081`（18080 的 80 条中 52 条是发起 POST 的 500，28 条是预热 GET；更早的 same-IP/4 源 IP 轮次未捕获网关日志，但其 500 响应体与上述一致：WebFlux 错误体带 `requestId`）。后端日志无 `ERROR`/`Exception`，同一轮次的订单与库存与无 500 轮次完全一致，说明请求从未到达后端；根因是并发新建连接瞬间超过 Tomcat `accept-count`（默认 100）的接纳队列，SYN 被拒。连接预热到位后 500 消失（第 2 轮 0 个）。
3. 购买链路本身不是瓶颈：直连后端 2000 并发全部 200，P95 257.82–261.26ms，订单/库存/Stream 全部一致。旧口径“服务端购买路径 P95 67ms”与新口径直连 258ms 的差异，来自真实 2000 并发下的 Redis 单线程串行（`INFO commandstats` 实测 `evalsha` 4040 次、单次 41.95µs、合计 169ms）。
4. 关闭限流并不会更快：网关 `RATE_LIMIT_ENABLED=false` 时 2000 个请求同时压到上游，连接建立排队更严重，P95 升到 716–803ms、500 达 109–186 个。限流器在此处起削峰保护作用。

> 环境备注：本轮收尾前误对 16379 执行过一次 `FLUSHDB`（只清 Redis 工作集，MySQL 未动，当时 `pendingReservations` 全为 0，无在途预占）。已用 `mp/restore_redis.py` 按 MySQL 的 `available_stock`/`generation` 与 `warmup.lua` 的同一参数重建 26 个商品的 `meta`/`stock`，并复核 `pr:*` 键存在、数值与 MySQL 一致；限流键用 24 并发同 token 请求复核（20×401 + 4×429），限流仍生效。

**证据文件**（`G:\高并发大作业项目\临时数据文件目录\PeakRush-20261107\mp\`）：`mp-steady-1000.json`、`mp-steady-1100.json`、`mp-burst-same-ip.json`、`mp-burst-multi-ip.json`、`mp-burst-8ip-warm{,-2,-3}.json`、`mp-burst-direct-backend{,-2}.json`、`mp-burst-gateway-nolimit{,-2}.json`、`gateway-18080.out.log`、`gateway-18082-nolimit.out.log`、`mp_load.py`。

## 7. 演练后清理

1. 只停止隔离栈（18082/18083/16380/19095）及演练库，不动主栈。
2. 删除演练临时 Redis/Kafka 数据目录，保留 `drill-report-*.json` 作为证据。
3. 确认主栈健康：网关、后端 `/actuator/health` 为 UP，Redis/Kafka 端口正常。
