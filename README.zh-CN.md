# dsh-api-kit

> 为 DeepSeek Harness 提供 API 套件、OpenAPI 导入、会话级启用和安全调用的本地优先插件。

## 当前状态

当前版本是 **T01 工程骨架（0.1.0）**，用于验证 DSH profile bundle 的打包和加载契约。目前只提供：

- Host / Client / Typert 三个 bundle 入口；
- 输入栏“API 套件”占位入口；
- 设置页“API 套件”占位页面。

当前版本**尚未实现** API 套件 CRUD、OpenAPI 导入、认证配置、`api_*` Agent 工具或真实 HTTP 请求，也不会保存或读取凭据。

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
