# PeakRush 高并发抢购课设

本轮交付 V0–V3，采用已选定的第 2 个橙色界面方案。代码、依赖启动脚本、实际验收与压测报告均在本目录。V4 为后续实验，现有实验代码不纳入本次验收。

## 已实现的阶段

| 阶段 | 实现与对比重点 |
| --- | --- |
| V0 | MySQL 事务与行锁，同步扣库存、创建订单 |
| V1 | 条件更新库存、唯一约束和请求幂等 |
| V2 | Redis Lua 原子资格校验、库存预占，同步落单与补偿 |
| V3 | Kafka 异步落单、PENDING 结果轮询、重复消费幂等；Gateway 限流、动态路径、售罄短路 |

完整业务包括注册登录、商品与活动管理、活动预热与上下线、限购、订单查询、模拟支付、取消与超时关闭、库存回补、监控和实验报告。一个用户在同一活动的同一商品只能下一单；取消归还库存，但不恢复购买资格。支付仅模拟，不产生真实扣款。

## 当前机器启动

在 PowerShell 中进入本项目，执行：

~~~powershell
# 在克隆后的项目根目录执行；先按 deploy/README.md 配置本机依赖路径和口令环境变量
powershell -ExecutionPolicy Bypass -File .\scripts\app-start.ps1
~~~

打开 [本地页面](http://127.0.0.1:5179/)。

本机（Windows + PowerShell 5.1，复用已装 MySQL、依赖放项目内 `依赖环境/`）的完整启动、停止、自检与已知坑见 [启动指导](docs/STARTUP_GUIDE.md)。

| 角色 | 账号 | 密码 |
| --- | --- | --- |
| 演示用户 | demo | demo12345 |
| 管理员 | admin | admin12345 |

管理员登录后可进入「管理工作台」。可在活动管理创建 V0–V3 活动，依次预热、启用；未来开始时间的活动会保持等待开抢。演示活动时间随初始化确定，过期后请创建新活动，不要重置已有库存。

首次启动前需要在当前 PowerShell 会话中设置 PEAKRUSH_JAVA_HOME、PEAKRUSH_MYSQL_BIN、PEAKRUSH_REDIS_BIN、PEAKRUSH_KAFKA_HOME，以及独立的 PEAKRUSH_DB_PASSWORD、PEAKRUSH_RUNTIME_PASSWORD、PEAKRUSH_ROOT_PASSWORD（均不少于 16 位）。口令保存在本地环境与被 Git 忽略的 .runtime/ 中，不提交到仓库。启动脚本会启动独立依赖、构建后端和网关、执行 npm ci/build，最后启动本地服务。已有构建且依赖健康时可使用：

~~~powershell
.\scripts\app-start.ps1 -SkipBuild -SkipInfra
.\scripts\app-status.ps1
.\scripts\runtime-status.ps1
~~~

停止应用（保留数据）：

~~~powershell
.\scripts\app-stop.ps1
# 同时停止本项目依赖服务：
.\scripts\app-stop.ps1 -IncludeInfra
~~~

所有服务面向本机开发，绑定回环地址。应用端口为 5179 / 8080 / 8081，独立依赖端口为 MySQL 13306、Redis 16379、Kafka 19092/19093。数据和日志位于被 Git 忽略的 .runtime/；不使用现有系统 MySQL 的 3306 或既有 Kafka 数据目录。前端本地启动使用 Vite，生产构建产物在 frontend/dist/。

## 换一台机器运行

脚本不会自动安装工具。准备 JDK17、Maven3.9+、Node22/npm，以及 MySQL8.0.30、Redis、Kafka4.3.0。Windows 原生运行需要通过上述环境变量指向本机安装位置；mvn.cmd、node.exe/npm.cmd 需要在 PATH 中，也可用 PEAKRUSH_MAVEN_CMD 指向 Maven 命令。不要复制旧机器带 PID 和绝对路径的 .runtime/ 作为新环境。

首次空库先正常启动完成建表，再开启真实集成测试。依赖已由外部环境或 Compose 启动时才使用 -SkipInfra；连接可通过 DB_URL、DB_USER、DB_PASSWORD、REDIS_HOST、REDIS_PORT、KAFKA_BOOTSTRAP_SERVERS 配置。Compose 文件已提供，但本机没有 Docker，未执行该方案；细节见 [部署说明](deploy/README.md)。

## 验证与实测

~~~powershell
python -m pip install -r scripts/requirements.txt
python scripts/verification_api.py
python scripts/verification_gateway.py
python scripts/verification_invariants.py
python scripts/verification_load.py --versions V0,V1,V2,V3 --users 2000 --rps 1100 --seconds 30 --stock 1000
python scripts/verification_load.py --versions V3 --users 2000 --burst --stock 1000
~~~

脚本使用独立测试用户和新活动，保留原有业务数据。数据库必须已经启动并完成建表。后端真实集成测试使用 PEAKRUSH_INTEGRATION_TESTS=true；V4 测试另有开关，本次关闭。

截至 2026-09-28：后端 15 项通过（另 1 项 V4 跳过），网关 3 项通过，前端 7 项通过；57 项真实 API 检查与 7 项全库不变量通过。

V3 持续场景：2000 个测试用户、33000 次请求，1092.95 HTTP QPS、P95 31.064 ms，1000 件库存最终对应 1000 个订单。HTTP QPS 包含售罄与重复购买响应，不能当作下单 TPS。统一释放 2000 个请求的突发场景 P95 为 1694.257 ms，未达到 500 ms，800 次请求被限流。两场景均无 5xx/网络错误，库存守恒。详见 [验收报告](docs/VALIDATION.md)，不要将本机短时测试视为生产容量承诺。

## 文件索引

- [架构与一致性边界](docs/ARCHITECTURE.md)
- [接口约定](docs/API_CONTRACT.md)
- [实现计划与验收映射](docs/IMPLEMENTATION_PLAN.md)
- [界面验收](design-qa.md)
- [GitHub 项目选型](docs/GITHUB_SELECTION.md)
- backend/、gateway/、frontend/：Java17 / Spring Boot3 / MySQL / Redis Lua / Kafka / Vue3 / Element Plus
- artifacts/：原始接口报告、分阶段压测数据、环境与界面截图

## 来源

参考项目 [daydreamdev/seconds-kill](https://github.com/daydreamdev/seconds-kill/tree/57a31cb2c15b082bc84472b479e17534ee9ace53) 固定于版本 57a31cb2c15b082bc84472b479e17534ee9ace53，MIT 许可证和来源说明保留在 references/。当前应用沿用分阶段实验思路，重新实现库存与异步一致性流程；其他项目用于选型与设计比较，未直接复制无许可证项目源码。

