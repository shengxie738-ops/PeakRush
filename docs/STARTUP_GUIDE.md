# PeakRush 前后端启动指导（Windows 本机）

适用环境：Windows 11 + Windows PowerShell 5.1，项目根 `G:\高并发大作业项目\PeakRush`。
本文件记录的是**本机实际跑通的口径**，与 `README.md` 的差异集中在第 8 节。

## 1. 服务与端口

| 角色 | 地址 | 由谁启动 | 说明 |
| --- | --- | --- | --- |
| 前端（Vite 开发服务器） | `http://127.0.0.1:5179` | `scripts/app-start.ps1` | **端口为 5179，不是 5173**；`--strictPort`，端口被占直接失败，不会自动漂到 5180 |
| 网关 Gateway | `127.0.0.1:8080` | `scripts/app-start.ps1` | 前端 `/api`、`/actuator` 经 Vite 代理转发到这里 |
| 后端 Spring Boot | `127.0.0.1:8081` | `scripts/app-start.ps1` | 只由网关对外暴露，前端不直连 |
| MySQL | `127.0.0.1:3306` | 本机已有 `MySQL81` 服务 | 复用现有实例，库名 `peakrush` |
| Redis | `127.0.0.1:16379` | `依赖环境/start-runtime.ps1` | 6379 已被 `com.docker.backend` 占用，必须用 16379 |
| Kafka | `127.0.0.1:19092`（controller `19093`） | `依赖环境/start-runtime.ps1` | KRaft 单机，数据在 `.runtime/kafka/data` |

前端端口涉及的位置（以后再改端口，这 4 处代码 + 5 处文档要一起改）：

- `frontend/vite.config.ts:7`
- `frontend/package.json:7`（dev）、`frontend/package.json:9`（preview）
- `scripts/app-start.ps1:62`（启动参数与端口登记）、`:64`（健康检查 URL）、`:72`（就绪提示）
- `scripts/app-status.ps1:2`
- 文档：`README.md:25`、`README.md:50`、`frontend/README.md:7`、`docs/ARCHITECTURE.md:7`、`docs/ARCHITECTURE.md:93`、`docs/API_CONTRACT.md:19`

`design-qa.md:8` 仍写 5173，那是交付时的界面验收记录，属于历史事实，未回改。

## 2. 依赖清单与本机位置

| 依赖 | 版本 | 本机位置 | 状态 |
| --- | --- | --- | --- |
| JDK | 17 | `G:\Java WEB\jdk-17.0.2` | 已有（PATH 上的 Java 23 不要用） |
| Maven | 3.9.15 | `G:\软件体系\apache-maven-3.9.15\bin\mvn.cmd` | 已有，不在 PATH，靠 `PEAKRUSH_MAVEN_CMD` |
| Maven 本地仓库 | — | `G:\软件体系\maven-repository`（由 `~/.m2/settings.xml` 指定，阿里云镜像） | 依赖不写 C 盘 |
| Node / npm | v24 / 11.x | PATH | 已有 |
| Redis | 5.0.9（Windows 便携版） | `G:\软件体系\Redis\Redis-x64-5.0.9` | 已有 |
| MySQL | 8.1.0 | `C:\Program Files\MySQL\MySQL Server 8.1`，服务名 `MySQL81` | 已有并运行中，直接复用 |
| Kafka | 4.3.0 | `依赖环境\kafka_2.13-4.3.0` | 本机原先没有，已下载（官方 SHA512 校验一致） |
| Python | 3.14 | PATH | 仅验收/压测脚本需要（`pip install -r scripts/requirements.txt`） |

`依赖环境/` 目录内容：`kafka_2.13-4.3.0/`、`env.ps1`、`start-runtime.ps1`、`build-local.ps1`、`stop-all.ps1`。该目录已加入 `.gitignore`，不进版本库。

## 3. 一次性准备（换机器或首次运行）

1. 建库（表由后端 `schema.sql` 自动创建，全部 `CREATE TABLE IF NOT EXISTS`，可重复执行）：

   ```powershell
   & "C:\Program Files\MySQL\MySQL Server 8.1\bin\mysql.exe" -h 127.0.0.1 -P 3306 -u root -proot `
     -e "CREATE DATABASE IF NOT EXISTS peakrush CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
   ```

2. 取 Kafka 4.3.0。`scripts/runtime-start.ps1:18` 硬校验 `libs/kafka_2.13-4.3.0.jar`，所以版本必须是 4.3.0（4.3.1 会让校验失败）。archive.apache.org 实测只有约 50 KB/s，改用华为云镜像：

   ```powershell
   cd G:\高并发大作业项目\PeakRush\依赖环境
   curl.exe -L -o kafka_2.13-4.3.0.tgz https://repo.huaweicloud.com/apache/kafka/4.3.0/kafka_2.13-4.3.0.tgz
   tar -xzf kafka_2.13-4.3.0.tgz
   ```

   校验（与 Apache 官方 `.sha512` 一致）：

   ```powershell
   (Get-FileHash -Algorithm SHA512 .\kafka_2.13-4.3.0.tgz).Hash
   # 期望 EE36CF508B519769E253ACDFA13ADD23F405AB42B241CA641589843DF6A5C7BC
   #      72289301EB410A645CE7CD1CD0FE20921143B9074DFBFE72605943140D4E8CB1
   ```

3. 若换了机器，改 `依赖环境/env.ps1` 里 JDK / Maven / Redis 三行路径即可，其余不用动。

## 4. 日常启动（三步）

```powershell
cd G:\高并发大作业项目\PeakRush
. .\依赖环境\env.ps1                       # 只影响当前会话，不写注册表
. .\依赖环境\start-runtime.ps1             # Redis 16379 + Kafka 19092，幂等
.\scripts\app-start.ps1 -SkipBuild -SkipInfra
```

期望最后一行：`PeakRush ready: http://127.0.0.1:5179`。

