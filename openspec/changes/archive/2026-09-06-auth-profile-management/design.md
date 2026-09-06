## Context

当前 Registry 和 Configuration Service 已经保存 Auth Profile 的非敏感元数据，并通过 `credential-adapter.js` 在 Host 请求时解析真实凭据。Host 目前只向 Client 暴露 `listAuthProfiles`/`getAuthProfile`；Client 仅能在 Service Target 和 OpenAPI 导入中选择已有 Profile，不能管理 Profile 生命周期或 secret 状态。现有模型的认证类型已经包含 `none`、Bearer、Header/Query API Key、Basic 和 OAuth2 Client Credentials；Query API Key 的执行默认关闭，OAuth2 已有严格 endpoint、Environment 和 token 响应限制。

本设计遵循 proposal 和 delta specs：补齐管理闭环，但不把浏览器 Client 变成凭据存储、HTTP 客户端或安全策略执行器。

## Goals / Non-Goals

**Goals:**

- 为安全 Auth Profile 元数据提供完整 CRUD 和引用保护。
- 通过受控 Host RPC 管理 secret 的设置、替换和删除，只返回安全状态。
- 在设置页提供可理解的认证类型表单、凭据状态、风险提示、局部错误和确认流程。
- 让 Query API Key 的 URL 风险、OAuth2 的固定 endpoint 和现有 fail-closed 规则在 UI、RPC 和测试中保持一致。
- 使 Service Target、Operation、OpenAPI 导入和请求执行继续使用最新的 Profile 状态。

**Non-Goals:**

- 不扩展为一个 Auth Profile 包含多个命名 secret；企微等多字段凭据仍由一个外部 credentials 值封装，或拆成多个既有 Profile。
- 不实现 authorization-code/PKCE/OIDC discovery、浏览器回调、refresh-token 持久化、mTLS 或任意 token endpoint。
- 不在 Client 直接请求认证目标、测试连接或调用任意 URL。
- 不向 Agent、浏览器普通文本、审计日志或 RPC 返回值输出真实 secret、`secretRef` 或完整认证 Header。
- 不改变 Session activation、API Kit/Operation 写确认和固定 Target/Environment SSRF 门禁。

## Decisions

### 1. 保持单 secretRef 语义，扩展管理而非扩展凭据数据模型

Auth Profile 继续只保存一个 `secretRef`，真实值由现有 DSH credentials adapter 管理。这样可以复用当前 `createAuthProfile`、`validateAuthProfileInput`、`safeAuthProfileView` 和按请求解析路径，同时避免为复合凭据引入新的序列化、字段脱敏和多引用生命周期问题。企微需要多个密钥时，由 credentials 服务以单个 JSON/封装值管理，或在后续变更中设计多命名凭据。

**替代方案：** 在 Profile 中增加 `secrets: { ... }`。该方案能表达多个字段，但会同时扩大 Registry schema、RPC payload、表单和泄露审计面，超出本次补齐生命周期的必要范围。

### 2. RPC 分离元数据写入与 secret 写入

新增的 Host RPC 分为两类：Auth Profile 元数据 CRUD，以及 secret 设置/删除。元数据 RPC 只能接收 `secretRef` 等安全引用和非敏感字段；secret RPC 只接收一次性输入值并返回 `hasSecret`、来源、可写状态等安全视图。两类操作都由 Host 做参数校验、引用校验和错误脱敏。

**替代方案：** 在 `createAuthProfile` payload 中同时接收 `secret`。这会扩大普通 Registry 写事务和错误/重试的泄露风险，也容易让 secret 进入通用状态，故不采用。

### 3. Client 采用独立 Auth Profile 分组与局部编辑器

在现有 settings.section 中增加 Auth Profile 折叠分组，沿用现有列表、局部加载、请求代次、busy、dialog、焦点恢复、44px 控件和主题 token 模式。列表显示名称、类型、启用状态、凭据状态和风险标记；编辑器按类型展示非敏感字段。secret 使用独立的“设置/替换凭据”流程，输入控件不可回显，成功后仅刷新状态。

