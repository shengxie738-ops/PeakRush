# PeakRush 架构与演进说明

本文按当前源码说明 V0–V3，核对日期为 2026-09-28。交付范围止于 V3；已有 V4 Stream、故障注入和崩溃脚本保留为后续实验，不作为本轮交付或已验证能力。活动的 architectureVersion 固定在创建时，同一套商品、鉴权、结果查询和订单状态机用于对比不同下单路径。

## 系统入口与版本路径

浏览器使用 Vue 3，默认访问本机 5179。Gateway 在 8080 转发到 8081 的 Spring Boot 后端。MySQL 保存活动、请求、订单、库存变更和恢复任务；Redis 保存动态路径、V2/V3 预占库存及请求工作集；Kafka 为 V3 异步下单传递事件。全部服务默认绑定回环地址。

~~~mermaid
flowchart LR
  UI["Vue 3：提交与轮询"] --> GW["Gateway：准入限流"]
  GW --> API["后端：鉴权、路径、幂等标识"]
  API -->|"V0 / V1 同步"| DB["MySQL 事务：库存、请求、订单、Outbox"]
  API -->|"V2 / V3"| LUA["Redis Lua：预占、限购、PENDING"]
  LUA -->|"V2 同步"| DB
  LUA -->|"V3 异步发送"| MQ["Kafka"]
  MQ --> CON["订单消费者"]
  CON --> DB
  REC["PENDING 扫描重发"] --> MQ
  LUA -. "保留 payload 与待处理索引" .-> REC
  DB --> OUT["Outbox 重试"]
  OUT --> FIN["Redis Lua：状态投影与一次回补"]
~~~

| 版本 | 请求线程的工作 | 数据库防线 | 正常响应 |
| --- | --- | --- | --- |
| V0 | 在 MySQL 事务中查询并锁定商品，检查库存、扣减、创建订单 | 商品行锁、请求锁及唯一约束 | 提交后返回结果 |
| V1 | 同步下单，将商品库存扣减改为带 available_stock >= quantity 的条件更新 | 受影响行数必须为 1；唯一约束仍保留 | 提交后返回结果 |
| V2 | Lua 原子预占和限购，然后同步执行 MySQL 下单 | V1 条件更新作为最终库存防线 | 通常直接返回订单结果 |
| V3 | Lua 原子预占，向 Kafka 发起发送，由消费者执行 MySQL 下单 | 与 V2 相同；重复消息按 requestId 收敛 | requestId + PENDING，随后轮询 |

V0 是正确的加锁基线。V1、V2、V3 都与 V0 共用请求唯一键和订单唯一约束，不能把唯一约束描述为 V1 才首次拥有。V0/V1 的下单核心使用 MySQL，但登录后的动态抢购路径仍依赖 Redis；通过 Gateway 访问时也会经过 Redis 限流。

主要入口是 `POST /api/seckill/{aid}/{iid}/path`、`POST /api/seckill/{path}/{aid}/{iid}` 和 `GET /api/seckill/result/{rid}`。路径有效期为 120 秒，绑定当前用户、活动和商品。接口细节见 [API_CONTRACT.md](API_CONTRACT.md)。

## 幂等与限购的准确含义

提交必须携带 8–100 位 Idempotency-Key。后端将活动 ID、商品 ID 与当前用户及该键的 SHA-256 摘要组合为 requestId；请求载荷摘要包含用户、活动、商品、数量。同一请求标识改变数量会返回 409 IDEMPOTENCY_CONFLICT。已存在请求先于动态路径失效和售罄提示被识别，重试时应保留原键。

MySQL 的 `seckill_request.request_id` 是主键，`seckill_order.request_id` 唯一；`(user_id, activity_id, item_id)` 也唯一。Redis users Hash 对同一活动商品记录用户对应 requestId。limitPerUser 表示这一单允许的最大数量：同一用户对同一活动商品只能形成一笔订单，取消或超时关闭后仍保留购买资格已使用的记录。FAILED 且未形成订单的预占会释放用户标记，可以换新请求重新参与。重复提交原来的 FAILED 请求仍返回原终态。

订单、请求和 Redis 状态不是同一个字段。落单后请求为 SUCCESS，订单先为 CREATED，模拟支付后订单为 PAID；请求依旧可以是 SUCCESS，查询结果同时提供 orderStatus。关闭/取消将请求改为 CLOSED/CANCELLED。GET 结果查询先读 MySQL，再在未落库时读 Redis，并检查归属用户；重复 POST 可能暂时读到尚未被 Outbox 更新的 Redis 投影，客户端以轮询结果判断最终状态。

## Redis 与 MySQL 的边界

`reserve.lua` 在一个脚本内完成键类型检查、generation 校验、活动启用及 Redis TIME 时间窗校验、数量与限购校验、库存 DECRBY、用户标记、完整请求 payload 和 PENDING ZSet 索引。相关键使用同一 `pr:{activityId:itemId}:` 前缀与 Hash Tag。V2/V3 在 Lua 完成时有可恢复的预占记录，但尚不等于 MySQL 订单创建成功。

