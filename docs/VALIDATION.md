# V0–V3 验收报告

日期：2026-09-28。按用户“先把 V3 做完”的要求，本轮交付范围为 V0–V3。功能正确性通过；持续场景性能达标，2000 请求突发场景延迟未达目标。V4 高级故障实验不在本轮验收内。

## 环境与测量口径

真实服务运行于单台 Windows 测试机，使用 JDK17、MySQL8.0.30、Windows Redis5.0.9、Kafka4.3.0。Gateway、后端、数据库、缓存、消息代理和 Python3.11 压测器均在本机，入口为 127.0.0.1:8080。

所有阶段使用同一网关，因此均包含入口 Redis 限流开销。Redis 使用 AOF always；Kafka 单节点、复制因子 1。没有分布式高可用或磁盘丢失耐久性证明。

注册、登录、动态路径获取在计时之前完成。每次抢购 quantity=1、新 Idempotency-Key。HTTP QPS 包含售罄、限购及限流响应，不代表成功下单 TPS。P95 是 HTTP 请求耗时；异步订单完成耗时另记 settledSeconds。订单 TPS 使用成功订单数 / 从发起到全部结果查询完毕的总时间，是整场平均值，不是消费者最大容量。

## 功能与正确性证据

- 后端 Surefire：InputRules 2、MySQL 事务 5、Redis 8，共 15 项通过；V4 StreamBridge 测试 1 项跳过。
- Gateway：3 项策略测试通过；真实限流测试 45 次请求中 25 次 429，窗口后恢复，篡改令牌 401。
- 前端：7 项 transport 测试通过，TypeScript 与 Vite 构建通过。截图与真实操作见 [界面验收](../design-qa.md)。
- [真实 API 验收](../artifacts/verification-api.json)：57 项通过，覆盖四阶段 100 人抢 10 件、所有者校验、重复提交、payload 冲突、quantity=2、模拟支付、重复取消、回补后再购及重复预热不重置库存。
- [全库不变量](../artifacts/verification-invariants.json)：7 项违规数量全部为 0。分别检查库存守恒、重复用户订单、支付状态关联、成功请求关联订单、失败请求不挂有效订单、关闭订单有释放流水。
- 页面实测：V3 订单 68546 从 PENDING 转 SUCCESS 后模拟支付为 PAID；历史演示订单 969 取消成功；后台创建 V3 活动 65 成功；未来场次禁购；手机 390px 无横向溢出。
- 后端代码复核见 [审核记录](../deploy/BACKEND_REVIEW.md)。修复包括 UTC Outbox 时间、活跃库存预热保护和死信处理反馈循环。

## 持续负载：2000 用户、1100 请求/秒、30 秒、1000 件库存

每阶段发出 33000 次请求。V0/V1 排队使完成时间超过 30 秒。结果如下：

| 阶段 | HTTP QPS | HTTP P95 ms | 峰值在途请求 | 最终成功订单 | 整场平均订单 TPS | HTTP 429 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| V0 | 628.08 | 5340.698 | 2000 | 1000 | 19.02 | 0 |
| V1 | 900.4 | 4213.428 | 2000 | 1000 | 27.28 | 664 |
| V2 | 1092.18 | 4785.452 | 2000 | 1000 | 33.09 | 4103 |
| V3 | 1092.95 | 31.064 | 128 | 1000 | 27.76 | 0 |

四阶段最终均产生 1000 个成功订单，对应 1000 件库存；测量时数据库剩余库存为 0，未超卖。5xx 和网络错误率均为 0。V0/V1 的 FAILED 是业务拒绝，V2/V3 的 ALREADY_PURCHASED 为 409，并非服务端故障。

V3 在该持续场景达到 1000 QPS、P95 < 500ms、服务/网络错误率 < 1% 的目标。配置 2000 用户不等于 2000 请求同时在途；V3 实际峰值是 128。V3 HTTP 返回 PENDING 后仍需 Kafka 消费；全部 1000 个结果查明成功用时 36.029 秒，不能把 31.064ms 解释为订单持久化完成时间。

原始数据：[V0](../artifacts/load-V0-1790571118.json)、[V1](../artifacts/load-V1-1790571158.json)、[V2](../artifacts/load-V2-1790571191.json)、[V3](../artifacts/load-V3-1790571230.json)。

## 突发负载：统一释放 2000 个请求

采用 asyncio.Event 屏障，先创建全部任务再统一释放。正式结果见 [V3 burst](../artifacts/load-V3-1790571519.json)：

- 实际峰值在途 2000，2000 次请求完成，HTTP QPS 1048.7。
- HTTP P95 1694.257ms，含调度等待的 P95 1900.445ms；未达到 500ms。
- 压测器调度延迟 P95 957.081ms，同机 Python 事件循环与连接建立会影响结果，不能将其全部归因于后端，也不能宣称网络同时到达。
- 1000 次 PENDING、200 次 SOLD_OUT、800 次 429；服务端/网络错误为 0。
- 最终 SUCCESS 1000，全部结果查询完成用时 10.137 秒，整场平均订单 TPS 98.65。
- 报告库存快照时异步 Redis 投影还在推进；之后只读核对该活动 Outbox PENDING=0、Redis pending=0、Redis stock=0，数据库订单数量和购买数量均为 1000。

load-V3-1790571344.json 是屏障修复前的探索记录，任务边创建边执行，不能证明同时 2000 在途。本轮不采用其漂亮的延迟数字作为突发验收结果；原始记录保留，管理台注明 exploratory/not acceptance。

## 持久化与恢复边界

当前交付包括请求幂等、唯一约束、数据库事务、Lua 幂等回补、V3 pending 重试和 Outbox 投影。未支付订单到期关闭并归还库存；压测后延时检查可看到库存回升，这不否定测量结束时的 1000 个历史成功订单。库存守恒按 CREATED+PAID 数量统计。

中断后确认项目服务停止，使用原有数据执行 app-start.ps1 -SkipBuild 恢复成功，恢复后再跑 7 项全库不变量仍全部为 0。该观察不等于系统性的故障注入实验。

原生 Windows Kafka 曾在删除测试 topic 时遭遇映射文件目录重命名拒绝，代理退出；仅隔离已删除的测试分区后恢复，并真实验证发布/消费。业务 topic 和数据库未重置。自动测试已不再自动删除 Kafka topic；Windows 原生运行属于开发环境限制。

V4 崩溃/断点故障脚本没有执行，不声称完成 V4。Compose 方案未在本机运行，不将 Redis5 实测冒充 Redis7 认证。未采集长时间 CPU/数据库连接/Redis 时延曲线，也未验证多机水平扩容。后续性能调优应使用独立压测机、稳定运行更久并补充这些指标。

## 复现

在项目根目录、真实服务就绪后：

~~~powershell
python -m pip install -r scripts/requirements.txt
python scripts/verification_api.py
python scripts/verification_gateway.py
python scripts/verification_invariants.py
python scripts/verification_load.py --versions V0,V1,V2,V3 --users 2000 --rps 1100 --seconds 30 --stock 1000
python scripts/verification_load.py --versions V3 --users 2000 --burst --stock 1000
~~~

脚本会新增隔离活动和测试账号、保留报告，并下线完成的压测活动，不覆盖演示活动。
