# PeakRush 项目记忆与启动指南

本文件为 PeakRush 高并发秒杀系统（Windows 本机开发环境）的项目记忆。每次启动、重启、排查或构建前后端服务时，遵循以下已验证口径。

## 1. 服务架构与端口约定

- **前端（Vite Dev Server + MPA）**：`http://127.0.0.1:5400`（`--strictPort`；`5179` 属于本机 Windows 保留端口段不可用）
  - 欢迎页 / 登录注册：`http://127.0.0.1:5400/`、`/signin`、`/signup`（入口 `frontend/index.html`）
  - 业务端 / 管理台：`http://127.0.0.1:5400/app/`、`/app/orders`、`/app/admin`（入口 `frontend/app.html`）
  - Vite 代理：`/api` 与 `/actuator` 转发至 `$env:PEAKRUSH_GATEWAY_URI`（默认 `http://127.0.0.1:8080`）
- **网关（Spring Cloud Gateway WebFlux）**：`127.0.0.1:8080`（健康检查 `/actuator/health`），负责 Redis Lua 限流后路由 `/api/**` 至 `$env:BACKEND_URI`（默认 `http://127.0.0.1:8081`）
- **后端（Spring Boot 3.5.14 / Java 17）**：`127.0.0.1:8081`（健康检查 `/actuator/health`），默认 profile 为 `local`（若开启故障开关则使用 `local,lab`）
- **MySQL（本机系统服务复用）**：`127.0.0.1:3306`，Windows 服务名 `MySQL81`，库名 `peakrush`（**不由项目脚本托管启停**）
- **Redis（项目独占便携版 5.0.9）**：`127.0.0.1:16379`（`6379` 已被本机 Docker 占用，禁止使用 `6379`）
- **Kafka（项目独占 KRaft 4.3.0）**：`127.0.0.1:19092`（broker）、`127.0.0.1:19093`（controller）
- **验收 / 压测 / 双实例演练端口**：应用可使用 `-BackendPort 18081 -GatewayPort 18080 -Lab`，第二实例演练后端常用 `18082`（详见 `RUNBOOK.md`）

## 2. 本机依赖位置（由 `依赖环境/env.ps1` 注入）

> `依赖环境/` 为本机私有目录（已 `.gitignore`），所有工具路径与连接环境变量均通过 dot-source `依赖环境/env.ps1` 在**当前 PowerShell 会话**注入，不写入系统注册表：

- **JDK 17**：`G:\Java WEB\jdk-17.0.2`（`PEAKRUSH_JAVA_HOME`，勿使用 PATH 中的 Java 23）
- **Maven 3.9.15**：`G:\软件体系\apache-maven-3.9.15\bin\mvn.cmd`（`PEAKRUSH_MAVEN_CMD`，仓库配置在 `~/.m2/settings.xml`）
- **Redis 5.0.9**：`G:\软件体系\Redis\Redis-x64-5.0.9`（`PEAKRUSH_REDIS_BIN`）
- **Kafka 4.3.0**：`依赖环境\kafka_2.13-4.3.0`（`PEAKRUSH_KAFKA_HOME`）
- **数据库连接变量**：`DB_URL` 指向 `127.0.0.1:3306/peakrush`，由 `env.ps1` 设置 `DB_USER`、`DB_PASSWORD`、`REDIS_HOST`、`REDIS_PORT`、`KAFKA_BOOTSTRAP_SERVERS`；**刻意不设置 `PEAKRUSH_MYSQL_BIN`**，以防误触发 `scripts/runtime-start.ps1` 新建 `13306` 隔离库。

## 3. 标准启动与停止命令（PowerShell）

> **Agent 调用注意**：
> 1. 每个终端工具调用都是独立的新会话，环境变量不会跨命令保留。必须在**同一个命令块**中先执行 `. .\依赖环境\env.ps1`，再执行后续脚本。
> 2. **长驻服务保活约束**：`start-runtime.ps1` 与 `app-start.ps1` 内部通过 `Start-Process` 拉起后台子进程后自身退出。在 Agent 的 `run_command` 中若使用 `IsDaemon=false`，命令退出时其派生进程组（Redis/Kafka/Backend/Gateway/Frontend）会被宿主一并终止回收！通过 Agent 启动服务时，**必须使用 `IsDaemon=true`**，并在启动命令末尾读取 `.runtime/native-processes.json`（UTF-8）与 `.runtime/app-processes.json` 中的 PID，循环调用 `Wait-Process` 保活（直到全部服务进程停止才退出），随后另开普通检查命令验证端口与健康接口。

### 3.1 日常三步启动（先确认系统服务 `MySQL81` 处于 Running）

