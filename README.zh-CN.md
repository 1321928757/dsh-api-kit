# dsh-api-kit

> 面向 DeepSeek Harness Web Profile 的本地优先插件：登记经过确认的 API 定义、导入 OpenAPI JSON、按会话选择 API Kit，并让 Agent 通过固定 HTTP Operation 受控调用服务。

[English README](./README.md)

> **数据边界：** Registry 定义和非敏感设置保存在本机。凭据值只在请求执行时由 Host 解析，不会返回给浏览器、Agent 工具或运行时上下文；但 API 参数和经过投影的 API 响应仍属于普通工具数据，可能发送给当前 DSH 会话配置的 LLM 服务商。

## 功能概览

| 入口 | 提供能力 |
| --- | --- |
| **设置 → API Kit** | 创建和维护 Kit、Operation、Environment 和 Service Target；查看安全认证元数据，并预览、显式确认 OpenAPI/Swagger JSON 导入。 |
| **会话输入栏** | 为当前会话激活一个或多个 API Kit，并选择一个共同的逻辑 Environment。 |
| **Agent 工具 / 运行时上下文** | 发现已登记 Operation、读取安全调用契约，并在统一 Host 固定目标安全边界下直接调用声明的 HTTP method。 |

## 功能特性

- **API Kit 与 Operation：** 按项目或业务服务组织经过确认的 HTTP Operation。Operation 保存 method、相对 path、参数、请求体、响应、Tag、认证引用和明确的 Agent 策略。
- **OpenAPI JSON 导入：** 预览并导入 OpenAPI 3.0/3.1 或 Swagger 2.0 JSON。导入前展示 paths、Tag、Operation、诊断信息以及新增/更新/冲突/跳过分类，确认后通过一次原子 Registry 提交。
- **Environment 与 Service Target 分离：** Environment 表示 `demo`、`dev` 或生产等逻辑阶段；Service Target 表示逻辑业务服务，并为每个绑定的 Environment 保存独立 endpoint 和网络策略。
- **会话级启用：** 会话选择保存在 Host 内存中，以权威 session ID 为键。当前激活的所有 Kit 必须共享所选 Environment。
- **固定目标调用：** Agent 只使用稳定 `operationId`、已声明参数、登记的 Service Target endpoint 和 Operation path。模型不能提供任意 URL、host、代理、重定向策略、session ID 或覆盖 Host 管理的凭据值。
- **Host-only 认证：** 设置页可创建、编辑、启用/停用、绑定和删除未被引用的 Auth Profile，支持无认证、Bearer、Basic、Header/Query API Key 和 OAuth2 Client Credentials。secret 只能通过 Host credentials 流程设置、替换或删除，并且只在请求执行时由 Host 解析。Query API Key 明确标记为可能进入 URL，默认禁止执行。
- **响应治理与审计：** 响应始终有界，默认保守脱敏；用户可承担风险并仅对指定 Operation 关闭响应正文脱敏。调用和策略拒绝写入不含请求/响应正文的本地白名单 JSONL 审计文件。
- **可访问 Web UI：** 设置页和会话选择器使用 DSH 主题令牌，支持键盘/焦点管理、语义化状态反馈、响应式布局、触控尺寸主控件和 reduced-motion。
- **紧凑会话范围摘要：** 输入栏对较长的 Kit 或 Environment 组合只显示最多 5 个字符，超出部分使用 `...`；完整的安全范围仍可通过按钮 title、辅助名称和选择弹窗获取。

## Agent 工具

所有工具都是固定注册的工具。它们不接受任意 URL，也不暴露 `sessionId` 参数；Host 从当前 Agent 执行上下文取得权威会话。

