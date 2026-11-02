# PeakRush 高并发抢购课设 · V5

V5 是 2026-11-02 的交付版本：在 V4 的 Redis Stream 异步落单与实时指标之上，完成 V4 审查整改、Stream 条目压缩、bridge 故障恢复优化和压测快照收敛。V0–V4 仍是可创建的活动架构版本；**V5 是项目整体发布版本，不新增 V5 活动协议**。

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
. .\依赖环境\env.ps1
.\依赖环境\start-runtime.ps1             # Redis 16379 + Kafka 19092
.\scripts\app-start.ps1 -SkipBuild -SkipInfra
```

首次启动或修改代码后去掉 `-SkipBuild`（会执行 Maven、`npm ci` 与前端构建）。打开 [本地页面](http://127.0.0.1:5400/)；业务页为 http://127.0.0.1:5400/app/。

| 角色 | 账号 | 密码 |
| --- | --- | --- |
| 演示用户 | demo | demo12345 |
| 管理员 | admin | admin12345 |

管理员登录后可进入「管理工作台」，创建 V0–V4 活动，依次预热、启用。未来开始时间的活动会保持等待开抢；演示活动过期后请创建新活动，不要重置已有库存。

停止应用（保留数据）：

```powershell
.\scripts\app-stop.ps1
# 同时停止本项目依赖服务：
.\scripts\app-stop.ps1 -IncludeInfra
```

所有服务面向本机开发，绑定回环地址。应用端口为 5400 / 8080 / 8081，独立依赖端口为 MySQL 13306（本机复用时为 3306）、Redis 16379、Kafka 19092/19093。数据和日志位于 `.runtime/`；不使用现有系统 MySQL 的 3306 库实例以外的数据，也不复用既有 Kafka 数据目录。更完整的本机口径见 [启动指导](docs/STARTUP_GUIDE.md)。

## 验证与实测

2026-11-02 V5 本机验证结果：

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

**验证边界**：测试运行在单台 Windows 主机，压测器、网关、后端、MySQL、Redis、Kafka 共享 CPU 与磁盘；这不是生产容量承诺。突发场景 P95 1899.70 ms，未达到 500 ms 目标，与 V3 基线一致；持续场景达到 1000 QPS、P95 < 500 ms、错误率 < 1% 的目标。未执行 V4 崩溃/断点故障注入，也未验证多机水平扩容、真实支付和 Compose Redis7 方案。V5 不新增活动协议，活动创建仍使用 V0–V4。

## 复现

应用健康后执行：

```powershell
python -m pip install -r scripts/requirements.txt
python scripts/verification_api.py
python scripts/verification_gateway.py
python scripts/verification_invariants.py
python scripts/verification_load.py --versions V4 --users 2000 --rps 1100 --seconds 30 --stock 1000
python scripts/verification_load.py --versions V4 --users 2000 --burst --stock 1000
```

脚本使用独立测试用户和新活动，保留原有业务数据；压测结束后只下线本次创建的活动，不重置历史库存。

## 文件索引

- [架构与一致性边界](docs/ARCHITECTURE.md)
- [接口约定](docs/API_CONTRACT.md)
- [实现计划与验收映射](docs/IMPLEMENTATION_PLAN.md)
- [V5 验收报告](docs/VALIDATION.md)
- [界面验收](design-qa.md)
- [GitHub 项目选型](docs/GITHUB_SELECTION.md)
- backend/、gateway/、frontend/：Java17 / Spring Boot3 / MySQL / Redis Lua / Kafka / Vue3 / Element Plus
- artifacts/：原始接口报告、分阶段压测数据、环境与界面截图

## 来源

参考项目 [daydreamdev/seconds-kill](https://github.com/daydreamdev/seconds-kill/tree/57a31cb2c15b082bc84472b479e17534ee9ace53) 固定于版本 57a31cb2c15b082bc84472b479e17534ee9ace53，MIT 许可证和来源说明保留在 references/。当前应用沿用分阶段实验思路，重新实现库存与异步一致性流程；其他项目用于选型与设计比较，未直接复制无许可证项目源码。
