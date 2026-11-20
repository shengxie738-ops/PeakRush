# PeakRush PR #3 增量可靠性合并审查

审查日期：2026-11-03，Asia/Shanghai。结论针对下述固定提交；不是对未来更新版本的批准。

| 对象 | 固定版本 |
|---|---|
| 当前 main | `f0670b7eb7b8c8774658908fe966562821c5e81c`，已合并 V4 |
| PR #3 HEAD | `f03238930a60fb8a10e26a54c131b345281514f7` |
| PR 状态 | 审查结束前再次读取仍为 Open、未合并；1 个提交、13 个文件、+1633/-85 |
| 审查入口 | https://github.com/sherlockfeng07-ui/PeakRush/pull/3 |

## 1. 合并决定

**建议 REQUEST_CHANGES，当前版本暂缓合并。** 已复现一项 P1 故障隔离缺陷，另确认发送上限声明不成立、ACK/XDEL 之间存在不可自动清理的窗口，以及压测会把未知指标误报为已收敛。修复候选已在本地通过针对性测试，但尚不具备完整三组件故障恢复和突发性能验收证据。GitHub 的 `mergeable/clean` 仅说明分支可以合并，不代表可靠性通过。

本次没有合并 PR，没有向 GitHub 发布评论或推送修复。附带的 `reliability.patch` 是对上述 PR HEAD 的候选最小修复，待维护者应用后再完成补测。

## 2. 已确认的问题

下列行号全部指 **原 PR HEAD**，不是打补丁后的本地行号。

| 编号 / 等级 | 文件位置 | 已执行或直接证实的结果 | 与 main 的关系 |
|---|---|---|---|
| R1 / **P1，阻断** | `Workers.java:19-32,37-40` | 外层 try/catch 包住整个活动遍历。第一活动出现坏 JSON 或 `enqueue()` 同步异常，第二个有效活动不会被处理。两个真实 Redis 回归均失败，第二流 XLEN 仍为 1 | 原有异常边界未修复；V5 把 `return` 换为 `continue` 只覆盖返回 false 的路径，未完成其故障隔离承诺 |
| R2 / **P2，本次验收应修复** | `Workers.java:36-49` | 先 enqueue 整批 256 条，再按 32 个 Future 等待。受控 Future 实验在任何完成之前观察到 **256** 个未完成发送；一次等待超时后再次调用还能继续提交 | eager submission 已存在于 main；V5 新注释/说明中的“分块不会让 256 个发送冲击 producer”不成立 |
| R3 / **P2，本次清理机制应修复** | `Workers.java:56-63` | 真实 Redis 7.4.2 禁止 XDEL、允许 XACK：执行后 **XLEN=1、PEL=0**。恢复 XDEL 权限后，这条已 ACK 记录不会通过 `>` 新读或 PEL claim 再出现 | V5 新增清理路径的故障窗口；V4 本身没有 XDEL，也会保留历史已 ACK 条目，不能把所有历史残留都称为 V5 回归 |
| R4 / **P2，验收证据失真** | `scripts/verification_load.py:89-92`，结合 `Admin.java:75` | Redis读失败时库存为null，但pending可能保留默认0；脚本还把缺失inventory、null pending/outbox当零。执行真实报告流程的受控HTTP回归，7项有5项把未收敛误报为true | V5新增的收敛等待逻辑引入；当前提交的两份完整JSON没有触发这些异常，不据此否定其正常数值 |