| 工具 | 参数 | 网络 / 返回值 |
| --- | --- | --- |
| `api_kits` | 无业务参数。 | 不联网。返回当前会话的有界 Kit 和 Environment 摘要，包括激活 ID 以及只读/写操作数量。 |
| `api_operations` | 可选 `query`、精确 `tag`、`method`、`serviceTargetId`、`offset`（默认 `0`）和 `limit`（默认 `20`，最大 `100`）。 | 不联网。只在当前会话激活 Kit 和 Environment 可发现的范围内搜索 Operation。 |
| `api_describe` | 必填 `api_operations` 返回的 `operationId`。 | 不联网。返回完整的安全调用契约，包括已声明参数、请求/响应 Schema 预览、策略元数据和相对 path；不返回凭据或任意目标 URL。 |
| `api_call` | 必填 `operationId`；可选 `pathParams`、`query`、`headers` 和 JSON `body` 字段。只接受已声明的 path/query/业务 Header key。 | 通过固定 Host 目标直接执行每个已声明的受支持 HTTP method，包括 POST/PUT/PATCH/DELETE。未声明 key、受控 Header、无效 Schema、任意 URL/host 和网络策略违规都会被拒绝。 |
| `api_write_prepare` | 旧版兼容描述。 | 返回 `WRITE_CONFIRMATION_UNSUPPORTED`，不联网；请改用 `api_call`。 |
| `api_write_execute` | 旧版兼容描述。 | 返回 `WRITE_CONFIRMATION_UNSUPPORTED`，不联网，也不接受 confirmation token。 |

推荐流程：

```text
api_kits → api_operations → api_describe → api_call
```

操作员通过导入和启用哪些 Operation 来控制暴露范围。直接写请求仍必须满足声明的 Operation、固定 Service Target/Environment、请求 Schema、Host 认证、网络安全、响应边界、脱敏、取消和审计约束；不再需要独立 write flag 或 confirmation token。

## 环境要求与兼容性

- 支持范围为 DSH `>=0.2.0-rc.2 <0.3.0` 和 Node.js `>=20`；插件使用 Host Typert 严格 JSON codecs、Host credentials、Cordis 4.0.4 系列，以及 Web Profile bundle 加载器。
- Client bundle 只需 React 和可选 `@deepseek-ai/dsh-client-ui-primitives` peer；Client Cordis 服务通过插件 `inject` 声明 `remote` 和 `slots`。
- 插件使用 DSH Web Client slots `conversation.input.left`（session scope）和 `settings.section`（root scope），并在 Host 侧提供 `apiKitConfig` 服务和 `api-kit` 命名空间的 Typert 描述。
- 当前包只声明 Web bundle，不承诺兼容非 Web Profile、所有 OpenAPI 厂商扩展或 DSH 0.3+。生产发布前请在隔离 profile 中验证目标 DSH 发行版。
- OAuth2 需要 Host 凭据服务和安全 HTTP transport。登记的内网 API 地址可直接使用，但本机、link-local、metadata 和保留地址仍会被拦截。

## DSH 0.2 升级说明

- 升级插件时不会改写 Registry 中已有的 `secretRef`。旧版 `dsh-api-kit/auth/<id>` sentinel 只在 Host credentials 边界适配；不符合新引用语法的历史显式引用仍保留在 Registry，但相关操作会 fail closed，需用户主动修正。
- 新建 Auth Profile 使用 `DSH_API_KIT_AUTH_V2_<hash>` 默认引用，避免标点和大小写归一化碰撞。显式引用保持原值。
- 历史默认引用碰撞会报告 Profile ID 和共享引用；允许编辑无关元数据，用户也可为其中一个 Profile 指定有效且唯一的新引用来解决冲突。插件不会推测共享 secret 的归属。
- 升级前备份 DSH profile，并保留旧包用于回滚。回滚时不得删除或重命名任一版本创建的凭据。
- 发布前使用隔离 profile 验证 Host 启动、两个 Web slot、设置页到 RPC 的流程和凭据状态；不要对承载用户会话的 profile 执行 smoke。

## 安装、更新与卸载

### 从 GitHub 安装

当前仓库版本为 `0.1.1`：

