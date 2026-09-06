# dsh-api-kit

> 面向 DeepSeek Harness Web Profile 的本地优先插件：登记经过确认的 API 定义、导入 OpenAPI JSON、按会话选择 API Kit，并让 Agent 通过固定 HTTP Operation 受控调用服务。

[English README](./README.md)

> **数据边界：** Registry 定义和非敏感设置保存在本机。凭据值只在请求执行时由 Host 解析，不会返回给浏览器、Agent 工具或运行时上下文；但 API 参数和经过投影的 API 响应仍属于普通工具数据，可能发送给当前 DSH 会话配置的 LLM 服务商。

## 功能概览

| 入口 | 提供能力 |
| --- | --- |
| **设置 → API Kit** | 创建和维护 Kit、Operation、Environment 和 Service Target；查看安全认证元数据，并预览、显式确认 OpenAPI/Swagger JSON 导入。 |
| **会话输入栏** | 为当前会话激活一个或多个 API Kit，并选择一个共同的逻辑 Environment。 |
| **Agent 工具 / 运行时上下文** | 发现已登记 Operation、读取安全调用契约、调用固定 GET/HEAD endpoint，并通过 Host 审批准备或执行受策略约束的写请求。 |

## 功能特性

- **API Kit 与 Operation：** 按项目或业务服务组织经过确认的 HTTP Operation。Operation 保存 method、相对 path、参数、请求体、响应、Tag、认证引用和明确的 Agent 策略。
- **OpenAPI JSON 导入：** 预览并导入 OpenAPI 3.0/3.1 或 Swagger 2.0 JSON。导入前展示 paths、Tag、Operation、诊断信息以及新增/更新/冲突/跳过分类，确认后通过一次原子 Registry 提交。
- **Environment 与 Service Target 分离：** Environment 表示 `demo`、`dev` 或生产等逻辑阶段；Service Target 表示逻辑业务服务，并为每个绑定的 Environment 保存独立 endpoint 和网络策略。
- **会话级启用：** 会话选择保存在 Host 内存中，以权威 session ID 为键。当前激活的所有 Kit 必须共享所选 Environment。
- **固定目标调用：** Agent 只使用稳定 `operationId`、已声明参数、登记的 Service Target endpoint 和 Operation path。模型不能提供任意 URL、host、代理、重定向策略、session ID 或凭据值。
- **Host-only 认证：** 支持无认证、Bearer、Basic、Header/Query API Key 和 OAuth2 Client Credentials 元数据。secret 只在请求执行时由 Host 解析。
- **响应治理与审计：** 响应会进行有界处理和保守脱敏；调用和策略拒绝写入本地白名单 JSONL 审计文件。
- **可访问 Web UI：** 设置页和会话选择器使用 DSH 主题令牌，支持键盘/焦点管理、语义化状态反馈、响应式布局、触控尺寸主控件和 reduced-motion。

## Agent 工具

所有工具都是固定注册的工具。它们不接受任意 URL，也不暴露 `sessionId` 参数；Host 从当前 Agent 执行上下文取得权威会话。

| 工具 | 参数 | 网络 / 返回值 |
| --- | --- | --- |
| `api_kits` | 无业务参数。 | 不联网。返回当前会话的有界 Kit 和 Environment 摘要，包括激活 ID 以及只读/写操作数量。 |
| `api_operations` | 可选 `query`、精确 `tag`、`method`、`serviceTargetId`、`offset`（默认 `0`）和 `limit`（默认 `20`，最大 `100`）。 | 不联网。只在当前会话激活 Kit 和 Environment 可发现的范围内搜索 Operation。 |
| `api_describe` | 必填 `api_operations` 返回的 `operationId`。 | 不联网。返回完整的安全调用契约，包括已声明参数、请求/响应 Schema 预览、策略元数据和相对 path；不返回凭据或任意目标 URL。 |
| `api_call` | 必填 `operationId`；可选 `pathParams`、`query`、`headers` 和 `body` 字段。只接受已声明的 path/query/业务 Header key。 | 执行固定的 **GET/HEAD** Operation。`body`、cookie 参数、未声明 key、受控 Header、无效 Schema 值和策略违规都会被拒绝。写方法只生成确认意图，不发送 HTTP。 |
| `api_write_prepare` | 必填 `operationId`；可选已声明的 `pathParams`、`query`、`headers` 和 JSON `body`。 | 不联网。仅当 Operation 和当前 Kit 策略都允许写入时，生成短期、单次使用的 Host 确认意图。 |
| `api_write_execute` | 必填 `operationId` 和 `confirmationToken`；以及准备阶段使用的相同逻辑请求字段。 | 只有 Host 批准匹配意图后才发送一次写请求。token 绑定 Session、Operation、method、Service Target、Environment、请求指纹和当前 Registry 指纹；重放或不匹配会 fail closed。 |

