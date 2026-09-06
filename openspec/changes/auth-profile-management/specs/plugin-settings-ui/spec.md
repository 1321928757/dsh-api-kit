## MODIFIED Requirements

### Requirement: 设置区域支持分组或折叠并降低首屏高度

设置页 MUST 将导入、连接配置、Auth Profile 管理、套件与 Operation 等主要内容组织为语义清晰的分组或可折叠区域。首次进入时 MUST 采用能降低首屏纵向高度的默认展开策略，同时用户主动展开或收起的区域 MUST 在当前组件生命周期内保持，不因无关列表刷新而被重置。分组控件 MUST 对键盘和辅助技术可操作、可感知。

#### Scenario: 初次打开设置页
- **WHEN** 用户首次进入设置页且没有此前的分组交互状态
- **THEN** 页面显示标题和必要状态摘要，并仅默认展开当前最相关或需要用户开始操作的区域，其余导入、连接、Auth Profile 和工作台区域以可发现的折叠入口呈现

#### Scenario: 用户切换分组
- **WHEN** 用户使用鼠标或键盘展开/收起一个设置分组
- **THEN** 分组状态立即反映在视觉和语义属性中，后续刷新其他设置数据时该状态仍保持

### Requirement: 现有设置交互和状态语义保持不变

本次 UI 调整 MUST 保留现有编辑、新建、启用/禁用、删除、加载、空状态、局部加载错误、保存错误、重试、未保存草稿、删除确认和写策略确认交互，并为 Auth Profile 管理增加等价的草稿、凭据确认和引用保护语义。列表折叠、渐进展示、分组或 Auth Profile 交互 MUST NOT 新增直接 API 请求、改变既有 RPC 参数/结果、改变 Registry 数据模型或绕过 Host 的最终校验和安全策略。OpenAPI 导入预览成功后，客户端 MUST 使 Tag 筛选与当前预览文档保持一致；不得继续使用当前文档不存在的 Tag 过滤可导入 Operation。筛选被自动修剪或清除时，页面 MUST 以可感知的简短提示说明筛选发生了变化及当前导入范围。

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
- **THEN** 对应区域继续显示现有加载或错误反馈，Auth Profile 列表/凭据状态的失败不得清空或伪装为未配置，其他已成功加载的内容不因布局变化被清空

#### Scenario: 新预览保留仍有效的 Tag 筛选
- **WHEN** 用户已在文档 A 上选择多个 Tag，并成功预览文档 B，且其中部分 Tag 仍出现在文档 B
- **THEN** 客户端仅移除文档 B 不存在的 Tag，保留仍有效的 Tag，并按保留后的筛选计算可导入 Operation

#### Scenario: 新预览清除全部失效的 Tag 筛选
- **WHEN** 用户已在文档 A 上选择 Tag，并成功预览文档 B，且文档 B 不包含任何已选 Tag
- **THEN** 客户端清除失效筛选并恢复“不筛选”语义，页面显示短提示说明原筛选已失效且当前将按全部可导入 Operation 处理；用户不再因旧筛选而被困在零结果状态

#### Scenario: 筛选结果为零
- **WHEN** 当前预览存在可导入 Operation，但所选 Tag 过滤后没有任何匹配项
- **THEN** 页面明确说明当前筛选导致 0 个可导入 Operation，并指导用户清除 Tag 筛选或重新选择；确认导入动作保持不可用，直到存在可导入范围

#### Scenario: Auth Profile 草稿和凭据操作
- **WHEN** 用户编辑 Auth Profile、输入 secret、取消凭据确认或遇到 Host 校验/凭据服务错误
- **THEN** 页面按字段或全局显示可行动反馈，未确认或未成功提交的草稿不覆盖已保存安全视图，真实 secret 不出现在列表、错误、成功提示、普通 DOM 文本或日志中

### Requirement: 主题、键盘、响应式和安全边界保持兼容