`Orders.process` 使用 TransactionTemplate，在同一个 MySQL 事务内初始化请求并锁定请求行、创建订单、扣减数据库库存、写 ALLOCATE 日志、更新请求终态和插入 recovery_outbox。任一操作失败则本次事务回滚。V2/V3 的活动时间窗由受理时的 Lua 判断，已受理请求允许在活动结束之后消费；消费时仍校验 generation、数量和数据库可用库存。

数据库库存是已落单占用的账本，Redis 库存还包含尚未落单的预占。因此处理中两者短暂不同是正常现象。正确性核对按 CREATED + PAID 订单的数量求和，不能把已取消历史订单数当作当前库存占用。

`Store.itemCached` 将商品和活动元数据缓存 1 秒；`StockHints` 的售罄提示最多保留 200 毫秒，仅在 Lua 观察库存精确为 0 时设置，并在回补后清除。它们用于减少重复访问，不能替代 Lua 或数据库库存条件。

预热只允许对未使用的 DRAFT/PREHEATED 活动建立初始库存。运行中缺失 meta/stock、工作集不完整或残留请求时，拒绝覆盖并报告 RECOVERY_REQUIRED。warmup 不会拿数据库库存覆盖已有预占；Redis 持久化卷丢失需要人工恢复，当前代码没有承诺从数据库重建全部待处理预占。

## V3 消息投递与恢复

生产者启用 acks=all 和 enable.idempotence；`seckill-order-create` 与 `seckill-dlq` 均为 3 分区、1 副本。消息键为 itemId，相同商品进入相同分区。当前 listener 未配置多并发实例，3 个分区本身不意味着同时运行 3 个下单消费者。

V3 提交调用 Kafka send 后返回 PENDING，不等待发送 Future 完成。因此 PENDING 表示 Redis 已受理预占，不保证此刻 Kafka 已确认，也不保证订单成功。发送抛错、超时或确认结果不确定时保留预占，不立即增加库存。

每 5 秒运行的 pending 扫描处理超过 5 秒未完成的记录，每个商品每次最多 30 条。V3 会使用保留的 payload 重发；如果 MySQL 已终态，则确保已有 Outbox；默认超过 1800 秒仍未完成则写 FAILED 终态并走回补流程。该扫描可以覆盖 Lua 完成后、首次发送之前进程退出的窗口，但依赖 Redis 工作集仍然存在。恢复吞吐有限，大量积压时不能把这些默认周期解释为严格完成时限。

消费者自动提交关闭，按 RECORD 确认。MySQL 事务提交之后 listener 返回，容器才推进消费 offset。若提交数据库后、提交 offset 前中断，消息会重放；请求行锁与唯一约束使重放返回既有结果。这里提供的是至少一次投递加业务幂等，没有 MySQL、Redis 与 Kafka 的跨系统原子事务，也不声称端到端 exactly-once。

普通订单 listener 失败后使用 500 毫秒间隔重试 2 次，再投递 DLQ；只有 DLQ 发送确认成功才完成该条恢复。DLQ listener 使用独立容器工厂：落库失败时保留原 offset 无限退避重试，不再次向同一个死信 topic 自我投递。管理员可查看并重试或终止；终止先写请求 FAILED 终态，迟到订单消息据此停止落单。

## 订单关闭、支付与 Outbox

支付是本地模拟支付，不接入第三方支付平台。支付、取消、超时任务统一按“请求行 → 订单行”加锁；只允许 CREATED 发生首次支付或释放库存。已支付订单不能取消，已关闭订单不能再支付，同种终态重试返回现状。

默认订单有效期为落单后 900 秒。超时任务每秒扫描至多 100 条过期 CREATED 订单。关闭或取消在同一个 MySQL 事务中更新订单和请求、增加库存、写唯一 `release:requestId` 库存日志并插入 Outbox。数据库会话固定 UTC；DATETIME 调度比较、Outbox next_retry_at 和应用 Instant 均按 UTC 处理。

Outbox 每 500 毫秒处理最多 50 条到期任务：先执行 `finalize.lua`，成功后将任务标记 DONE，失败后 2 秒再试。Lua 校验 generation 和 stateVersion；旧状态不覆盖新状态，released 标记使重复回补只增加一次库存。这样“Redis 已应用、Outbox 尚未标记完成”的重试不会再次回补。FAILED/CLOSED/CANCELLED 才释放预占；SUCCESS 只更新投影。所有 V2/V3 回补都通过这个持久化任务处理，不能因为 Kafka 发送报错就直接释放。

这些恢复任务属于 V2/V3 基础正确性所需的共用实现。本轮延后的 V4 是额外的 Stream 持久事件桥接和精确崩溃实验，不等于 V3 没有回补或死信能力。

## Gateway 与压测口径

