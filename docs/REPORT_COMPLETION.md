# PeakRush 报告任务完成说明

2026 年 10 月 9 日，根据项目报告中明确列出的缺口，完成用户确认的“课程实验与商品扩展”范围。保留 V0—V3 现有业务架构，新增独立可运行课程套件、实际商品目录和运行证据。

## 课程任务与实现

| 报告栏目 | 本次补齐内容 | 实现及证据 |
| --- | --- | --- |
| 5.1 竞态与互斥 | 稳定复现 1 件库存被卖出 2 件，synchronized、ReentrantLock、AtomicInteger CAS 对照均只接受 1 单 | CourseLabs 的 inventory-race |
| 5.2 死锁检测 | 构造反向加锁，ThreadMXBean 检测并捕获真实 jstack 栈；中断后全部实验线程结束 | deadlock，JSON 内含堆栈 |
| 5.3 线程通信 | 容量 4 队列的 wait/notifyAll 与 Condition 生产消费，验证 100 项 FIFO、无丢失及无重复 | 两个 producer-consumer 实验 |
| 5.4 同步工具 | CountDownLatch 集合点、Semaphore 峰值 3、CyclicBarrier 三轮协作 | synchronizers |
| 5.5 线程池 | 具名有界池的精确拒绝；相同 64 次真实 TCP 请求的新线程与线程池对照 | bounded-thread-pool 与 WorkloadComparisons |
| 5.6 并发容器 | 手动锁 HashMap 与 ConcurrentHashMap.merge 的相同 40000 次更新及耗时对照 | concurrent-containers |
| 5.7 原子类与 ThreadLocal | CAS 库存控制、同一复用线程的上下文泄漏演示、异常 finally 清理 | inventory-race 与 thread-local |
| 5.8 异步编排 | thenCombine/allOf、异常传播；同样 18 次接口请求、6 商品聚合的串行与并行对照 | completable-future 与 WorkloadComparisons |
| 5.9 虚拟线程 | 同一 JDK23 的平台线程与真实虚拟线程执行 TCP 阻塞 I/O；平均、P95/P99、实际线程数、CPU/堆曲线 | blocking-io |

运行命令、参数、指标定义和实测表见 [课程实验说明](COURSE_LABS.md)。主代理最终重新运行 JDK17/JDK23，各 10 项通过，退出码为 0。JDK17 不支持虚拟线程，该分支明确记录 SKIPPED；JDK23 真实执行 80 个虚拟线程任务。

最终复核数据：[JDK17](../artifacts/course-labs-jdk-17.0.2-20261008T171228050Z.json)、[JDK23](../artifacts/course-labs-openjdk-23.0.2-20261008T171232053Z.json)。文件名采用 UTC，报告日期采用北京时间。

这些实验由独立 JVM 运行。业务服务仍采用 JDK17、数据库事务、Redis Lua 和 Kafka；教学实验不改变线上库存算法，也不作为真实秒杀容量的证明。线程池降低了线程创建数，但固定并发上限可能增加排队时延；实验保留该结果，没有强制断言优化一定更快。

## 商品目录与页面

| 分类 | 商品 |
| --- | --- |
| 数码影音 | 轻羽无线耳机、复古全画幅微单相机、全天候运动智能手表、声岛便携蓝牙音箱、序列机械键盘 |
| 居家生活 | 晨光意式咖啡机、光序桌面台灯 |
| 运动户外 | 山径轻量越野鞋 |
| 旅行出行 | 远行轻量登机箱 |

六款新品各有独立生成的专业广告图；素材及完整提示词见 [素材说明](ASSETS.md)。商品和分类写入真实数据库，活动预热及启用通过管理员 API 完成。当前目录场次 id 为 14，后续场次 id 为 15，各绑定九款商品。连续两次初始化复用相同商品与活动 id，已接受的库存、订单和历史活动保持可追溯。

`seed_catalog.py` 使用本机 OS 文件锁，先检查服务端现状再补商品及目录活动，支持草稿、预热中断恢复。有效场次保持原有库存，过期后创建新代次。旧接口创建商品默认“其他好物”，旧接口更新商品时保留已有分类。商品新增分类列通过启动时增量迁移完成。

业务页取消原有六商品展示上限，聚合当前及未来场次并按商品去重；存在多个同款活动时优先仍可购买的商品。支持四类筛选、倒计时边界、过期空态、定期与回到页面刷新、手动查看历史，以及静默刷新成功后清除旧错误。管理台支持分类保存。

## 验证结果

| 检查 | 实际结果 | 证据 |
| --- | --- | --- |
| 后端真实 MySQL/Redis 测试与单元测试 | 21 通过、1 个 V4 测试跳过 | [汇总](../artifacts/report-verification-20261009.json) |
| 前端测试与构建 | 69 通过；TypeScript/Vite 构建成功 | 同一汇总及前端验收记录 |
| 初始化脚本离线测试 | 14 通过，包括重复执行、失去创建响应、预热续跑及锁 | scripts/tests/test_seed_catalog.py |
| 业务 API | V0—V3 百人抢十件及幂等、支付、取消等 57 项通过 | [API 记录](../artifacts/verification-api-20261009.json) |
| 新目录实际 API | 21 项通过，包括九图片响应、分类、新品 V3 下单、支付、取消回补 | [目录记录](../artifacts/verification-catalog-20261009.json) |
| 全库不变量 | 7 项违规数均为 0 | [库存与订单核对](../artifacts/verification-invariants-20261009.json) |
| 重复初始化 | 两次返回同一九商品和两场活动 id | [首次](../artifacts/catalog-seed-20261009.json)、[复跑](../artifacts/catalog-seed-repeat-20261009.json) |
| 真实页面 | 九商品、四分类数量、未来九按钮禁购、390 px 无横向溢出、控制台无错误/警告 | [实屏记录](../artifacts/ui/catalog-20261009/verification.json) |

本机实际 MySQL 是 3306 的既有实例，测试与不变量工具已支持环境变量指定连接，生产默认独立部署配置仍为 13306。API 与不变量工具可用 `--output` 保存新证据，原始 2026-09-28 记录保留。课程编译产物与日志位于被忽略的 `courses/build/`。

## 复现

应用按 [本机启动指导](STARTUP_GUIDE.md) 启动后执行：

```powershell
python scripts/seed_catalog.py
python scripts/verification_catalog.py
python -m unittest discover -s scripts/tests -v
.\scripts\verify_course_labs.ps1 -JavaHomes @(
  'G:\Java WEB\jdk-17.0.2',
  'C:\Users\17894\.jdks\openjdk-23.0.2'
)
```

访问 [业务页面](http://127.0.0.1:5400/app/)。目录场次到期后再次初始化即可生成新的可参与场次。真实目录验收会新增独立测试用户、一个模拟已支付订单和一个取消订单，用库存流水与不变量验证结果。

## 仍需后续工作

原报告的 2000 请求突发 P95 小于 500 ms 目标、独立压测机、集群多副本、真实支付、Compose 和精确 V4 崩溃恢复，不属于本次确认范围。本次没有用教学 TCP 的时延替代那些指标。成员姓名、贡献比例、账号费用和远程仓库协作证据需要实际信息，未填造记录。

初始化通过既有管理员 API 实现。服务端尚未给商品创建及活动创建提供幂等键；跨机器同时初始化或创建超时后数据库仍在提交的极端窗口，仍可能产生重复，需管理员根据报告核对。本机锁和创建响应不确定时重读现状可减少该风险。