紧凑列表、分组和 Auth Profile 表单 MUST 继续消费现有 DSH 主题令牌及局部语义样式，不得以独立品牌色覆盖宿主主题。布局 MUST 适配现有设置容器的窄宽和宽屏断点，支持 Tab/Shift+Tab、Enter/Space、Escape 及可见 focus 状态；列表和认证操作在窄容器中 MUST 仍可访问。设置页主要操作、OpenAPI 导入步骤操作、Operation 行操作和 Auth Profile 行操作的可点击命中区 MUST 至少达到 44px 垂直高度。checkbox/radio MUST 保持独立的原生选择控件语义，同时其外围可点击标签 MUST 提供不低于 44px 的可操作高度或等价的点击区域。客户端 MUST 不新增直接 API 请求、任意 URL 输入、凭据/secret 处理、连接测试逻辑或安全策略修改；secret 录入只能作为 Host credentials RPC 的不可回显输入。

#### Scenario: 主题或容器宽度变化
- **WHEN** 用户切换亮色/暗色主题，或在窄设置容器中查看 Auth Profile 列表和表单
- **THEN** 列表、分组、状态、敏感字段提示和边界仍具备清晰层级，无横向溢出且 focus 指示可见

#### Scenario: 仅使用键盘操作渐进列表
- **WHEN** 用户通过 Tab 定位到列表展示控制并按 Enter 或 Space
- **THEN** 页面展开或收起对应列表，控件的名称和状态对辅助技术可理解，且不触发与展示无关的网络请求

#### Scenario: 触控设备操作关键按钮
- **WHEN** 用户在触控设备或精度较低的指针设备上操作设置页、导入步骤或 Operation 行
- **THEN** 主要按钮、步骤按钮和行操作按钮均拥有至少 44px 的垂直命中区，且不会因增大命中区造成横向溢出

#### Scenario: 连接配置动作层级
- **WHEN** 用户展开连接配置并看到 Environment 与 Service Target 的创建动作
- **THEN** “添加 Environment”保留 primary 视觉层级，“添加 Service Target”使用 secondary 或 outline 层级，同时两个动作的功能和可用性保持不变

#### Scenario: 键盘操作 Auth Profile
- **WHEN** 用户通过 Tab、Enter、Space 或 Escape 操作 Auth Profile 的创建、编辑、启用/停用、凭据确认和删除流程
- **THEN** 页面正确更新展开、确认、busy、错误和焦点恢复状态，不触发与当前操作无关的网络请求

### Requirement: 表单和导入布局修复不改变现有配置与安全边界

本次表单与导入布局调整 MUST 只改变 Client 的局部展示样式、DOM 语义和响应式布局；新增 Auth Profile 管理 MUST 通过明确的 Host RPC 完成，不得由 Client 承担 Registry、凭据或网络安全职责。MUST 保留现有导入、编辑、新建、保存、删除、确认、错误、重试、未保存草稿、Host 校验和安全策略行为，不得改变既有 RPC 参数/结果、导入事务、Session activation、执行器或凭据/secret 处理边界。

#### Scenario: 表单保存和导入提交
- **WHEN** 用户从修复后的字段表单保存 Environment、Service Target、Operation，或确认 OpenAPI 导入
- **THEN** 现有业务调用、参数、确认和成功/错误反馈保持不变，控件样式与字段 ID 修复不改变提交数据语义

#### Scenario: Auth Profile 与现有连接配置协同
- **WHEN** 用户在 Auth Profile 管理区域创建或更新认证配置，再在 Service Target 或 OpenAPI 导入中选择该配置
- **THEN** 绑定列表显示安全摘要并使用既有 Host 校验；Client 不读取或拼接 secret，不改变既有连接配置和导入提交数据语义

#### Scenario: 既有安全边界
- **WHEN** 用户查看或编辑 Endpoint、认证配置和 OpenAPI Server 候选
- **THEN** 页面仍不直接发起连接测试或 API 请求，不展示 secret/token/Authorization，不将任意 URL 变成执行目标，并继续由 Host 执行最终安全校验
