# PeakRush PR #3 增量可靠性审查与补测手册

2026-11-09，Asia/Shanghai。**建议暂缓合并。** 多实例下，Redis PEL 的空闲计时先于应用分批发送。存活实例还在处理时，另一实例已经可以接管同一批事件并重复发布。

本次范围是 `f03238930a60fb8a10e26a54c131b345281514f7` 至 `83b713dff71c17f57770de282ba5406d8f2a3327`。GitHub 比较显示前进 10 个提交，其中 8 个为本轮内容提交，另外两个来自合并历史。文件差异为 19 个。PR 目标仍是 `main`，状态 Open。 [PR #3](https://github.com/sherlockfeng07-ui/PeakRush/pull/3) · [固定版本比较](https://github.com/sherlockfeng07-ui/PeakRush/compare/f03238930a60fb8a10e26a54c131b345281514f7...83b713dff71c17f57770de282ba5406d8f2a3327)

## 上一轮风险的整改结果

| 风险 | 本轮判断 | 证据与边界 |
| --- | --- | --- |
| R1 单条故障打断其他活动 | 原问题已整改 | 活动与记录两级捕获。真实 Redis 上用缺少 `payload` 的记录和同步抛错的 producer 复现，后续活动继续发送。永久坏记录保留在 PEL。恢复分支失败时当轮跳过同流新读，仍需验收同流新消息的活性。 |
| R2 名义 32、实际先提交 256 | 每实例发送上限已整改 | 发送前获取 Semaphore，Future 成功或异常完成才归还。同步异常单独归还，12 秒等待超时保留未完成名额。32 的范围是单个 `Workers` 的 V4 bridge；各实例分别计数，Kafka 请求批次和其他 producer 入口各有自己的边界。 |
| PEL 深页长期扫不到 | 基本分页生效 | 256 条一页，以每流最后一个 ID 为闭区间起点，末页回绕。测试让 300 条保持在 PEL，第 257 条在第二轮被尝试，使用 0 秒阈值和失败 Future。尚需验收默认 12 秒、竞争接管、回绕、新流入和成功排空。 |
| R3 两条 Redis 命令之间留下孤儿 | 本地 Redis 原子清理已整改 | `XDEL 0-0` 空操作先校验，再执行 `XACK` 与实际 `XDEL`。单消费者组 `bridge` 下，成功路径删除消息，重复清理返回 0。Lua 运行错误会保留错误前的写入，预检对 ACL 错误有实质作用。 |
| R4 未知收敛指标被当作零 | 原错误已整改，新增门禁还有边界 | 缺失库存、未知 pending/outbox、未知 Redis 投影均拦截，V4 还检查 Stream 长度及 PEL。新增 `order_targets` 会把 `null` 或未知状态计入终态。本地直接调用已复现，应使用业务终态白名单。 |

[Workers.java](https://github.com/sherlockfeng07-ui/PeakRush/blob/83b713dff71c17f57770de282ba5406d8f2a3327/backend/src/main/java/com/peakrush/Workers.java#L15-L105) · [ack_delete.lua](https://github.com/sherlockfeng07-ui/PeakRush/blob/83b713dff71c17f57770de282ba5406d8f2a3327/backend/src/main/resources/ack_delete.lua#L1-L12) · [verification_load.py](https://github.com/sherlockfeng07-ui/PeakRush/blob/83b713dff71c17f57770de282ba5406d8f2a3327/scripts/verification_load.py#L18-L51)

## 多实例接管与积压

### P1 存活实例的批次会被提前接管

`XREADGROUP` 和 `XCLAIM` 都能一次把至多 256 条交给同一个实例。PEL 计时从交付或 claim 开始，代码随后串行等待每批 32 条完成，等整轮发送结束才清理累计成功 ID。假如前几批累计耗时超过 12 秒，后面的记录即使还在本实例等待发送，也符合另一实例的接管条件。Kafka 的 10 秒 `delivery.timeout.ms` 从 `send()` 返回后计时，发送前排队、最多 3 秒的 `max.block.ms` 和 Redis 确认耗时另算。跨 producer 的应用层重发也会产生新的 Kafka 记录。 [读取与接管](https://github.com/sherlockfeng07-ui/PeakRush/blob/83b713dff71c17f57770de282ba5406d8f2a3327/backend/src/main/java/com/peakrush/Workers.java#L32-L57) · [分批及确认](https://github.com/sherlockfeng07-ui/PeakRush/blob/83b713dff71c17f57770de282ba5406d8f2a3327/backend/src/main/java/com/peakrush/Workers.java#L59-L105) · [Kafka producer 配置](https://kafka.apache.org/41/configuration/producer-configs/#delivery.timeout.ms) · [Kafka producer 幂等范围](https://kafka.apache.org/43/javadoc/org/apache/kafka/clients/producer/KafkaProducer.html)

本地在 Redis 7.4.2 和 Kafka 4.3.0 上运行原版 `Workers`，在同一测试 JVM 构造两个独立 Worker 和 producer。向单流加入 64 条，A 实际写入 broker，测试把第一批成功结果延迟到 PEL 空闲约 6.5 秒才通知 A，再暂缓第二批回执。PEL 空闲达 12,205ms 时执行 B，B 接管并提交 64 条，而 A 的调用仍未返回。放行 A 的第二批回执后，从独立 Kafka topic 拉到 128 条业务记录，64 个 `requestId` 各出现两次，`XLEN=0`。这里人为延迟 Java Future 通知，Kafka 写入和 Redis 接管均真实执行。此实验未连接 MySQL，不能据此判断发生了重复订单。

### P2 无发送额度时仍会 claim

容量检查在 `sendRecords` 内部，晚于 `XCLAIM` 和 `XREADGROUP`。名额耗尽后，下一轮仍可接管一页事件，重置空闲时间并增加投递次数，随后提交 0 条。这会拉长其他有容量的实例重新接管的等待。若 stale 批次失败，`bridgeItem` 还会直接返回，同一流的未读事件在该轮得不到处理。 [claim、分页与限额调用顺序](https://github.com/sherlockfeng07-ui/PeakRush/blob/83b713dff71c17f57770de282ba5406d8f2a3327/backend/src/main/java/com/peakrush/Workers.java#L32-L79)

本地在真实 Redis 中预置 300 条可接管 PEL。第一轮耗尽 32 个名额，并让发送 Future 在 12 秒等待后仍悬挂。第二轮未增加任何提交，但第 300 条空闲从 32,014ms 变为 1ms，投递次数从 1 增为 2。用受控 Future 隔离了容量耗尽这一条件。

### 最小修复

1. 以可发送名额为上限读取和接管，容量为 0 时跳过该流的交付操作。扫描窗口仍可保持 256，但只 claim 本轮能发送的一批，游标记到实际检查的位置。每批 Kafka 成功结果立即进入 Lua 确认。同一调度轮保留多个小批次和总条数或时间预算，避免把单热流限制为每 50ms 只处理 32 条。
2. 同一实例跟踪 `(stream, recordId)` 的未完成发送，等待超时后仍保留记录和名额，Future 完成后移除。Redis 确认可由桥接线程处理，避免在 Kafka 回调线程同步执行 Redis 网络操作。为新读和 PEL 恢复各留有界预算，坏记录持续失败时仍给同流新消息处理机会。
3. 校验接管阈值应覆盖 Redis 交付到 Kafka 完成及 Redis 确认的整个时间段。多实例若要求存活时不被抢占，使用可续期的处理租约或明确约束为单活 bridge；生产停顿与故障恢复仍按至少一次交付验收。用稳定的 `requestId` 约束下游业务效果。 [订单事务与幂等约束](https://github.com/sherlockfeng07-ui/PeakRush/blob/83b713dff71c17f57770de282ba5406d8f2a3327/backend/src/main/java/com/peakrush/Orders.java#L24-L44)

## CI 实际执行的内容

11 月 7 日的运行 `42387107310` 四个作业成功。后端 `verify` 为 37 项通过、0 跳过，含 11 项故障隔离和 1 项三组件集成，另有 1 项慢测通过。网关 5 项通过。脚本任务发现 45 项，其中 2 项 Redis 残留清理用例因 `PEAKRUSH_REDIS_TESTS` 未启用而跳过。11 月 9 日同一 HEAD 又有 `42568756501` 和 `42569099533` 两轮成功；最新 run 的实际 checkout 是 PR 合并测试提交 `15343f1`，其 Git tree 与 `83b713d` 一致。 [11 月 7 日运行](https://github.com/sherlockfeng07-ui/PeakRush/actions/runs/42387107310) · [后端日志](https://github.com/sherlockfeng07-ui/PeakRush/actions/runs/42387107310/job/128446702055) · [脚本日志](https://github.com/sherlockfeng07-ui/PeakRush/actions/runs/42387107310/job/128446702015) · [11 月 9 日较早运行](https://github.com/sherlockfeng07-ui/PeakRush/actions/runs/42568756501) · [最新运行](https://github.com/sherlockfeng07-ui/PeakRush/actions/runs/42569099533)

| 用例 | 实际验证 | 证据边界 |
| --- | --- | --- |
| `StreamBridgeFaultIsolationTest` | 真实 Redis 执行 XADD、XPENDING、XCLAIM 和 Lua。Mock 控制 producer Future、同步异常和迟迟未完成。 | 确认失败用 spy 替整个方法抛错，两活动均无法确认。重复确认是直接执行 Lua 两次。旧消费者由测试制造 PEL。 |
| `StreamBridgeIntegrationTest` | Redis 7.4.2、Kafka 4.3.0、MySQL 8.0.30。取回新消息及模拟遗留的 PEL 消息，从真实 broker 拉取，逐条直接调用订单处理两次，断言 2 笔订单及库存。 | 手工组装、独立 topic、3 秒 claim 阈值。Kafka listener 的 offset 提交、outbox 调度和进程重启路径不在该用例中。 |
| `PurchaseLimitFilterTest` | 一项真实 Redis 限流 Lua 测试断言第三次 429；另一项注入 Redis 错误信号，断言 503 和未调用下游。 | 请求经过 Mock exchange，503 用例没有切断 Redis TCP 连接。 |
| 慢速容量 | 等待真实的 12 秒，用受控 Future 证明跨调用仍只提交 32 条，异常完成后恢复。 | broker 的真实连接中断及网络超时未注入。慢测覆写同名 Surefire XML，常规 11 项以 job 日志为证。 |

[后端用例](https://github.com/shengxie738-ops/PeakRush/blob/83b713dff71c17f57770de282ba5406d8f2a3327/backend/src/test/java/com/peakrush/StreamBridgeFaultIsolationTest.java) · [三组件集成用例](https://github.com/shengxie738-ops/PeakRush/blob/83b713dff71c17f57770de282ba5406d8f2a3327/backend/src/test/java/com/peakrush/StreamBridgeIntegrationTest.java#L22-L62) · [后端证据包](https://github.com/sherlockfeng07-ui/PeakRush/actions/runs/42387107310/artifacts/13579903296) · [网关日志](https://github.com/sherlockfeng07-ui/PeakRush/actions/runs/42387107310/job/128446702056)

本地用真实 Redis 7.4.2 分别禁止 `XACK` 与 `XDEL`。两次权限错误都保留 `(PEL, XLEN)=(1,1)`，恢复权限后重试均为 `(0,0)`。另在原始 TCP 连接发送实际 Lua，独立连接确认脚本落地后关闭原连接而未读取响应，重试返回 0。这是 Redis 层的响应未读取实验，应用自动重连需单独验证。

本地 Java 17 和 Maven 3.9.11 运行了 11 项仓库故障隔离用例，以及上文两项复现用例，共 13 项，0 失败、0 跳过。两项复现用例的断言用于确认缺陷现象。

两条仓库残留清理测试本地均通过。另种下两条已投递记录，首条保留 PEL，第二条已 ACK。`--batch 1` 的 dry-run 与 apply 均报告零，改用 `--batch 2` 清掉第二条。最小修复是禁止 `--batch 1`，或补齐闭区间续页；`--apply` 按单一 `bridge` 消费组和停写停读窗口验收。 [清理脚本](https://github.com/shengxie738-ops/PeakRush/blob/83b713dff71c17f57770de282ba5406d8f2a3327/scripts/cleanup_stream_residue.py#L67-L115)

## 可复现的真实故障补测

在独立 VM 或 runner 检出待合并 SHA，用 `deploy/compose.yml` 启动 Redis、Kafka、MySQL。Redis 使用持久卷和 AOF。启动 A、B 两个 JVM，共用上述服务，分别绑定 18081 和 18082，使用 `local,lab` 配置。需要验证 HTTP 时把隔离网关指向该后端。使用足额库存、独立活动及不同用户，保留幂等键、`requestId` 和 Stream ID 的映射。Kafka 实际订单消费组是 `peakrush-orders`。 [部署配置](https://github.com/shengxie738-ops/PeakRush/blob/83b713dff71c17f57770de282ba5406d8f2a3327/deploy/compose.yml) · [实际消费组](https://github.com/shengxie738-ops/PeakRush/blob/83b713dff71c17f57770de282ba5406d8f2a3327/backend/src/main/java/com/peakrush/Messaging.java#L33-L45)

以下命令使用仓库默认的基础设施端口，在隔离 VM 内执行。先为该环境设置 `PEAKRUSH_DB_PASSWORD` 和 `PEAKRUSH_ROOT_PASSWORD`。

```bash
docker compose -p peakrush-pr3-audit -f deploy/compose.yml up -d --wait
mvn -f backend/pom.xml -DskipTests package
mvn -f gateway/pom.xml -DskipTests package
export DB_PASSWORD="$PEAKRUSH_DB_PASSWORD" SPRING_PROFILES_ACTIVE=local,lab
SERVER_PORT=18081 java -jar backend/target/peakrush-backend-1.0.0.jar > bridge-a.log 2>&1 &
PID_A=$!
curl --retry 30 --retry-all-errors --retry-delay 1 -fsS http://127.0.0.1:18081/actuator/health
SERVER_PORT=18082 java -jar backend/target/peakrush-backend-1.0.0.jar > bridge-b.log 2>&1 &
PID_B=$!
SERVER_PORT=18080 BACKEND_URI=http://127.0.0.1:18081 \
  java -jar gateway/target/peakrush-gateway-1.0.0.jar > gateway.log 2>&1 &
```

在需要 A 独占的用例中，先用管理员 token 向 B 的 `POST /api/admin/faults` 发送 `{"pauseBridge":true}`，再提交本轮购买。需要 B 参与时才恢复，并从其独立日志取接管时间。

| 补测 | 故障定位和复现步骤 | 通过判据 |
| --- | --- | --- |
| 多实例与 PEL | A 先独占桥接，提交 64 条。按 32 条分组给 A 的 producer 回执注入每批约 6–7 秒延迟，在首个 PEL ID 空闲超过 12 秒而 A 仍存活时启动 B 的 bridge。再以 300 条旧 PEL、仍在流入的新事件重跑，记录每轮 owner、idle、delivery count。 | 修复后存活 A 的有效租约期内 B 不重复发送，容量为零时不改变 PEL 所有权及 idle；A 真崩溃后 B 越过 256 条边界并完成回绕，健康记录都结算。 |
| Kafka 长停与恢复 | 暂停其他 bridge 后预热客户端，使用 `docker compose -p peakrush-pr3-audit -f deploy/compose.yml stop kafka`，提交 300 条有效 V4 请求并保持停机至少 45 秒；随后 `start kafka` 并记录 broker 恢复时刻。另用只作用于 A 的 TCP 代理做短时网络中断，确保 broker 广播地址也走代理。 | 每实例未完成发送峰值 ≤32，broker 恢复前未成功发送的 ID 留在 Redis。恢复后未漏单，队列排空。使用测量到的恢复时长对照发布 SLO。 |
| Kafka ACK → Redis Lua 崩溃 | 为隔离测试在真实 Future 成功且调用 `acknowledgeAndDelete` 前加按 `requestId` 触发的一次性屏障，记录 topic/partition/offset 与 Stream ID。看到 broker 已有该事件、Redis 仍 pending 后 `kill -9 "$PID_A"`，由 B 接管。 | 对同一 `requestId` 可以观测到恢复重投，但 SQL 分配和订单各一次。记录 A/B PID、Kafka offset、PEL owner 及清理结果。 |
| Redis Lua 响应丢失与真实 Redis 中断 | 对已预热的 `EVALSHA`，让代理只阻断应用连接的 Redis 返回方向。用独立 Redis 连接确认 `XPENDING` 和 `XLEN` 已归零，再让应用重连；另跑上行阻断，确认脚本确实没有到 Redis。单独在新请求发出前停止 Redis，经过真实网关验证 503 并在 AOF 实例恢复后复验。 | 脚本已经执行时，重连后原 ID 不复活；脚本未执行时，PEL 保留且可恢复。明确拒绝的新请求没有预占或订单。结果不确定时以同一幂等键复查。 |
| 消费者 offset 与 outbox 重放 | 设置 `POST /api/admin/faults` 的 `afterDbCommitPauseMs=30000`，等匹配 `requestId` 的 `FAULT_AFTER_DB_COMMIT` 日志后杀 JVM，验证实际 offset 重放。另在取消订单时用 `afterRedisApplyPauseMs=30000`，等 `FAULT_AFTER_REDIS_APPLY` 后、outbox DONE 前杀 JVM。 | 订单唯一，重复消费只扣一次，取消只释放一次，Redis 库存回到预期值，outbox 收敛。 |

对每个活动同时记录 `XLEN`、`XPENDING <stream> bridge`、预占 ZSET、Kafka lag 及 `recovery_outbox`。逐 `requestId` 对账 `seckill_request`、`seckill_order` 和 `stock_change_log`，按 `CREATED` 与 `PAID` 订单量验证 `total_stock = available_stock + occupied_quantity`。保留注入时点、环境版本、发布 SHA 和原始日志。仓库 `RUNBOOK.md` 记录了 11 月 7 日四项隔离演练。此次核对的 CI 证据包未找到对应的故障 JSON，工作流也没有故障注入步骤。现有崩溃脚本明确列出 Kafka producer ACK 到 Redis 清理的精确断点尚无测试钩子。 [演练记录](https://github.com/shengxie738-ops/PeakRush/blob/83b713dff71c17f57770de282ba5406d8f2a3327/RUNBOOK.md#L18-L160) · [已有崩溃脚本](https://github.com/shengxie738-ops/PeakRush/blob/83b713dff71c17f57770de282ba5406d8f2a3327/scripts/verification_crash.py#L46-L52)

## 合并门禁

1. 修复提前接管和满容量仍 claim；以双实例、默认配置、300 条以上积压回归验证，也要覆盖永久坏记录旁边的健康新事件。若部署只支持单活 bridge，应有能验证单活的部署约束。
2. 把真实 broker 停复机、精确 ACK 崩溃窗口、Lua 请求与响应的两个断点纳入同一候选 SHA 的验收。保留真实 Redis ACL、订单唯一、库存守恒和幂等补偿断言。主测试和慢测分别归档 XML，启用真实 Redis 残留清理测试。上线若依赖 `--apply` 清理历史数据，先修复 `--batch 1` 并验证单消费者组前提。
3. 用 V4 场景重跑持续和突发负载，保留全量请求、准入请求、429 和网络错误的原始记录。现有两份随 CI 打包的 V4 压测 JSON 生成于 11 月 2 日。新增 RUNBOOK 的多源 IP 三轮中仍有一轮全量 P95 为 549.12ms，另一轮错误率为 2.6%。按原有全量 P95 <500ms、错误率 <1% 与收敛门禁验收。 [突发表与口径](https://github.com/shengxie738-ops/PeakRush/blob/83b713dff71c17f57770de282ba5406d8f2a3327/RUNBOOK.md#L174-L207)

风险主要落在多实例慢链路的重复 Kafka 投递、积压恢复延长及证据不足的跨组件故障窗口。MySQL 的 `requestId` 唯一约束与事务降低重复业务效果的风险。上线风险应以真实故障恢复后的订单、分配、释放及库存对账判定。