```powershell
dsh plugin --profile web add github:1321928757/dsh-api-kit#v0.1.1
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
dsh plugin --profile demo add C:\path\to\dsh-api-kit-0.1.1.tgz
dsh --profile demo --dump-config | findstr dsh-api-kit
```

每次更新包后，都要重启对应 profile 的 DSH 进程。

## 快速开始

1. **创建 Environment。** 在 **设置 → API Kit → 连接配置** 中添加 `demo` 等 ID。除非确有需要，不要让生产 Environment 默认允许 Agent 使用。
2. **创建 Service Target。** 将它绑定到一个或多个 Environment，并为每个绑定项配置一个 endpoint，例如 `demo → https://api.example.test`。endpoint host 会自动进入固定主机校验；请检查超时和响应限制。
3. **直接登记内网 API 主机。** 对已加入 Environment/Service Target 主机白名单的 hostname，RFC1918、IPv6 ULA 和 CGNAT DNS 地址可直接访问，不需要额外开关或 CIDR。loopback、link-local、metadata、组播和保留地址仍会被拦截。
4. **管理或绑定 Auth Profile。** 在 **设置 → API Kit → Auth Profile** 中创建/编辑无认证、Bearer、Basic、Header/Query API Key 或 OAuth2 Client Credentials 的安全元数据，可启用/停用、删除未被引用的 Profile，并通过 Host-only 凭据流程设置、替换或删除 secret。Registry 只保存凭据引用；列表仅展示 `hasSecret`、凭据来源和可写状态，不展示 secret 或 `secretRef`。Query API Key 会明确提示凭据可能进入 URL，默认禁止执行。
5. **导入 API 定义。** 粘贴 OpenAPI 3.0/3.1 或 Swagger 2.0 JSON，点击 **校验并预览**，选择 Tag 以及已存在的 Service Target/Environment/Auth Profile，处理冲突后点击 **确认并导入**。`servers[].url` 与 Swagger `host/basePath/schemes` 只是展示候选，不会自动变成可信调用目标。
6. **激活会话范围。** 在会话输入栏打开 **API 套件**，选择一个或多个已启用 Kit，再选择兼容的共同 Environment。
7. **让 Agent 使用固定流程。** 它应先发现 Operation，再描述必需参数，最后按 `operationId` 调用。GET、HEAD、POST、PUT、PATCH、DELETE 使用同一固定目标 Host 执行路径；副作用由 Operation method 元数据明确表示。
8. **按操作员控制风险。** Registry 中旧的 `allowWrite` 和写 method 字段仍可为迁移兼容而加载，但不再隐藏本来符合条件的 Operation。`api_write_prepare` 和 `api_write_execute` 仅保留不联网的兼容错误，直接写请求使用 `api_call`。

## 功能导览

### 设置 → API Kit

设置页主要包含三个区域：

- **OpenAPI 导入：** 粘贴 JSON，预览有界元数据和诊断，选择 Tag 与绑定，查看冲突并显式确认一次原子导入；
- **连接配置：** 维护逻辑 Environment、按 Environment 保存 endpoint 的 Service Target、登记主机校验、超时和响应限制；查看可用于绑定的 Auth Profile 安全元数据，但不暴露 secret；
- **API Kit 工作台：** 创建空 Kit，查看其中的 Operation，启停 Operation，编辑策略；删除被引用对象前先解除关联。

无效 JSON 会在字段附近报错，同时保留草稿。`IMPORT_STALE_PREVIEW` 等导入错误会提供重新预览原始文档的恢复提示。

### 临时 token 接口：按 Operation 关闭响应脱敏

在 **设置 → API 套件 → API Kit 工作台 → 编辑 getToken Operation → Agent 权限与安全** 中，勾选 **关闭此 Operation 的响应脱敏（我理解并承担风险）** 并保存。该选项对应 `policy.redactResponse: false`；默认值为 `true`，旧 Registry 和新导入的 Operation 默认继续脱敏。保存后下次调用生效；取消勾选并保存可恢复脱敏。它属于 Operation，不是整个 Kit 或会话；同一个 Operation 被多个 Kit 引用时共享此配置，且会对所有绑定环境生效。

