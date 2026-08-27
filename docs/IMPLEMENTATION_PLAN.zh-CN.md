# dsh-api-kit 实施文档

- **项目名称**：dsh-api-kit
- **对应需求**：[`REQUIREMENTS.zh-CN.md`](./REQUIREMENTS.zh-CN.md)
- **计划版本**：v0.1 MVP → v0.4
- **文档状态**：实施基线
- **当前阶段**：T02 领域模型和纯函数已完成，准备进入 T03
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

建议每次会话开头使用类似目标：

> 继续 dsh-api-kit，执行 Txx，先阅读需求和实施文档，完成代码、测试与任务验收，并更新交接记录。

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
T04 服务目标、环境与认证配置
  ↓
T05 手工 API 操作 CRUD
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
| T03 | Registry 持久化与迁移 | M0 | 未开始 | T02 |
| T04 | 服务目标、环境和认证配置 | M0 | 未开始 | T02/T03 |
| T05 | 手工 API 操作 CRUD | M0 | 未开始 | T02/T03/T04 |
| T06 | 会话级 API 套件选择器 | M0 | 未开始 | T03/T04/T05 |
| T07 | Agent 发现与描述工具 | M0 | 未开始 | T05/T06 |
| T08 | 固定目标的只读 HTTP 执行器 | M0 | 未开始 | T04/T05 |
| T09 | 安全策略、SSRF、响应治理和审计 | M0 | 未开始 | T08 |
| T10 | 动态上下文和 MVP 端到端验收 | M0 | 未开始 | T06/T07/T08/T09 |
| T11 | OpenAPI JSON 导入器 | M1 | 未开始 | T02/T03/T05 |
| T12 | 导入预览、冲突、Tag 与多服务分配 | M1 | 未开始 | T11 |
| T13 | UI 质量、主题、可用性和回归 | M1 | 未开始 | T10/T12 |
| T14 | 写接口、人工确认和 OAuth | M2 | 未开始 | T09/T13 |
| T15 | 独立 MCP Server 适配器 | M3 | 未开始 | T02/T08/T09 |

---

## 4. 任务详细说明

## T00：运行时能力核对与任务拆解

**状态：已完成**

### 建议阅读

