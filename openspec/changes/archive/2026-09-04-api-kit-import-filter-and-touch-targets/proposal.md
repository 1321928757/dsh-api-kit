## Why

OpenAPI 导入配置在更换文档后会保留旧的 Tag 筛选；当新文档不包含该 Tag 时，预览虽然成功，但可导入 Operation 数量变为 0，用户会被禁用的确认按钮困住。与此同时，设置页关键操作仍被局部样式压缩到约 40px，低于触控设备和窄窗口下更稳妥的命中区建议，且 Environment/Service Target 两个创建动作的视觉优先级没有体现“先环境、后服务目标”的配置顺序。

本变更优先修复导入流程的假性卡死，并统一关键操作的触控命中区；保持现有 Host、RPC、Registry、导入事务和安全边界不变。真实 smoke 测试必须使用隔离的测试 DSH 实例（例如 `3091`），不得操作当前用户正在使用的 `3080` 实例。

## What Changes

- 在 OpenAPI 新预览成功后协调已有 Tag 筛选：保留仍存在于新文档的 Tag，移除失效 Tag；若筛选全部失效则恢复为“不筛选”状态。
- 在筛选被自动修剪或清除时显示简短、可感知的提示，明确当前导入范围，避免用户误以为仍在使用旧筛选。
- 为筛选结果为 0 的状态提供明确的可访问说明，告知用户清除 Tag 筛选或重新选择，而不是只依赖禁用的“查看变更确认”按钮。
- 设置页主要按钮、OpenAPI 导入步骤按钮和 Operation 行操作按钮使用至少 44px 的垂直命中区，同时保留适合窄容器的视觉宽度。
- 确保 checkbox/radio 继续保持独立原生控件语义，并为其外围选择标签提供足够的点击区域，不把普通控件尺寸规则应用到原生选择控件。
- 将“添加 Service Target”从 primary 调整为 secondary/outline，保留“添加 Environment”作为连接配置区域的主要动作，以体现配置顺序。
- 补充 Client contract 测试，覆盖跨文档 Tag 筛选协调、零结果提示、44px 关键命中区和 primary/secondary 层级等静态不变量。
- 在隔离的 `3091` 测试实例中验证文档 A → 选择 Tag → 文档 B 的交互、窄容器按钮尺寸、键盘可达性和无横向溢出；不在 `3080` 实例执行调试、安装、刷新或重启。

## Capabilities

### New Capabilities

<!-- No new standalone capability is introduced; the behavior belongs to the existing settings UI capability. -->

### Modified Capabilities

- `plugin-settings-ui`: 修改 OpenAPI 导入筛选在文档切换后的状态一致性、零结果反馈、关键操作触控命中区和连接配置动作层级要求。

## Impact

- **Client:** 主要修改 `lib/client.js` 中的 `OpenApiImportPanel` 状态协调、导入状态提示和局部 CSS；不改变 RPC 名称、参数、返回值、Registry 数据模型或 Host 校验。
- **Tests:** 更新 `test/client-contract.test.mjs`，并执行现有 Node 测试、manifest 检查和 diff 检查。
- **OpenSpec:** 为现有 `plugin-settings-ui` 能力新增本变更的 delta spec、设计和任务记录；不直接修改主 spec，直到实施验证完成并进入同步/归档阶段。
- **Runtime verification:** 仅使用独立测试实例（建议 `http://127.0.0.1:3091/`）进行插件加载和浏览器 smoke；严禁触碰当前 `3080` 实例。
- **Security:** 不新增直接网络请求、任意 URL 执行、凭据/secret 处理、连接测试或安全策略路径。