源码：[原始 Workers.java](https://github.com/shengxie738-ops/PeakRush/blob/f03238930a60fb8a10e26a54c131b345281514f7/backend/src/main/java/com/peakrush/Workers.java#L19)。

R2 的“在途”指应用尚未完成的消息发送 Future。它不是 Kafka 每连接网络请求数：`enable.idempotence=true` 对 `max.in.flight.requests.per.connection` 的约束作用于连接上的请求/批次，不是 32 条业务消息。不能说原实现没有任何边界：一次读取上限确实是 256，producer 也有自己的缓冲和协议约束；问题是本次宣称的应用级 32 条上限不存在。

R3 首先是内存保留和可用性风险，不是本次已证明的订单丢失。Kafka 已确认后才做 XACK，正常顺序方向正确；但日志“下次删除成功会清掉”不成立，因为已 ACK 的 ID 没有持久重试队列。结合运行配置 `maxmemory 256mb/noeviction`，反复出现该窗口会积累不可自动清理条目。**XACK 不等于删除 Stream 条目。**

## 3. 候选最小修复和回归

生产修改限于 `Workers.java`、`Reservations.java`、新增 `ack_delete.lua` 和 `scripts/verification_load.py`，不改库存、订单事务或 schema。

### R1：把异常边界收窄

每个活动内有自己的 try/catch；每条记录的解析、同步 enqueue 异常也单独捕获。坏记录保持在 PEL，不在无法确认时删除；其他活动继续处理。永久坏记录的隔离/DLQ 策略仍需后续运营处理，候选没有擅自丢弃。

回归：`poisonInOneStreamDoesNotStopAnotherActivity`、`synchronousProducerFailureDoesNotStopAnotherActivity`。原代码均失败，候选通过。

### R2：在提交前限制容量，超时不释放

核心逻辑如下；完整实现见补丁：

```java
private final Semaphore producerCapacity = new Semaphore(32);

// 创建本小批次发送时执行，而不是先创建全部 256 个发送。
if (!producerCapacity.tryAcquire()) {
    complete = false;
    break;
}
try {
    var future = Objects.requireNonNull(purchases.enqueue(event));
    future.whenComplete((result, error) -> producerCapacity.release());
    sends.add(Map.entry(recordId, future));
} catch (RuntimeException error) {
    producerCapacity.release();
    throw error;
}
```

等待超时不代表原发送已经结束，不能在超时 catch/finally 里释放名额。候选按小批次创建发送，并在结果不确定时停止追加本流后续批次。上限范围为每个 `Workers` 实例的 V4 bridge；不是整个集群的 32 条，也不涵盖 V3 和 DLQ 所有发送入口。

回归：`atMost32UncompletedBridgeSendsAreSubmitted` 在原代码观察到 256、候选观察到 32；`unresolvedSendsKeepTheirCapacityAcrossAnotherBatch` 验证跨 12 秒等待超时仍保留容量；`exceptionalProducerCompletionRestoresCapacity` 验证失败完成后可以恢复发送。

### R3：确认与清理放到一个 Redis 脚本

在同一个脚本中先对不可能存在的 Stream ID `0-0` 做 XDEL 空操作，校验 XDEL 的命令/键权限和键类型，再执行真实 XACK、XDEL。有效 XADD 禁止创建 ID `0-0`。这样既防止 XDEL 权限错误发生在 XACK 之后，也兼容仓库启动指南中的 Redis 5.0.9；没有依赖 Redis 7 专属的 `redis.acl_check_cmd`。

```lua
-- ack/del 参数数组包含本批已经得到 Kafka 成功结果的 ID。
redis.call('XDEL', KEYS[1], '0-0')
local count = redis.call('XACK', unpack(ack))
redis.call('XDEL', unpack(del))
return count
```

这防止客户端在两条网络命令之间中断造成孤儿条目。**Lua 的执行原子性不表示运行错误会回滚先前写入**；空操作预检查正是为已复现的 XDEL 错误窗口补上的保护。适用前提是当前代码只有一个 `bridge` 消费者组。若增加其他组，删除策略必须重审。

回归：真实 Redis 7.4.2 分别禁止 XACK/XDEL，失败时都保留 XLEN=1、PEL=1；恢复权限并把 pending 设为可 claim 后归零。混合成功/失败发送只删除 Kafka 已确认的那条。真实 Redis 5.0.9 的混合结果清理、失败后新 consumer claim 两项兼容测试通过。

补丁不会追溯清理此前已 ACK 的历史条目。升级时应在停用 bridge 的维护窗口，核对唯一消费者组、last-delivered-id 和 PEL 后做定向清理；不能直接用 MAXLEN 裁掉尚未处理的消息。

### R4：未知指标不得当零

候选要求inventory非空、pending/outbox为有效非负整数；V2及以上还要求Redis库存为有效值，V4要求Stream/PEL两个指标明确归零。未知pending在报告里保留null，不再强行写0；V0/V1不强求Redis投影。

Stream/outbox仍是全局指标：其他活动或历史保留条目可使等待保守超时，因此应在隔离验收环境运行；这也不代替当前fixture的库存守恒断言。

```python
counts = [row.get("pendingReservations") for row in inventory]
pending = sum(counts) if inventory and all(type(n) is int and n >= 0 for n in counts) else None
# 然后显式验证outbox、Redis库存和V4 Stream指标，全部可用且为目标值才置converged。
```

回归位于 `scripts/tests/test_load_convergence.py`：使用受控HTTP边界执行真正的 `verification_load.run()`，覆盖Redis失败、空inventory、null pending、null outbox、未清理Stream、正常V4、无需Redis投影的V1。原PR 7项中5失败；候选7项全部通过。整个Python脚本测试集21项通过。这是报告流程单元测试，打印的单请求fixture吞吐不是性能实验。

## 4. 可靠性链路核验

| 项目 | 当前证据 | 判断 / 边界 |
|---|---|---|
| Kafka 未成功时不 ACK、不删 payload | 原代码路径及真实 Redis + 失败 Future 回归；候选另用真实 Kafka 客户端连接不可达 broker，观察 PENDING、PEL=1、XLEN=1、Redis 库存9/10 | 通过已测边界；没有把受控成功 Future 叫作真实 broker 成功 |
| PEL 基本恢复 | Redis 中制造 abandoned consumer，通过 XCLAIM 的 IDLE 设置使其满足 6 秒条件；换新 Workers 身份后能恢复 | 基本 claim 路径通过；这不是操作系统进程崩溃测试 |
| 消息重复和幂等 | `Orders.java:25-45` 事务、`:27-29` 请求行锁与终态短路；schema 的 request、user/activity/item、ledger、outbox 唯一键；原 CI 的 MySQL 测试成功 | 未发现 V5 新增的重复落单/超卖缺陷；本地未重跑真实 MySQL 崩溃回放 |
| 补偿重复执行 | `finalize.lua:11-20` 的 stateVersion/released；原有真实 Redis 并发预占、冲突请求、重复释放、旧确认等 8 项本地通过 | 通过现有覆盖；Redis apply 后进程被杀的端到端场景仍待执行 |
| DB 库存守恒 | 提交 JSON 中本次 fixture 均为 total1000=available0+occupied1000，Redis0/pending0；原 CI MySQL 事务测试成功 | 对提交数据和已有测试成立；不冒充本次重新做了生产 SQL 核验 |
| ACK 后删除 | 原顺序正确，但 R3 可复现 | 原 PR 有风险；候选通过针对性回归 |
| 持久化卷损坏/故障转移 | 没有执行证据 | 不作通过判断 |

异步期间 DB available 与 Redis available 暂时不同可以是正常预占/补偿状态。DB 的提交态守恒式是 `total_stock = available_stock + SUM(CREATED/PAID.quantity)`；只有在预占、outbox、Stream、Kafka 等均收敛后，才要求 Redis available 与 DB available 相等。

仍需留意的继承风险：PEL reclaim 阈值 6 秒短于配置的 Kafka `delivery.timeout.ms=10000`；多实例下可能在原发送仍活跃时 claim，增加重复发布。DB 幂等可限制重复订单，却不能消除额外负载。另有 XPENDING 只取最前 256 条的分页/公平性问题。这两项没有经过多实例故障实验，不记作已证实的数据丢失，也没有宣称候选已解决。

## 5. 压测 JSON 与性能解释

已重新读取两份 HEAD 中的 JSON，并执行算术/库存断言；没有重新跑 2000 用户压测，也没有原始逐请求样本可独立重算分位数。

| 指标 | 持续测试 1793608514 | 突发测试 1793608594 |
|---|---:|---:|
| 请求数 / HTTP 耗时 | 33000 / 30.049s | 2000 / 2.062s |
| 报告 HTTP QPS | 1098.20 | 969.87 |
| P95 / P99 | 40.760 / 53.885ms | 1899.697 / 1931.134ms |
| 客户端峰值在途 | 113 | 2000 个活跃请求协程 |
| 初始 PENDING / 最终 SUCCESS | 1000 / 1000 | 1000 / 1000 |
| SOLD_OUT | 18448 | 212 |
| ALREADY_PURCHASED | 13552 | 0 |
| 429 | 0 | 788，39.4% |
| QPS≥1000 / P95<500ms | true / true | **false / false** |
| settle 结束 / 额外收敛等待 | 35.865s / .433s | 11.651s / 19.349s |

持续测试仅 3.03% 请求被接纳，96.97% 是售罄或重复购买拒绝。因此 1098.2 是该工作负载的 HTTP 吞吐，不是 1098 笔成功订单/秒。2000 个配置用户不能替代实际并发测量；突发峰值2000也在 `api.call` 前增加计数，不能证明2000个连接或后端线程同时在处理。

突发 `2000/2.062` 与报告969.87之间的微小差异可由 elapsedSeconds 只存三位小数解释，不是发现算错。`orderTps=85.83` 在额外收敛等待前计算；起点到所有投影收敛约31秒，对应1000/31≈32.26/s，只是对更宽观察窗口的算术解释，不是新增容量实验。

`Api.settle` 每个初始 PENDING 在第一次 GET 前先 sleep150ms，且 settle 并行数30；1000条轮询本身至少分34组，带来约5.1秒的等待下界。不能把 settleSeconds 全部当作消费者工作耗时。

**突发 P95 接近1.9秒：可确定的是测量混入客户端调度/连接/请求处理成本，无法唯一定位服务器瓶颈。**

- JSON 中 schedule-delay P95=1131.460ms、端到端 P95=2057.643ms，说明 barrier 后客户端也未立即发出全部请求。
- 请求计时包含 aiohttp 连接和读取响应等成本。网关限流代码执行 Redis 后直接放行或429，没有“等额度可用”的排队逻辑；不能把1.9秒直接解释成限流器主动等待。
- 默认限额 global1500/IP1200/token20。单机同IP与788次429相符，但 JSON 没记录实际覆盖配置，不能仅凭默认值还原每个请求；1212个HTTP200跨约2秒也不违反一个1200/s窗口。
- 同机压测、event loop/连接建立、网关连接池、Redis Lua及 always fsync、后端 Hikari20连接与缓存冷启动竞争、Kafka/DB后台共享CPU和I/O，均是有源码依据的候选原因，尚没有时序证据确定贡献。
- Kafka key 为 itemId，使同商品集中到一个分区；这可能限制落单吞吐，但异步链路并不直接让每个 HTTP 请求等待订单完成，不能凭此断定 HTTP P95 的根因。
- 不能对不同样本集合的 P95 相减来分解耗时，也不能拿 metricsAfter 的聚合 API P95 代替这一轮客户端 POST P95。

补测应记录每请求 scheduled/start、DNS/connect/connection-queue、网关入口/Redis限流/转发、后端入口/预占返回、requestId 对应的Kafka确认/DB提交/Redis完成时间，并按200-PENDING、200-SOLD_OUT、409、429分别给分位数。同时记录有效限额、CPU、event-loop lag、GC、磁盘fsync及连接池占用，再比较修复前后同配置结果。当前不能声称补丁已经改善突发 P95。

JSON 没包含逐买家明细或 outbox DONE1000 的原始 SQL 输出；本次直接核验的是 uniqueAcceptedRequests1000、SUCCESS1000、outboxPending0及记录的各队列指标。此前核验的额外查询结论不被当作本次新增故障证据。

## 6. CI 与本次执行记录

GitHub Actions run `41415597657` 的四个 job 均成功。已读取后端 job `125178545191` 的实际日志：**26 项，25 执行通过、1 跳过**，不是只依据绿色图标推断。

`.github/workflows/ci.yml:62-64` 启用了 MySQL/Redis 与迁移测试，但明确 `PEAKRUSH_V4_TESTS=false`，也没有 Kafka service；被跳过的正是 StreamBridgeIntegrationTest。网关三个测试只覆盖 GatewayPolicy 的路由/键规则，没有执行限流 Lua 和 Redis 故障下的503。这些覆盖缺口与 main 一致。

| 本次执行 | 实际结果 |
|---|---|
| 原有6项本地单元测试 | 6通过 |
| 新增回归在原PR代码上 | 7项：5个预期失败、2通过、0错误 |
| 最终候选扩展 verify，Redis7.4.2 | **24项通过，0失败/错误/跳过；打包成功**：原6单元+原8Redis+新10回归 |
| 最终候选默认后端 verify | 总36项；16实际通过、20按环境条件跳过；构建成功 |
| 最终候选 Redis5.0.9 兼容 | 2项通过：混合发送清理、新consumer恢复 |
| Python完整脚本测试集 | **21项通过**，其中7项新增收敛回归；新增回归在原PR上5失败/2通过/0错误 |
| 两份 JSON 算术与分位数算法秩检查 | 通过；没有原始延迟数组，未独立重算报告 P95 |
| 新补充完整服务故障脚本 | Python语法检查和 --help 已执行；Docker故障场景**未执行** |

本地：OpenJDK17.0.20、Maven3.9.9，真实 Redis7.4.2/5.0.9。多数 Kafka 成功结果使用受控 Future；另有真实 Kafka 客户端连接不可达地址的失败场景。这里没有运行 MySQL 和可用 Kafka broker，也没有 PowerShell，所以完整三组件/Windows进程崩溃场景未执行。沙箱最初阻止 Mockito 动态自附加，预加载 Byte Buddy javaagent 后运行成功；不是 PR 缺陷。故障测试中的 broker/ACL/timeout WARN 是注入的预期日志。

## 7. 合并前必须补齐的门禁

1. 将候选修复或等价修复应用到 PR，保留发送上限、同步异常隔离、混合发送、XACK/XDEL失败及旧consumer恢复回归。
2. CI 后端启用 `PEAKRUSH_BRIDGE_REDIS_TESTS=true`，增加与部署一致的 Kafka4.3.0 服务和 bootstrap 配置，再将 `PEAKRUSH_V4_TESTS` 置为 true；上传 Surefire XML、服务日志、故障 JSON。仅翻转开关而不提供 broker 不足够。
3. 在完整独立实例执行 `RUNBOOK.md`：Kafka停机超过发送超时再恢复；Redis中断时新请求503且已接受请求恢复；消费者真实崩溃后的重复投递；DB提交前后与Redis apply/outbox DONE断点。每次断言订单数、分配/释放日志次数和库存守恒。
4. 为精确 Kafka ACK→Redis清理、清理响应丢失、多实例claim、大PEL分页增加注入/代理测试；已有 Windows crash 脚本明确列出第一窗口未覆盖，不能用它的整体通过替代。
5. 重跑持续/突发负载，保留原始逐请求时序和环境。突发 P95<500ms 是当前未通过目标：满足目标，或由维护者明确调整发布验收标准，不能抹去false。
6. 压测脚本仍是报告生成器：45秒收敛超时只记录 false，不失败退出，也未把库存/订单/收敛纳入 targets。候选已修复原PR把未知指标当零的R4，但验收门禁仍应显式要求目标、收敛、队列归零和库存守恒。包内 `gate_report.py` 对持续原JSON返回0、对目标失败的突发JSON返回1，已实际验证；不要把负载脚本正常退出当作可靠性通过。

**已验证通过**：上述明确执行的单元/Redis边界、候选修复回归、JSON算术、历史CI记录。

**存在风险**：当前PR的 R1/R2/R3/R4，突发目标未达成，单机/客户端指标容易被误作服务端容量。

**仍缺证据**：完整broker/Redis/消费者进程故障恢复、多实例及持久化异常，以及新的突发性能结果。候选24项通过不等于这些场景已通过。

## 8. 证据定位

- [持续原JSON](https://github.com/shengxie738-ops/PeakRush/blob/f03238930a60fb8a10e26a54c131b345281514f7/artifacts/load-V4-1793608514.json)
- [突发原JSON](https://github.com/shengxie738-ops/PeakRush/blob/f03238930a60fb8a10e26a54c131b345281514f7/artifacts/load-V4-1793608594.json)
- [CI运行](https://github.com/sherlockfeng07-ui/PeakRush/actions/runs/41415597657)
- [CI开关](https://github.com/shengxie738-ops/PeakRush/blob/f03238930a60fb8a10e26a54c131b345281514f7/.github/workflows/ci.yml#L62)
- [订单事务/幂等](https://github.com/shengxie738-ops/PeakRush/blob/f03238930a60fb8a10e26a54c131b345281514f7/backend/src/main/java/com/peakrush/Orders.java#L25)
- [压测计时和收敛](https://github.com/shengxie738-ops/PeakRush/blob/f03238930a60fb8a10e26a54c131b345281514f7/scripts/verification_load.py#L39)
- [崩溃脚本未覆盖项](https://github.com/shengxie738-ops/PeakRush/blob/f03238930a60fb8a10e26a54c131b345281514f7/scripts/verification_crash.py#L46)
- [Redis XACK语义](https://redis.io/docs/latest/commands/xack/)、[Kafka producer配置](https://kafka.apache.org/39/configuration/producer-configs/)

附包包含最小补丁、最终测试源码、上述关键执行日志、两份原始JSON、可移植算术检查、补测脚本、完整命令和文件SHA256。没有把可重建的依赖或整个仓库打包。