推荐的只读流程：

```text
api_kits → api_operations → api_describe → api_call
```

写请求流程：

```text
api_write_prepare → 人工确认 → api_write_execute
```

模型没有 approve 工具，不能自行批准确认 token。

## 环境要求与兼容性

- 需要安装支持 **Web Profile bundle** 加载器的 DSH，以及能够加载 ESM 包的 Node.js 运行时。
- DSH 在安装时提供可用的 peer 集成：`@deepseek-ai/cordis`、`@deepseek-ai/dsh-client-runtime`、`@deepseek-ai/dsh-client-ui-conversation`、`@deepseek-ai/dsh-client-ui-primitives` 和 `react`。本包将它们声明为可选 peer dependencies。
- 插件使用 DSH Web Client slots `conversation.input.left` 和 `settings.section`，并在 Host 侧提供 `apiKitConfig` 服务和 `api-kit` 命名空间的 Typert 描述。
- 当前包只声明 Web bundle，不承诺兼容非 Web Profile、所有 OpenAPI 厂商扩展或所有 DSH runtime 版本。生产发布前请核对目标 DSH 版本，并用 Inspect 确认当前 slots。
- OAuth2 需要 Host 凭据服务和安全 HTTP transport。访问私网 endpoint 需要显式开启并配置匹配 CIDR。

## 安装、更新与卸载

### 从 GitHub 安装

当前仓库版本为 `0.1.0`：

```powershell
dsh plugin --profile web add github:1321928757/dsh-api-kit#v0.1.0
```

安装或更新后，请重启已有的 `dsh web` 进程，让新 bundle 进入 Web boot graph。命令会安装到 `web` profile；测试时请使用隔离 profile。

### 验证 Profile 是否加载插件

```powershell
dsh --profile web --dump-config | findstr dsh-api-kit
```

然后打开 DSH Web，确认以下两个入口都出现：

1. **设置 → API Kit**；
2. 会话输入栏中的 **API 套件**。

如果配置行存在但 UI 没有出现，请停止旧 Web 进程、重启、刷新页面，并先检查 boot 日志，再排查配置本身。

### 更新或卸载

```powershell
dsh plugin --profile web update dsh-api-kit@latest
dsh plugin --profile web remove dsh-api-kit
```

如果需要可重复的版本，请使用固定 GitHub tag，而不是 `@latest`。

### 本地开发安装

先生成包快照，再安装到隔离 profile。这样不会替换当前使用的 DSH Web profile，也可以避免 Windows 跨盘 `link:` 路径问题。

```powershell
pnpm pack
# 如果 profile 位于另一个盘符，请将生成的 tgz 复制到方便访问的位置。
dsh plugin --profile demo add C:\path\to\dsh-api-kit-0.1.0.tgz
dsh --profile demo --dump-config | findstr dsh-api-kit
```

每次更新包后，都要重启对应 profile 的 DSH 进程。

## 快速开始

1. **创建 Environment。** 在 **设置 → API Kit → 连接配置** 中添加 `demo` 等 ID。除非确有需要，不要让生产 Environment 默认允许 Agent 使用。
2. **创建 Service Target。** 将它绑定到一个或多个 Environment，并为每个绑定项配置一个 endpoint，例如 `demo → https://api.example.test`。endpoint host 会自动加入 host 白名单；请继续检查额外的 `allowedHosts`、超时和响应限制。
3. **仅在必要时配置私网策略。** 对内网 endpoint，开启允许私网访问，并加入匹配的 `allowedCidrs`，例如 `172.31.33.216/32`。仅设置 hostname 白名单不会授予私网访问权限。
4. **按需绑定 Auth Profile。** 如果 Host/Registry 中已经有 Auth Profile，可按需选择无认证、Bearer、Basic、API Key 或 OAuth2 Client Credentials。Registry 只保存凭据引用；实际值通过 DSH Host credentials 服务配置。当前 Web 设置页只展示可安全用于绑定的认证元数据，不展示 secret 值，也不提供 secret 编辑入口。
5. **导入 API 定义。** 粘贴 OpenAPI 3.0/3.1 或 Swagger 2.0 JSON，点击 **校验并预览**，选择 Tag 以及已存在的 Service Target/Environment/Auth Profile，处理冲突后点击 **确认并导入**。`servers[].url` 与 Swagger `host/basePath/schemes` 只是展示候选，不会自动变成可信调用目标。
6. **激活会话范围。** 在会话输入栏打开 **API 套件**，选择一个或多个已启用 Kit，再选择兼容的共同 Environment。
7. **让 Agent 使用固定流程。** 它应先发现 Operation，再描述必需参数，最后按 `operationId` 调用。建议先使用只读 GET/HEAD；上游支持时，在请求中主动加入筛选、分页或 `LIMIT`。
8. **将写请求视为独立变更。** 写请求必须同时通过 Operation 与 Kit 策略，并获得 Host 人工批准。准备阶段绝不访问网络，执行阶段只消费一次已批准意图。