随后 Agent 可以先调用 `getToken`，再把返回的临时 token 作为后续 Operation 已声明的普通 query/body/业务 Header 参数传入，例如 `query.access_token`。请先在参数 Schema 中声明该字段。不能覆盖 Auth Profile 注入的同名 Query 参数或认证 Header；`Authorization`、`Cookie` 等受控 Header 仍不可作为普通参数。若上游强制要求这些 Header，应由 Host 认证流程处理，而不是通过此开关绕过。

**风险：** 此选项关闭该 Operation 整个响应正文的默认字段、`policy.redactKeys` 和文本模式脱敏，包括错误响应，并非只放开 token 字段。token、密码等内容可能进入模型服务、会话记录和后续工具参数；临时 token 仍是敏感值，重新开启不会清除已有历史。请只对可信且必要的接口启用，并使用短期、最小权限 token。配置/认证安全视图仍保持脱敏；本地审计不记录请求/响应正文。响应大小、深度、数组、字符串、对象 key 限制及损坏/截断 JSON 的拒绝规则保持不变。

该开关只能通过用户配置保存，不能作为 `api_call` 参数临时覆盖。升级插件代码后才能看到新选项；现有安装包不会因源码修改自动更新。

### 会话输入栏

**API 套件**选择器是会话级开关，不是全局开关。它展示安全名称、可用性、兼容性和诊断信息，但不展示 base URL、Host 访问策略、凭据引用或 secret 值。

即使 Kit 或 Environment 名称很长，输入栏仍会保持紧凑：可见摘要最多显示 5 个字符，超出部分显示为 `...`；完整安全范围仍可通过按钮 title、辅助名称和选择弹窗获取。

