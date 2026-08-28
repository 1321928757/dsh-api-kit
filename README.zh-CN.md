# dsh-api-kit

> 为 DeepSeek Harness 提供 API 套件、OpenAPI 导入、会话级启用和安全调用的本地优先插件。

## 当前状态

当前版本已完成 T13：在 T12 OpenAPI 3.0/3.1 与 Swagger 2.0 JSON 有界解析、规范化、预览和原子确认事务基础上，完善设置页与会话选择器的主题、键盘、焦点、窄屏和错误恢复体验。当前工具为 `api_kits`、`api_operations`、`api_describe` 和 `api_call`。

- API 定义和非敏感配置保存在本机 Registry；真实凭据只由 Host 按次解析。
- `api_call` 只接受稳定 `operationId` 与已声明参数，当前只执行 GET/HEAD。
- 目标只来自登记的 Environment `baseUrl` 与 Operation path，不接受模型传入 URL、host、sessionId、代理或重定向策略。
- Environment 的 host 必须在 `allowedHosts` 中；每次调用对 DNS 返回的全部地址做校验，任一地址为 loopback、link-local、metadata、保留、文档测试网段、IPv4-mapped 高风险地址则拒绝。
- RFC1918、IPv6 ULA 和 CGNAT 私网地址还必须同时满足 `allowPrivateNetwork: true` 与匹配的 `allowedCidrs`；仅设置 hostname 白名单不能放行私网。
- 请求连接固定到已校验的 IP；HTTPS 仍使用登记 hostname 作为 TLS SNI 和 Host，避免 DNS rebinding。生产 pinned transport 不使用代理、自动重试或自动重定向。
- 301/302/303/307/308 只返回安全错误 `REDIRECT_NOT_ALLOWED`，不读取或返回 `Location`。
- JSON 成功和错误响应在返回前按默认及 Operation `policy.redactKeys` 递归脱敏，再执行深度、数组、字符串、对象 key 和字节治理；不返回响应 Header。
- 每次 `api_call` 的实际调用和策略拒绝都写入 `$DSH_HOME/storages/dsh-api-kit/audit/audit-YYYY-MM-DD.jsonl`。审计按白名单字段写入，默认懒清理 14 天前文件；写失败不影响业务结果，并仅保留 Host 内部诊断。

## T13 UI 质量与可用性

- 设置页和输入栏选择器使用当前 DSH Inspect 确认的 `--dsw-*` 主题令牌，兼容亮色/暗色表面、文字、边框和状态色；不把 Server URL 当作执行目标。
- 主要控件保持至少 44px 高度，支持 `:focus-visible`、Tab/Shift+Tab、Enter/Space 和 Escape；选择器打开时管理焦点、循环 Tab，并在关闭后恢复触发按钮焦点。
- 选择器和设置页在 720px/520px 下改为单列/可换行布局，长名称和诊断文本换行，弹层限制在 viewport 内；用户启用 reduced motion 时停用 spinner/过渡动画。
- RPC 加载和提交使用请求序号与卸载保护；绑定列表支持局部失败和重试，JSON 字段错误在原字段附近显示并保留草稿。
- `IMPORT_STALE_PREVIEW` 等事务错误会提示重新预览；成功、空状态、加载中和错误状态均提供文字反馈，不仅依赖颜色。
- T13 本地合同/全量回归和隔离 Profile 安装已完成；由于仓库没有专用浏览器 smoke 脚本，真实浏览器主题、键盘和窄屏交互仍需发布前在可重复浏览器环境中补验。

## 会话级套件选择

- 输入栏 `conversation.input.left` 的“API 套件”入口使用独立槽位 ID `dsh-api-kit`，排序为 `93`。
- 当前会话可以多选 API Kit，并选择一个共同 Environment；选择只保存在 Host 运行时的 `sessionId → { activeKitIds, environmentId }` 内存映射。
- Host 每次读取和工具调用都会重新校验 Kit/Operation/Environment 的启用状态、Agent 权限和环境兼容性。
- 选择器及 Agent 工具不展示 base URL、host 白名单、凭据引用或 secret。

## Agent 工具

- `api_kits`：列出当前会话的安全 Kit/Environment 摘要。
- `api_operations`：按关键词、Tag、HTTP method、Service Target 和分页发现 Operation。
- `api_describe`：按稳定 `operationId` 返回完整安全调用说明。
- `api_call`：按描述调用固定 GET/HEAD Operation；参数只允许声明的 path/query/业务 Header。

推荐顺序：`api_kits → api_operations → api_describe → api_call`。模型不得猜测 URL、主机、认证值或绕过会话激活。

## 动态运行时上下文