## 功能导览

### 设置 → API Kit

设置页主要包含三个区域：

- **OpenAPI 导入：** 粘贴 JSON，预览有界元数据和诊断，选择 Tag 与绑定，查看冲突并显式确认一次原子导入；
- **连接配置：** 维护逻辑 Environment、按 Environment 保存 endpoint 的 Service Target、host/CIDR 白名单、私网开关、超时和响应限制；查看可用于绑定的 Auth Profile 安全元数据，但不暴露 secret；
- **API Kit 工作台：** 创建空 Kit，查看其中的 Operation，启停 Operation，编辑策略；删除被引用对象前先解除关联。

无效 JSON 会在字段附近报错，同时保留草稿。`IMPORT_STALE_PREVIEW` 等导入错误会提供重新预览原始文档的恢复提示。

### 会话输入栏

**API 套件**选择器是会话级开关，不是全局开关。它展示安全名称、可用性、兼容性和诊断信息，但不展示 base URL、host/CIDR 策略、凭据引用或 secret 值。

## 安全与权限

以下应用层控制用于收窄插件能力，不能替代最小权限服务账号、上游授权、网络隔离或 TLS 配置。

| 防护项 | 实际强制行为 | 重要边界 |
| --- | --- | --- |
| 固定目标 | Host 只根据登记的 Service Target endpoint 和相对 Operation path 构造 URL。 | 这不是任意 URL 的互联网或内网代理。模型不能选择 host、代理、重定向策略或凭据。 |
| Host 白名单 | endpoint hostname 必须已登记；生产 transport 使用固定 IP 前会检查 DNS 返回的全部地址。 | hostname 白名单不是完整授权边界，DNS 和服务端权限仍然重要。 |
| SSRF / 私网 | 拒绝 loopback、link-local、metadata、保留/文档地址和高风险映射地址。RFC1918、IPv6 ULA、CGNAT 还必须同时满足 `allowPrivateNetwork: true` 和匹配 `allowedCidrs`。 | 私网是显式例外而不是默认能力；请检查全部 DNS 返回并使用最小 CIDR。 |
| Transport | 请求连接到已检查的 IP，同时保留登记 hostname 作为 HTTPS SNI 和 HTTP `Host`。不使用代理、隐式重试或自动重定向。 | HTTP 本身可能不适合敏感数据；部署侧 TLS 和网络控制由使用者负责。 |
| 请求形状 | 只接受已声明的 path/query/业务 Header 参数。受控 Header、未声明 key、不安全相对路径、cookie 参数和无效 JSON Schema 值会被拒绝。 | 定义和 Schema 必须正确；仍需依赖 API 服务端的授权策略。 |
| 凭据 | 凭据值由 Host 在请求时解析。安全视图不返回 `secretRef`、密码、token 或 client secret。 | 凭据存储和 DSH Host 仍是可信组件；API 结果属于模型可见的工具输出。 |
| 读/写策略 | GET/HEAD 是直接只读路径。写请求必须同时满足 Operation `allowAgentCall`、Operation `allowWrite` 与确认策略、当前 Kit 写策略，以及 Host 批准的一次性绑定意图。 | 默认 fail closed，但管理员可以有意开启写入；审批不会扩大目标或凭据访问范围。 |
| 响应治理 | JSON 按默认规则和 Operation `policy.redactKeys` 递归脱敏；文本、XML、JavaScript、未知类型和非 2xx body 也会保守脱敏。执行深度、数组、字符串、对象 key、字节、超时和响应大小限制；不返回响应 Header。 | 响应限制是应用层读取/投影限制，不保证上游服务器在 Host 接收前就停止扫描或发送。 |
| 审计 | 调用和策略拒绝投影为白名单 JSONL 记录，不含 URL、path、query、Header、body、凭据、stack 或 error cause；默认懒清理 14 天前文件。 | 审计是 best-effort：写审计失败不会改变业务结果。请保护本机 DSH home 目录。 |