**替代方案：** 把 Auth Profile 表单嵌入每个 Service Target。这样会造成配置重复、无法管理未绑定 Profile，也不利于引用保护和凭据状态复用；因此采用独立资源分组，Target 只负责绑定。

### 4. Query API Key 是显式风险配置，不是普通 Header 配置的别名

Query API Key 仍可作为模型支持的认证类型，但 UI 必须明确显示“凭据可能进入 URL”，并提供 `allowQuery` 显式开关。关闭时允许保存元数据以便先完成配置，但 `resolveAuthForRequest` 必须拒绝执行。受控 query 名称、URL 处理和审计脱敏继续由 Host 校验，Client 不自行拼接 query。

### 5. 删除采用 Host 最终引用校验，UI 只提供预览和确认

Client 可根据已加载安全列表展示引用影响，但不能推断 Host 的完整 Registry 引用关系。删除前使用局部 dialog；只有 `deleteAuthProfile` 成功后才清理列表。Host 发现 Service Target 或 Operation 引用时返回 `AUTH_PROFILE_IN_USE` 和非敏感引用信息，UI 保留当前状态并给出解除引用/重试路径。

### 6. Profile 变更使请求时认证保持最新

元数据更新、secret 设置/删除和 Profile 删除都必须使相关 OAuth client/token cache 失效。实际请求继续在 Host 侧按最新 Registry 和 credentials 状态重新解析；停用 Profile 不能作为新绑定或请求认证使用。这样既复用现有 request-time resolution，也避免凭据替换后继续使用旧 token。

## RPC / 数据流

```text
Settings Client
   |  safe metadata RPC
   v
Typert apiKitConfig
   |
   +--> Auth Profile metadata validation --> Registry atomic update
   |
   +--> secret set/unset -----------------> credentials adapter
   |                                          |
   |                                          +--> safe status only
   v
safeAuthProfileView (no secretRef/secret)

Agent api_call / write executor
   |
   +--> latest operation + target + profile
   +--> credentials.resolve(secretRef) at request time
   +--> fixed target / Environment / SSRF / policy gates
   v
authenticated request
```

## Risks / Trade-offs

- **[Risk] 用户误以为“已配置”代表认证测试成功** → UI 只展示 credentials 状态，不添加伪造的连接测试；真实请求仍由现有 Host 执行器验证。
- **[Risk] Query API Key 进入 URL 后被中间层记录** → 默认关闭执行，UI 强提示，Host 继续要求显式 `allowQuery` 并进行错误/审计脱敏。
- **[Risk] Profile 被删除或停用后已有绑定失效** → 删除由 Host 引用保护；停用保留元数据并在绑定/执行时返回稳定错误，UI 展示影响和修复路径。
- **[Risk] secret 在 Client 错误、React 状态或 DOM 中残留** → secret 输入仅用于受控 RPC，成功/失败只保留安全状态；测试扫描禁止 secret 出现在返回值、文案和 DOM 文本。
- **[Risk] RPC 方法扩展造成 Host/Client descriptor 不一致** → 同一批次更新 `lib/typert.host.js`、`lib/index.js`、Client descriptors、manifest/contract tests，并在安装前运行全量回归。
- **[Risk] OAuth token cache 使用过期配置** → 所有 Profile metadata/secret 变更调用现有 cache invalidation；测试覆盖替换、停用和 endpoint 变更后的重新解析。

## Migration Plan

1. 保持现有 Registry schema 和 `secretRef` 格式兼容，只新增 RPC 和 Client 管理入口。
2. 已有 Auth Profiles 不需要迁移；首次打开管理区域时通过安全视图读取凭据状态。
3. 安装新 bundle 后，先验证 Host/Client manifest、列表和既有 Target/Import 绑定；若 RPC descriptor 不匹配则回滚到旧 bundle。
4. 回滚只需恢复旧插件 bundle；既有 Registry/Auth Profile 数据仍由旧 Host 核心兼容读取，新增未提交的 UI 操作不会影响旧数据。

## Open Questions

无影响当前规格或任务拆分的待决策项。多命名凭据和企微专用认证协议作为后续独立变更处理。
