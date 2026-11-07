# PeakRush 故障演练 RUNBOOK

本文档用于复现和验收四条可靠性链路：Kafka 停机、Redis 中断、消费者进程崩溃、DB 提交断点。
演练必须使用隔离实例，不得直接操作主栈（18080/18081/16379）或生产库。

## 1. 环境与隔离

| 组件 | 演练端口 | 说明 |
|---|---|---|
| 后端 | 18082 | `--spring.profiles.active=local,lab`，演练直连，不经过网关 |
| MySQL | 3306 / `peakrush_drill` | 独立库，演练结束可整库丢弃 |
| Redis | 16380 | 独立实例，开启 AOF |
| Kafka | 19095 | 独立单节点 broker（controller 19096） |

观察口径统一使用 `requestId`：HTTP 响应、`seckill_request`、`seckill_order`、Kafka 消息和 Redis Stream 必须能按同一个 `requestId` 对上。
禁止用“HTTP 200”单独判定成功；必须同时满足订单唯一、库存守恒、PEL/outbox 归零。

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
