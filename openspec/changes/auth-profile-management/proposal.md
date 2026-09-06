## Why

当前 API Kit 已经具备 Auth Profile 的 Registry 模型、Host 侧 CRUD、凭据适配器和请求时认证解析，但设置页只能绑定已有 Auth Profile，用户无法在插件内创建、编辑、停用、删除或维护凭据引用。因此 Bearer、API Key、Basic、OAuth2 Client Credentials 等认证配置的生命周期是不完整的，企微等需要通过 URL query 传递业务 API Key 的场景也缺少可发现、可审查的管理入口。

## What Changes

- 在 API Kit 设置页增加独立的 Auth Profile 管理区域，支持安全元数据的创建、编辑、启用/停用和删除。
- 将 Auth Profile 管理所需的 Host 方法通过 Typert/RPC 暴露给 Client，同时保持 Client 不直接访问网络、不接触真实 secret。
- 支持当前模型中的 `none`、Bearer、Header API Key、Query API Key、Basic 和 OAuth2 Client Credentials 配置；Query API Key 明确显示“凭据会进入 URL”风险，并继续默认关闭执行。
- 增加凭据状态与凭据维护入口：只显示是否已配置、来源和可写状态；设置、替换和删除真实 secret 均通过 Host credentials 服务完成，界面不回显原值。
- 保留单个 `secretRef` 对应一个 Auth Profile 的模型；多字段认证不在本次扩展为多个命名 secret，外部 credentials 服务可自行封装复合值。
- 保留 Service Target 绑定、Operation 认证引用、OpenAPI 导入绑定和引用保护；被引用的 Auth Profile 不能直接删除。
- 增加针对 RPC 边界、安全视图、凭据不泄露、Query API Key 风险、引用保护和 UI 状态的测试与文档。

## Capabilities

### New Capabilities

- `auth-profile-management`: 提供 Auth Profile 的安全配置生命周期、凭据维护、认证类型表单、引用保护和设置页管理体验。

### Modified Capabilities

- `plugin-settings-ui`: 增加 Auth Profile 管理分组、凭据状态/维护交互，并明确认证配置与 Service Target、Operation 和导入流程的安全边界。

## Impact

- **Host 核心**：`lib/configuration.js`、`lib/index.js`、`lib/typert.host.js`，需要暴露安全的 Auth Profile CRUD 与 secret 管理 RPC，并继续通过 `credential-adapter.js` 隔离真实凭据。
- **领域校验与安全视图**：`lib/model.js`、`lib/config-validation.js` 及引用检查；Query API Key、OAuth2 和 secret 状态必须保持现有 fail-closed 语义。
- **Client 设置页**：`lib/client.js` 增加 Auth Profile 列表、编辑器、敏感字段替换/删除流程、错误与确认状态；不得新增 `fetch` 或任意 URL 执行。
- **Typert/RPC 契约**：补充 create/update/delete Auth Profile 及 set/unset secret 所需的严格 JSON 方法描述；真实 secret 不得进入返回值、浏览器日志、模型上下文或普通审计日志。
- **测试与文档**：扩展配置、Host adapter、Client contract、manifest、安全边界和 README/需求说明；不引入新的运行时依赖。
