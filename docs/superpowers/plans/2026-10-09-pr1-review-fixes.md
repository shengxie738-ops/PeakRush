# PR1 审查修复实施计划

**Goal:** 根据 `PeakRush_PR1_Review_20261009.md` 修复 R1–R7，补充回归测试与可重复的 CI 检查。

**Architecture:** 保留 Vue 双入口、现有运动控制器和库存实现；统一首页 WebGL 所有权，以成功绘制及纹理就绪揭示画布。会话恢复核验存储中的当前 token，商品更新通过 SQL 原子保留省略的 category。

**Tech Stack:** Vue 3、TypeScript、Three 0.176、Lenis 1.3.3、Java 17、Spring Boot、MySQL、Redis、Node test、Maven、Python unittest。

**Spec:** `PeakRush_PR1_Review_20261009.md`。

## 约束

- 当前本地 HEAD 为 `a1e94ac8937080e40305f9f577a8ace94c5b49dd`，不能直接应用针对另一 HEAD 的补丁。
- 保留已有 `docs/STARTUP_GUIDE.md`、`frontend/vite.config.ts`、`scripts/app-start.ps1`、`scripts/app-status.ps1` 修改。
- 在当前工作区交付可查看的修改；不执行推送、合并、发布。
- 测试先复现再修复；真实集成测试使用专用随机数据库，不能清空现有应用库。
- 区分本次执行、模拟边界测试和未执行的实机/端到端验收。

## 重点边界

- 异步导入途中离开首页、组件销毁及再次进入首页。
- 无 WebGL、纹理延迟/失败、上下文丢失以及减少动画切换。
- BFCache 恢复时账号切换、存储清空、迟到身份响应和暂时 503。
- 更新省略 category 与显式 null 的不同语义，并发显式分类更新。
- 轮播按钮、拖动、重建状态与监听器/纹理引用释放。

## 任务 1：会话恢复 R3

文件：`frontend/src/session.ts`、`frontend/tests/session.test.mjs`。

- [x] 添加并执行账号切换、退出、迟到响应、同 token 503 的失败回归。
- [x] 维护响应式身份对应的 token，persisted pageshow 重新恢复会话；只有仍匹配当前 token 的响应可更新身份。
- [x] 运行会话及前端现有测试。

## 任务 2：目录并发 R2 与迁移回归

文件：`backend/src/main/java/com/peakrush/Store.java`、`backend/src/test/java/com/peakrush/*ReviewTest.java`。

- [x] 复现省略 category 导致显式并发分类更新丢失的问题。
- [x] 更新时不预读 category，使用 `category=COALESCE(?,category)`；保持创建、显式 null、显式分类的兼容语义。
- [x] 补充旧 schema 迁移/重复及并发迁移回归，在专用库运行 Maven 检查。

## 任务 3：首页渲染 R1、R4–R7

文件：`frontend/welcome/app/App.vue`、`frontend/welcome/webgl/`、`frontend/welcome/motion/`、`frontend/welcome/features/home/HomeTestimonials.vue` 及新增前端测试。

- [x] 添加真实模块回归，复现所有权、路由释放、poster readiness、滚动、轮播与颜色模式问题。
- [x] App 唯一挂载，路由/偏好/销毁释放，异步版本保护和 host 身份核对。
- [x] 绘制成功且依赖纹理成功加载才隐藏备用图，失败/释放/上下文丢失恢复备用图。
- [x] 减少动画保持原生滚动；连接轮播事件及状态；纹理按 URL 与颜色模式计数。
- [x] 运行新增测试、前端全套测试及生产构建。

## 任务 4：集成验收与 G1

文件：`.github/workflows/ci.yml`、`docs/PR1_FIX_VALIDATION_20261009.md`。

- [x] 配置前端测试/构建、后端 MySQL/Redis 测试、迁移测试、gateway 及 Python 测试的 CI。
- [x] 执行可用本地检查，检查合并差异和新增回归测试质量。
- [x] 尝试真实浏览器复测路由、降级、滚动和轮播；记录无法执行的项目。
- [x] 在验收记录中逐项映射修复、命令、结果与仍需部署环境完成的门槛。