Gateway 在购买 POST 上使用 Redis Lua 同时检查全局、socket 来源 IP、Authorization 字符串摘要三个计数器。默认阈值分别为每秒 1500、1200、20；这是配置值，不是实测 QPS。令牌维度是请求头摘要，并不等价于网关已验证的用户 ID；用户认证由后端完成。超过阈值返回 429，Redis 准入不可用返回 503，Retry-After 为 1 秒。

经 Gateway 的 V0–V3 都受同一限流逻辑影响。公平比较必须记录入口地址、限流配置、库存、用户分布、并发与持续时间；售罄快速返回的请求 QPS、成功下单 TPS 和异步受理延迟应分开统计。本文不声称达到 2000 并发、1000 QPS 或指定 p95 目标，最终结果以 artifacts 中相应时间的真实验收与压测报告为准。

## 本机实测环境与耐久性限制

| 组件 | 本机版本与入口 | 核对依据 |
| --- | --- | --- |
| Java | Amazon Corretto 17.0.19 | 本机 java 版本；backend/gateway 编译目标 17 |
| Spring Boot / Cloud | 3.5.14 / 2025.0.3 | 两个 pom.xml；Cloud 用于 Gateway |
| MySQL | 8.0.30，127.0.0.1:13306 | 独立数据目录、SELECT VERSION() |
| Redis | Windows 5.0.9，127.0.0.1:16379 | 原生版本及真实 Lua 测试 |
| Kafka | 4.3.0，127.0.0.1:19092 | 原生 broker；真实发布与指定 offset 消费校验 |
| Node.js | 22.17.1，前端端口 5179 | 本机版本；Vue 3 / Vite 版本以 package-lock.json 为准 |
| OS | Windows 测试机 | 单机本地验证 |

MySQL、Redis、Kafka 及应用和负载发生器都在同一台主机，结果不能直接外推到独立压测机或集群。原生 Redis 使用 AOF appendfsync=always、256 MiB、noeviction；Kafka 为单 broker/controller、512 MiB 堆、单副本。进程重启保留数据不等于多副本高可用，也不能抵御磁盘损坏或人为删除卷；acks=all 在单副本下仅确认这一台 broker。

2026-09-28 的原生 Kafka 曾因删除实验 topic 时 Windows 目录重命名 AccessDenied 导致唯一日志目录离线。离线隔离精确的已删除测试分区、保留原件与故障日志后，原业务数据恢复启动并完成健康消息收发。常规测试已取消自动删除 Kafka topic。保留位置是 `.runtime/kafka/quarantine/` 和 `.runtime/kafka/failure-*.log`。这也是 Windows 原生实验环境的已知限制。

Docker/WSL 在本机不可用。deploy/compose.yml 提供 MySQL 8.0.30、Redis 7.4.2、Kafka 4.3.0 的持久卷方案，尚未在本机执行；不能把 Redis 5 上的验证写成 Redis 7 已实测。最近核对的后端 Surefire 报告为 15 项通过、1 项 V4 测试跳过；该事实不代替完整业务验收和负载报告。

## 源码与操作文件入口

| 关注点 | 文件 |
| --- | --- |
| HTTP 接口与认证 | backend/src/main/java/com/peakrush/Api.java、Auth.java、WebConfig.java |
| V0–V3 路由、requestId、查询 | backend/src/main/java/com/peakrush/Purchases.java |
| MySQL 事务、支付与关闭 | backend/src/main/java/com/peakrush/Orders.java |
| Redis 工作集、预热、脚本执行 | backend/src/main/java/com/peakrush/Reservations.java |
| 原子预占、终态回补、预热 | backend/src/main/resources/reserve.lua、finalize.lua、warmup.lua |
| 消息消费与 DLQ | backend/src/main/java/com/peakrush/Messaging.java |
| Pending 恢复、Outbox、超时 | backend/src/main/java/com/peakrush/Workers.java |
| 表与唯一约束 | backend/src/main/resources/schema.sql |
| 限流规则与转发 | gateway/src/main/java/io/peakrush/gateway/PurchaseLimitFilter.java、GatewayPolicy.java、GatewayApplication.java |
| 依赖生命周期 | scripts/runtime-start.ps1、runtime-status.ps1、runtime-stop.ps1 |
| 应用生命周期 | scripts/app-start.ps1、app-stop.ps1 |
| 部署与已有审查 | deploy/README.md、deploy/compose.yml、deploy/BACKEND_REVIEW.md |
| 验收记录 | scripts/verification_api.py 等脚本及 artifacts/verification-*.json |

V4 的 Stream 写入仅在版本 4 分支发生；V3 不依赖 Stream 消费组或 XACK。现有 `scripts/verification_crash.py`、`scripts/verification_backend_process.ps1` 仅为后续 V4 崩溃验收准备，本轮未执行，不能据此声称已覆盖 Kafka 确认与 Stream XACK 之间的精确故障窗口。用户界面和本次交付验收以 V0–V3 为准。