- [官方开发文档首页](https://deepseek-harness.github.io/deepseek-harness/develop/basic/)
- [工具开发](https://deepseek-harness.github.io/deepseek-harness/develop/basic/tool)
- [Framework：Service](https://deepseek-harness.github.io/deepseek-harness/develop/framework/service)
- [Framework：Events](https://deepseek-harness.github.io/deepseek-harness/develop/framework/events)
- [Cordis 教程：生命周期与 effects](https://deepseek-harness.github.io/deepseek-harness/develop/cordis-tutorial/02-lifecycle-and-effects)
- [Cordis 教程：进入 Harness](https://deepseek-harness.github.io/deepseek-harness/develop/cordis-tutorial/07-into-the-harness)


### 目标

确认当前 DSH 版本能支持本项目所需的 Host Tool、Typert RPC、动态上下文和 Web Slot，建立后续实现边界。

### 产出

- 本需求文档；
- 本实施文档；
- 基于 `dsh-mysql` 的插件结构参考；
- 初步决定采用 profile bundle，而不是临时动态插件；
- 初步决定使用固定 `api_*` 工具，而不是每个 operation 动态注册工具。

### 验收

- 明确列出未确认的运行时 API；
- 未对 DSH 运行时 API 凭空编码；
- T01 开始前重新执行官方 Inspect / 文档核对。

---

## T01：创建发布骨架和最小 Bundle

**对应需求**：NFR-004、NFR-005、NFR-009。

### 建议阅读

- [官方开发文档首页](https://deepseek-harness.github.io/deepseek-harness/develop/basic/)
- [配置与插件配置](https://deepseek-harness.github.io/deepseek-harness/develop/basic/config)
- [插件发布](https://deepseek-harness.github.io/deepseek-harness/develop/basic/publish)
- [Cordis 教程：第一个插件](https://deepseek-harness.github.io/deepseek-harness/develop/cordis-tutorial/01-first-plugin)
- [DSH 插件开发实战模板 Skill](https://github.com/fuzhengwei/xfg-skills-dsp-plugin-template)
- [现有 dsh-mysql 插件](https://github.com/1321928757/dsh-mysql)

### 目标

创建独立的 `dsh-api-kit` 包，能被 DSH profile 以 bundle 方式识别、安装和启动。

### 工作项

1. 创建 `dsh-api-kit/package.json`：
   - `type: module`；
   - `dsh.bundle.patch`；
   - `dsh.client.platform: web`；
   - Host、Client、Typert exports；
   - `dsh-plugin` keyword；
   - DSH/React 依赖按 peerDependencies 处理；
   - 仅引入必要依赖。
2. 创建 `cordis.patch.yml`，只插入一个插件行。
3. 创建最小 `lib/index.js`、`lib/client.js` 和 `lib/typert.host.js`。
4. 创建 README、LICENSE、NOTICE、CHANGELOG 占位文件。
5. 创建 `test/`、`scripts/` 和 `.gitignore`。
6. 使用当前 DSH 版本核对 package/bundle 加载契约。

### 验收

```powershell
node --check lib\index.js lib\client.js lib\typert.host.js
pnpm pack --dry-run
```

安装到测试 profile 后：

```powershell
dsh --profile web --dump-config | findstr dsh-api-kit
```

重启 DSH Web，确认插件启动日志没有异常。

### 完成定义

- 包可打包；
- bundle 行可被识别；
- Host/Client 无副作用泄漏；
- 空设置页或占位入口可正常加载；
- 文档和目录结构已提交。

---

## T02：领域模型、归一化和纯函数

**对应需求**：FR-KIT-001、FR-OP-001、FR-ENV-001、FR-AUTH-001、NFR-006、NFR-007。

### 建议阅读

- [官方开发文档首页](https://deepseek-harness.github.io/deepseek-harness/develop/basic/)
- [OpenAPI Specification](https://spec.openapis.org/oas/latest.html)
- [JSON Schema Specification](https://json-schema.org/specification)

### 目标

建立与 DSH 无关的纯数据模型和校验函数，为手工录入、OpenAPI 导入和未来 MCP 适配提供共同核心。

### 工作项

创建建议文件：

```text
lib/shared.js
lib/model.js
lib/normalizers.js
```

实现：

- `apiKit`、`operation`、`serviceTarget`、`environment`、`authProfile`、`registry` 模型；
- ID、名称、method、path、Tag、schema 的归一化；
- 稳定 operation key 生成；
- 支持 JSON Schema 常用类型；
- 保护最大名称、路径、描述和 schema 大小；
- 默认 `GET/HEAD` 只读策略；
- 默认写操作关闭；
- 不保存 secret 明文到 API 定义；
- schemaVersion 和迁移入口。

### 测试

- 空对象、错误类型、超长值；
- 相同输入生成相同 ID；
- path 参数提取和编码前的值校验；
- method 大小写归一化；
- 多个套件引用同一 operation；
- 旧 schema 迁移。

### 验收

```powershell
node test\model.test.mjs
node test\shared.test.mjs
```

### 完成定义

纯函数测试覆盖正常、边界和恶意输入；没有 Host/Client/Cordis 依赖。

---

## T03：Registry 持久化与迁移

**对应需求**：NFR-001、NFR-005、FR-KIT-002、FR-SESSION-005。

### 建议阅读

- [官方开发文档首页](https://deepseek-harness.github.io/deepseek-harness/develop/basic/)
- [配置与插件配置](https://deepseek-harness.github.io/deepseek-harness/develop/basic/config)
- [Cordis 教程：配置](https://deepseek-harness.github.io/deepseek-harness/develop/cordis-tutorial/05-config)

### 目标

实现本地 Registry 的加载、保存、备份、迁移和内存快照。

### 工作项

1. 默认路径：`$DSH_HOME/storages/dsh-api-kit/registry.json`。
2. 采用临时文件 + 原子替换写入。
3. 启动时校验 JSON、schemaVersion 和实体引用。
4. 损坏时保留坏文件，生成可读错误和空安全快照。
5. 保存失败时回滚内存缓存。
6. 所有 Host 读路径使用最新快照，不读启动旧副本。
7. 设计并实现迁移函数。
8. 原始 OpenAPI 是否落盘必须有显式配置；默认不存或存脱敏快照。

### 验收

- 首次启动无文件时得到空 Registry；
- 连续保存/读取后数据一致；
- 写入失败时内存和磁盘不分裂；
- schemaVersion 旧版本能迁移；
- 文件损坏不会导致整个 DSH 启动失败。

```powershell
node test\registry.test.mjs
```

---

## T04：服务目标、环境和认证配置

**对应需求**：FR-ENV-001～004、FR-AUTH-001～004、安全需求 6.1～6.3。

### 建议阅读

- [官方开发文档首页](https://deepseek-harness.github.io/deepseek-harness/develop/basic/)
- [Framework：Service](https://deepseek-harness.github.io/deepseek-harness/develop/framework/service)
- [Cordis 教程：Services](https://deepseek-harness.github.io/deepseek-harness/develop/cordis-tutorial/03-services)
- [Cordis 教程：配置](https://deepseek-harness.github.io/deepseek-harness/develop/cordis-tutorial/05-config)

### 目标

实现服务入口、环境和认证 Profile 的管理，以及敏感信息只在 Host 使用的边界。

### 工作项

1. 支持一个 Service Target 绑定多个环境。
2. 环境存储 baseUrl、协议、host 白名单、生产标识和调用限制。
3. 认证 Profile 存类型、非敏感参数和 `secretRef`。
4. 对浏览器返回安全视图：只返回 `hasSecret`、类型和名称。
5. 在 Host 请求前解析凭据。
6. 明确使用 DSH Credentials 还是插件本地 Host 安全存储；以运行时 Inspect 结果为准。
7. 对 baseUrl 做格式校验并拒绝嵌入凭据、非法协议和危险端口。

### 验收

- Client 永远拿不到 secret；
- 环境和认证可增删改查；
- 删除被引用实体时给出可行动错误；
- 测试环境与生产环境有清晰差异提示；
- baseUrl 不能由 tool 参数覆盖。

```powershell
node test\environment.test.mjs
node test\auth.test.mjs
```

---

## T05：手工 API 操作 CRUD

**对应需求**：FR-OP-001～005、FR-IMPORT-006、FR-KIT-004。

### 建议阅读

- [官方开发文档首页](https://deepseek-harness.github.io/deepseek-harness/develop/basic/)
- [工具开发](https://deepseek-harness.github.io/deepseek-harness/develop/basic/tool)
- [配置与插件配置](https://deepseek-harness.github.io/deepseek-harness/develop/basic/config)
- [现有 dsh-mysql 插件](https://github.com/1321928757/dsh-mysql)

### 目标

让用户在设置页手工维护 API 操作，并把操作分配到一个或多个 API 套件。

### 工作项

1. Host 实现 operation CRUD。
2. 通过 Typert RPC 暴露套件、操作、目标、环境和认证的安全视图。
3. 实现 operation 与 kit 的关联。
4. 实现操作启用/禁用和 Agent 调用策略。
5. 实现人工测试入口，但必须走同一个后续请求执行器。
6. Client 设置页支持：
   - 套件列表；
   - 操作列表；
   - 手工添加/编辑表单；
   - JSON Schema 编辑或简化参数表单；
   - 环境/认证选择；
   - 启用开关；
   - 删除二次确认。

### 验收

- 能创建至少 3 个 GET 操作并归入套件；
- 可编辑、禁用、删除；
- 设置页刷新后数据仍在；
- 客户端不显示 secret；
- 关系引用一致。

```powershell
node test\operation.test.mjs
```

浏览器人工验收：亮色、暗色、窄屏、键盘操作。

---

## T06：会话级 API 套件选择器

**对应需求**：FR-SESSION-001～005、FR-KIT-003。

### 建议阅读

- [官方开发文档首页](https://deepseek-harness.github.io/deepseek-harness/develop/basic/)
- [配置与插件配置](https://deepseek-harness.github.io/deepseek-harness/develop/basic/config)
- [Cordis 教程：Services](https://deepseek-harness.github.io/deepseek-harness/develop/cordis-tutorial/03-services)
- [现有 dsh-mysql 插件](https://github.com/1321928757/dsh-mysql)

### 目标

像 `dsh-mysql` 的数据库按钮一样，让用户从输入栏选择当前会话使用的 API 套件和环境。

### 工作项

1. 在当前 DSH 版本中核对 `conversation.input.left` Slot 的完整 props 和注册契约。
2. 实现会话到 `activeKitIds`、environment 和 Tag 过滤的映射。
3. 实现输入栏按钮三态：未激活、已激活、异常/停用。
4. 支持搜索、套件多选、环境选择和清空。
5. 对生产环境和多个套件展示风险提示。
6. 会话变更通过 Typert RPC 写入 Host 内存或持久化的会话映射。
7. 工具调用时重新校验当前激活配置。

### 验收

- 会话 A 和会话 B 的选择互不影响；
- 刷新页面能恢复当前会话选择，或明确记录为临时选择；
- 停用套件后不能继续调用；
- 只激活一个套件时 UI 清晰显示套件和环境；
- 没有激活套件时工具给出明确提示。

---

## T07：Agent 发现与描述工具

**对应需求**：FR-TOOL-001～003、FR-SESSION-004、NFR-003。

### 建议阅读

- [官方开发文档首页](https://deepseek-harness.github.io/deepseek-harness/develop/basic/)
- [工具开发](https://deepseek-harness.github.io/deepseek-harness/develop/basic/tool)
- [MCP Tools 规范](https://modelcontextprotocol.io/specification/latest/server/tools)
- [MCP 官方 TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)

### 目标

注册固定数量的模型工具，让 AI 能够从当前激活套件中发现和理解操作。

### 工作项

实现：

- `api_kits`；
- `api_operations`；
- `api_describe`。

工具规范：

- 只返回安全视图；
- 只显示当前激活套件允许暴露的内容；
- 支持关键词、Tag、method、serviceTarget、分页和数量上限；
- 完整 schema 按需返回；
- 未激活/禁用对象不可通过猜 ID 访问；
- 返回稳定错误码。

### 工具注册注意事项

- 以当前 DSH 运行时 Inspect 结果为准确认 `harness.registerTool` 或等价 API；
- 为每一个注册副作用绑定 Fiber disposer；
- 确认工具是否默认对所有 Agent 预设可见；
- Tool description 说明“禁止任意 URL、先 discover/describe 再 call”。

### 验收

- 工具目录中出现 3 个固定工具；
- 无激活套件时有可行动错误；
- `api_operations` 不返回完整 schema；
- `api_describe` 返回完整但脱敏的 schema；
- 输出大小受限制。

```powershell
node test\agent-tools.test.mjs
```

---

## T08：固定目标的只读 HTTP 执行器

**对应需求**：FR-TOOL-004～005、FR-ENV-002、FR-AUTH-001、NFR-002。

### 建议阅读

- [官方开发文档首页](https://deepseek-harness.github.io/deepseek-harness/develop/basic/)
- [工具开发](https://deepseek-harness.github.io/deepseek-harness/develop/basic/tool)
- [Framework：Service](https://deepseek-harness.github.io/deepseek-harness/develop/framework/service)
- [Cordis 教程：Services](https://deepseek-harness.github.io/deepseek-harness/develop/cordis-tutorial/03-services)
- [Fetch Standard](https://fetch.spec.whatwg.org/)

### 目标

实现只接受 operationId 的 HTTP 请求执行器，先从 Registry 解析目标、环境和认证，再发起 GET/HEAD 请求。

### 工作项

1. 只允许 `operationId + params`，禁止任意 `url`。
2. 拼接 baseUrl 和 path，正确 URL 编码 path 参数。
3. 序列化 query 参数和 body（MVP GET/HEAD 通常无 body）。
4. 注入认证 Header/Query，但不允许模型覆盖受控 Header。
5. 使用 DSH 官方可用 HTTP Service/Builtin 或受控 Node API，先确认运行时契约。
6. 支持超时、取消、最大响应大小和内容类型判断。
7. 返回统一 `{ok,status,data,truncated,...}` 结果。
8. 明确处理非 2xx、空响应、文本响应和无效 JSON。

### 测试

- baseUrl/path 的各种斜杠组合；
- path/query 编码；
- 必填参数缺失；
- 非 JSON 响应；
- 连接失败、超时、401、404、500；
- 结果大小限制。

```powershell
node test\request-executor.test.mjs
```

不得用真实公司服务作为单元测试依赖；使用本地 mock 或纯函数注入 transport。

---

## T09：安全策略、SSRF、响应治理和审计

**对应需求**：安全需求 6.1～6.4、FR-TOOL-006、NFR-002、NFR-008。

### 建议阅读

- [官方开发文档首页](https://deepseek-harness.github.io/deepseek-harness/develop/basic/)
- [工具开发](https://deepseek-harness.github.io/deepseek-harness/develop/basic/tool)
- [Framework：Service](https://deepseek-harness.github.io/deepseek-harness/develop/framework/service)
- [MCP Tools 规范中的工具安全提示](https://modelcontextprotocol.io/specification/latest/server/tools)
- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)

### 目标

将安全策略落实到 Host 执行边界，而不是只写在 Prompt 或 UI 提示中。

### 工作项

1. 协议白名单：仅 HTTP/HTTPS。
2. operation + environment 固定目标校验。
3. host 白名单校验。
4. loopback、link-local、metadata、未授权私网地址默认拒绝。
5. 企业内网通过显式 host/CIDR 放行。
6. 关闭重定向；如开放，只允许同一白名单。
7. 核对 DNS 解析/实际连接 IP 的校验实现，防 DNS rebinding。
8. Header allowlist，禁止 Host、Authorization、Cookie 等受控 Header 被覆盖。
9. 方法策略双重校验：套件级 + 操作级。
10. 响应字段脱敏、长度/深度/数组限制。
11. 记录成功、失败和拒绝审计事件。
12. 审计信息不包含 secret、Cookie、完整 Header 和完整敏感请求体。

### 必测拒绝用例

- `http://127.0.0.1`；
- `http://169.254.169.254`；
- RFC1918 未在企业白名单的目标；
- 编码/重定向绕过白名单；
- operation 不存在；
- 未激活套件；
- POST/DELETE 等写方法；
- Header 注入 Authorization；
- 超大响应；
- 超时和重复调用。

### 验收

```powershell
node test\policy.test.mjs
node test\sanitizer.test.mjs
node test\audit.test.mjs
```

安全测试未通过时，不得进入端到端 MVP。

---

## T10：动态上下文和 MVP 端到端验收

**对应需求**：MVP 全部验收标准、FR-SESSION-004、NFR-003。

### 建议阅读

- [官方开发文档首页](https://deepseek-harness.github.io/deepseek-harness/develop/basic/)
- [工具开发](https://deepseek-harness.github.io/deepseek-harness/develop/basic/tool)
- [Framework：Events](https://deepseek-harness.github.io/deepseek-harness/develop/framework/events)
- [Cordis 教程：Events](https://deepseek-harness.github.io/deepseek-harness/develop/cordis-tutorial/04-events)
- [现有 dsh-mysql 插件](https://github.com/1321928757/dsh-mysql)

### 目标

将套件摘要加入每轮运行时上下文，完成从配置到 AI 工具调用的闭环。

### 工作项

1. 按当前 DSH 版本核对 `systemPrompt.context` 注册方法。
2. 只注入套件名称、描述、环境、数量和使用规则。
3. 不注入完整 OpenAPI、secret、完整 schema。
4. 在工具执行时解析当前 sessionId。
5. 编写端到端测试场景：
   - 创建 3 个 GET 操作；
   - 激活套件；
   - 搜索；
   - 描述；
   - 调用 mock API；
   - 将结果与 MySQL/代码/日志概念串联。
6. 更新 README 快速上手和安全模型。

### MVP 验收

- 能完成用户需求中的最小排障流程；
- 未激活、无权限、错误参数、危险 host 均拒绝；
- 响应、日志和工具卡片不泄密；
- DSH 重启后配置恢复；
- 安全和基础 UI 回归通过。

```powershell
node test\mvp.e2e.test.mjs
pnpm pack
```

---

## T11：OpenAPI JSON 导入器

**对应需求**：FR-IMPORT-001～003、FR-IMPORT-005、NFR-006。

### 建议阅读

- [官方开发文档首页](https://deepseek-harness.github.io/deepseek-harness/develop/basic/)
- [OpenAPI Specification](https://spec.openapis.org/oas/latest.html)
- [OpenAPI 3.0.3 Specification](https://spec.openapis.org/oas/v3.0.3.html)
- [OpenAPI 3.1.1 Specification](https://spec.openapis.org/oas/v3.1.1.html)
- [Swagger/OpenAPI 2.0 Specification](https://swagger.io/specification/v2/)
- [JSON Schema Specification](https://json-schema.org/specification)

### 目标

把 OpenAPI 3.0/3.1 JSON 和 Swagger 2.0 JSON 归一化为内部 Operation 模型。

### 工作项

1. 识别 `openapi` / `swagger` 版本。
2. 解析 `paths` 和支持的 HTTP methods。
3. 读取 operationId、summary、description、tags。
4. 解析 path/query/header/cookie 参数。
5. 解析 requestBody 和 responses。
6. 处理 `components.schemas`、`definitions` 和 `$ref`。
7. 读取 `servers` 或 Swagger `host/basePath/schemes` 作为环境候选，不自动信任为最终可调用地址。
8. 读取 `securitySchemes` 生成认证配置模板，不导入 secret。
9. 缺失 operationId 时生成稳定 ID。
10. 输出导入报告：新增、更新、冲突、跳过、错误、警告。

### 约束

- 不支持的 schema 不能静默丢弃；
- `$ref` 循环要有深度和错误保护；
- 原始文档大小有限制；
- 导入结果必须经过用户确认后落盘。

### 测试

准备 fixtures：

```text
test/fixtures/openapi-3-basic.json
test/fixtures/openapi-3-ref.json
test/fixtures/swagger-2-basic.json
test/fixtures/openapi-invalid.json
```

```powershell
node test\openapi-import.test.mjs
```

---

## T12：导入预览、冲突、Tag 与多服务分配

**对应需求**：FR-IMPORT-004～006、FR-KIT-004～005、FR-ENV-003。

### 建议阅读

- [官方开发文档首页](https://deepseek-harness.github.io/deepseek-harness/develop/basic/)
- [配置与插件配置](https://deepseek-harness.github.io/deepseek-harness/develop/basic/config)
- [OpenAPI Specification](https://spec.openapis.org/oas/latest.html)

### 目标

将导入器接入设置页，使用户可以安全预览、筛选和确认导入。

### 工作项

1. 导入预览显示文档元信息和统计。
2. 按 Tag、Service Target、method 筛选。
3. 预览新增/更新/冲突/跳过/错误列表。
4. 提供“覆盖”“保留本地修改”“跳过”冲突策略。
5. 按 Tag 批量分配到 API 套件。
6. 处理多个 `servers` 和多个服务入口。
7. 从 security scheme 选择认证 Profile 模板。
8. 支持导入回滚或在确认前不落盘。
9. 可选保存原始文档快照和导入版本。

### 验收

- 同一文档重复导入不会复制操作；
- 本地手工修改不会被默认无提示覆盖；
- 用户能只导入一个 Tag；
- 一个文档中的不同服务可进入不同套件；
- 缺失 baseUrl、无法解析 ref 等问题可被用户看到。

---

## T13：UI 质量、主题、可用性和回归

**对应需求**：NFR-009、FR-SESSION-001、FR-KIT-005。

### 建议阅读

- [官方开发文档首页](https://deepseek-harness.github.io/deepseek-harness/develop/basic/)
- [配置与插件配置](https://deepseek-harness.github.io/deepseek-harness/develop/basic/config)
- [Cordis 教程：生命周期与 effects](https://deepseek-harness.github.io/deepseek-harness/develop/cordis-tutorial/02-lifecycle-and-effects)
- [Cordis 教程：组合与 HMR](https://deepseek-harness.github.io/deepseek-harness/develop/cordis-tutorial/06-into-the-harness)
- [DSH 插件开发实战模板 Skill](https://github.com/fuzhengwei/xfg-skills-dsp-plugin-template)

### 目标

让插件达到可日常使用和发布的质量，不因功能增加而破坏 DSH 原生体验。

### 工作项

- 亮色/暗色主题全面替换硬编码颜色；
- 使用 DSH `--dsw-*` 令牌；
- 设置页列表、空状态、错误状态、加载状态；
- 输入栏窄屏和长名称处理；
- 键盘焦点、方向键、Escape、Enter；
- `focus-visible`、reduced motion、contrast；
- 大量操作时分页和搜索；
- 工具调用结果的可读卡片或原生兼容表现；
- 不暴露认证值和内部路径；
- 检查 HMR/重启后的副作用回收。

### 验收

人工通过：

- 亮色主题；
- 暗色主题；
- 400px 左右窄屏；
- 0/1/3/100 个套件或操作；
- 加载、失败、空数据、冲突和删除确认状态。

---

## T14：写接口、人工确认和 OAuth

**阶段：M2，不能阻塞 M0/M1**

### 建议阅读

- [官方开发文档首页](https://deepseek-harness.github.io/deepseek-harness/develop/basic/)
- [工具开发](https://deepseek-harness.github.io/deepseek-harness/develop/basic/tool)
- [Framework：Events](https://deepseek-harness.github.io/deepseek-harness/develop/framework/events)
- [Cordis 教程：Events](https://deepseek-harness.github.io/deepseek-harness/develop/cordis-tutorial/04-events)
- [OAuth 2.0 RFC 6749](https://datatracker.ietf.org/doc/html/rfc6749)

**对应需求**：安全需求 6.2、FR-AUTH-001、后续版本规划。

### 目标

在只读 MVP 稳定后，安全扩展副作用请求和动态认证。

### 工作项

1. POST/PUT/PATCH/DELETE 的套件级和操作级开关。
2. 必须明确显示副作用说明。
3. 可配置人工确认；确认应由 DSH 正式审批/确认能力承载，不仅靠 Prompt。
4. 请求体 schema 强校验；禁止未声明字段或提供严格模式选项。
5. 写操作审计增强，保留脱敏后的请求摘要。
6. OAuth2 Client Credentials 和 token 刷新。
7. 生产环境默认必须确认或关闭。
8. 文件上传、多段表单另立需求，不直接复用 JSON body 逻辑。

### 验收

- 默认配置下写接口无法调用；
- 没有用户确认时不会发出请求；
- token 刷新失败不会泄露 client secret；
- 审计可定位是谁、在哪个会话、调用了哪个环境。

---

## T15：独立 MCP Server 适配器

**阶段：M3，独立排期**

### 建议阅读

- [官方开发文档首页](https://deepseek-harness.github.io/deepseek-harness/develop/basic/)
- [工具开发](https://deepseek-harness.github.io/deepseek-harness/develop/basic/tool)
- [OpenAPI Specification](https://spec.openapis.org/oas/latest.html)
- [MCP Tools 规范](https://modelcontextprotocol.io/specification/latest/server/tools)
- [MCP 官方 TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)

**对应需求**：NFR-007、后续版本规划。

### 目标

复用核心 Registry、OpenAPI、请求执行和策略模块，为其他 MCP Client 提供能力。

### 工作项

1. 将 DSH 无关核心抽到可复用模块。
2. 使用 MCP `tools/list` / `tools/call` 映射：
   - `api_kits`；
   - `api_operations`；
   - `api_describe`；
   - `api_call`。
3. 支持 stdio，后续支持 Streamable HTTP。
4. 明确 MCP Server 运行时的凭据、工作区和会话边界。
5. 不让独立 MCP Server 绕过与 DSH 相同的 SSRF、方法和审计策略。
6. 增加 MCP Inspector / Claude / VS Code 等兼容性验证。

### 验收

- MCP Client 能发现固定工具；
- `tools/list` 不暴露 secret；
- `tools/call` 复用同一安全核心；
- DSH 原生插件和 MCP 适配器对同一配置产生一致结果。

---

## 5. 技术约束与实现原则

### 5.1 DSH 插件形态

采用可发布 **profile bundle**：

- `dsh.bundle.patch` 插件行；
- Host 入口；
- Web Client 入口；
- Typert 入口；
- 与 `dsh-mysql` 类似的本地打包、安装、重启验证流程。

### 5.2 Host/Client 边界

Host 负责：

- Registry；
- 文件；
- 凭据；
- HTTP 请求；
- SSRF 和安全策略；
- Agent Tools；
- 动态上下文；
- 审计。

Client 负责：

- 输入栏套件选择器；
- 设置页；
- 导入预览；
- 非敏感状态展示。

Client 不直接访问内部 API，不持有 secret，不决定最终安全策略。

### 5.3 数据传输

- CRUD 使用 Typert RPC 或当前 DSH 官方推荐的类型化通道；
- 大型导入预览和大 JSON 结果必要时使用 HTTP JSON 通道；
- 所有跨 Host/Client 数据必须是有限、可序列化、无 secret 的 JSON；
- 不传递 Cordis 活对象、Service、Session 或函数。

### 5.4 工具策略

固定 `api_*` 工具优先于动态端点工具：

```text
api_kits → api_operations → api_describe → api_call
```

如果未来实测表明少量高频端点需要专用工具，应作为明确的可选优化，而不是默认暴露所有 operation。

### 5.5 可回收副作用

所有 Tool、Slot、路由、监听、Timer、样式和服务注册都必须绑定当前 Fiber，在 stop/update/卸载后回收。

### 5.6 不凭猜测使用运行时 API

编码前/遇到版本差异时必须通过：

- 官方文档；
- 当前 DSH 源码；
- `cordis_inspect_list` / `cordis_inspect_query`；
- 已验证的 `dsh-mysql` 实现；

确认服务名、Slot、Tool 注册和上下文注入方式。无法确认时先建立探测任务，不要假设。

---

## 6. 测试策略

### 6.1 单元测试

纯函数优先：

- model / normalize；
- registry migration；
- URL 拼接；
- JSON Schema 参数；
- OpenAPI import；
- SSRF / allowlist；
- auth header 构造；
- response sanitizer；
- audit formatter。

### 6.2 Host 集成测试

使用注入式 fake transport，不访问真实公司服务：

- Tool 注册和卸载；
- session selection；
- registry 写入；
- 执行器的错误边界；
- 动态上下文。

### 6.3 浏览器验收

每个涉及 UI 的任务至少验证：

- 亮色主题；
- 暗色主题；
- 空数据/加载/失败；
- 窄屏；
- 键盘和焦点；
- 页面刷新；
- 插件重启后副作用是否重复。

### 6.4 发布前检查

```powershell
node --check lib\index.js lib\client.js lib\typert.host.js
node test\model.test.mjs
node test\policy.test.mjs
node test\openapi-import.test.mjs
pnpm pack --dry-run
```

按 dsh-plugin-authoring 的本地黄金流程：先 pack → 本地 profile 安装 → 重启 DSH → 浏览器验收 → 再推送和打 tag。

---

## 7. 交接记录

每次会话完成一个任务后，在这里追加一条：

```markdown
### YYYY-MM-DD / Txx

- **完成内容**：
- **变更文件**：
- **测试命令与结果**：
- **需求覆盖**：
- **未完成/风险**：
- **下一步建议**：
```

### 2026-08-26 / 文档基线

- **完成内容**：建立 dsh-api-kit 需求文档和分阶段实施文档；确定 API 套件术语、MVP 边界、固定 `api_*` 工具、Host 安全边界和 OpenAPI 后置路线。
- **变更文件**：`dsh-api-kit/docs/REQUIREMENTS.zh-CN.md`、`dsh-api-kit/docs/IMPLEMENTATION_PLAN.zh-CN.md`。
- **测试命令与结果**：未执行代码测试；当前仅完成文档沉淀。
- **需求覆盖**：背景、目标、范围、用户场景、功能需求、安全需求、非功能需求、MVP 验收、版本路线。
- **未完成/风险**：T01 开始前仍需以当前运行时 Inspect 结果核对 Tool 注册、动态上下文、Slot、Credentials 和 HTTP 能力。
- **下一步建议**：执行 T01；先检查官方文档和当前 DSH 运行时，再创建最小 bundle。

### 2026-08-27 / T01

- **完成内容**：创建 `dsh-api-kit` 0.1.0 profile bundle 骨架；增加 Host、Client、Typert 入口；增加输入栏和设置页占位 UI；增加 manifest 检查脚本与 Node 内置测试。
- **变更文件**：`package.json`、`cordis.patch.yml`、`lib/index.js`、`lib/client.js`、`lib/typert.host.js`、`README.md`、`README.zh-CN.md`、`CHANGELOG.md`、`LICENSE`、`NOTICE`、`.gitignore`、`scripts/check-manifest.mjs`、`test/manifest.test.mjs`。
- **测试命令与结果**：`node --check` 三个入口通过；`pnpm test` 5/5 通过；`pnpm run check` 通过；`pnpm pack --dry-run` 只输出发布白名单；本地 `dsh plugin --profile t01-test add dsh-api-kit-0.1.0.tgz` 成功；`dsh --profile t01-test --dump-config` 已看到 `# == dsh-api-kit`。
- **需求覆盖**：NFR-004、NFR-005、NFR-009 的包结构、加载契约和占位 UI 基线。
- **未完成/风险**：尚未启动隔离测试 profile 的 Web UI 做浏览器冒烟；当前 DSH Web 进程未被本任务重启，避免影响用户正在使用的 `http://127.0.0.1:3080`；T01 暂不实现业务 RPC、Tool、Registry、网络和凭据。
- **下一步建议**：进入 T02，先实现 DSH 无关的领域模型、归一化、schemaVersion 和纯函数测试；之后再补充 Typert 业务 RPC。

### 2026-08-27 / T02

- **完成内容**：新增 DSH 无关的 `normalizers.js` 和 `model.js`；建立 API Kit、Operation、Service Target、Environment、Auth Profile、Registry 规范化模型；实现稳定 operation key/id、路径参数补全、请求体/响应 schema 归一化、方法/认证/策略默认值、边界限制和 legacy registry 迁移入口。
- **变更文件**：`lib/normalizers.js`、`lib/model.js`、`test/model.test.mjs`、`package.json`、`scripts/check-manifest.mjs`、`test/manifest.test.mjs`。
- **测试命令与结果**：`node --check lib\\model.js`、`node --check lib\\normalizers.js` 通过；`pnpm test` 6 个子测试 / 16 组断言通过；`pnpm run check` 通过。
- **需求覆盖**：FR-KIT-001、FR-OP-001、FR-ENV-001、FR-AUTH-001、NFR-006、NFR-007；T02 领域模型、归一化、默认只读策略、大小限制和测试基线。
- **未完成/风险**：中文 ID 会被安全归一化为 ASCII 片段，纯中文名称可能退化为 fallback；T02 尚未实现 Registry 文件读写和 DSH RPC。当前 `package.json` 的 `files` 已加入两个纯函数模块，后续发布包仍需同步验证。
- **下一步建议**：进入 T03，基于 `createEmptyRegistry` / `migrateRegistry` / `normalizeRegistry` 实现原子写入、加载、损坏文件保护、回滚和 schema 迁移测试。

---

## 8. 变更记录

| 日期 | 版本 | 变更 | 原因 |
|---|---|---|---|
| 2026-08-26 | v0.1 | 建立分阶段实施计划，拆分 T00–T15，并定义每个任务的依赖、产出和验收。 | 支持跨多次会话持续推进 |
| 2026-08-26 | v0.1 | 补充 DSH 官方开发文档、Cordis 教程、OpenAPI、JSON Schema、MCP、OWASP SSRF 和 OAuth 参考链接，并在相关任务中增加就近阅读入口。 | 方便后续 AI 在跨会话实施时快速查阅权威资料 |
| 2026-08-27 | v0.1 | 完成 T01 Bundle 工程骨架、静态验收、tgz 打包和隔离测试 profile 配置验收。 | 建立可持续迭代的插件发布基础 |
