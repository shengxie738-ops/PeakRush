# Java 并发课程实验

实验代码位于 `courses/src/peakrush/courses/`，由独立 JVM 执行，不访问后端、MySQL、Redis、Kafka，也不修改商品库存。课程 V1—V9 表示知识点；业务 V0—V4 表示下单架构，编号不能混用。

## 运行

在项目根目录的 PowerShell 执行：

```powershell
.\scripts\verify_course_labs.ps1
```

运行器查找环境变量指定的 JDK、当前机器的 JDK17 和用户 `.jdks` 目录。也可明确选择：

```powershell
.\scripts\verify_course_labs.ps1 -JavaHomes @(
  'G:\Java WEB\jdk-17.0.2',
  'C:\Users\17894\.jdks\openjdk-23.0.2'
) -Tasks 80 -DelayMs 40
```

每个运行时都用 `javac --release 17` 编译标准库源码，无 Maven 或额外依赖。JDK17 明确跳过虚拟线程；JDK21 及以上通过反射创建真实虚拟线程执行器，支持的运行时无法执行时验收失败。JDK17 与 JDK23 的代码、TCP 服务模型、任务数和回复延迟相同；平台/虚拟对照在同一个 JDK21+ JVM 内执行。

输出为 `artifacts/course-labs-<JDK名称>-<UTC时间>.json`；编译类和进程日志位于被忽略的 `courses/build/`。运行器检查 Java 退出码、十项实验状态和完整报告。每个常规协调等待不超过 8 秒，jstack 等待不超过 5 秒；独立 Java 进程默认总时限 90 秒，超时只终止运行器刚启动的课程进程。TCP 模式有独立网络/任务时限和资源清理。

## 覆盖与判据

| 课程项 | JSON 实验 id | 实际行为与断言 |
| --- | --- | --- |
| V1 竞态与互斥 | inventory-race | 两请求检查库存后用屏障同时扣减，稳定复现 1 件库存卖出 2 件、剩余 -1；synchronized、ReentrantLock、AtomicInteger CAS 各只允许 1 单、剩余 0。 |
| V2 死锁 | deadlock | 两个具名线程反向持有 ReentrantLock，ThreadMXBean 检测两线程；JDK 提供 jstack 时捕获自身 JVM 的真实死锁栈并嵌入 JSON；interrupt + finally 解锁，线程结束。 |
| V3 线程通信 | monitor-producer-consumer、condition-producer-consumer | 容量 4 的队列，分别使用 wait/notifyAll 和 Condition.await/signal；生产与消费 100 个值，逐个断言 FIFO、数量及无丢失。使用 while 重查条件。 |
| V4 同步工具 | synchronizers | CountDownLatch 对齐 12 个任务，Semaphore 限定同时进入者为 3，结束后全部许可恢复；4 个参与者重复通过 CyclicBarrier 三轮。 |
| V5 线程池 | bounded-thread-pool | 2 个核心/最大线程、ArrayBlockingQueue 容量 2、具名线程工厂、AbortPolicy；第 5 个任务必然拒绝、其余 4 个完成。另对相同 64 个真实 TCP 请求比较每任务 new Thread 与 8 线程有界池，记录实际创建数、峰值、平均/P95 与总时间。 |
| V6 并发容器 | concurrent-containers | 4 个线程各执行 10000 次共享键计数；手动锁 HashMap 与 ConcurrentHashMap.merge 都得到 40000，并分别记录耗时。 |
| V7 原子类与 ThreadLocal | inventory-race、thread-local | CAS 库存对照；单线程池先显示未清理的 alice 上下文泄漏，再在异常路径的 finally 中 remove，复用同一工作线程读取值为 null。 |
| V8 异步编排 | completable-future | thenCombine/allOf 与异常传播断言保留；另对 6 个商品的 DETAIL/PRICE/INVENTORY 三接口执行相同 18 个真实 TCP 请求，比较串行、thenCombine、allOf，逐项验证任务标识、商品、数量、响应值及聚合顺序，记录平均/P95 与总时间。 |
| V9 虚拟线程 | blocking-io | 真实本地 TCP 阻塞读取；平台线程固定池上限 16 与每任务虚拟线程分别运行相同任务。记录平均、P95/P99、总用时、吞吐、线程类型、资源曲线。JDK17 对虚拟线程记录 SKIPPED 原因。 |

