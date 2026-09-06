## 1. Host Auth Profile RPC 契约

- [x] 1.1 扩展 `lib/typert.host.js`、`lib/index.js` 与 Client RPC descriptors，暴露 Auth Profile 元数据 CRUD 和 secret set/unset 方法；验证 Host/Client 方法名、参数 codec、返回形状和 manifest contract 测试一致
- [x] 1.2 为 Auth Profile RPC 建立统一的安全错误映射和输入边界；验证非法 ID、未知认证类型、缺少类型必需字段、停用 Profile 和不存在 Profile 返回稳定非敏感错误且不产生部分写入

## 2. Host 配置与凭据生命周期

- [x] 2.1 完善 Auth Profile 元数据创建、更新、启用/停用、删除的安全视图和引用保护；验证 Service Target/Operation 引用时删除返回 `AUTH_PROFILE_IN_USE` 及可行动引用信息
- [x] 2.2 暴露 Host-only secret 设置、替换和删除能力，复用现有 credential adapter；验证成功只返回 `hasSecret`/来源/可写状态，secret 不进入 Registry、RPC 结果、错误或诊断
- [x] 2.3 保持 Query API Key 的 `allowQuery` 显式开关与风险元数据；验证默认执行仍被 `QUERY_AUTH_DISABLED` 拒绝，受控 query 名称始终被拒绝
- [x] 2.4 保持 OAuth2 Client Credentials 的 HTTPS、Environment allowlist/DNS/IP、响应大小、manual redirect 和 cache 隔离约束；验证 Profile 元数据或 secret 变更会失效 OAuth client/token cache

## 3. Client Auth Profile 设置区域

- [x] 3.1 在 `lib/client.js` 增加独立 Auth Profile 分组、列表、加载/空状态/局部错误/重试和安全摘要；验证可显示类型、启用状态、hasSecret、credentialSource、writable 与 Query/OAuth 风险，但不显示 secretRef 或真实 secret
- [x] 3.2 增加按认证类型切换的创建/编辑表单和字段校验，覆盖 none、Bearer、Header API Key、Query API Key、Basic、OAuth2 Client Credentials；验证字段 ID 稳定唯一、保存草稿、错误关联和窄容器布局
- [x] 3.3 增加启用/停用和 Auth Profile 删除确认流程；验证 44px 操作命中区、键盘/Enter/Space/Escape、焦点恢复、Host 删除失败时保留列表并提供重试
- [x] 3.4 增加不可回显的 secret 设置/替换/删除交互；验证 secret 只作为 Host RPC 输入，成功/失败/列表/DOM 文本/日志均不包含原值，并对删除 secret 提供明确确认
- [x] 3.5 在 Query API Key 表单显示“凭据可能进入 URL”的高风险提示与显式 allowQuery 控制，在 OAuth2 表单保留 endpoint/认证方式/范围等现有安全校验；验证 UI 不自行拼接 URL、不发起连接测试
- [x] 3.6 将 Auth Profile 分组与现有 Service Target 绑定、Operation 认证引用、OpenAPI 导入默认 Profile 选择联动；验证创建或更新后绑定列表刷新，停用/删除/引用冲突通过安全 RPC 反馈

## 4. 测试与安全回归

- [x] 4.1 扩展 `test/configuration.test.mjs`、`test/auth.test.mjs`、`test/host-adapter.test.mjs`，覆盖 CRUD、secret set/unset、凭据不可用、引用保护、停用拒绝、Query 风险和 OAuth cache 失效
- [x] 4.2 扩展 `test/client-contract.test.mjs` 和 manifest/descriptor 测试，验证新增 UI/RPC 标记、无直接 `fetch`/任意 URL/连接测试、无 secret 泄露、响应式/键盘/确认语义
- [x] 4.3 运行 `node --test test/*.test.mjs`、`node scripts/check-manifest.mjs`、`pnpm pack --dry-run` 和 `git diff --check`，确认既有 API Kit picker、导入、Session activation、写确认与 Agent 工具回归通过
- [x] 4.4 在隔离 DSH profile 3091 安装最新 bundle，验证 Auth Profile 设置页创建/编辑/凭据状态/绑定/删除失败路径；确认不重启或刷新主实例 3080，并记录浏览器中未出现真实 secret

## 5. 文档与交付

- [x] 5.1 更新 README、中文需求/实现文档和变更日志，说明 Auth Profile 支持类型、单 secretRef 限制、Query API Key 风险、OAuth2 边界和 Host-only 凭据管理；验证文档不包含示例真实凭据
- [x] 5.2 运行 `openspec validate "auth-profile-management" --type change --strict`，确认所有 artifacts 和 delta spec 可被校验并准备进入 apply 阶段
