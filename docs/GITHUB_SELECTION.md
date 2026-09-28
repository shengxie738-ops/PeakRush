# PeakRush GitHub 项目选型对比

调研日期：2026-09-27。选型时结合原始项目需求与设计资料，通过 GitHub 插件核查仓库元数据、README、POM、关键控制器、服务、消息消费者与部分 SQL。本次没有构建、部署或压测。

## 推荐结论

首选 daydreamdev/seconds-kill 作为实验演进骨架，在新的 Java17/21 + Spring Boot3 精简工程中迁移开发 PeakRush。它只有 490 stars，属于几百星候选，推荐依据是最贴合 V0→V4 实验组织、已有 Kafka、体量小及 MIT 许可明确，而非代码已经可靠完整。它的 Redis/Kafka 核心需要重写，并非升级 POM 即可交付。

如果至少 1,000 stars 且已有登录和商品页面是硬约束，则选择 hfbin/Seckill 的 v2.0 分支作为业务模板备选。仍需升级 Boot3、重写 Lua 资格预占、RabbitMQ 迁移 Kafka、修正库存 SQL、补 requestId 与补偿；其项目许可证未明确，复用前需核实。

本次候选中没有发现兼具高星、现代栈、完整 Lua→Kafka→MySQL 可靠业务链路、低部署复杂度及 V0→V4 实验的现成工程。组件分别存在不等于完整业务已经实现。

## 原设计约束

业务流程：登录 → 活动/商品 → 短期凭证 → Gateway 限流 → 本地售罄 → Redis Lua 原子校验活动、库存和限购并预占 → Kafka → MySQL 幂等落单 → requestId 查询 PENDING/SUCCESS/FAILED → 模拟支付/超时关闭 → 幂等回补。

实验流程：V0 数据库同步基线 → V1 条件更新与唯一约束 → V2 Redis Lua → V3 Kafka、网关 → V4 补偿、故障恢复。统一硬件、模型、库存和压测脚本。实验契合度与改造成本优先于星数；未编造相似度百分比。

## 候选概览

Stars 是本次 API 查询快照。提交日期指默认分支最新提交，不代表最新业务开发；没有将 updated_at/pushed_at 当成 commit 时间。