错误库存演示属于“检查—修改”业务竞态：即使 get 和 decrementAndGet 各自原子，两者合起来仍非原子。CAS 只说明单 JVM 单变量控制，不替代业务数据库事务、Redis Lua 或分布式限购规则。死锁使用可中断显式锁以便安全清理，不使用 Thread.stop。

## I/O 与观测口径

阻塞 I/O 使用绑定到回环地址的 ServerSocket。客户端建立 TCP 连接后阻塞读取服务端响应；服务端用受控调度器延迟回复，不访问外部服务。延迟与任务数可配置，最大 256 个任务、250 ms 延迟。客户端连接入场由 Semaphore 限定为 128，避免本机 TCP 监听队列被瞬时连接压满；相同限制应用于两种模式并写入 `maxInFlightClients`。等待该许可的时间也计入任务延迟。它是可复现的阻塞 I/O 教学负载，不是系统真实下单压测。

每个任务的延迟从提交时刻计算到读完响应，包括平台线程队列等待；平均值为全部任务时延的算术平均，P95/P99 是同一组任务时延分位数。总吞吐由完成任务数除以整场时间计算。两种模式的工作负载一致，但线程上限不同，应同时查看 `platformPoolSize`、`virtualTaskThreads` 与实际连接峰值。

资源报告包含基线、结束快照、采样间隔、连续样本与峰值，记录 JVM 堆使用量和进程 CPU 时间/负载等实际可用指标。CPU 时间是累计进程 CPU 使用量，不是墙钟时长；不可用的系统指标保留明确缺省值。峰值包含两端快照。JVM、JIT、采样开销和同时运行的其他程序都会影响结果，单次差异不能宣称业务吞吐提高。

本套件没有把实验结果写入后端实验表。业务接口、不变量与真实 Kafka 故障验收仍由原有 verification 脚本负责；独立课内实验不证明业务服务的死锁或虚拟线程行为已变更。

V5/V8 的接口负载位于 `WorkloadComparisons.java`：服务端持有六种不同商品的名称、分单位价格和库存，每个请求携带操作、商品与数量，20 ms 后从 TCP 返回真实序列化响应。三类请求与响应均有多种值，不用常量任务冒充接口比较。各模式复用相同请求计划；报告保存相同的 SHA-256 工作负载摘要及全部响应/聚合值，验收要求数量、内容与摘要相同。

V5 的 `createdThreads` 只统计客户端任务工作线程，不含每种模式相同的服务端接收和回复线程。平均/P95 从任务提交到验证响应，包含线程池排队。逐任务版本最多并发 64，线程池为 8；耗时差同时包含并发上限与复用方式的影响，不能单独归因于线程复用效率。V8 的平均/P95 衡量一个商品的三接口聚合，从该商品发起查询到三结果组合完成；串行基线用调用者现有线程，额外创建工作线程数为 0，实测活动峰值为 1。两种并行模式使用显式具名有界执行器。所有比较均不强制断言速度提升。

## 实测记录

2026-10-09（北京时间），补入 V5/V8 相同负载对照后，主线程按上述明确 JDK 列表最终重新执行运行器，两个 JVM 均为 **10 项通过、进程退出码 0**。新比较的数量、值、线程计数、峰值、工作负载摘要和计时也进入验收。ThreadMXBean 与实际 jstack 均捕获教学死锁，实验线程随后终止。JDK23 的 80 个 I/O 客户端任务全部在真实虚拟线程运行；JDK17 对该分支正确标记 SKIPPED。

| JDK23，V5 相同 64 个 TCP 请求 | 每任务 new Thread | 8 线程有界池 |
| --- | ---: | ---: |
| 实际创建客户端线程 / 活动峰值 | 64 / 64 | 8 / 8 |
| 完成请求数 | 64 | 64 |
| 平均 / P95 提交至响应 ms | 63.183 / 67.338 | 128.345 / 233.189 |
| 整场用时 ms | 128.384 | 234.962 |

