# dsh-api-kit

> 为 DeepSeek Harness 提供 API 套件、OpenAPI 导入、会话级启用和安全调用的本地优先插件。

## 当前状态

当前版本已完成 T10：在 T09 固定目标只读调用的基础上加入按会话、按每轮组装刷新的动态运行时上下文，以及执行期 DNS/IP/CIDR SSRF 防护、固定 IP 连接、重定向拒绝、递归 JSON 脱敏和 Host-only 本地审计。当前工具为 `api_kits`、`api_operations`、`api_describe` 和 `api_call`。

- API 定义和非敏感配置保存在本机 Registry；真实凭据只由 Host 按次解析。
- `api_call` 只接受稳定 `operationId` 与已声明参数，当前只执行 GET/HEAD。
- 目标只来自登记的 Environment `baseUrl` 与 Operation path，不接受模型传入 URL、host、sessionId、代理或重定向策略。
- Environment 的 host 必须在 `allowedHosts` 中；每次调用对 DNS 返回的全部地址做校验，任一地址为 loopback、link-local、metadata、保留、文档测试网段、IPv4-mapped 高风险地址则拒绝。
- RFC1918、IPv6 ULA 和 CGNAT 私网地址还必须同时满足 `allowPrivateNetwork: true` 与匹配的 `allowedCidrs`；仅设置 hostname 白名单不能放行私网。
- 请求连接固定到已校验的 IP；HTTPS 仍使用登记 hostname 作为 TLS SNI 和 Host，避免 DNS rebinding。生产 pinned transport 不使用代理、自动重试或自动重定向。
- 301/302/303/307/308 只返回安全错误 `REDIRECT_NOT_ALLOWED`，不读取或返回 `Location`。
- JSON 成功和错误响应在返回前按默认及 Operation `policy.redactKeys` 递归脱敏，再执行深度、数组、字符串、对象 key 和字节治理；不返回响应 Header。
- 每次 `api_call` 的实际调用和策略拒绝都写入 `$DSH_HOME/storages/dsh-api-kit/audit/audit-YYYY-MM-DD.jsonl`。审计按白名单字段写入，默认懒清理 14 天前文件；写失败不影响业务结果，并仅保留 Host 内部诊断。

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
