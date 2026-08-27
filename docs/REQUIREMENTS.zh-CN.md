# dsh-api-kit 需求文档

- **项目名称**：dsh-api-kit
- **产品定位**：为 DeepSeek Harness 提供“API 套件、OpenAPI 导入、会话级启用和安全调用”的本地优先插件。
- **文档版本**：v0.1
- **文档状态**：需求基线
- **最后更新**：2026-08-26

---

## 官方文档与参考链接

后续实现、运行时 API 核对和问题排查，优先查阅以下官方文档。DSH 的插件运行时 API 可能随版本变化，本文档中的服务名、Slot、Tool 注册方式和 RPC 细节，最终以当前 DSH 版本文档、源码和运行时 Inspect 结果为准。

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

### 本项目相关参考

- [DSH 插件开发实战模板 Skill](https://github.com/fuzhengwei/xfg-skills-dsp-plugin-template)
- [现有 dsh-mysql 插件](https://github.com/1321928757/dsh-mysql)

---

## 1. 背景

在日常开发、排障和数据分析场景中，AI 往往需要综合使用：

- 工作区中的代码和配置；
- 本地控制台日志；
- `dsh-mysql` 查询到的数据库数据；
- 公司内部服务或第三方服务的 HTTP API。

当前代码通常只暴露 Feign 接口路径、方法签名和 DTO，真正的服务 `baseUrl`、部署环境、鉴权方式和可调用范围可能位于配置中心、网关或运行环境中。仅凭代码，AI 无法可靠知道：

- 请求应该发往哪个环境；
- 完整 URL 如何拼接；
- 路径参数、查询参数和请求体如何组织；
- 应使用哪一种 token、Header 或其他认证方式；
- 当前接口是查询接口还是会产生副作用的写接口。

如果让 AI 通过 shell、脚本或自行猜测 URL 发起请求，会带来误调用生产环境、SSRF、泄露凭据、写入业务数据和难以审计等风险。

因此需要一个 DSH 原生插件，把经人工确认的 API 定义、环境和认证配置注册到本机，并按当前会话选择的 API 套件向模型提供可发现、可描述、可控制调用的 API 能力。

---

## 2. 产品目标

### 2.1 核心目标

1. 支持用户手工维护 API 接口定义。
2. 支持从 OpenAPI / Swagger 文档导入接口定义。
3. 支持将多个接口组织为面向项目、业务域或排障场景的 **API 套件（API Kit）**。
4. 支持在 DSH 输入栏按会话选择一个或多个 API 套件。
5. 让 AI 能够先发现接口、再读取接口详情、最后调用已登记接口。
6. 在 Host 侧统一处理 `baseUrl`、环境、认证、请求构造和安全策略。
7. 默认优先支持只读查询，并对写操作、目标主机、响应大小和调用过程进行控制。
8. 保持本地优先：API 定义和非敏感配置保存在本机，密钥不进入浏览器和模型上下文。
9. 与 `dsh-mysql` 形成互补，使 AI 能够结合代码、日志、MySQL 和内部 API 进行问题分析。

### 2.2 非目标

以下内容不属于第一版 MVP：

- 不是完整的 Postman 替代品；
- 不负责 API 生命周期管理、Mock、压测、监控和测试报告；
- 不允许模型任意输入 URL 并直接访问互联网或内网；
- 不默认支持任意写操作、文件上传、WebSocket、SSE 或 GraphQL；
- 不把完整 OpenAPI 文档无条件注入每轮 Prompt；
- 不在第一版实现团队级云端同步、账号体系和集中式凭据服务；
- 不强依赖外部 MCP Server 才能工作；
- 不承诺兼容所有 OpenAPI 扩展和厂商私有 schema 方言。

---

## 3. 术语定义

| 术语 | 定义 |
|---|---|
| API 套件（API Kit） | 一组面向某个项目、业务域或排障场景，可被 AI 发现和调用的 API 操作集合。 |
| API 操作（Operation） | 一个具体的 HTTP method + path + 参数/请求体/响应定义，通常对应 OpenAPI 的一个 operation。 |
| 服务目标（Service Target） | 一组 API 操作对应的服务入口，例如 `risk-service`、`order-service`。用于关联不同环境的 baseUrl。 |
| 环境（Environment） | 服务目标的部署环境，如开发、测试、预发、生产。包含 baseUrl 和目标主机白名单。 |
| 认证配置（Auth Profile） | API 请求使用的认证方式和密钥引用，例如 Bearer Token、API Key、Basic Auth。 |
| 会话激活（Session Activation） | 当前 DSH 会话选择的 API 套件、环境和可选 Tag 范围。 |
| 导入批次（Import Batch） | 一次手工或 OpenAPI 文档导入产生的候选操作、冲突和错误报告。 |
| 只读接口 | 通常指 GET、HEAD；最终以接口策略显式配置为准。 |
| 写接口 | POST、PUT、PATCH、DELETE 或其他可能产生副作用的操作。默认关闭。 |

采用“API 套件”而不是“API 集合”，是为了强调它是经过配置、筛选和授权后可供 Agent 使用的一组能力；“集合”容易与 Postman Collection 或 OpenAPI Tags 混淆。

---

## 4. 用户角色与典型场景

### 4.1 用户角色

- **开发者**：导入当前项目的 OpenAPI 文档，补充 Feign 对应的测试环境地址。
- **排障人员**：在一个会话中启用“RPA 排障套件”和 MySQL 连接，联合查询接口、日志和数据库。
- **插件维护者**：维护套件、环境和认证配置，控制哪些操作可以被 Agent 调用。

### 4.2 典型场景

#### 场景 A：根据用户 ID 查询内部服务数据

1. 用户在设置中配置“风控排障套件”。
2. 套件关联 `risk-service` 的测试环境和若干 GET 操作。
3. 用户在输入栏激活该套件。
4. 用户询问某用户的风控命中情况。
5. AI 使用 `api_operations` 搜索接口，使用 `api_describe` 确认参数，再使用 `api_call` 查询数据。
6. AI 将 API 结果与代码、日志和 MySQL 查询结果综合分析。

#### 场景 B：同一套接口切换测试/预发环境

1. API 操作定义不变。
2. 用户在会话选择器中切换环境。
3. Host 根据环境绑定的 baseUrl 发起请求。
4. 模型不需要知道或接触真实 token。

#### 场景 C：导入 OpenAPI 文档后人工筛选

1. 用户导入 OpenAPI JSON。
2. 插件展示版本、服务、Tag、操作数量和异常项。
3. 用户选择导入的 Tag，处理 operationId 冲突。
4. 用户确认后，将操作加入某个 API 套件。
5. 只有已启用且策略允许的操作可被 `api_call` 使用。

#### 场景 D：拒绝危险调用

当模型尝试调用未激活的操作、未登记的 host、写接口或超大响应时，Host 拒绝请求并返回明确原因，同时记录审计事件；不得退化为直接访问用户提供的任意 URL。

---

## 5. 功能需求

### 5.1 API 套件管理

#### FR-KIT-001 套件创建

用户可以创建 API 套件，至少填写：

- 名称；
- 唯一 ID；
- 描述；
- 适用项目或业务域；
- 默认环境；
- 是否允许 Agent 使用。

#### FR-KIT-002 套件编辑和删除

用户可以修改套件元数据、关联操作、Tag 和调用策略。删除前需要二次确认；删除套件不应删除仍被其他套件引用的服务目标、环境或认证配置。

#### FR-KIT-003 套件状态

套件支持启用/停用。停用后：

- 不能在新的会话激活；
- 已激活会话在下一次工具调用时必须重新校验；
- 已配置的定义和审计记录保留。

#### FR-KIT-004 套件操作关联

一个 API 操作可以被多个 API 套件复用，但每个套件可以为该操作设置独立的 Agent 调用策略。

#### FR-KIT-005 套件概览

设置页需要展示：操作数量、启用数量、只读/写操作统计、关联环境、认证配置摘要和最近导入时间。

---

### 5.2 API 操作管理

#### FR-OP-001 手工创建

用户可以手工创建一个 API 操作，至少支持：

- 显示名称；
- 稳定 ID 或 operationId；
- HTTP method；
- path；
- 服务目标；
- Tag；
- 描述和使用说明；
- path/query/header/cookie 参数；
- request body 的 JSON Schema 或示例；
- 成功响应状态码和响应说明；
- 认证配置；
- 是否允许 Agent 调用。

#### FR-OP-002 参数类型

第一版至少支持：

- string、number、integer、boolean；
- enum；
- array；
- object；
- required；
- format 和 description；
- JSON Schema 的常用约束，如 min/max、minLength/maxLength。

无法安全转换的 schema 应保留为原始片段并在导入报告中标记，而不是静默生成错误定义。

#### FR-OP-003 操作详情

用户可以查看规范化后的完整操作详情，包括实际调用方法、路径模板、参数、请求体、响应摘要、环境和认证引用。敏感值不得展示。

#### FR-OP-004 操作启停

用户可以单独禁用某个操作。被禁用的操作不能被 `api_call` 调用，即使模型知道它的 operationId。

#### FR-OP-005 操作测试

设置页可提供人工测试入口。人工测试必须复用与 Agent 相同的 Host 请求执行器和安全策略，不能绕过白名单、超时、认证或响应限制。

---

### 5.3 OpenAPI 导入

#### FR-IMPORT-001 文档格式

MVP 支持：

- OpenAPI 3.0 JSON；
- OpenAPI 3.1 JSON；
- Swagger/OpenAPI 2.0 JSON。

YAML、URL 导入和 Git 文件导入列为后续版本，但内部模型应预留扩展点。

#### FR-IMPORT-002 文档校验

导入前校验：

- JSON 是否可解析；
- `openapi` 或 `swagger` 版本字段；
- `paths` 是否为对象；
- method 是否为支持的方法；
- operationId 是否稳定或可自动生成；
- `$ref` 是否可解析；
- server/baseUrl 是否有效。

#### FR-IMPORT-003 规范化

将不同版本转换为统一内部模型：

- path + method；
- operationId；
- summary/description；
- tags；
- parameters；
- request body；
- response schema 和成功状态码；
- security scheme 引用；
- servers / host / basePath 候选。

#### FR-IMPORT-004 导入预览

导入确认前展示：

- 文档名称和版本；
- 发现的服务/Server；
- 操作总数；
- 按 Tag 分组的操作数；
- 新增、更新、冲突、跳过和错误数量；
- 缺失 operationId、无法解析 `$ref`、缺少 baseUrl 等警告。

#### FR-IMPORT-005 幂等导入

重复导入同一文档时，不应无限产生重复操作。默认以稳定 operationId 优先匹配；没有 operationId 时使用规范化的 `method + path` 生成稳定键。用户可以选择覆盖、保留本地修改或跳过冲突。

#### FR-IMPORT-006 套件分配

导入确认时用户可以：

- 选择目标 API 套件；
- 按 Tag 过滤；
- 批量启用/禁用操作；
- 将不同服务分配到不同套件；
- 指定默认环境和认证配置。

---

### 5.4 环境与服务目标

#### FR-ENV-001 多环境

同一 API 操作可关联多个环境。至少支持开发、测试、预发、生产四种用户自定义环境名。

#### FR-ENV-002 baseUrl

baseUrl 必须由用户显式登记，不能由模型传入。拼接时应正确处理：

- baseUrl 末尾 `/`；
- path 开头 `/`；
- path 参数 URL 编码；
- query 参数数组、布尔值和空值。

#### FR-ENV-003 host 白名单

每个环境必须产生可校验的允许主机集合。实际请求只能访问环境配置允许的主机。

#### FR-ENV-004 生产环境标识

生产环境应有明显的风险标识。MVP 中生产环境默认不可被 Agent 调用，或者必须由用户显式开启；设置页和输入栏都要展示环境名称，不允许只显示“当前环境”。

---

### 5.5 认证配置

#### FR-AUTH-001 认证方式

MVP 支持：

- Bearer Token；
- API Key Header；
- API Key Query（默认关闭并显示风险提示）；
- Basic Auth。

后续支持 OAuth2 Client Credentials、自动刷新和企业 SSO。

#### FR-AUTH-002 密钥引用

API 定义只保存 `secretRef` 或凭据 ID，不保存真实 secret。真实 secret 只在 Host 请求执行时读取并组装。

#### FR-AUTH-003 脱敏

以下内容禁止进入浏览器、模型上下文和普通日志：

- token；
- password；
- Authorization 完整值；
- Cookie；
- client secret；
- API Key 完整值。

#### FR-AUTH-004 认证测试

测试认证时只返回成功/失败、HTTP 状态、耗时和脱敏错误摘要，不返回响应中的认证 Header 或 Cookie。

---

### 5.6 会话级套件启用

#### FR-SESSION-001 输入栏入口

在 DSH 输入栏提供 API 套件入口，交互形式参考 `dsh-mysql` 的会话级数据库连接选择器。

#### FR-SESSION-002 多选和环境

用户可以选择一个或多个 API 套件，并为当前会话选择环境。MVP 默认最多建议激活 2 个套件；超过后允许用户继续，但需要展示上下文和调用范围变大的提示。

#### FR-SESSION-003 会话隔离

套件激活、环境选择和 Tag 过滤必须按 session 保存，不应影响其他会话。

#### FR-SESSION-004 动态上下文

已激活套件以简短摘要注入每轮运行时上下文，至少包含：

- 套件名称和描述；
- 当前环境；
- 可发现操作数量；
- 可用工具名称；
- 先发现、再描述、后调用的使用规则；
- 只读/写操作和安全限制。

不得把完整 OpenAPI 文档或密钥注入上下文。

#### FR-SESSION-005 激活状态失效校验

如果用户停用套件、操作或环境，工具调用时必须重新读取权威配置并拒绝失效对象，不能只依赖会话初始化时的缓存。

---

### 5.7 Agent 工具

建议第一版使用少量固定工具，而不是为每个 OpenAPI operation 动态注册一个 Tool。

#### FR-TOOL-001 `api_kits`

列出当前会话可用的 API 套件和环境摘要。不得返回 secret、完整 Header 或未激活套件的内部凭据。

#### FR-TOOL-002 `api_operations`

在当前激活套件内搜索和筛选操作，支持：

- 关键词；
- Tag；
- HTTP method；
- 服务目标；
- 分页或数量上限。

返回稳定操作 ID、名称、方法、path、摘要和必要参数概览。

#### FR-TOOL-003 `api_describe`

根据稳定操作 ID 返回完整调用说明和 JSON Schema。只能描述当前会话激活且允许暴露的操作。

#### FR-TOOL-004 `api_call`

根据稳定操作 ID 发起实际请求。输入不得包含任意 URL，至少包括：

- operationId；
- pathParams；
- query；
- 必要的 header 参数（只能使用被允许的业务 Header，不允许覆盖认证 Header）；
- body；
- 是否需要用户确认的调用意图（由策略决定）。

Host 负责从操作、环境和认证配置中解析实际请求。

#### FR-TOOL-005 调用结果

调用结果至少包含：

- ok；
- operationId；
- HTTP status；
- 脱敏后的 response data 或文本摘要；
- truncated；
- durationMs；
- error code/message（失败时）。

不要把内部堆栈、认证值和完整响应 Header 返回给模型。

#### FR-TOOL-006 工具错误可行动

错误信息要能帮助模型修正下一步，例如：

- `KIT_NOT_ACTIVE`：请先使用 `api_operations` 查看当前激活套件；
- `OPERATION_NOT_FOUND`：操作不存在或已禁用；
- `MISSING_PARAMETER`：缺少 path 参数 `userId`；
- `METHOD_NOT_ALLOWED`：当前套件只允许只读调用；
- `HOST_NOT_ALLOWED`：目标主机不在环境白名单；
- `RESPONSE_TOO_LARGE`：响应超过限制，请缩小查询条件。

---

## 6. 安全与合规需求

### 6.1 SSRF 防护

必须同时执行：

1. 调用参数中禁止出现自由 URL；
2. 目标只能来自已登记的 operation + environment；
3. 校验协议，仅允许 HTTP/HTTPS；
4. 校验 host 白名单；
5. 默认拒绝 loopback、link-local、metadata 地址和未允许的私网地址；
6. 企业内网场景通过显式 host/CIDR 白名单放行，而不是全局关闭防护；
7. 默认不跟随重定向；需要跟随时只允许同一白名单范围；
8. 对 DNS 解析结果和实际连接目标做校验，考虑 DNS rebinding；
9. 不允许通过 Header、path、query 或 body 绕过目标校验。

### 6.2 方法与副作用

默认策略：

| 方法 | MVP 默认策略 |
|---|---|
| GET | 允许，仍需通过套件/操作/环境校验 |
| HEAD | 允许 |
| OPTIONS | 默认关闭 |
| POST | 默认关闭或要求显式开启 |
| PUT/PATCH/DELETE | 默认关闭或要求显式开启 |
| 文件上传、多段表单 | MVP 不支持 |

套件级和操作级策略同时满足时才能调用。生产环境或写操作可以配置为必须人工确认，但不能只依赖 Prompt 提示。

### 6.3 请求限制

- 默认超时 10–15 秒；
- 单次响应大小有上限，建议初始 512 KB；
- JSON 数组、嵌套深度和字符串长度有上限；
- 单个调用不允许多次隐式重试；
- 后续可增加每会话/每分钟调用次数限制；
- 请求 Header 使用 allowlist，禁止模型覆盖 Host、Content-Length、Authorization、Cookie 等受控 Header。

### 6.4 响应脱敏与审计

- 对常见敏感字段进行递归脱敏，可配置字段名规则；
- 审计日志记录时间、session、kit、operation、environment、method、host、status、耗时、结果大小、拒绝原因；
- 审计日志不记录 token、Cookie、密码、完整 Authorization、完整请求体；
- 发生异常时记录错误类别和脱敏信息，便于本地排查。

### 6.5 本地文件与权限

建议默认存储：

```text
$DSH_HOME/storages/dsh-api-kit/
├─ registry.json
├─ imports/
├─ audit/
└─ boot.log
```

若配置与项目强相关，可支持：

```text
<workspace>/.dsh/api-kit/
```

配置优先级建议为：workspace > user global > defaults。密钥不应随项目文件进入 Git；原始 OpenAPI 文档可选择是否保存，保存时需要明确告知用户。

---

## 7. 非功能需求

### NFR-001 本地优先

无云端依赖即可完成套件管理、OpenAPI 导入和 API 调用。

### NFR-002 可审计

每一次实际调用和每一次策略拒绝都可在本地审计日志中追踪。

### NFR-003 上下文效率

常规会话只注入套件摘要；完整操作 schema 按需通过工具获取。

### NFR-004 兼容 DSH

插件采用可发布 profile bundle 形态，Host/Client 分离，复用 DSH 官方 Slot、Typert RPC 和模型 Tool 注册能力。具体 API 以当前 DSH 版本和运行时 Inspect 结果为准。

### NFR-005 可恢复

配置写入采用临时文件 + 原子替换或等价机制；失败时内存状态回滚。插件重启后能恢复有效配置，并对损坏文件提供错误提示和备份策略。

### NFR-006 可测试

核心解析、规范化、URL 拼接、SSRF 校验、方法策略、脱敏和响应截断均应有不依赖真实内部服务的单元测试。

### NFR-007 可维护

将 OpenAPI 解析、配置注册、策略校验、请求执行和 DSH 适配层分离，后续可复用到独立 MCP Server。

### NFR-008 可观测

启动、配置加载、导入、调用拒绝和执行失败应有可读的本地诊断日志，不能把敏感信息写入日志。

### NFR-009 主题和无障碍

Web UI 使用 DSH `--dsw-*` 主题令牌，支持亮/暗主题、键盘操作、焦点状态、窄屏布局和 reduced motion。

---

## 8. MVP 范围（v0.1.0）

MVP 的目标是验证最核心工作流：**手工登记一批只读内部 API → 当前会话选择套件 → AI 发现并安全调用 API**。

### MVP 必须包含

- API 套件 CRUD；
- 服务目标和一个以上环境；
- 手工创建 GET/HEAD 操作；
- Bearer Token、Header API Key、Basic Auth 三类认证；
- 输入栏会话级套件/环境选择器；
- `api_kits`、`api_operations`、`api_describe`、`api_call`；
- GET/HEAD 默认只读策略；
- operation + environment 固定目标，不接受任意 URL；
- host 白名单、SSRF 基础防护、超时和响应截断；
- 密钥只在 Host；
- 动态上下文摘要；
- 审计日志；
- 单元测试和本地 bundle 安装验证。

### MVP 可以暂不包含

- OpenAPI YAML；
- URL 远程导入；
- OAuth2 自动刷新；
- POST/PUT/PATCH/DELETE；
- 文件上传；
- 多个服务目标的复杂路由；
- Tag 高级筛选；
- 独立 MCP Server 导出。

### MVP 验收标准

1. 用户能创建“RPA 排障套件”，加入至少 3 个手工 GET API。
2. 用户能在会话中激活该套件并选择测试环境。
3. AI 能先发现操作，再查看详情，再调用合法操作。
4. 未激活、已禁用、缺参数、未白名单 host 的调用均被拒绝。
5. 认证信息不出现在浏览器、工具结果和审计日志中。
6. 大响应被截断并带有明确标记。
7. 重启 DSH 后配置仍可恢复。
8. 亮色/暗色主题下设置页和输入栏均可使用。

---

## 9. 后续版本规划

### v0.2：OpenAPI 导入

- OpenAPI 3.0/3.1 JSON；
- Swagger 2.0 JSON；
- `$ref` 和 components schemas；
- 导入预览、差异、冲突处理；
- Tag 筛选和批量套件分配；
- `servers` 与 `securitySchemes` 映射。

### v0.3：企业服务适配

- YAML；
- 多 Service Target；
- 多环境切换；
- POST/PUT/PATCH/DELETE 分层授权；
- 人工确认；
- OAuth2 Client Credentials；
- 更丰富的响应提取和脱敏规则。

### v0.4：项目化与生态

- workspace 配置层；
- Git 版本化配置；
- OpenAPI URL/Git 导入；
- API 文档变更检测；
- 独立 MCP Server 适配器；
- 团队共享只读 API Catalog。

---

## 10. 竞品与设计依据

本项目不以“首次实现 OpenAPI 转工具”为主要差异化。市场上已有相近项目和路线：

- [openapi-mcp-server](https://github.com/johannesbrandenburger/openapi-mcp-server)：将 OpenAPI 端点暴露为 MCP 能力；
- [openapi-to-mcp](https://github.com/janwilmake/openapi-to-mcp)：OpenAPI 到 MCP 的转换路线；
- [IBM openapi-mcp-server](https://github.com/ibm/openapi-mcp-server)：企业 OpenAPI/MCP 方向的参考实现；
- [Postman MCP Server](https://github.com/postmanlabs/postman-mcp-server)：通过 MCP 管理 Postman Workspace、Collection、Environment 等资源；
- DSH 社区中的 `dsh-mcp-bridge`、`dsh-mcp-lazy`、MCP Manager 类插件：说明 DSH 已有 MCP 接入、管理和按需暴露工具的生态。

dsh-api-kit 的差异化是：

1. DSH 原生输入栏会话级 API 套件选择；
2. 针对 Feign/内部服务场景补全 baseUrl、环境和认证；
3. 结合代码、日志、MySQL 和 API 的本地排障工作流；
4. Host 侧固定目标、默认只读、凭据隔离、SSRF 防护和审计。

MCP 的工具模型要求服务端提供工具名称、描述和 JSON Schema，并通过工具调用执行操作；本项目的固定 `api_*` 工具设计遵循同样的“可发现、可描述、可调用”分层思想，但第一版优先采用 DSH 原生 Tool，不直接引入外部 MCP Server。

---

## 11. 待确认事项

以下事项在编码前需要结合当前 DSH 版本文档和运行时 Inspect 结果最终确认：

1. 当前版本模型 Tool 注册 API 的准确参数和 disposer 形式；
2. `exec.agent.id` 或等价执行上下文中获取 sessionId 的稳定方式；
3. `systemPrompt.context` 动态 section 的推荐注册方式；
4. Typert RPC codec 对大 JSON 和 JSON Schema 的边界；
5. Credentials 服务是否可直接用于插件 secretRef，还是需要插件本地 Host 加密存储；
6. Host 发 HTTP 请求时可使用的官方 Service/Builtin，以及 DNS/IP 校验能力；
7. 当前 Web 设置页可用的 Slot 名称和 props；
8. 是否需要为后续 MCP 导出预留标准化 Tool 名称和返回结构。

在这些事项确认前，不应凭猜测写入正式运行时 API。

---

## 12. 需求追踪原则

- 需求 ID 不随实现任务变化；
- 每个实施任务必须引用对应 FR/NFR/MVP 验收标准；
- 若实现中改变需求，先在本文件增加“变更记录”，再修改实施计划；
- 未满足的安全需求不得以“后续优化”跳过 MVP；
- 每次跨会话继续时，先阅读本需求文档和实施文档的“当前进度”和“交接记录”。

### 变更记录

| 日期 | 版本 | 变更 | 原因 |
|---|---|---|---|
| 2026-08-26 | v0.1 | 建立需求基线，确定产品名、API 套件概念、MVP 边界和安全基线。 | 初始需求沉淀 |
| 2026-08-26 | v0.1 | 增加 DSH 官方开发文档、Cordis 教程、插件模板和现有 dsh-mysql 参考链接。 | 方便后续 AI 实施和跨会话查阅 |