## 已知限制

- 只导入 **JSON** OpenAPI/Swagger 文档。YAML、URL/Git 导入、remote `$ref` 和不受支持的厂商 Schema 行为不在范围内。本地 JSON Pointer `$ref` 有深度/数量限制；缺失或循环引用会生成诊断。
- `servers[].url` 以及 Swagger `host/basePath/schemes` 仅用于展示。导入 Operation 必须绑定已登记的 Service Target 及其 Environment endpoint。
- 固定 Agent 只读路径只执行 GET/HEAD。`OPTIONS` 可以登记/发现，但不是直接 `api_call` 方法。POST/PUT/PATCH/DELETE 必须走独立写确认流程。
- 写准备阶段不联网，确认意图短期有效、单次使用并绑定当前 Registry。模型不能批准 token；Host 审批不可用时执行会 fail closed。
- 写请求目前只支持 JSON body。不支持 cookie 参数、multipart/file upload、GraphQL、SSE、WebSocket、自动重定向、隐式重试和独立 MCP Server。
- 认证支持无认证、Bearer、Basic、Header/Query API Key 和 OAuth2 Client Credentials。Query API Key 默认关闭。OAuth2 不支持 authorization code、PKCE、OIDC discovery、refresh-token 持久化、浏览器回调、任意 token endpoint 或非 HTTPS token endpoint。
- 响应治理发生在读取和投影过程中。上游的大查询仍可能消耗服务端、网络和 Host 资源；API 支持时请主动加入筛选、分页或 `LIMIT`。
- Registry 保存在 DSH profile 本机。会话激活是内存中的会话级状态；新会话或进程重启后，需要重新选择 Kit 和 Environment。
- 仓库没有专用 browser smoke 脚本。发布前应在可重复的 DSH Web 环境中手工验证亮/暗主题、键盘焦点、窄屏布局、连接错误和安装后的 Profile。

## 工作原理

```text
设置页 / 会话选择器
        │ DSH slots + Typert JSON RPC
        ▼
Host bundle（apiKitConfig + 固定 Agent 工具）
        │
        ├── 本地 Registry：Kit、Operation、Environment、Target、认证元数据
        ├── Host credentials：请求时解析 secret
        ├── pinned HTTP transport：白名单 + DNS/IP/CIDR 校验
        └── runtime context：供 prompt 组装的有界会话摘要
```

- Host 入口挂载 `apiKitConfig` 服务，注册固定 Agent 工具，并注册动态 `systemPrompt.context` provider。
- 浏览器 bundle 在 `conversation.input.left` 注册 slot ID `dsh-api-kit`，在 `settings.section` 注册 ID `api-kit`。
- Typert 使用 `api-kit` 命名空间和 `apiKitConfig` 服务。Client 调用先解包标准 `{ ok, value }` gateway envelope，再使用安全 value。
- Registry 默认保存于 `$DSH_HOME/storages/dsh-api-kit/registry.json`；Host store 负责原子更新、备份、完整性校验和旧格式迁移。
- 审计记录默认保存于 `$DSH_HOME/storages/dsh-api-kit/audit/audit-YYYY-MM-DD.jsonl`。
- 每次模型步骤组装 prompt 时，都会基于当前权威会话激活和 Registry 重建 runtime context。它包含数量、名称、工作流和边界，不包含 URL、具体 host、CIDR、凭据引用、Header、Cookie 或完整 Schema。
- dispose 和 Agent 生命周期事件会清理会话激活、未完成写确认、OAuth client cache 和已挂载的 Client contribution。

## FAQ 与故障排查

<details>
<summary><b>API Kit 按钮或设置分节没有出现</b></summary>

确认插件安装到了正在使用的 profile：

```powershell
dsh --profile web --dump-config | findstr dsh-api-kit
```

重启已有的 `dsh web` 进程并刷新页面。安装包不会自动注入已经运行的 boot graph。如果仍未出现，请检查 DSH boot 日志，并确认使用的是 Web Profile。

