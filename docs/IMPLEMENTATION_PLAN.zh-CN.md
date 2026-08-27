# dsh-api-kit 实施文档

- **项目名称**：dsh-api-kit
- **对应需求**：[`REQUIREMENTS.zh-CN.md`](./REQUIREMENTS.zh-CN.md)
- **计划版本**：v0.1 MVP → v0.4
- **文档状态**：实施基线
- **当前阶段**：T09 安全策略、SSRF、响应治理和审计已完成，准备进入 T10
- **最后更新**：2026-08-27

---

## 官方文档与参考链接

执行每个任务前，先阅读本任务列出的对应官方文档。由于 DSH Runtime API 可能随版本变化，文档只作为导航，具体 Service、Event、Slot、Tool、Builtin、Typert 和 RPC 契约必须以当前版本源码及运行时 Inspect 结果为准。

### DeepSeek Harness 官方文档

- [官方开发文档首页：第一个插件](https://deepseek-harness.github.io/deepseek-harness/develop/basic/)
- [工具开发](https://deepseek-harness.github.io/deepseek-harness/develop/basic/tool)
- [配置与插件配置](https://deepseek-harness.github.io/deepseek-harness/develop/basic/config)
- [插件发布](https://deepseek-harness.github.io/deepseek-harness/develop/basic/publish)
- [Framework：Service](https://deepseek-harness.github.io/deepseek-harness/develop/framework/service)
- [Framework：Events](https://deepseek-harness.github.io/deepseek-harness/develop/framework/events)
- [Cordis 教程：第一个插件](https://deepseek-harness.github.io/deepseek-harness/develop/cordis-tutorial/01-first-plugin)
- [Cordis 教程：生命周期与 effects](https://deepseek-harness.github.io/deepseek-harness/develop/cordis-tutorial/02-lifecycle-and-effects)
- [Cordis 教程：Services](https://deepseek-harness.github.io/deepseek-harness/develop/cordis-tutorial/03-services)
- [Cordis 教程：Events](https://deepseek-harness.github.io/deepseek-harness/develop/cordis-tutorial/04-events)
- [Cordis 教程：配置](https://deepseek-harness.github.io/deepseek-harness/develop/cordis-tutorial/05-config)
- [Cordis 教程：组合与 HMR](https://deepseek-harness.github.io/deepseek-harness/develop/cordis-tutorial/06-into-the-harness)
- [Cordis 教程：进入 Harness](https://deepseek-harness.github.io/deepseek-harness/develop/cordis-tutorial/07-into-the-harness)
- [开发实践：LLM Adapter](https://deepseek-harness.github.io/deepseek-harness/develop/practice/llm-adapter)
- [官方 GitHub 仓库](https://github.com/deepseek-ai/deepseek-harness)

### 插件模板与现有实现

- [DSH 插件开发实战模板 Skill](https://github.com/fuzhengwei/xfg-skills-dsp-plugin-template)
- [现有 dsh-mysql 插件](https://github.com/1321928757/dsh-mysql)

### OpenAPI 与 MCP 参考

- [OpenAPI Specification](https://spec.openapis.org/oas/latest.html)
- [MCP Tools 规范](https://modelcontextprotocol.io/specification/latest/server/tools)
- [MCP 官方 TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)

---

## 1. 使用方式

本文件将开发拆分成可以在不同会话中独立推进的小任务。每次继续开发时：

1. 阅读本文件的“当前进度”和“交接记录”；
2. 阅读需求文档中与当前任务相关的 FR/NFR；
3. 只选择一个未完成任务作为当前会话主目标，除非任务明确要求串行完成；
4. 完成后运行该任务的验收命令和测试；
5. 更新本文件的任务状态、实际变更、遗留问题和下一步；
6. 不要为了“顺手”提前实现未满足前置条件的任务。

状态取值：

- `未开始`：尚未动手；
- `进行中`：当前会话正在处理；
- `阻塞`：存在明确外部阻塞，记录原因和解除条件；
- `已完成`：代码、测试和任务验收均完成；
- `延期`：需求或技术路线被重新安排，不代表已实现。

---

## 2. 总体路线

```text
T00 任务拆解与运行时勘探
  ↓
T01 工程骨架与 Bundle 最小启动
  ↓
T02 领域模型与纯函数校验
  ↓
T03 持久化 Registry
  ↓
T04/T05 配置与手工操作 CRUD
  ↓
T06 会话激活与输入栏选择器
  ↓
T07 api_kits / api_operations / api_describe
  ↓
T08 api_call 只读执行器
  ↓
T09 安全策略、SSRF、响应治理、审计
  ↓
T10 动态上下文与端到端 MVP
  ↓
T11 OpenAPI JSON 导入
  ↓
T12 OpenAPI 兼容性、冲突和 Tag 分配
  ↓
T13 UI 完善、主题、可用性和回归
  ↓
T14 写操作、确认机制与 OAuth（后续）
  ↓
T15 独立 MCP 适配器与发布（后续）
```

依赖关系：

```text
T01 → T02 → T03 → T04/T05 → T06 → T07 → T08 → T09 → T10
T02 + T03 + T05 → T11 → T12
T10 → T13
T09 + T13 → T14
T02 + T08 + T09 → T15
```

---

## 3. 任务状态总表

| ID | 任务 | 阶段 | 状态 | 依赖 |
|---|---|---|---|---|
| T00 | 运行时能力核对与任务拆解 | 准备 | 已完成 | 无 |
| T01 | 创建发布骨架和最小 Bundle | M0 | 已完成 | T00 |
| T02 | 领域模型、归一化和纯函数 | M0 | 已完成 | T01 |
| T03 | Registry 持久化与迁移 | M0 | 已完成 | T02 |
| T04 | 服务目标、环境和认证配置 | M0 | 已完成 | T02/T03 |
| T05 | 手工 API 操作 CRUD | M0 | 已完成 | T02/T03/T04 |
| T06 | 会话级 API 套件选择器 | M0 | 已完成 | T03/T04/T05 |
| T07 | Agent 发现与描述工具 | M0 | 已完成 | T05/T06 |
| T08 | 固定目标的只读 HTTP 执行器 | M0 | 已完成 | T04/T05 |
| T09 | 安全策略、SSRF、响应治理和审计 | M0 | 已完成 | T08 |
| T10 | 动态上下文和 MVP 端到端验收 | M0 | 未开始 | T06/T07/T08/T09 |
| T11 | OpenAPI JSON 导入器 | M1 | 未开始 | T02/T03/T05 |
| T12 | 导入预览、冲突、Tag 与多服务分配 | M1 | 未开始 | T11 |
| T13 | UI 质量、主题、可用性和回归 | M1 | 未开始 | T10/T12 |
| T14 | 写接口、人工确认和 OAuth | M2 | 未开始 | T09/T13 |
| T15 | 独立 MCP Server 适配器 | M3 | 未开始 | T02/T08/T09 |

---

## 4. T05：手工 API 操作 CRUD

**状态：已完成**

**对应需求**：FR-OP-001～005、FR-IMPORT-006、FR-KIT-004。

### 完成内容

- 新增 DSH 无关的 `lib/operation-validation.js`：严格校验 Operation/Kit 输入、Path 参数、参数位置、受控 Header、Schema/Response 状态码、引用和策略；提供 Host/Client 安全视图及引用重算。
- 扩展 `model.js`：Operation 支持 `enabled`、时间戳、严格 path 参数语义；Kit 支持 `operationPolicies`；响应数组可安全归一化。
- 扩展配置门面：提供 Operation CRUD、启用/禁用、最小 Kit CRUD、加入/移出 Kit；使用 patch 更新、引用保护、容量保护、原子 Registry 提交和失败回滚。
- 以 `kit.operationIds` 为关系事实源，每次提交后重算 Operation 的 `kitIds`，清理失效策略键并报告重算警告。
- 增加 Typert Host manifest 与 `api-kit` namespace；新增严格 JSON RPC 处理和 Fiber disposer；不暴露 Registry 原始对象、secretRef 或凭据值。
- 替换设置页占位 UI：支持 Kit 列表、创建/删除、Operation 列表、创建/编辑、启用/禁用、删除确认、参数/请求体/响应 JSON 编辑和目标选择。

### 设计边界

T05 不实现 `api_*` Agent Tools、会话级套件激活、HTTP 请求执行、SSRF/DNS 校验、OpenAPI 导入、动态上下文、OAuth、写操作确认和文件上传。人工测试入口等请求执行器完成后再接入。

### 测试与验收

```powershell
node --check lib\model.js lib\normalizers.js lib\operation-validation.js lib\configuration.js lib\index.js lib\client.js lib\typert.host.js
node test\operation.test.mjs
pnpm test
pnpm run check
pnpm pack --dry-run
git diff --check
```

结果：`pnpm test` 46/46 通过，Operation 测试 6/6 通过，manifest 检查通过，打包清单包含 T05 runtime 文件，语法检查通过。

### 风险和遗留

- T05 的 Client 仍使用最小的手工 Remote descriptor；最终类型生成和完整 remote assembly 仍需结合发布 profile 做集成验证。
- Registry schemaVersion 保持 1；历史大写 Operation ID 和非法参数位置在加载时保持兼容，新写入严格拒绝。
- 当前 `harness.handle` 仅在运行时可见时注册兼容 RPC；Typert Gateway 仍是正式目标通道。
- T06 已完成运行时核对与会话级 Kit 选择；当前 Typert/Client 真实安装烟测仍需在不影响用户 3080 的隔离 Profile 中执行。

---

## 5. 任务详细说明（后续）

后续 T06–T15 的原始目标、需求映射、运行时核对、测试策略和发布检查，继续以 [`REQUIREMENTS.zh-CN.md`](./REQUIREMENTS.zh-CN.md) 为基线，并在开始每个任务前补充对应实施记录。

### T06：会话级 API 套件选择器

**状态：已完成**

**对应需求**：FR-SESSION-001～005、FR-ENV-004、MVP 验收标准 2/8。

- 已通过当前运行时 Inspect 确认 `conversation.input.left` 为 `session` scope 的 list Slot，组件收到 `sessionId` 标准 props，且输入区域 owner props 为 `session`/`input`。
- 已通过当前运行时 Inspect 确认 `sessions` 服务可提供 session scope/binding；T06 采用 Slot 标准 `sessionId`，不依赖 DOM、路由或全局浏览器存储。
- Host 配置门面新增 `getSessionActivation`、`setSessionActivation`、`clearSessionActivation` 与内部 `resolveSessionActivation`；选择保存在内存 Map，不污染 Registry，`agent/disposed` 时清理。
- 每次读取和权威解析都重新检查 Kit/Operation/Environment 的存在、启用状态、Agent 权限、Kit 环境约束和多 Kit 共同环境；超过 2 个 Kit 允许继续保存但返回范围扩大警告。
- Client 输入栏选择器使用槽位 ID `dsh-api-kit`、排序 `93`，支持多选 Kit、共同 Environment、生产标记、失效提示、空状态引导、应用/清除、Esc 和外部点击关闭；设置页配置变更通过 `dsh-api-kit:config-changed` 联动刷新。
- 三处 Typert/RPC descriptor 已统一为单 `args` wire，结果保持宽松 JSON codec；不暴露 base URL、secretRef 或凭据值。

**设计边界**：T06 不实现 `api_*` Agent Tools、HTTP 请求、OpenAPI 导入、SSRF/DNS、动态上下文、审计和写操作确认；这些留给 T07～T10。

**测试与验收**：新增 `test/session-selection.test.mjs`，覆盖 session 隔离、环境推导/交集、超过 2 个 Kit、停用失效、生产环境警告、清理和安全视图；全量 `pnpm test` 通过，清单检查和入口语法检查通过。

### T07：Agent 发现与描述工具

**状态：已完成**

**对应需求**：FR-TOOL-001～003、FR-TOOL-006、FR-SESSION-005、MVP 验收标准 3/4/5。

- 新增 DSH 无关的 `lib/discovery.js`：每次调用从 `exec.agent.id` 获取 session，复用 `resolveSessionActivation` 权威校验；按激活 Kit、Operation、Service Target、Environment 和只读/写策略交集计算可发现范围。
- 新增 `lib/agent-tools.js`：Host 注册三个固定 raw ToolDefinition：`api_kits`、`api_operations`、`api_describe`；不为每个 Operation 动态生成工具，也不接受模型传入 `sessionId` 或 URL。
- `api_kits` 只返回 Kit/Environment 安全摘要；`api_operations` 支持关键词、Tag、method、Service Target、offset/limit、稳定分页和共享 Operation 去重；`api_describe` 只描述当前会话可见的稳定 `operationId`。
- 结果限制为最多 64 KiB；分页按完整 Operation 条目截断，超大详情 fail-closed 为 `DESCRIPTION_TOO_LARGE`；错误使用不含堆栈和凭据的可行动 JSON envelope。
- Host 改为注入 `tools` 并将三个工具注册到当前 Fiber，停止/更新/删除时随 Fiber 清理；未新增 DSH runtime 依赖。

**设计边界**：T07 只实现发现和描述，不发起 HTTP，不实现 `api_call`、SSRF/DNS、响应治理、审计、动态上下文和 OpenAPI 导入；这些留给 T08～T12。

**测试与验收**：新增 `test/discovery.test.mjs`，覆盖会话门禁、安全视图、策略过滤、Tag/method/target 筛选、分页去重、描述 Schema、失效重校验、参数校验和大输出 fail-closed；全量 `pnpm test`、`pnpm run check` 和入口语法检查通过。

### T08/T09：只读执行与安全边界

**T08 状态：已完成；T09 状态：已完成**

- 只接受固定 `operationId + params`；
- Host 侧 transport、认证、超时、响应治理、SSRF 和审计均已实现；
- 测试使用 fake resolver/transport，不访问真实公司服务；
- T09 使用 DNS 全量解析、IP/CIDR 分类、固定 IP Node HTTP transport，避免“预解析后仍由 fetch 按 hostname 重解析”的 DNS rebinding 假修复；
- JSON 响应（含 HTTP 错误体）在投影前递归脱敏，并执行深度、数组、字符串、对象数量和字节边界；
- 每次调用和策略拒绝通过 Host-only JSONL sink 记录，审计写失败不影响业务结果。

**T09 设计边界**：仍只执行 GET/HEAD，不实现 OpenAPI 导入、动态上下文、写操作、OAuth、SSE/WebSocket、自动重定向或独立 MCP Server。

---

## 6. 技术约束与实现原则

### Host/Client 边界

Host 负责 Registry、文件、凭据、HTTP 请求、SSRF、策略、Agent Tools、动态上下文和审计。Client 只负责设置页、选择器和非敏感状态展示。

### 数据传输

所有跨 Host/Client 数据必须是有限、可序列化、无 secret 的 JSON；不传递 Cordis 活对象、Session 或函数。

### 不凭猜测使用运行时 API

编码前/遇到版本差异时必须通过官方文档、当前 DSH 源码、`cordis_inspect_list`/`cordis_inspect_query` 和已验证的 `dsh-mysql` 实现确认契约。

---

## 7. 交接记录

### 2026-08-27 / T04

- **完成内容**：完成 DSH 无关的服务目标、环境和认证配置核心；新增严格环境/认证校验、配置引用检查、Host-only 凭据适配器、配置 CRUD 门面和安全视图；支持多环境/认证绑定、生产环境默认关闭 Agent、私网显式 opt-in、API Key Query 默认关闭、受控 Header 拦截、请求时重新解析凭据，以及被引用实体删除保护。
- **变更文件**：`lib/config-validation.js`、`lib/credential-adapter.js`、`lib/configuration.js`、`lib/errors.js`、`lib/model.js`、T04 测试、清单、README、CHANGELOG 和本文件。
- **测试命令与结果**：T04 测试与全量回归通过；已完成当前 DSH Host Service/凭据能力 Inspect。
- **下一步建议**：进入 T05，先实现手工 API Operation CRUD，再基于本配置门面增加套件/操作安全视图和 Typert 接线。

### 2026-08-27 / T05

- **完成内容**：完成手工 API Operation CRUD 和最小 API Kit CRUD；实现严格输入校验、Path 参数约束、受控 Header 防护、Schema/Response 限制、Operation 启用/禁用、Kit/Operation 关系重算、引用删除保护、容量保护、时间戳和 patch 更新；补充安全视图、Typert Host RPC manifest、Client 设置页和 RPC 错误包装。
- **变更文件**：`lib/model.js`、`lib/operation-validation.js`、`lib/configuration.js`、`lib/config-validation.js`、`lib/index.js`、`lib/client.js`、`lib/typert.host.js`、`test/operation.test.mjs`、`test/model.test.mjs`、`test/manifest.test.mjs`、`scripts/check-manifest.mjs`、`package.json`、`README.md`、`README.zh-CN.md`、`CHANGELOG.md`、本文件。
- **测试命令与结果**：`node --check` 全部 T05 入口通过；`node test\operation.test.mjs` 6/6 通过；`pnpm test` 46/46 通过；`pnpm run check` 通过；`pnpm pack --dry-run` 包含 `lib/operation-validation.js`；`git diff --check` 通过。
- **需求覆盖**：FR-OP-001～005、FR-IMPORT-006、FR-KIT-004，以及 T05 手工 CRUD、关系一致性、安全视图和 RPC/设置页基线。
- **未完成/风险**：不实现 Agent Tools、会话级选择、HTTP 执行、SSRF/DNS、OpenAPI 导入和动态上下文；当前 Typert/Client remote 需要隔离 profile 做真实加载验证，未重启用户的 `http://127.0.0.1:3080`。
- **下一步建议**：进入 T06，先 Inspect `conversation.input.left` 的 session props 与可用 Scope/Remote，再实现会话级 API Kit 选择器。

---

### 2026-08-27 / T06

- **完成内容**：完成会话级 API Kit/Environment 选择器；Host 内存 Map 按 `sessionId` 隔离状态，设置/读取/解析均以当前 Registry 为权威进行重校验，并在 Agent dispose 时清理；Client 支持多选 Kit、共同环境、生产标识、失效诊断和范围扩大提示。
- **变更文件**：`lib/session-selection.js`、`lib/configuration.js`、`lib/index.js`、`lib/typert.host.js`、`lib/client.js`、`package.json`、`test/session-selection.test.mjs`、`test/manifest.test.mjs`、`scripts/check-manifest.mjs`、`README.md`、`README.zh-CN.md`、`CHANGELOG.md`、本文件。
- **运行时依据**：已 Inspect `conversation.input.left`（session scope、标准 `sessionId` props）、`sessions` Service 和 `agent/disposed` Event；参考已安装 `dsh-mysql` 的 session selection 生命周期实现。
- **测试命令与结果**：`node --check lib\\*.js`（入口语法通过）；`node test\\session-selection.test.mjs` 6/6 通过；`pnpm test` 55/55 通过；`pnpm run check` 通过；`git diff --check` 通过。
- **未完成/风险**：不实现 Agent Tools、HTTP/OpenAPI、SSRF/DNS、动态上下文和审计；选择状态为进程内存态，重启后需重新激活；隔离 Profile 的 T06 新包运行时烟测待完成。
- **下一步建议**：进入 T07，实现固定 `api_kits`、`api_operations`、`api_describe` Agent Tools，并在每次工具调用前复用 `resolveSessionActivation`。

---

### 2026-08-27 / T07

- **完成内容**：完成固定 Agent 发现与描述工具；`api_kits` 提供安全 Kit/Environment 摘要，`api_operations` 支持关键词、Tag、HTTP method、Service Target 和分页，`api_describe` 根据稳定 `operationId` 返回当前会话可用的完整安全调用说明。
- **变更文件**：新增 `lib/discovery.js`、`lib/agent-tools.js`、`test/discovery.test.mjs`；修改 `lib/index.js`、`package.json`、`scripts/check-manifest.mjs`、`test/manifest.test.mjs`、`README.md`、`README.zh-CN.md`、`CHANGELOG.md` 和本文件。
- **运行时依据**：通过 Inspect 确认 `tools.register(definition)`、raw ToolDefinition 的参数/输出 Schema、`exec.agent.id` 会话身份和 Fiber 生命周期；参考当前运行时已安装并运行的 `dsh-mysql` 工具实现。
- **安全边界**：每次调用重新解析会话激活状态；只暴露启用且允许 Agent 的 Operation，并应用 Kit/Operation 策略交集；输出不含 base URL、host 白名单、凭据引用、secret 或内部堆栈；T07 不发 HTTP。
- **测试命令与结果**：`node --check` T07 入口通过；`node --test test/discovery.test.mjs` 8/8 通过；全量 `pnpm test`、`pnpm run check`、`pnpm pack --dry-run` 和 `git diff --check` 待最终验收后记录。
- **未完成/风险**：T07 不实现 `api_call`、HTTP transport、SSRF/DNS、响应治理、审计、动态上下文和 OpenAPI 导入；64 KiB 输出上限是发现工具边界，真实响应限制留给 T08/T09。
- **下一步建议**：进入 T08，实现固定 `operationId + 参数` 的 Host 只读 HTTP 执行器，并继续复用当前会话权威解析和策略门禁。

---

### 2026-08-27 / T08

- **完成内容**：完成固定 `api_call` Agent Tool 和 Host 只读执行器。工具只接受稳定 `operationId`、path/query/header 参数，目标由已登记 Environment 的 `baseUrl` 与 Operation path 固定拼接；仅允许 GET/HEAD，拒绝任意 URL、host、sessionId、body、Cookie 参数和需要确认的调用。
- **变更文件**：新增 `lib/executor.js`、`lib/transport.js`、`test/executor.test.mjs`；修改 `lib/agent-tools.js`、`lib/index.js`、`lib/credential-adapter.js`、`package.json`、`scripts/check-manifest.mjs`、`test/manifest.test.mjs`、`test/discovery.test.mjs`、`test/auth.test.mjs`、`README.md`、`README.zh-CN.md`、`CHANGELOG.md` 和本文件。
- **运行时依据**：确认 `tools.register(definition)`、`exec.agent.id`、`exec.signal`；确认当前 DSH 没有可直接复用的通用出站 HTTP Provider 和 DNS/IP SSRF Helper，因此 T08 使用插件私有、可注入的 Host `fetch` transport，不注册全局 `ctx.web` Provider。
- **执行与安全边界**：每次调用重新解析会话激活和 Registry；复用 T07 的 Operation/Kit/Target/Environment 策略门禁；仅使用 Environment 固定目标和显式 host allowlist；认证通过 Host-only adapter 按次解析；transport 使用 manual redirect；响应流式按字节限额读取并投影为 JSON 或文本；错误不返回 URL、Header、secret、body、stack 或 cause。
- **测试命令与结果**：`node --check` T08 模块通过；`node --test test/executor.test.mjs` 7/7 通过；T07 discovery 8/8 通过；认证测试 5/5 通过。全量 `pnpm test`、`pnpm run check`、`pnpm pack --dry-run` 和 `git diff --check` 待最终验收后记录。
- **未完成/风险**：T08 不实现 DNS 解析结果/IP/CIDR 级 SSRF、DNS rebinding、递归响应脱敏、持久化审计、动态上下文、OpenAPI 导入、自动重定向或写操作；`credential-adapter` 已切换为当前 DSH credentials seam 的字符串引用形状。
- **下一步建议**：进入 T09，集中实现 DNS/IP SSRF、重定向安全、递归响应治理和审计，并继续复用 T08 的执行计划与 transport seam。

---

### 2026-08-27 / T09

- **状态：已完成**。新增 `lib/ip.js`、`lib/ssrf.js`、`lib/redaction.js`、`lib/audit-log.js`；扩展 Environment `allowedCidrs` 和 Operation 响应治理/脱敏策略；新增 pinned Node HTTP/HTTPS transport。
- **安全修订**：修复 Host 默认 fs 服务与审计 sink 契约不兼容、截断 JSON 原文脱敏旁路、IPv4-translated/NAT64/IPv4-compatible/6to4 地址分类、注入 transport 跳过 DNS 校验、非默认端口 Host 头和审计前置拒绝丢失等问题；pinned transport 强制 `Accept-Encoding: identity`，避免压缩响应在有界读取前膨胀。
- **SSRF 与重定向**：每次调用对 DNS 全部返回地址分类校验，覆盖 IPv4、IPv6、IPv4-mapped IPv6、loopback、link-local、metadata、RFC1918、ULA、CGNAT、保留/文档网段；私网必须同时配置 `allowPrivateNetwork` 和匹配 CIDR。生产 transport 连接已校验固定 IP，保留登记 hostname 的 Host/SNI，不使用代理、隐式重试或自动重定向。
- **响应治理**：JSON 成功及错误体在输出前递归替换敏感字段，再按深度、数组、字符串、对象数量和总字节治理；不返回 Response Header 或 `Location`。
- **审计**：Host-only JSONL sink 写入 `$DSH_HOME/storages/dsh-api-kit/audit/audit-YYYY-MM-DD.jsonl`，字段白名单、默认 14 日懒清理、串行 append；调用拒绝和网络尝试均走 executor finally，审计写失败不影响工具结果。
- **测试与验收结果**：新增 SSRF 15 项、Redaction 4 项、Audit 3 项；全量 `pnpm test` 94/94 通过；`pnpm run check`、`pnpm pack --dry-run` 和 `git diff --check` 通过。
- **未完成/风险**：仍不实现动态上下文、OpenAPI 导入、写操作、OAuth、SSE/WebSocket、自动重定向和独立 MCP Server；DNS/固定连接能力通过插件私有 seam 实现，未来若 DSH 提供官方能力可替换。
- **下一步建议**：进入 T10，完成动态上下文和 MVP 端到端验收。

---

## 8. 变更记录

| 日期 | 版本 | 变更 | 原因 |
|---|---|---|---|
| 2026-08-26 | v0.1 | 建立分阶段实施计划，拆分 T00–T15，并定义每个任务的依赖、产出和验收。 | 支持跨多次会话持续推进 |
| 2026-08-27 | v0.1 | 完成 T01 Bundle 工程骨架、T02 领域模型、T03 Registry、T04 配置和 T05 手工 Operation/Kit CRUD。 | 建立可持续迭代的 API Kit 基础 |
