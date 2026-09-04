## MODIFIED Requirements

### Requirement: 表单控件具有一致且可读的尺寸与主题样式

API 套件设置页中所有用于输入或选择业务值的普通 text/search input、select 和 textarea MUST 在其实际字段上下文中呈现一致的 DSH 主题化控件样式。普通 input 和 select MUST 具有约 40px 的可用高度，普通 textarea MUST 具有至少 112px 的初始高度；OpenAPI 文档输入框 MAY 使用更高的专用尺寸。控件 MUST 使用插件局部的宽度、边框、内边距、字体、背景、文字和 focus 语义，不得因是否嵌套在某一种表单容器中而回退到浏览器默认样式。checkbox 和 radio MUST 保持独立的选择控件语义与尺寸，不得被普通控件规则拉伸或覆盖。

#### Scenario: Environment 和 Service Target 字段保持统一高度

- **WHEN** 用户打开 Environment、Service Target 或其 Endpoint 编辑器
- **THEN** 普通 text input、select 和 textarea 均使用统一的可读高度、内边距、边框和 DSH 主题样式，且 checkbox 不受普通 input 高度规则影响

#### Scenario: Operation 和导入配置字段保持统一高度

- **WHEN** 用户打开 Operation 编辑器或 OpenAPI 导入配置
- **THEN** Method、Service Target、Environment、Auth Profile、名称和其他普通 select/input 使用统一控件样式，JSON/说明 textarea 使用独立但可读的最小高度，OpenAPI 原文输入框仍可保留更高的专用展示尺寸

#### Scenario: 控件处于窄设置容器

- **WHEN** 设置页位于约 556px 或更窄的宿主容器中
- **THEN** 普通控件不会被 flex/grid 拉伸成多行异常高度，也不会因宽度不足产生非预期横向滚动；长值继续在可用宽度内处理

### Requirement: 动态表单字段具备稳定且唯一的可访问性关联

设置页中每个业务输入控件 MUST 具有在当前页面和当前动态编辑上下文中唯一且稳定的 DOM ID。可见 label MUST 关联到对应控件；字段帮助和错误信息（如存在） MUST 仅关联到该字段对应的控件。ID 不能只由中文展示 label 的 ASCII 归一化结果生成，也不能因组件重新渲染而无故改变。重复的 Environment Endpoint 字段 MUST 包含能区分环境上下文的稳定标识。

#### Scenario: 中文字段同时出现

- **WHEN** Environment、Target、Operation 或其他表单中存在多个中文 label 字段
- **THEN** 每个控件均具有不同的稳定 ID，不会生成重复的 `dsh-api-kit-field--`，每个 label 的 `for` 属性只指向自己的控件

#### Scenario: 动态 Endpoint 字段重复渲染

- **WHEN** 一个 Service Target 绑定多个 Environment 并展开多个 Endpoint 编辑器
- **THEN** 每个 Environment 的 baseUrl、timeout 和高级网络策略字段均具有带环境上下文的唯一 ID，帮助/错误关联不会跨 Environment 串联

#### Scenario: 字段状态发生变化

- **WHEN** 用户修改字段、触发校验错误、重新渲染列表或切换相关折叠区域
- **THEN** 控件 ID 及其 label/help/error 关联保持不变，辅助技术和键盘焦点不会因为普通状态更新而指向错误字段

### Requirement: OpenAPI 导入 header 在窄容器中保持可扫描布局

OpenAPI 导入区域的标题说明、三步导航和主要“校验并预览”动作 MUST 在设置容器缩窄时保持清晰的布局关系，不得通过 flex shrink 将步骤卡压缩成不可读的窄列。导入主要动作 MUST 在窄容器中拥有独立且可触达的布局空间；步骤按钮和状态文本 MUST 保持可读、可聚焦和可操作。

#### Scenario: 真实 DSH 设置宽度约 556px

- **WHEN** OpenAPI 导入卡位于约 556px 的设置容器中并展开
- **THEN** 标题说明、步骤导航和“校验并预览”按钮按窄容器布局分行或整行排列，步骤导航使用接近完整内容宽度，不会被压缩为约 59px 的竖向窄列

#### Scenario: 更窄容器中的导入步骤

- **WHEN** 导入卡处于 520px 以下的内容容器
- **THEN** 三步导航可降级为单列或其他等价的可读布局，主要动作具有足够命中区域并不会引起横向滚动

#### Scenario: 键盘操作导入流程

- **WHEN** 用户通过 Tab、Enter 或 Space 操作导入步骤和校验动作
- **THEN** 步骤状态、焦点指示和按钮可用性正确反映当前流程，布局调整不改变现有预览、错误、重试和确认行为，也不触发额外的网络请求

### Requirement: 表单和导入布局修复不改变现有配置与安全边界

本次表单与导入布局调整 MUST 只改变 Client 的局部展示样式、DOM 语义和响应式布局。MUST 保留现有导入、编辑、新建、保存、删除、确认、错误、重试、未保存草稿、Host 校验和安全策略行为，不得新增 RPC 或直接 API 请求，不得改变 RPC 参数/结果、Registry 数据模型、导入事务或凭据/secret 处理。

#### Scenario: 表单保存和导入提交

- **WHEN** 用户从修复后的字段表单保存 Environment、Service Target、Operation，或确认 OpenAPI 导入
- **THEN** 现有业务调用、参数、确认和成功/错误反馈保持不变，控件样式与字段 ID 修复不改变提交数据语义

#### Scenario: 既有安全边界

- **WHEN** 用户查看或编辑 Endpoint、认证配置和 OpenAPI Server 候选
- **THEN** 页面仍不直接发起连接测试或 API 请求，不展示 secret/token，不将任意 URL 变成执行目标，并继续由 Host 执行最终安全校验