| 项目 | Stars | 默认分支最新提交 | 许可 | 选型判断 |
|---|---:|---|---|---|
| [daydreamdev/seconds-kill](https://github.com/daydreamdev/seconds-kill) | 490 | 2019-06-18，README；src 2019-06-12 | MIT | 首选实验结构；Boot1.5.7/Java8，迁入新骨架 |
| [hfbin/Seckill](https://github.com/hfbin/Seckill) | 1,427 | 2023-05-13，v2.0 | 未发现明确项目许可 | 千星业务模板备选；Boot2.4.6/Java8/RabbitMQ |
| [qiurunze123/miaosha](https://github.com/qiurunze123/miaosha) | 26,593 | 2025-04-18，README | 未发现明确项目许可 | 设计资料参考；Boot2.6.1/Java8，多版本/RPC |
| [zaiyunduan123/springboot-seckill](https://github.com/zaiyunduan123/springboot-seckill) | 3,293 | 2022-03-06，README；src 2019-04-26 | 未发现明确项目许可 | 参考 MySQL 条件扣减；Boot1.5.8，预扣库存逻辑有问题 |
| [techa03/goodsKill](https://github.com/techa03/goodsKill) | 2,445 | 2026-07-07 | MIT | 现代工程参考；Boot4.0.6/JDK21/Vue3，裁剪成本高 |
| [macrozheng/mall](https://github.com/macrozheng/mall) | 84,835 | 2026-09-15 | Apache-2.0 | 完整商城参考；Boot3.5.14/Java17，主链路为同步下单 |
| [macrozheng/mall-swarm](https://github.com/macrozheng/mall-swarm) | 13,152 | 2026-05-21 | Apache-2.0 | Gateway/微服务参考；主链路仍不等同异步抢购 |
| [codingXiaxw/seckill](https://github.com/codingXiaxw/seckill) | 2,166 | 2020-05-21 | 未发现明确项目许可 | V1 SQL参考；旧 SSM/JSP，整体迁移价值有限 |
| [Grootzz/dis-seckill](https://github.com/Grootzz/dis-seckill) | 545 | 2023-05-03，依赖升级合并 | 未发现明确项目许可 | Boot2.1.5/Dubbo/RabbitMQ；预占与回灌逻辑需修整 |
| [wayn111/newbee-mall-pro](https://github.com/wayn111/newbee-mall-pro) | 509 | 2024-04-24 | GPL-3.0 | Boot3.2.3/Java21，功能齐全但 Thymeleaf/RabbitMQ 与原方案有差异 |

## 首选项目的证据与必改项

[IndexController](https://github.com/daydreamdev/seconds-kill/blob/57a31cb2c15b082bc84472b479e17534ee9ace53/src/main/java/com/daydreamdev/secondskill/controller/IndexController.java#L65) 已包含 createWrongOrder、createOptimisticOrder、createOptimisticLimitOrder、createOrderWithLimitAndRedis、createOrderWithLimitAndRedisAndKafka，适合整理为统一实验策略。这是首选的主要依据。其 [MIT 许可](https://github.com/daydreamdev/seconds-kill/blob/57a31cb2c15b082bc84472b479e17534ee9ace53/LICENSE) 明确。

但它的 V2/V3 不是原设计的完成品：

- [POM](https://github.com/daydreamdev/seconds-kill/blob/57a31cb2c15b082bc84472b479e17534ee9ace53/pom.xml) 为 Boot1.5.7/Java8，建议迁入 Boot3 工程，不整包继承旧依赖。
- [OrderServiceImpl](https://github.com/daydreamdev/seconds-kill/blob/57a31cb2c15b082bc84472b479e17534ee9ace53/src/main/java/com/daydreamdev/secondskill/service/impl/OrderServiceImpl.java#L83) 先读取 Redis 库存、发送携带 version 的 Stock，再在消费端更新数据库；没有入队前 Lua 原子资格预占。limit.lua 只负责限流。
- [StockWithRedis](https://github.com/daydreamdev/seconds-kill/blob/57a31cb2c15b082bc84472b479e17534ee9ace53/src/main/java/com/daydreamdev/secondskill/common/StockWithRedis/StockWithRedis.java#L23) 在一个 Jedis 实例上 multi，但 [RedisPoolUtil](https://github.com/daydreamdev/seconds-kill/blob/57a31cb2c15b082bc84472b479e17534ee9ace53/src/main/java/com/daydreamdev/secondskill/common/utils/RedisPoolUtil.java) 的 decr/incr 重新取连接，未入该事务队列，不能照搬。
- stock_order 缺少 userId、activityId、requestId。接口在限流或异常后仍统一返回排队中。需增加完整模型、明确状态和结果查询。
- kafkaTemplate.send 后立即记发送成功，未检查异步结果；发送失败处理、消费幂等、重试/死信、超时关单、幂等补偿与对账须新增。
- Vue3 用户端、活动管理、模拟支付和统一压测需补齐。

该推荐节省的是实验组织和技术路线摸索时间，业务与可靠性增量仍是自己的课设工作。

## 高星项目为什么没有胜出

### hfbin/Seckill

有登录、商品、同步下单、Redis DECR→RabbitMQ 异步下单、按用户商品查询结果；结构小，业务流程较近。但 [GoodsMapper.xml](https://github.com/hfbin/Seckill/blob/20275079f9e0c27170abd5679b9a2304344db345/src/main/resources/mybatis/mappers/GoodsMapper.xml#L215) 的扣库存只有 goods_id 条件，没有 stock_count>0；判重与预扣非 Lua 原子动作；[MQReceiver](https://github.com/hfbin/Seckill/blob/20275079f9e0c27170abd5679b9a2304344db345/src/main/java/cn/hfbin/seckill/mq/MQReceiver.java#L33) 把补偿和 Redis 恢复留为 TODO。可复用业务模板，不能认定已实现可靠 V1～V4。

### qiurunze123/miaosha

设计资料丰富，但 [MiaoshaController](https://github.com/qiurunze123/miaosha/blob/e58017658e549b63fc4db2160d2325ccd7f8435b/miaosha-v2/miaosha-web/src/main/java/com/geekq/miaosha/controller/MiaoshaController.java#L95) 调用 Lua 限流后忽略 boolean 返回值；Lua 用于限流而非库存限购。[关单任务](https://github.com/qiurunze123/miaosha/blob/e58017658e549b63fc4db2160d2325ccd7f8435b/miaosha-v1/src/main/java/com/geekq/miaosha/timeTask/OrderCloseTask.java#L28) 调度被注释，[closeOrder](https://github.com/qiurunze123/miaosha/blob/e58017658e549b63fc4db2160d2325ccd7f8435b/miaosha-v1/src/main/java/com/geekq/miaosha/service/OrderService.java#L60) 仅查询打印。高星不代表已具备可靠补偿。

### techa03/goodsKill

有现代栈、Vue3、Gateway/Kafka、多策略与观测，MIT 明确。但 [前端 API](https://github.com/techa03/goodsKill/blob/e77c98571a4785657ea6cb834842308f40698e75/goodskill-customer-ui/src/api/index.js#L4) 默认 USE_MOCK=true；[真实 C 端](https://github.com/techa03/goodsKill/blob/e77c98571a4785657ea6cb834842308f40698e75/goodskill-seckill-provider/goodskill-service/src/main/java/com/goodskill/service/controller/SeckillCustomerController.java#L63) 同步扣减后调用订单服务，直接返回 orderId。[Lua 策略](https://github.com/techa03/goodsKill/blob/e77c98571a4785657ea6cb834842308f40698e75/goodskill-seckill-provider/goodskill-service/src/main/java/com/goodskill/service/mock/strategy/impl/RedisMongoReactiveStrategy.java#L60) 是单独的模拟方案，不包含用户限购/requestId；Kafka 是另一路模拟，不能拼成已完成的 Lua→Kafka 链路。

订单服务使用 MongoDB，偏离原设计的 MySQL 事实源。README 还指出 ElasticJob 与 Boot4 不兼容导致 job 模块无法启动，框架兼容未完整验证。Nacos/Dubbo/ES/Seata/AI 等增加裁剪成本。更适合参考多策略设计和页面，不建议整仓作为默认首选。

### mall 与 mall-swarm

不能以技术陈旧为由淘汰：POM 已是 Boot3/Java17，关联 mall-admin-web 已 Vue3/Element Plus/Pinia。问题是 [建单方法](https://github.com/macrozheng/mall/blob/master/mall-portal/src/main/java/com/macro/mall/portal/service/impl/OmsPortalOrderServiceImpl.java#L223) 先同步落库，随后 RabbitMQ 用于延迟取消订单，并非 Kafka 异步建单。TTL 死信转发也不等于抢购消费失败的补偿队列。完整商城业务和微服务部署会扩大课题范围，建议参考商品/后台/订单模型。

### 其他候选

zaiyunduan 的 [SQL](https://github.com/zaiyunduan123/springboot-seckill/blob/6343f3c33836edf26df7005e02ba9643818fdb75/src/main/java/com/jesper/seckill/mapper/GoodsMapper.java#L24) 有 stock_count>0 与 version，但 [控制器](https://github.com/zaiyunduan123/springboot-seckill/blob/6343f3c33836edf26df7005e02ba9643818fdb75/src/main/java/com/jesper/seckill/controller/SeckillController.java#L86) 在 Redis 负库存后重载数据库库存，可能覆盖尚未落库请求的预占额度。codingXiaxw 的 [条件更新](https://github.com/codingXiaxw/seckill/blob/master/src/main/resources/mapper/SeckillDao.xml#L9) 与 [联合主键](https://github.com/codingXiaxw/seckill/blob/master/src/main/sql/schema.sql#L28) 适合 V1 教学。

Grootzz 的 [控制器](https://github.com/Grootzz/dis-seckill/blob/master/dis-seckill-gateway/src/main/java/com/seckill/dis/gateway/seckill/SeckillController.java#L148) 先预扣后判重，部分返回未回补；服务又用 DB 库存覆盖 Redis。newbee-mall-pro 虽现代，但 [Lua](https://github.com/wayn111/newbee-mall-pro/blob/84bf182ae34186eeb16139256bba3283a1dbc722/src/main/java/ltd/newbee/mall/redis/RedisCache.java) 未合并限购，[消费者](https://github.com/wayn111/newbee-mall-pro/blob/84bf182ae34186eeb16139256bba3283a1dbc722/src/main/java/ltd/newbee/mall/mq/reciver/OrderDirectReceiver.java) 的短期缓存幂等与超过重试次数后确认消息，也不能视为完整可靠性。

## 开发迁移顺序

| 阶段 | 工作 | 验收重点 |
|---|---|---|
| 准备 | 固定 daydream 提交 57a31cb2c15b082bc84472b479e17534ee9ace53，新建 Boot3 精简工程与统一模型 | 最小启动、保留来源许可、数据库就绪 |
| V0 | 用户/商品/活动/订单基础功能，同步数据库基线 | 单用户闭环和基线数据 |
| V1 | 条件扣库存、requestId 唯一键、用户活动商品限购约束 | 并发不超卖、不重复 |
| V2 | 预热、Lua 原子资格预占；成功请求仍同步落库 | 无效流量前置，库存守恒 |
| V3 | Kafka 异步建单，requestId 状态查询，Gateway 限流，本地售罄 | 受理和完成分离，积压可观测 |
| V4 | 可靠发送状态处理、消费幂等、重试死信、超时关闭、幂等回补、对账 | 消费者/DB故障后恢复 |
| 答辩 | 同环境、同库存、同脚本运行各版 | 正确性、吞吐、延迟、MQ lag 和恢复证据 |

初期采用模块化单体即可，V3 再把消费者独立运行。不必先引入 Dubbo/Nacos/Seata/分库分表。保持原 Kafka 方向，不因仓库已有 RabbitMQ 就自动改变设计。

V2 应明确成功请求仍同步落库，V3 才改变为消息异步化，确保对照实验因果清楚。必须分别记录受理 QPS、订单完成 TPS、受理 P95、完成 P95、业务拒绝和系统错误，不能把 PENDING 的快速返回直接当作订单性能提升。

requestId 应在预占前生成或恢复，贯穿 Redis、事件与订单。发送超时并不证明事件未到达，补偿需结合请求状态与对账，以免订单已成功又回补库存。原文档中的 Lua 同时预占并 XADD 到 Redis Stream，再转 Kafka，可作为 V4 后续讨论方案，本轮不改变已定架构。

## 结论边界

选择 daydream 代表实验演进优先，接受几百星并自行补业务和可靠性；选择 hfbin 代表先复用业务界面，接受核心重构与技术迁移。goodsKill 和 mall-swarm 适合更大工程学习目标，组件多不等于更适合本次课设。

推荐基于静态源码适配分析，没有实测工时或性能保证。作者 README 的 QPS/TPS 不能跨硬件、接口和错误口径直接比较，也不能替代自己的验收结果。