</details>

<details>
<summary><b>Agent 提示没有激活 Kit 或 Environment</b></summary>

打开当前会话的 **API 套件**选择器，至少选中一个已启用 Kit，并选择一个兼容的 Environment。多个 Kit 必须存在共同 Environment。如果选择后 Kit 或 Environment 被禁用或编辑，请重新选择，让 Host 重建当前范围。

</details>

<details>
<summary><b>导入预览或确认失败</b></summary>

遇到 `JSON_INVALID` 时，修正输入字段附近的 JSON 语法。遇到 `IMPORT_STALE_PREVIEW`、`IMPORT_TRANSACTION_MISMATCH` 或 `IMPORT_DOCUMENT_MISMATCH` 时，粘贴未改变的原始 JSON 并重新预览。确认每个选中的 Operation 都有已存在且启用的 Service Target、绑定的 Environment endpoint 和至少一个现有 Kit（也可以使用界面中的新建 Kit 导入路径）。文档里的 Server URL 不会创建可信目标。

</details>

<details>
<summary><b>API 无法连接，或被目标策略拒绝</b></summary>

检查所选 Environment 下 Service Target 的 endpoint、`allowedHosts`、端口、DNS 返回和私网设置。私网 endpoint 同时需要 `allowPrivateNetwork` 与匹配的 `allowedCidrs`。请求从 DSH Host 发起，不是从浏览器发起。重定向会按设计返回 `REDIRECT_NOT_ALLOWED`；请登记最终固定 endpoint。

</details>

<details>
<summary><b>响应为空、被截断或过大</b></summary>

检查上游 status，以及 Operation/endpoint 的响应限制。工具只返回有界投影，并可能脱敏无效或敏感内容。使用筛选、分页或服务支持的 `LIMIT` 缩小 API 查询；应用层限制不保证上游服务没有执行大扫描。

</details>

<details>
<summary><b>为什么写请求被拒绝？</b></summary>

写请求必须使用写 method，同时满足 Operation 与 Kit 写策略、Host 审批，以及准备阶段的准确请求/Registry/Session 绑定。`api_write_prepare` 绝不访问网络。缺少审批、Registry 过期、token 重放、参数改变、Kit/Target 被禁用、凭据缺失、不支持的 body 或审批 UI 不可用都会 fail closed。先用 `api_describe` 检查 Operation，再重新开始 prepare 流程。

</details>

<details>
<summary><b>浏览器或模型能看到我的密码/token 吗？</b></summary>

浏览器侧安全视图不包含 `secretRef`、password、token、client secret、请求 Header 或响应 Header。Host 在请求时解析凭据。但经过投影的 API 响应和工具参数属于模型可见数据，可能发送给当前会话配置的 LLM 服务商。凭据元数据和 Registry 文件保存在本机 DSH profile，但这不等于 API 响应只在本机流转。

</details>

<details>
<summary><b>配置和审计日志在哪里？</b></summary>

默认路径为：

```text
$DSH_HOME/storages/dsh-api-kit/registry.json
$DSH_HOME/storages/dsh-api-kit/audit/audit-YYYY-MM-DD.jsonl
```

如果没有设置 `DSH_HOME`，实现会回退到 DSH home 目录（通常是 `~/.dsh`）。Registry 备份、损坏文件恢复产物和审计保留周期由 Host 组件管理。

</details>

## 开发与验证

本仓库是 ESM 包，包含与 DSH 解耦的 Host/domain 模块和浏览器 bundle。可执行以下检查：

```powershell
pnpm test
pnpm run check
pnpm pack --dry-run
git diff --check
```

`pnpm test` 会运行 configuration、session、discovery、executor、SSRF、redaction、Registry、OpenAPI import、OAuth2、confirmation、transport 和 client-contract 回归测试。`pnpm run check` 会校验 bundle 元数据、入口导出、Typert 描述、工具注册、导入边界和 Client UI guard。`pnpm pack --dry-run` 会验证 package 的 `files` 白名单；输出应包含两份 README、`CHANGELOG.md`、bundle 入口和选定回归测试。

仓库没有专用 browser smoke 脚本，因此 release candidate 应安装到隔离 DSH profile，并在真实 DSH Web 进程中手工检查。

## License 与免责声明

[MIT](./LICENSE)。本项目与 DeepSeek 无关联。使用生产 endpoint、凭据和写策略前，请先根据所在组织的安全与授权要求完成审查。
