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

当前版本已完成 T06 会话级 API Kit/Environment 选择。`api_*` Agent 工具、真实 HTTP 请求、OpenAPI 导入和完整套件高级策略仍未实现，继续留给 T07–T12。人工测试入口也会在请求执行器完成后接入。凭据只允许通过 Host-only 适配器按次解析，Registry 不保存真实 secret。

### 会话级套件选择

- 输入栏 `conversation.input.left` 的“API 套件”入口使用独立槽位 ID `dsh-api-kit`，排序为 `93`，与 `dsh-mysql` 等控制共存。
- 当前会话可以多选 API Kit，并选择一个共同 Environment；选择只保存在 Host 运行时的 `sessionId → { activeKitIds, environmentId }` 内存映射，不写入 Registry，重启 DSH 后需要重新激活。
- 默认建议最多激活 2 个 Kit；超过后仍允许保存，但会显示模型可见操作范围扩大的警告。
- Host 每次读取和后续解析都会重新校验 Kit/Operation/Environment 的启用状态、Agent 权限和环境兼容性；停用或删除后的旧选择不会继续生效。
- 选择器只展示安全元数据和环境名称，不展示 base URL、凭据引用或 secret。生产环境会显示风险标识，并遵循 Host 的 Agent 开关。

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
