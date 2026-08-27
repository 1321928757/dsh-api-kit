# dsh-api-kit

> 为 DeepSeek Harness 提供 API 套件、OpenAPI 导入、会话级启用和安全调用的本地优先插件。

## 当前状态

当前版本完成 **T05 手工 API Operation 与最小 API Kit 管理（0.1.0）**，在 T01 Bundle、T02 领域模型、T03 Registry 存储和 T04 配置基础之上增加了严格的 Operation/Kit CRUD、安全视图和设置页管理界面。目前提供：

- Host / Client / Typert 三个 bundle 入口；
- 输入栏“API 套件”占位入口；
- 设置页“API 套件”占位页面；
- Registry 的规范化加载、schema 迁移、完整性校验、原子保存、备份、损坏恢复和内存快照；
- Service Target、Environment、Auth Profile、Operation 和 API Kit 的 Host 配置门面；
- Operation 严格校验、启用/禁用、Kit 关联、最小 Kit CRUD、双向引用重算和安全视图；
- Typert/Host RPC 配置通道，以及支持 Kit/Operation 增删改查的设置页；
- HTTP/HTTPS、Host 白名单、生产环境 Agent 默认关闭、认证字段校验和删除引用保护；
- 可选的 OpenAPI 导入存档策略：默认不保存，也可显式选择脱敏或原文存档。

当前版本已完成 T08 固定目标只读调用：`api_kits`、`api_operations`、`api_describe` 和 `api_call`。`api_call` 只接受稳定 `operationId` 与已声明参数，仅执行 GET/HEAD；Host 根据登记的 Environment 拼接目标、按次解析认证、强制 host 白名单、超时和响应大小限制。OpenAPI 导入、DNS/IP 级 SSRF、递归响应脱敏、审计、动态上下文和写操作仍留给后续任务。凭据只允许通过 Host-only 适配器按次解析，Registry 不保存真实 secret。

### 会话级套件选择

- 输入栏 `conversation.input.left` 的“API 套件”入口使用独立槽位 ID `dsh-api-kit`，排序为 `93`，与 `dsh-mysql` 等控制共存。
- 当前会话可以多选 API Kit，并选择一个共同 Environment；选择只保存在 Host 运行时的 `sessionId → { activeKitIds, environmentId }` 内存映射，不写入 Registry，重启 DSH 后需要重新激活。
- 默认建议最多激活 2 个 Kit；超过后仍允许保存，但会显示模型可见操作范围扩大的警告。
- Host 每次读取和后续解析都会重新校验 Kit/Operation/Environment 的启用状态、Agent 权限和环境兼容性；停用或删除后的旧选择不会继续生效。
- 选择器只展示安全元数据和环境名称，不展示 base URL、凭据引用或 secret。生产环境会显示风险标识，并遵循 Host 的 Agent 开关。

### T07 Agent 发现工具

- Host 全局注册三个固定工具：`api_kits`、`api_operations`、`api_describe`，不为每个 Operation 动态生成工具。
- 工具从 `exec.agent.id` 获取当前会话，并在每次调用前重新校验会话激活状态；模型不能传入或伪造 `sessionId`。
- `api_kits` 返回当前会话的 Kit/Environment 安全摘要；`api_operations` 支持关键词、Tag、HTTP method、Service Target 和分页；`api_describe` 只接受已发现的稳定 `operationId`。
- 只有激活 Kit 中启用、允许 Agent 且满足 Operation/Kit 只读或写策略交集的 Operation 才会被发现或描述；共享 Operation 会确定性去重。
- 工具结果限制为最多 64 KiB；搜索结果按完整条目截断并返回分页信息，过大的详情 fail-closed 为 `DESCRIPTION_TOO_LARGE`。
- T07 只负责发现和描述，不发起 HTTP，不接受任意 URL，不暴露 `baseUrl`、host 白名单、认证引用、secret 或内部堆栈。
- T08 `api_call` 只执行当前会话已发现的 GET/HEAD Operation；目标固定来自 Environment，业务参数按声明校验，认证只在 Host 侧解析，响应按字节上限投影为 JSON 或文本。T08 不跟随重定向，DNS/IP 级 SSRF、递归脱敏和审计留给 T09。

后续开发任务和需求基线见：

- [`docs/REQUIREMENTS.zh-CN.md`](./docs/REQUIREMENTS.zh-CN.md)
- [`docs/IMPLEMENTATION_PLAN.zh-CN.md`](./docs/IMPLEMENTATION_PLAN.zh-CN.md)

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

## 设计方向

- API 定义按“API 套件（API Kit）”组织；
- 当前会话从输入栏选择一个或多个套件和环境；
- AI 通过 `api_kits → api_operations → api_describe → api_call` 分层发现和调用；
- Host 固定解析 operation + environment，不接受模型传入任意 URL；
- 默认只读，凭据只在 Host 侧使用；
- OpenAPI 导入、SSRF 防护、响应脱敏、审计和后续 MCP 适配均按实施文档推进。

## 参考链接

- [DeepSeek Harness 官方开发文档首页](https://deepseek-harness.github.io/deepseek-harness/develop/basic/)
- [开发一个工具](https://deepseek-harness.github.io/deepseek-harness/develop/basic/tool)
- [插件配置](https://deepseek-harness.github.io/deepseek-harness/develop/basic/config)
- [打包与安装插件](https://deepseek-harness.github.io/deepseek-harness/develop/basic/publish)
- [DSH 官方 GitHub 仓库](https://github.com/deepseek-ai/deepseek-harness)
- [DSH 插件开发实战模板 Skill](https://github.com/fuzhengwei/xfg-skills-dsp-plugin-template)
- [dsh-mysql 参考实现](https://github.com/1321928757/dsh-mysql)
- [OpenAPI Specification](https://spec.openapis.org/oas/latest.html)
- [MCP Tools 规范](https://modelcontextprotocol.io/specification/latest/server/tools)

## License

[MIT](./LICENSE)。本项目与 DeepSeek 无关联。