```powershell
# 1. 加载本机环境变量（仅当前会话）
. .\依赖环境\env.ps1
# 2. 幂等启动独占依赖（Redis 16379 + Kafka 19092/19093，复用 MySQL 3306）
. .\依赖环境\start-runtime.ps1
# 3. 启动后端(8081) + 网关(8080) + 前端(5400)
#    无代码改动时加 -SkipBuild；首次启动或修改了代码后去掉 -SkipBuild
.\scripts\app-start.ps1 -SkipBuild -SkipInfra
```

- **全量构建 + 启动**（修改过后端/网关/前端代码后）：
  ```powershell
  . .\依赖环境\env.ps1; . .\依赖环境\start-runtime.ps1; .\scripts\app-start.ps1 -SkipInfra
  ```
- **仅构建不启动**：
  ```powershell
  .\依赖环境\build-local.ps1
  ```
- **启用 Lab 故障注入开关（验收/演练）**：
  ```powershell
  . .\依赖环境\env.ps1; . .\依赖环境\start-runtime.ps1; .\scripts\app-start.ps1 -BackendPort 18081 -GatewayPort 18080 -Lab -SkipInfra
  ```

### 3.2 单独开发启动方式（按需）

- **前端单独开发**（需 Gateway 8080 与 Backend 8081 运行中）：在 `frontend/` 下执行 `npm run dev`（监听 `127.0.0.1:5400`）。
- **后端 / 网关单独打包与启动**：须先加载 `. .\依赖环境\env.ps1`，再用 `$env:PEAKRUSH_MAVEN_CMD -q -f <module>\pom.xml package`，然后用 JDK 17 `java -jar <module>\target\peakrush-<module>-1.0.0.jar --spring.profiles.active=local --server.port=<port>`。
- **注意**：Windows 下运行中的 `backend` / `gateway` 会锁定 `target/*.jar`，重新 `mvn package` 前必须先停止对应应用进程。

### 3.3 停止与重启

```powershell
# 停止应用 + 项目启动的 Redis/Kafka（绝不触碰系统 MySQL81 服务）
. .\依赖环境\env.ps1
.\依赖环境\stop-all.ps1

# 仅停止应用（保留 Redis/Kafka）
.\scripts\app-stop.ps1

# 仅停止或重启单个服务（例如前端）：
. .\依赖环境\env.ps1; .\依赖环境\stop-all.ps1 -Only frontend; .\scripts\app-start.ps1 -SkipBuild -SkipInfra
```

## 4. 状态校验与日志排查

- **端口与进程检查**：`.\scripts\app-status.ps1`（读取 `.runtime/app-processes.json`，校验 `5400`/`8080`/`8081` 监听）
- **健康检查接口**：
  - `http://127.0.0.1:8081/actuator/health` -> `{"status":"UP"}`
  - `http://127.0.0.1:8080/actuator/health` -> `{"status":"UP"}`
  - `http://127.0.0.1:5400/app/` -> HTTP 200
- **运行状态与日志目录**（均在 `.runtime/`）：
  - 进程清单：`.runtime/app-processes.json`、`.runtime/native-processes.json`
  - 应用日志：`.runtime/backend.out.log` / `.err.log`、`.runtime/gateway.out.log` / `.err.log`、`.runtime/frontend.out.log` / `.err.log`
  - 依赖数据与日志：`.runtime/redis/`、`.runtime/kafka/`
- **演示账号**（`local` profile 首次启动由 `DemoData` 写入）：普通用户 `demo / demo12345`，管理员 `admin / admin12345`。

## 5. 本机已踩坑与避雷约束

1. **禁止直接跑 `scripts/runtime-start.ps1` / `runtime-status.ps1` / `runtime-stop.ps1`**：
   - 本机通过 `依赖环境/` 复用系统 `MySQL81 (3306)`，而仓库版 `runtime-start.ps1` 会另建 `13306` 隔离库（仅 CI / fresh clone 使用）。
   - 项目路径包含中文，PowerShell 5.1 下 `scripts/runtime-common.ps1` 读取无 BOM 的 `.runtime/native-processes.json` 会按 ANSI/GB2312 解码乱码并报错 `Runtime ownership does not match this project.`；必须使用 `依赖环境/start-runtime.ps1` 与 `依赖环境/stop-all.ps1`。
2. **禁止在 PowerShell 脚本内用 `*>>` 重定向原生命令（`java`/`mvn`）的 stderr**：在 `$ErrorActionPreference='Stop'` 下会把 stderr 当作终止错误；如需记录日志应放在最外层调用重定向。
3. **不要修改前端端口或混用环境变量注释**：`依赖环境/env.ps1` 注释里残留旧端口写法，实际所有代码与脚本均已统一为 **`5400`**。
4. **不要在主栈运行期间对 `backend`/`gateway` 执行会重命名 jar 的 `mvn package`**：先通过 `stop-all.ps1` 或 `app-stop.ps1` 停服务再构建。
