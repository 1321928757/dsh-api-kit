## Purpose

为 API 套件设置页建立更高密度、更易扫描且可渐进浏览的管理体验，让大量 Operation 和 Service Target 不再造成卡片瀑布，同时不改变现有配置、安全与确认行为。

## ADDED Requirements

### Requirement: Operation 列表使用紧凑行布局

设置页 MUST 以紧凑列表行呈现当前 API 套件中的 Operation，而不是为每个 Operation 展示高纵向卡片。每一行 MUST 保留用户识别和管理该 Operation 所需的 Method、名称或 operationId、Path、Service Target、启用状态，以及现有的启用/禁用、编辑和删除操作；长文本 MUST 在可用宽度内换行或以不破坏布局的方式截断。

#### Scenario: 展示多个 Operation
- **WHEN** 当前 API 套件包含多个 Operation 且列表数据加载成功
- **THEN** 页面以连续、紧凑且可扫描的列表行展示它们，并且每行的现有管理操作仍可用

#### Scenario: Operation 名称或 Path 很长
- **WHEN** Operation 名称、operationId、Path 或 Service Target 名称超过当前容器宽度
- **THEN** 文本不会撑破设置区域或产生非预期横向滚动，用户仍能通过可见文本或辅助语义识别该项

### Requirement: Service Target 列表使用紧凑行布局

设置页 MUST 以紧凑列表行呈现 Service Target。每一行 MUST 保留环境绑定、Endpoint 配置完整度、关联 Operation 数量、启用/禁用状态、Agent 可用状态及现有编辑和删除操作；真实 Endpoint、Host/CIDR、凭据或其他敏感值 MUST NOT 因布局调整而暴露到不该展示的客户端界面。

#### Scenario: 展示多个 Service Target
- **WHEN** Service Target 列表数据加载成功且包含多个目标
- **THEN** 页面以低垂直占用的列表行呈现每个目标，并继续提供编辑和删除入口及已有状态摘要

#### Scenario: Service Target 列表加载失败
- **WHEN** Service Target 请求失败或仅部分设置数据加载成功
- **THEN** 页面保留现有错误提示和重试路径，不把失败列表伪装为空列表或成功状态

### Requirement: 设置区域支持分组或折叠并降低首屏高度

设置页 MUST 将导入、连接配置、套件与 Operation 等主要内容组织为语义清晰的分组或可折叠区域。首次进入时 MUST 采用能降低首屏纵向高度的默认展开策略，同时用户主动展开或收起的区域 MUST 在当前组件生命周期内保持，不因无关列表刷新而被重置。分组控件 MUST 对键盘和辅助技术可操作、可感知。

#### Scenario: 初次打开设置页
- **WHEN** 用户首次进入设置页且没有此前的分组交互状态
- **THEN** 页面显示标题和必要状态摘要，并仅默认展开当前最相关或需要用户开始操作的区域，其余大块区域以可发现的折叠入口呈现

#### Scenario: 用户切换分组
- **WHEN** 用户使用鼠标或键盘展开/收起一个设置分组
- **THEN** 分组状态立即反映在视觉和语义属性中，后续刷新其他设置数据时该状态仍保持

### Requirement: 大列表支持渐进展示

当 Operation 或 Service Target 列表数量超过产品定义的初始展示阈值时，页面 MUST 默认只展示有限条目，并提供清晰的“显示全部”和等价的“收起”操作。该操作 MUST 是真实可聚焦的控件，具有可理解的 accessible name，并在键盘操作后更新展示状态；数量不超过阈值时无需展示多余的展开控件。

#### Scenario: Operation 超过初始阈值
- **WHEN** 当前套件的 Operation 数量超过初始展示阈值
- **THEN** 页面先展示阈值内的 Operation，并显示剩余数量和“显示全部”入口；激活后展示所有 Operation

#### Scenario: Service Target 超过初始阈值
- **WHEN** Service Target 数量超过初始展示阈值
- **THEN** 页面先展示阈值内的 Service Target，并显示剩余数量和“显示全部”入口；激活后展示所有 Service Target

#### Scenario: 收起已展开列表
- **WHEN** 用户在已显示全部的列表上激活“收起”或等价操作
- **THEN** 列表恢复初始展示数量，且焦点仍位于可用的列表展示控制附近，不丢失当前编辑草稿或选择状态

### Requirement: 现有设置交互和状态语义保持不变

本次 UI 调整 MUST 保留现有编辑、新建、启用/禁用、删除、加载、空状态、局部加载错误、保存错误、重试、未保存草稿、删除确认和写策略确认交互。列表折叠、渐进展示或分组交互 MUST NOT 新增 API 请求、改变 RPC 参数/结果、改变 Registry 数据模型或绕过 Host 的最终校验和安全策略。

#### Scenario: 从紧凑行编辑 Operation
- **WHEN** 用户在任一已展示的 Operation 行上选择编辑并修改表单
- **THEN** 现有编辑器、未保存提示、保存/取消行为和必要确认继续按原有语义工作

#### Scenario: 从紧凑行禁用或启用 Operation
- **WHEN** 用户激活 Operation 行上的启用或禁用操作
- **THEN** 页面保留原有 busy、成功或错误反馈，并通过既有设置更新流程完成状态变更

#### Scenario: 从紧凑行删除 Service Target
- **WHEN** 用户激活 Service Target 行上的删除操作
- **THEN** 现有影响摘要、删除确认、错误重试、Escape/取消和 Host 引用校验行为保持不变

#### Scenario: 设置数据正在加载
- **WHEN** 页面首次加载、刷新或某一设置集合请求失败
- **THEN** 对应区域继续显示现有加载或错误反馈，其他已成功加载的内容不因列表布局变化而被清空

### Requirement: 主题、键盘、响应式和安全边界保持兼容

紧凑列表和分组 MUST 继续消费现有 DSH 主题令牌及局部语义样式，不得以独立品牌色覆盖宿主主题。布局 MUST 适配现有设置容器的窄宽和宽屏断点，支持 Tab/Shift+Tab、Enter/Space、Escape 及可见 focus 状态；列表操作在窄容器中 MUST 仍可访问。客户端 MUST 不新增直接 API 请求、任意 URL 输入、凭据/secret 处理、连接测试逻辑或安全策略修改。

#### Scenario: 主题或容器宽度变化
- **WHEN** 用户切换亮色/暗色主题，或在窄设置容器中查看页面
- **THEN** 列表行、分组控件、状态和边界仍具备清晰层级，无横向溢出且 focus 指示可见

#### Scenario: 仅使用键盘操作渐进列表
- **WHEN** 用户通过 Tab 定位到列表展示控制并按 Enter 或 Space
- **THEN** 页面展开或收起对应列表，控件的名称和状态对辅助技术可理解，且不触发与展示无关的网络请求