- 首次或改过后端/前端代码后，去掉 `-SkipBuild`（会执行 `mvn package` 与 `npm ci && npm run build`，约 3–6 分钟）。
- 只想构建不启动：`.\依赖环境\build-local.ps1`。
- 演示账号：`demo / demo12345`、`admin / admin12345`，由后端 `DemoData` 在 local profile 首次启动时写入，重启不会重置。

## 5. 停止与单服务重启

```powershell
. .\依赖环境\env.ps1
.\依赖环境\stop-all.ps1                    # 前端 + 网关 + 后端 + Redis + Kafka 全停
.\依赖环境\stop-all.ps1 -Only frontend     # 只停前端
```

只重启前端示例：

```powershell
.\依赖环境\stop-all.ps1 -Only frontend
.\scripts\app-start.ps1 -SkipBuild -SkipInfra   # 已运行的后端/网关会显示 already running
```

`stop-all.ps1` 与仓库脚本一样按 PID + 可执行路径 + 命令行 marker 三重校验归属，不会误杀别人占用的端口进程，也**绝不触碰 `MySQL81` 服务**。

## 6. 启动后自检

```powershell
.\scripts\app-status.ps1                                  # 三个应用端口 listening=True
curl.exe http://127.0.0.1:8081/actuator/health            # {"status":"UP"}
curl.exe http://127.0.0.1:8080/actuator/health            # {"status":"UP"}
curl.exe -X POST -H "Content-Type: application/json" -d "{\"username\":\"demo\",\"password\":\"demo12345\"}" http://127.0.0.1:5179/api/auth/login
```

最后一条同时验证了 5179 → Vite 代理 → 网关 → 后端 → MySQL 的完整链路，应返回 `{"token":"...","user":{"username":"demo",...}}`。

管理员登录后访问 `GET /api/admin/metrics/summary`，`kafkaLag` 有数值即说明 Kafka 消费者组已连上。

## 7. 已知坑（都实际踩过）

1. **中文项目路径 + PowerShell 5.1 的 ANSI 解码**：`scripts/runtime-common.ps1:27` 用 `Get-Content -Raw` 读无 BOM 的 `.runtime/native-processes.json`，PS 5.1 按 GB2312 解码，中文 `projectRoot` 变乱码，`:28` 抛 `Runtime ownership does not match this project.`。受影响：`runtime-status.ps1`、`runtime-stop.ps1`。绕过方式是 `依赖环境/start-runtime.ps1` 内覆盖 `Get-RuntimeState` 显式按 UTF-8 读；带 BOM 的 `app-processes.json` 反而**不能**加 `-Encoding UTF8`（会把 BOM 留在字符串里）。
2. **`ConvertFrom-Json` 外面套 `@()` 会造出嵌套数组**：PS 5.1 把 JSON 数组作为一个 `Object[]` 单次送入管道，`@( … )` 得到的是"1 个元素、其内是数组"，于是按 `.name` 过滤命中 0 条。`scripts/app-start.ps1:31-37` 原本因此无法识别"服务已在运行"，重复执行会误报 `Port 8081 is occupied by a process not verified as this project's backend`；现已改为逐条累加。
3. **脚本内不要用 `*>>` 重定向原生命令的 stderr**：配合 `$ErrorActionPreference='Stop'` 会把第一行 stderr 变成终止错误（`java -version` 就中招）。把重定向放到调用层，例如 `powershell -File x.ps1 > log.txt 2>&1`。
4. **自己新写的 `.ps1` 必须存成带 BOM 的 UTF-8**，否则里面的中文注释和路径字面量在 PS 5.1 下会坏掉。
5. **换前端端口等于换 origin**：浏览器 `localStorage` 里的登录 token 不跨端口，5173 上的登录态在 5179 上不存在，需要重新登录，属正常现象。
6. `scripts/verification_invariants.py:20` 把 MySQL 写死成 `127.0.0.1:13306 --user=peakrush`，没有命令行开关。本机用 3306/root，所以该脚本当前跑不了；`verification_api.py` 与 `verification_gateway.py` 支持 `--base`（默认 `http://127.0.0.1:8080`），不受前端端口影响。

## 8. 与 README.md 的偏离

| 项目 | README 口径 | 本机实际 |
| --- | --- | --- |
| MySQL | 独立实例 8.0.30 @13306，`scripts/runtime-start.ps1` 自建数据目录 | 复用本机 `MySQL81` 服务 3306 / root，只新建 `peakrush` 库 |
| 依赖启动 | `scripts/runtime-start.ps1` 一次拉起 MySQL+Redis+Kafka | 只用 `依赖环境/start-runtime.ps1` 拉起 Redis+Kafka；`env.ps1` 故意不设 `PEAKRUSH_MYSQL_BIN`，误调用 `runtime-start.ps1` 会立即报错，不会另起一套数据目录 |
| 环境变量 | 需要 3 个 16 位以上口令 | 走 `DB_URL/DB_USER/DB_PASSWORD` 覆盖后端连接，Redis 无口令、仅绑回环 |
| 前端端口 | 5173 | 5179 |

## 9. 数据与日志位置

- `.runtime/`（已 gitignore）：`redis/`、`kafka/` 数据与日志、`native-processes.json`、`app-processes.json`、`backend.out.log`、`gateway.out.log`、`frontend.out.log` 及各自 `.err.log`
- 项目根的 `app-start.log`、`build.log`、`kafka-start.log`、`frontend-restart.log` 是本次搭建过程的输出留档，`*.log` 已被 gitignore，可随时删
