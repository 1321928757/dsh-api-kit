## Why

当前插件设置页已经具备 API Kit、Operation、Service Target 和 Environment 的编辑能力，但 Operation 与 Service Target 以内容较高的卡片连续堆叠；当配置数量增加时，用户需要滚动经过大量重复操作和元数据，难以快速定位目标。设置页的多个功能区域也会在首屏同时展开，增加认知与纵向浏览成本。

本阶段以不改变数据契约和安全边界为前提，优化列表密度、分组层级和渐进展示，让高频管理动作更容易扫描，同时保持现有状态反馈和编辑流程。

## What Changes

- 将 Operation 列表改为紧凑列表行：以 Method、名称/ID、Path、Service Target、启用状态和现有操作按钮组成稳定的单行/可换行行布局，避免每项形成高卡片。
- 将 Service Target 列表改为紧凑列表行：保留环境、Endpoint 配置完整度、Operation 数量、启用/Agent 状态和现有编辑/删除入口，但减少重复卡片内边距与垂直留白。
- 将设置页主要区域组织为清晰的分组或可折叠区域，并定义合理的默认展开策略；用户主动展开/收起的状态在组件生命周期内保持。
- 为 Operation 和 Service Target 列表增加渐进展示：数量超过阈值时先展示有限条目，并提供“显示全部/收起”或等价的可访问操作；操作后不改变底层列表数据和编辑语义。
- 保留现有编辑、新建、启用/禁用、删除、加载、局部加载错误、保存错误、重试、未保存草稿和确认对话框交互。
- 继续使用 DSH 主题令牌、现有键盘/焦点语义、容器响应式布局和 Host 权威的安全边界。

## Capabilities

### New Capabilities

- `plugin-settings-ui`: 为 API 套件插件设置页提供紧凑列表、分组/折叠和渐进展示，同时保持现有配置管理交互与可访问性。

### Modified Capabilities

<!-- No existing capability spec is present under openspec/specs/. -->

## Impact

- 主要影响：`lib/client.js` 中 `Settings` 的 Operation/Service Target 列表渲染、设置页分组容器和相关局部样式。
- 可能新增：仅限 Client 内部的列表展示状态（展开/收起）和稳定的列表行样式；不新增 RPC、请求参数或 Host 数据字段。
- 不影响：Host、RPC、Registry、Typert、API 请求、写确认/安全策略、连接测试、套件名称输入框及现有配置数据模型。
- 需要验证：列表增多时的首屏高度与扫描效率、显示全部/收起的键盘操作、320–375px 等窄容器、亮/暗主题、加载/错误/确认路径，以及长名称和长 Path 的换行行为。
