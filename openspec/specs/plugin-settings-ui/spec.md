## Purpose

为 API 套件设置页建立更高密度、更易扫描且可渐进浏览的管理体验，让大量 Operation 和 Service Target 不再造成卡片瀑布，同时不改变现有配置、安全与确认行为。

## Requirements

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

本次 UI 调整 MUST 保留现有编辑、新建、启用/禁用、删除、加载、空状态、局部加载错误、保存错误、重试、未保存草稿、删除确认和写策略确认交互。列表折叠、渐进展示或分组交互 MUST NOT 新增 API 请求、改变 RPC 参数/结果、改变 Registry 数据模型或绕过 Host 的最终校验和安全策略。OpenAPI 导入预览成功后，客户端 MUST 使 Tag 筛选与当前预览文档保持一致；不得继续使用当前文档不存在的 Tag 过滤可导入 Operation。筛选被自动修剪或清除时，页面 MUST 以可感知的简短提示说明筛选发生了变化及当前导入范围。

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

#### Scenario: 新预览保留仍有效的 Tag 筛选
- **WHEN** 用户已在文档 A 上选择多个 Tag，并成功预览文档 B，且其中部分 Tag 仍出现在文档 B
- **THEN** 客户端仅移除文档 B 不存在的 Tag，保留仍有效的 Tag，并按保留后的筛选计算可导入 Operation

#### Scenario: 新预览清除全部失效的 Tag 筛选
- **WHEN** 用户已在文档 A 上选择 Tag，并成功预览文档 B，且文档 B 不包含任何已选 Tag
- **THEN** 客户端清除失效筛选并恢复“不筛选”语义，页面显示短提示说明原筛选已失效且当前将按全部可导入 Operation 处理；用户不再因旧筛选而被困在零结果状态

#### Scenario: 筛选结果为零
- **WHEN** 当前预览存在可导入 Operation，但所选 Tag 过滤后没有任何匹配项
- **THEN** 页面明确说明当前筛选导致 0 个可导入 Operation，并指导用户清除 Tag 筛选或重新选择；确认导入动作保持不可用，直到存在可导入范围

### Requirement: 主题、键盘、响应式和安全边界保持兼容

紧凑列表和分组 MUST 继续消费现有 DSH 主题令牌及局部语义样式，不得以独立品牌色覆盖宿主主题。布局 MUST 适配现有设置容器的窄宽和宽屏断点，支持 Tab/Shift+Tab、Enter/Space、Escape 及可见 focus 状态；列表操作在窄容器中 MUST 仍可访问。设置页主要操作、OpenAPI 导入步骤操作和 Operation 行操作的可点击命中区 MUST 至少达到 44px 垂直高度。checkbox/radio MUST 保持独立的原生选择控件语义，同时其外围可点击标签 MUST 提供不低于 44px 的可操作高度或等价的点击区域。客户端 MUST 不新增直接 API 请求、任意 URL 输入、凭据/secret 处理、连接测试逻辑或安全策略修改。

#### Scenario: 主题或容器宽度变化
- **WHEN** 用户切换亮色/暗色主题，或在窄设置容器中查看页面
- **THEN** 列表行、分组控件、状态和边界仍具备清晰层级，无横向溢出且 focus 指示可见

#### Scenario: 仅使用键盘操作渐进列表
- **WHEN** 用户通过 Tab 定位到列表展示控制并按 Enter 或 Space
- **THEN** 页面展开或收起对应列表，控件的名称和状态对辅助技术可理解，且不触发与展示无关的网络请求

#### Scenario: 触控设备操作关键按钮
- **WHEN** 用户在触控设备或精度较低的指针设备上操作设置页、导入步骤或 Operation 行
- **THEN** 主要按钮、步骤按钮和行操作按钮均拥有至少 44px 的垂直命中区，且不会因增大命中区造成横向溢出

#### Scenario: 连接配置动作层级
- **WHEN** 用户展开连接配置并看到 Environment 与 Service Target 的创建动作
- **THEN** “添加 Environment”保留 primary 视觉层级，“添加 Service Target”使用 secondary 或 outline 层级，同时两个动作的功能和可用性保持不变

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

OpenAPI 导入区域的标题说明、三步导航和主要“校验并预览”动作 MUST 在设置容器缩窄时保持清晰的布局关系，不得通过 flex shrink 将步骤卡压缩成不可读的窄列。导入主要动作 MUST 在窄容器中拥有独立且可触达的布局空间；步骤按钮和状态文本 MUST 保持可读、可聚焦和可操作。导入步骤按钮的垂直命中区 MUST 至少达到 44px。

#### Scenario: 真实 DSH 设置宽度约 556px
- **WHEN** OpenAPI 导入卡位于约 556px 的设置容器中并展开
- **THEN** 标题说明、步骤导航和“校验并预览”按钮按窄容器布局分行或整行排列，步骤导航使用接近完整内容宽度，不会被压缩为约 59px 的竖向窄列

#### Scenario: 更窄容器中的导入步骤
- **WHEN** 导入卡处于 520px 以下的内容容器
- **THEN** 三步导航可降级为单列或其他等价的可读布局，主要动作和步骤按钮具有至少 44px 的垂直命中区域并不会引起横向滚动

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