每次模型步骤组装提示词时，Host Provider 都会使用 Agent 的权威 session ID 重新读取当前会话激活和 Registry 状态，注入简短摘要：激活套件名称/描述、所选环境、可发现/只读/写操作数量、固定工具名、发现到调用流程，以及只读、SSRF、响应治理和审计边界。上下文不会包含 base URL、具体 host/CIDR、凭据引用或凭据值、请求 Header/Cookie，也不会包含完整 OpenAPI Schema。停用或清除 Kit/Environment 后，下一次组装会立即反映，DSH Runtime Projection 会替换或清除旧快照。

## OpenAPI JSON 导入与确认

T12 在设置页提供“导入 OpenAPI JSON”流程：粘贴 JSON → 读取并预览 → 选择 Tag、已登记 Service Target、Environment、Auth Profile 和一个或多个 Kit → 逐项处理冲突 → 二次确认并原子写入 Registry。Host 在确认时会重新解析文档和当前 Registry，不信任浏览器提交的候选字段；任何校验、并发或持久化失败都会使整个批次不写入。

- `previewOpenApiImport(args)` 返回有界预览、文档 fingerprint、Registry fingerprint、Tag/服务统计和 transactionId；不保存完整原文。
- `confirmOpenApiImport(args)` 必须携带原始 JSON、transactionId、预览指纹和明确绑定；只允许使用现有 Target/Environment/Auth Profile/Kit。重复成功确认使用相同 transactionId 和选择时幂等返回。
- Tag 筛选只影响本次 sourceKey 选择；冲突支持 `overwrite`、`keep-local`、`skip`。写操作保持不可由 Agent 调用的安全默认策略。
- Server URL 仍为 display-only，不能自动创建 Environment；导入归档默认关闭，归档失败不影响 Registry 提交结果。


T11 提供 DSH 无关的 `buildOpenApiImportPreview(input, options)`（同时导出 `previewOpenApiImport`），支持 OpenAPI 3.0/3.1 和 Swagger 2.0 JSON 字符串或对象。解析器只解析文档内的 JSON Pointer `$ref`，有界转换路径、参数、请求体、响应、Server 候选和认证模板，并生成稳定的 Operation 来源键及 new/update/conflict/skip 预览分类。

- `serverCandidates` 仅是 display-only 的用户确认候选，不会自动创建或信任 Environment；Swagger `host/basePath/schemes` 同样不会直接成为调用目标。
- 认证模板只包含 Bearer、Basic、Header/Query API Key 的非敏感元数据；不保存 secret，Query API Key 默认关闭。OAuth2、OpenID Connect、mTLS、远程 `$ref`、YAML、URL/Git 导入不在 T11 范围内。
- 预览只接收内存中的 JSON，不读文件、不联网、不修改 Registry 或输入对象；候选未绑定已登记 Service Target/Auth Profile 时标记 `needsBinding`，需 T12 的确认事务处理。
- 非法版本、坏路径、外部/循环/缺失引用、危险 Header、非法响应状态和文件上传会产生结构化诊断，不静默生成可调用定义；写操作仍保持默认不可由 Agent 执行。

## 安装（后续发布）

```powershell
dsh plugin --profile web add github:1321928757/dsh-api-kit#v0.1.0
```

当前阶段建议先使用本地 tgz 安装到隔离测试 profile，不要覆盖正在使用的 profile。

## 开发检查

```powershell
pnpm test
pnpm run check
pnpm pack --dry-run
```

## 安全边界

T10 仍不实现 OpenAPI 导入、写操作、OAuth2、文件上传、SSE/WebSocket、自动重定向、隐式重试或独立 MCP Server。私网放行必须是明确 CIDR；本实现不接受任意 URL，也不把 T09 的固定目标调用当作通用互联网代理。

## 参考链接

- [DeepSeek Harness 官方开发文档首页](https://deepseek-harness.github.io/deepseek-harness/develop/basic/)
- [开发一个工具](https://deepseek-harness.github.io/deepseek-harness/develop/basic/tool)
- [插件配置](https://deepseek-harness.github.io/deepseek-harness/develop/basic/config)
- [打包与安装插件](https://deepseek-harness.github.io/deepseek-harness/develop/basic/publish)
- [DSH 官方 GitHub 仓库](https://github.com/deepseek-ai/deepseek-harness)
- [dsh-mysql 参考实现](https://github.com/1321928757/dsh-mysql)
- [OpenAPI Specification](https://spec.openapis.org/oas/latest.html)
- [MCP Tools 规范](https://modelcontextprotocol.io/specification/latest/server/tools)

## License

[MIT](./LICENSE)。本项目与 DeepSeek 无关联。
