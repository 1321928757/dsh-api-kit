## MODIFIED Requirements

### Requirement: API Kit 输入栏选择器使用 DSH 原生 scope chip 语言

`conversation.input.left` 中的 API Kit 会话选择器 MUST 以轻量、紧凑的 DSH scope chip 作为视觉表面，而不是使用突出的独立表单式描边矩形。选择器 MUST 保留至少 44px 的垂直可点击命中区，并在该命中区内展示与 API/工具语义相关的 SVG 图标、当前选择摘要和可识别的下拉 chevron。图标和 chevron MUST 使用当前 DSH 可用的官方 primitives；当可选 primitive 在兼容宿主中不可用时，等价的插件内 `currentColor` SVG 降级 MUST 保持相同的语义、尺寸和可访问性。

#### Scenario: 空选择状态
- **WHEN** 当前会话没有激活 API Kit 或 Environment
- **THEN** 选择器以紧凑的默认摘要呈现，并同时显示 API 语义图标和展开 chevron；它仍然是至少 44px 高的可聚焦按钮，可打开现有选择弹窗

#### Scenario: 已选择状态与输入栏协调
- **WHEN** 当前会话存在一个或多个已激活 API Kit，且可能已选择 Environment
- **THEN** 选择器使用轻量的 DSH surface、pill 形状和次级文字层级表达 scope chip，不使用强描边或高对比独立白底，并与输入栏中的其他范围/模型控件保持紧凑视觉密度

#### Scenario: 窄输入栏工具行
- **WHEN** 输入栏工具行处于 320px 至 560px 的窄容器，或宿主字体规则发生变化
- **THEN** 选择器的可见摘要保持单行、可截断且不会因长 Kit/Environment 名称换行撑高工具行；选择器及其内部内容不得造成横向溢出

### Requirement: API Kit 选择器摘要和辅助名称反映当前作用域

选择器在输入栏中 MUST 使用稳定、紧凑的单行摘要：无 Kit 时显示默认 API Kit 文案，单个 Kit 时显示 Kit 名称，多 Kit 时显示一个 Kit 名称和其余 Kit 数量；存在 Environment 时可追加紧凑的环境摘要。完整 Kit/Environment 名称、生产环境标识和失效状态 MUST 通过 `title`、动态 `aria-label` 或现有弹窗摘要保持可获得。`aria-label` MUST 按弹窗关闭时的已提交作用域或弹窗打开时的草稿作用域同步更新，并说明用户可点击修改选择。

#### Scenario: 单 Kit 和 Environment 摘要
- **WHEN** 当前作用域包含一个 Kit 和一个 Environment
- **THEN** 输入栏摘要以单行紧凑形式表达类似 `RPA · demo` 的信息，完整环境名称和状态仍可通过辅助名称或打开弹窗获得

#### Scenario: 多 Kit 摘要
- **WHEN** 当前作用域包含多个 Kit
- **THEN** 输入栏摘要以类似 `RPA + 2` 的形式表达额外 Kit 数量，而不是渲染所有 Kit 名称；辅助名称说明首个 Kit 及另外多少个 Kit，并在存在 Environment 时说明该环境

#### Scenario: 动态 accessible name
- **WHEN** 用户通过读屏器或辅助技术查看空选择、单 Kit、多 Kit、生产 Environment 或失效选择状态
- **THEN** 选择器的 `aria-label` 反映当前状态、作用域摘要和“点击修改”动作，不始终重复一个无法说明当前选择的固定标签

### Requirement: API Kit 选择器的展开和交互状态可感知

选择器 MUST 将默认、hover、focus-visible、active-selection、expanded、loading/disabled 和 invalid 状态映射到 DSH 语义 token 或等价的兼容 fallback。`aria-expanded` MUST 与弹窗打开状态保持同步；打开时选择器 MUST 有轻微 active/expanded 表面变化，chevron MUST 提供方向或其他等价的展开反馈。现有点击、Enter/Space、Escape、外部点击、弹窗焦点进入和关闭后焦点恢复行为 MUST 保持不变。

#### Scenario: 打开选择器
- **WHEN** 用户点击选择器或将其聚焦后按 Enter/Space 打开弹窗
- **THEN** 选择器进入可见的 expanded 状态，`aria-expanded` 为 true，chevron 和 surface 反映已展开，焦点进入现有弹窗可操作区域

#### Scenario: 关闭并恢复焦点
- **WHEN** 用户按 Escape、点击外部区域或使用弹窗关闭动作关闭选择器
- **THEN** 弹窗关闭、选择器恢复默认或已选择状态的视觉表达，且焦点恢复到触发按钮；不得因视觉改造丢失现有 draft/committed 语义

#### Scenario: 加载和失效状态
- **WHEN** 作用域正在加载、按钮不可用或 Host 返回当前选择失效/错误
- **THEN** 选择器保留可理解的加载/禁用/修复文案和可见状态，防止重复操作，并继续把详细错误或修复路径交给现有弹窗/状态反馈

### Requirement: 输入栏选择器视觉改造保持 API Kit 和安全边界不变

本次选择器视觉、摘要和语义改造 MUST 只改变 Client 的局部 DOM、样式和可访问性表达。MUST 保留现有 Session activation RPC、请求代次保护、draft/committed 选择逻辑、弹窗内容、焦点管理、Host 校验、Registry 数据模型和安全视图；不得新增直接 API 请求、任意 URL、凭据/secret 处理、连接测试或执行目标。

#### Scenario: 修改当前会话选择
- **WHEN** 用户在选择器弹窗中选择 Kit/Environment 并应用或清除当前会话范围
- **THEN** 仍使用既有会话选择调用和成功/错误反馈，输入栏摘要及 `aria-label` 在提交成功后同步到已提交作用域

#### Scenario: 保持安全视图
- **WHEN** 选择器显示当前 Kit/Environment 摘要
- **THEN** 输入栏和其辅助名称不显示 base URL、Host/CIDR、凭据引用、token、secret 或其他超出安全投影的数据