![API Kit 选择器的五字符紧凑摘要](https://raw.githubusercontent.com/1321928757/dsh-api-kit/main/assets/conversation-picker-selected.png)

展开选择器后，完整的 Kit 和 Environment 元数据仍可用于选择和复核，不会把长名称撑宽输入栏工具区。

![展开的 API Kit 选择器](https://raw.githubusercontent.com/1321928757/dsh-api-kit/main/assets/conversation-picker-selected-expanded.png)

## 安全与权限

以下应用层控制用于收窄插件能力，不能替代最小权限服务账号、上游授权、网络隔离或 TLS 配置。

| 防护项 | 实际强制行为 | 重要边界 |
| --- | --- | --- |
| 固定目标 | Host 只根据登记的 Service Target endpoint 和相对 Operation path 构造 URL。 | 这不是任意 URL 的互联网或内网代理。模型不能选择 host、代理、重定向策略或凭据。 |
| Host 白名单 | endpoint hostname 必须已登记；生产 transport 使用固定 IP 前会检查 DNS 返回的全部地址。 | hostname 白名单不是完整授权边界，DNS 和服务端权限仍然重要。 |
| SSRF / 私网 | 拒绝 loopback、link-local、metadata、组播、保留/文档地址和高风险映射地址。已登记 hostname 解析到 RFC1918、IPv6 ULA 或 CGNAT 时允许使用；执行前检查所有 DNS 地址并固定实际连接 IP。 | 只登记可信 API 主机；不要把插件当作任意内网代理。 |
| Transport | 请求连接到已检查的 IP，同时保留登记 hostname 作为 HTTPS SNI 和 HTTP `Host`。不使用代理、隐式重试或自动重定向。 | HTTP 本身可能不适合敏感数据；部署侧 TLS 和网络控制由使用者负责。 |
| 请求形状 | 只接受已声明的 path/query/业务 Header 参数。受控 Header、未声明 key、不安全相对路径、cookie 参数和无效 JSON Schema 值会被拒绝。 | 定义和 Schema 必须正确；仍需依赖 API 服务端的授权策略。 |
| 凭据 | 凭据值由 Host 在请求时解析。安全视图不返回 `secretRef`、密码、token 或 client secret。 | 凭据存储和 DSH Host 仍是可信组件；API 结果属于模型可见的工具输出。 |
| 读/写执行 | 所有已声明的受支持 method（包括 POST/PUT/PATCH/DELETE）都使用统一的直接 `api_call` 路径。旧的写策略字段可为迁移兼容而加载，但不再作为发现或执行门槛。 | 操作员控制导入和启用哪些 Operation；每次调用仍必须通过 Host 的固定目标、Schema、认证、网络、响应边界、脱敏、取消和审计校验。 |
| 响应治理 | 默认 JSON 按规则和 Operation `policy.redactKeys` 递归脱敏，文本、XML、JavaScript、未知类型和非 2xx body 也会保守脱敏；用户可仅对此 Operation 设置 `policy.redactResponse: false` 关闭正文脱敏并承担风险。深度、数组、字符串、对象 key、字节、超时和响应大小限制始终执行；不返回响应 Header。 | 响应限制是应用层读取/投影限制，不保证上游服务器在 Host 接收前就停止扫描或发送。 |
| 审计 | 调用和策略拒绝投影为白名单 JSONL 记录，不含 URL、path、query、Header、body、凭据、stack 或 error cause；默认懒清理 14 天前文件。 | 审计是 best-effort：写审计失败不会改变业务结果。请保护本机 DSH home 目录。 |

## 已知限制

- 只导入 **JSON** OpenAPI/Swagger 文档。YAML、URL/Git 导入、remote `$ref` 和不受支持的厂商 Schema 行为不在范围内。本地 JSON Pointer `$ref` 有深度/数量限制；缺失或循环引用会生成诊断。
- `servers[].url` 以及 Swagger `host/basePath/schemes` 仅用于展示。导入 Operation 必须绑定已登记的 Service Target 及其 Environment endpoint。
- 固定 Agent 路径接受 Operation 声明的每个受支持 HTTP method，包括 GET、HEAD、POST、PUT、PATCH、DELETE 和 OPTIONS；不接受任意 URL、host、代理、重定向、session ID 或未声明请求字段。
- `api_write_prepare` 和 `api_write_execute` 仅作为旧调用方的离线兼容描述，返回稳定的 `WRITE_CONFIRMATION_UNSUPPORTED`，不会绕过直接 `api_call` 路径。
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

检查所选 Environment 下 Service Target 的 endpoint、已登记 hostname、端口和 DNS 返回。已登记的 RFC1918/ULA/CGNAT 内网 API 不再需要额外 CIDR 配置；loopback、link-local、metadata、组播和保留地址仍会被拒绝。请求从 DSH Host 发起，不是从浏览器发起。重定向会按设计返回 `REDIRECT_NOT_ALLOWED`；请登记最终固定 endpoint。

</details>

<details>
<summary><b>响应为空、被截断或过大</b></summary>

检查上游 status，以及 Operation/endpoint 的响应限制。工具只返回有界投影，并可能脱敏无效或敏感内容。使用筛选、分页或服务支持的 `LIMIT` 缩小 API 查询；应用层限制不保证上游服务没有执行大扫描。

</details>

<details>
<summary><b>为什么写请求被拒绝？</b></summary>

先用 `api_operations` 和 `api_describe` 确认 Operation 的 method、参数和 body Schema，再通过 `api_call` 发起调用。若请求被拒绝，检查 Operation、Kit、Environment 或 Service Target 是否启用，绑定的凭据是否可用，以及参数/body、固定 hostname、DNS/IP、超时和响应限制是否满足。旧的 `api_write_prepare`/`api_write_execute` 会返回 `WRITE_CONFIRMATION_UNSUPPORTED`，不会发送请求。

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