这次受控池降低线程数量，同时排队更久。结果不宣称线程池必然降低时延；有界池的目的也包括限制资源占用与明确拒绝过载。

| JDK23，V8 相同 18 个 TCP 请求、6 个商品聚合 | 串行 | thenCombine | allOf |
| --- | ---: | ---: | ---: |
| 额外创建客户端线程 / 活动峰值 | 0 / 1 | 18 / 18 | 18 / 18 |
| 完成请求数 / 聚合数 | 18 / 6 | 18 / 6 | 18 / 6 |
| 平均 / P95 商品聚合时延 ms | 86.306 / 94.661 | 36.086 / 38.796 | 22.326 / 22.960 |
| 整场用时 ms | 518.550 | 41.497 | 23.688 |

| 同一 JDK23，80 个任务、服务端延迟 40 ms | 平台线程池（16） | 虚拟线程（每任务） |
| --- | ---: | ---: |
| 平均提交至完成时延 ms | 137.781 | 54.637 |
| P95 / P99 ms | 230.509 / 230.732 | 56.670 / 56.865 |
| 整场用时 ms | 234.370 | 59.801 |
| 完成任务 / 秒 | 341.340 | 1337.773 |
| 实际虚拟任务线程数 | 0 | 80 |
| 采样数 | 53 | 13 |
| JVM 进程 CPU 时间增量 ms | 250.000 | 78.125 |
| 采样峰值 JVM 堆字节 | 18415616 | 19464192 |

资源采样包括本地服务端、JIT、采样器及清理；两个模式顺序执行，GC 可能发生，不能把堆峰值解释成通用内存节省比例。目标采样间隔为 5 ms，实际间隔和起止快照在 JSON 中。整场墙钟用时与进程 CPU 时间增量是分别测量的不同指标，后者统计整个 JVM 进程而非仅客户端任务。不能仅凭一组短时 CPU 差值宣称通用 CPU 节省效果；若短窗口累计差值为 0，也不能据此证明任务完全不消耗 CPU。原始起止值和连续采样均保留。

完整覆盖新增对照的主线程最终实测证据：[JDK17](../artifacts/course-labs-jdk-17.0.2-20261008T171228050Z.json)、[JDK23](../artifacts/course-labs-openjdk-23.0.2-20261008T171232053Z.json)。JDK17 平台线程平均 149.332 ms、P95 244.041 ms；完整资源曲线与各课程断言在 JSON 中。此前报告保留作开发记录，最终完成声明仅引用这两份主线程最终实测记录。

另外，I/O 独立自测在 JDK17 的最小输入 `1/1` 与 JDK23 的最大输入 `256/250` 通过。自测同时验证非法参数拒绝、预先中断时保留 InterruptedException、清理不产生附带错误以及无存活的实验线程。可在运行器编译后复现：

```powershell
& 'G:\Java WEB\jdk-17.0.2\bin\java.exe' -cp 'courses/build/jdk-17.0.2' peakrush.courses.IoComparison 1 1
& 'C:\Users\17894\.jdks\openjdk-23.0.2\bin\java.exe' -cp 'courses/build/openjdk-23.0.2' peakrush.courses.IoComparison 256 250
& 'G:\Java WEB\jdk-17.0.2\bin\java.exe' -cp 'courses/build/jdk-17.0.2' peakrush.courses.WorkloadComparisons
& 'C:\Users\17894\.jdks\openjdk-23.0.2\bin\java.exe' -cp 'courses/build/openjdk-23.0.2' peakrush.courses.WorkloadComparisons
```

具体日期、JDK版本、断言结果与数字以每次 JSON 为准。`passed=false` 的文件保留开发阶段的失败证据，不能纳入通过声明：初始空套件验收失败，I/O 尚为空实现时完整套件也被验收拒绝；实际实现完成后的两份最终记录均通过。
