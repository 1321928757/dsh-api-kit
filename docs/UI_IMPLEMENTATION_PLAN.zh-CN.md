# dsh-api-kit UI 调整实施文档

- **项目**：dsh-api-kit
- **目标**：将当前“功能平铺”的设置页和会话选择器，调整为作用域清晰、风险可见、流程分阶段、可在真实 DSH Web 中验证的 API 套件工作台。
- **适用版本**：当前 `0.1.0` profile bundle；客户端入口为 [`../lib/client.js`](../lib/client.js)。
- **文档状态**：UI-08 进行中；已完成真实挂载与部分视觉/键盘验收，仍需发布前完整失败路径和主题矩阵。
- **创建日期**：2026-08-30
- **当前 UI 基线**：T13 客户端合同、主题/响应式/键盘基础已完成；T14 Host 写操作、确认意图和 OAuth 能力已完成；UI-08 已完成最新 bundle 的真实 3080 挂载、桌面/窄屏无横溢出、删除 dialog 键盘 trap 和无 console/page error 验收，完整主题/失败路径矩阵仍待完成。
- **相关文档**：[`IMPLEMENTATION_PLAN.zh-CN.md`](./IMPLEMENTATION_PLAN.zh-CN.md)、[`REQUIREMENTS.zh-CN.md`](./REQUIREMENTS.zh-CN.md)、[`README.zh-CN.md`](../README.zh-CN.md)

> 本文档是 UI 调整实施计划，不等同于已完成的代码变更。除非任务明确要求，先按子任务逐项实施、测试并更新状态，不要一次性重写整个客户端。

---

## 1. 如何在后续会话中使用

每次继续工作时按以下顺序执行：

1. 阅读本文件的“当前进度”和目标子任务。
2. 阅读 `lib/client.js` 对应源码区段；如涉及 Host/RPC，不要凭猜测改变业务契约。
3. 只选择一个主子任务作为本次会话目标，除非该任务明确包含串行的小步骤。
4. 实现前确认当前 DSH 运行时的 Slot、Remote、primitive、theme token 和 Client 注入契约；不能把参考插件的旧契约直接复制过来。
5. 完成后运行该子任务的静态检查、合同测试和全量回归；能启动隔离 Profile 时再做真实 Web 验收。
6. 更新本文件的状态、实际改动、测试结果、遗留问题和下一步。
7. 不要因为 UI 任务顺手修改 Host 的写执行、OAuth、SSRF、审计或 Registry 语义；若发现业务契约缺口，单独记录为阻塞/后续任务。

状态取值：

- `未开始`：尚未实现；
- `进行中`：当前会话正在处理；
- `阻塞`：存在明确外部阻塞，并记录解除条件；
- `已完成`：代码、测试和该子任务验收均完成；
- `延期`：有意延后，不代表已实现。

---

## 2. 当前实现基线与审查结论

### 2.1 已有能力（应保留）

当前 [`lib/client.js`](../lib/client.js) 已实现以下基础，不应在 UI 重构中回退：

- 使用 `window.__ModuleLoader__.load` 加载发布版客户端；Client 通过 `remote.api-kit` 调用 Host，不在浏览器直接请求 API。
- 使用已确认的 `conversation.input.left` 和 `settings.section` Slot。
- 会话选择器支持多 Kit、一个共同 Environment、生产环境标识、失效错误/警告、清除/应用、Escape、外部点击关闭和焦点恢复。
- 设置页已有 Kit/Operation/Service Target/Environment 的读取、创建、编辑、删除和刷新入口。
- OpenAPI JSON 已支持“粘贴 → 预览 → 绑定 → 冲突处理 → 确认导入”的业务闭环，Host 侧会重新解析并原子提交。
- 已有 mounted/request-generation guard，刷新期间尽量保留旧数据；绑定列表支持部分失败和重试；JSON 字段错误会保留草稿。
- 已有 `focus-visible`、ARIA 状态/错误播报、`fieldset/legend`、`aria-expanded`/`aria-controls`/`aria-modal`、44px 级主要控件、720px/520px 响应式和 reduced-motion 基础。
- 样式已经使用 DSH 主题变量及 `color-mix` fallback；普通设置卡使用 flat surface 和边框，不应重新引入独立品牌色或重装饰。
- 写操作默认关闭；T14 的 Host-only confirmation/OAuth 边界必须继续由 Host 负责，浏览器不得持有 secret、token、任意 URL 或审批逻辑。

### 2.2 当前主要问题（按优先级）

| 优先级 | 问题 | 当前代码/表现 | UI 调整方向 |
|---|---|---|---|
| P0 | 作用域混淆 | Kit、Operation、Service Target、Environment 同时出现，但关系主要靠段落说明 | 增加关系说明和上下文摘要，统一用户术语 |
| P0 | 会话有效范围不透明 | 选择器只有 Kit/Environment 控件；用户看不到最终可发现、只读、写操作范围 | 增加“当前会话范围”摘要、共同环境失败解释和修改入口 |
| P0 | 写操作风险分层不足 | Operation 编辑器四个 checkbox 并列 | 分成基础状态、Agent 权限、调用安全策略；勾选写操作后显示影响和保存前二次确认 |
| P0 | 导入像长表单 | `OpenApiImportPanel` 在同一面板中连续显示 JSON、预览、绑定、冲突和导入按钮 | 视觉上分成 1 检查文档、2 配置导入、3 确认变更；状态和按钮按步骤显隐 |
| P0 | `multiple select` 可理解性差 | Tag、默认 Kit、Environment 绑定使用原生 `<select multiple>` | 改为 checkbox/chip 列表，提供数量、全选/清除和禁用原因 |
| P1 | 设置页信息架构平铺 | 导入、连接、空白创建、Workbench 依次展开 | 采用“总览 → 导入 API → 连接配置 → 套件与 Operation → 高级设置”的分组/Disclosure |
| P1 | Environment/Target 并列 | `.dsh-api-kit-connection-grid` 默认两栏，Target 又依赖 Environment | 改为纵向创建顺序；Endpoint 分环境折叠，当前环境优先展开 |
| P1 | Operation 编辑过长 | 基本信息、JSON 和权限全部垂直堆叠 | 基本信息、请求定义、响应定义、Agent 权限与安全四组 Disclosure |
| P1 | 未保存和连接状态不明显 | 只有通用 busy/error/notice；无明确 dirty footer、连接测试入口 | 增加 dirty 状态、sticky action bar、就地 retry 和连接测试设计 |
| P2 | 冲突处理与详情不足 | 每项一个 select，无批量决策和差异摘要 | 增加批量决策、变化摘要；字段级 diff 作为后续增强 |
| P2 | 删除反馈过于通用 | 多处使用 `window.confirm` | 替换为 DSH 风格确认层；显示引用影响和可恢复动作（底层支持时） |

### 2.3 关键现有源码锚点

后续会话可直接从这些位置开始定位；行号会随实现变化，应以字符串/组件名为主：

- RPC 描述和方法清单：`RPC_METHODS`、`descriptorSpec`、`CONTRIBUTION`。
- 样式入口：`const styles = \``；重点是 `.dsh-api-kit-settings`、`.dsh-api-kit-workbench`、`.dsh-api-kit-popover`、`.dsh-api-kit-connection-grid`。
- 会话选择器：`function ApiKitControl(props)`。
- 导入流程：`function OpenApiImportPanel()`；尤其是 `runPreview`、`confirm`、`selectedOperations`、`conflictsReady`。
- 设置页：`function Settings()`；尤其是 `refresh`、`editOperation`、`saveOperation`、`remove*`、`endpointFields`。
- 当前多选入口：Tag 筛选、默认 API Kit、绑定 Environment。
- 当前通用确认入口：导入确认、删除 Environment/Target/Kit/Operation。
- Slot 注册：末尾的 `slots.register({ name: 'conversation.input.left' ... })` 和 `slots.register({ name: 'settings.section' ... })`。

---

## 3. 产品目标、非目标与设计原则

### 3.1 产品目标

用户在任何关键操作前都应能回答四个问题：

1. **我正在选择什么？** 是 API 套件、某个 Operation、服务目标还是逻辑环境。
2. **Agent 最终能使用什么？** 当前会话激活的 Kit、共同 Environment、可发现/只读/写 Operation 数量是什么。
3. **请求会发往哪里？** Operation 绑定 Service Target；Service Target 在所选 Environment 下提供 endpoint。OpenAPI `servers[].url` 只用于展示，不能直接成为执行目标。
4. **保存或导入会改变什么？** 影响哪些 Operation、Kit、Environment、权限和冲突项，失败后如何恢复。

### 3.2 非目标

本轮 UI 调整不包含：

- 修改 Registry schema、Host 配置门面、HTTP 执行器、SSRF/DNS、OAuth2 token 解析、审计字段或写确认绑定规则；
- 新增任意 URL 请求、浏览器端凭据处理、模型审批工具、自动重定向或绕过 Host 安全策略；
- 自动信任 OpenAPI Server、自动创建 Environment 或自动导入 secret；
- 立即实现 YAML/URL/Git 导入、multipart、SSE/WebSocket 或独立 MCP Server；
- 用独立 React 应用、Tailwind、shadcn、全局 `body/#root` 样式覆盖 DSH Web；
- 为追求截图像素相似而引入渐变、玻璃拟态、强阴影、emoji 图标或独立 palette。

### 3.3 设计原则

1. **先表达关系，再表达装饰**：页面层级围绕 Kit → Operation → Service Target → Environment。
2. **一个区域一个主要动作**：导入、连接配置、Operation 编辑和删除确认各自只有一个 Primary/Destructive 主动作。
3. **安全默认、风险可见**：写操作默认关闭；生产、内网、覆盖导入和删除都显示后果，不只使用颜色。
4. **渐进披露**：常用字段默认展示，高级网络策略、JSON 高级模式、权限策略和诊断默认折叠但保留摘要。
5. **旧数据不消失**：刷新和异步请求保留旧列表、草稿、选择和滚动上下文；局部失败只影响局部区域。
6. **宿主一致性**：优先 DSH primitives 和已确认 token；插件 CSS 只负责局部布局和领域内容。
7. **可访问性先于视觉复刻**：键盘、焦点、语义、错误关联和 reduced-motion 必须在 happy path 之外成立。
8. **Host 是权威**：客户端只呈现安全视图和草稿；任何保存/导入前的最终校验仍由 Host 执行。

---

## 4. 统一术语和作用域模型

### 4.1 面向用户的术语

| 内部标识/旧文案 | 统一 UI 文案 | 说明 |
|---|---|---|
| API Kit / API Kit | API 套件 | 一组经过筛选和授权、可供 Agent 使用的 Operation |
| Operation | Operation / API 操作 | 一个 method + path + 参数/请求体/响应定义 |
| Service Target | 服务目标 | 一个逻辑业务服务；为每个 Environment 提供独立 endpoint |
| Environment | 环境 | `dev`、`test`、`staging`、`production` 等逻辑部署阶段 |
| Endpoint | 环境地址 / Endpoint | 某个服务目标在某个环境下的执行地址及网络策略 |
| Agent 可用 | 允许 Agent 发现和调用 | 不是“已启用”的同义词 |
| `allowWrite` | 允许写操作 | 只代表副作用权限，仍受 Kit、Environment、Host 和确认门约束 |
| `requiresConfirmation` | 调用前需要人工确认 | 安全护栏，不等于允许写操作 |
| `servers[].url` | Server 候选（仅展示） | 不可信执行目标，不自动创建 Environment |

UI 不应继续使用 `Environment Endpoint · demo环境` 这类混排标题。建议使用：

- `demo 环境的 Endpoint`；
- `环境地址：demo`；
- `服务目标“订单服务” · demo 环境`。

### 4.2 关系说明组件

设置页顶部新增一块轻量关系说明，不采用复杂图表：

```text
API 套件
  └─ 包含多个 Operation
       └─ 每个 Operation 绑定一个服务目标
            └─ 服务目标在不同环境拥有不同 Endpoint

当前示例：RPA 套件 → 查询订单 → 订单服务 → demo 环境
```

旁边增加一条“当前示例”摘要卡：

```text
RPA 套件
2 个 Operation · 1 个只读 · 1 个写操作
        ↓
订单服务
 demo  https://（仅在 Host 中保存和执行）
 prod   已配置 / Agent 默认不可用
```

浏览器不显示真实 host、CIDR、secret 或 Authorization；示例中的地址只使用安全视图允许的脱敏摘要，若 Host 未提供摘要则显示“已配置”，不能自行拼接敏感数据。

### 4.3 会话有效范围摘要

输入栏按钮保留低认知负担摘要，同时增强状态表达：

| 状态 | 推荐显示 |
|---|---|
| 未选择 | `API 套件` |
| 单 Kit、非生产 | `RPA · demo 环境` |
| 多 Kit | `RPA + 2 个套件 · demo 环境` |
| 生产 | `RPA · 生产环境`，配合危险状态图标/文字 |
| 状态失效 | `API 套件需修复` |

点击后弹层增加“当前会话范围”：

```text
当前会话范围

API 套件
✓ RPA                         2 个 Operation
✓ 用户中心                    8 个 Operation

环境
✓ demo 环境

Agent 可发现
10 个 Operation · 8 个只读 · 2 个写操作
⚠ 1 个写操作需要人工确认

[修改选择]
```

具体统计必须来自 Host 返回的安全视图；若旧 Host 未提供字段，显示已有安全计数或“暂不可统计”，不能在 Client 猜测。

多 Kit 无共同环境时，优先显示原因而不是只把 `<option>` 禁用：

```text
当前套件没有共同可用环境
RPA：demo、test
用户中心：test、staging

请移除一个套件，或为服务目标补充共同环境配置。
```

---

## 5. 目标信息架构与线框

### 5.1 设置页推荐结构

```text
API 套件                                      [重新加载]
说明：配置 Agent 可发现的 API 能力和固定服务目标

[关系说明：Kit → Operation → Service Target → Environment]
[状态摘要：套件 / 可调用 / 只读 / 写 / 环境 / 配置问题]
[错误或成功状态（需要时）]

▾ 导入 API
  [步骤：1 检查文档 → 2 配置导入 → 3 确认变更]
  [JSON / 预览 / 绑定 / 冲突 / 确认]

▾ 连接配置
  1. 环境                         [添加环境]
     [Environment 列表]
  2. 服务目标                     [添加服务目标]
     [Service Target 列表]
     [编辑中的目标：Endpoint 按环境折叠]

▾ 套件与 Operation
  [套件列表] [当前套件详情]
  [Operation 列表]
  [Operation 编辑器 / sticky 保存栏]

▸ 安全与高级设置（若当前版本暂不支持，先不渲染空菜单）
```

实现上可以先使用同一 `settings.section`，通过 CSS/Disclosure 和状态控制重组内容；不要为了实现信息架构新建未经 Inspect 的 Slot 或路由。

默认展开策略：

- 没有 Kit：展开“导入 API”，显示“也可以创建空白套件”；
- 已有 Kit：默认展开“套件与 Operation”；
- 没有 Environment/Service Target：在导入步骤和连接配置顶部显示配置缺口，不强制用户在错误后重新寻找入口；
- 用户主动展开的组在本组件生命周期内保持，不因局部刷新重置。

### 5.2 顶部状态摘要

将当前三格 `API Kit / Operation / 已启用` 改为至少六项语义明确的统计：

```text
API 套件       1       可调用操作     2       只读操作       1
写操作         1       可用环境       2       配置问题       0
```

计数定义：

- **API 套件**：Registry 安全视图中可读 Kit 数量；
- **可调用操作**：启用、已关联 Kit、Agent 策略允许且具备必要绑定的 Operation 数量；
- **只读操作/写操作**：按 Operation method/policy 的安全视图统计，写操作仍不表示当前可直接联网；
- **可用环境**：启用且可供会话选择的 Environment 数量；
- **配置问题**：绑定缺失、失效引用、无 endpoint、无共同环境等可行动问题数量。

若当前 RPC 列表尚未提供其中某项，分两步实施：先用已有安全视图可证明的字段，不能把 `enabledOperationCount` 直接标记为“可调用操作”；再在独立兼容任务中扩展 Host 安全投影。

### 5.3 连接配置线框

```text
连接配置
环境决定部署阶段；服务目标为每个环境提供自己的 Endpoint。

1. 环境                                      [添加环境]
┌──────────────────────────────────────────────┐
│ demo 环境                         [编辑] [删除] │
│ 可用 · 非生产 · 2 个服务目标                   │
├──────────────────────────────────────────────┤
│ production                         [编辑] [删除] │
│ 可用 · 生产环境 · Agent 默认不可用             │
└──────────────────────────────────────────────┘

2. 服务目标                                  [添加服务目标]
┌──────────────────────────────────────────────┐
│ 订单服务                         [编辑] [删除] │
│ 已绑定：demo、production · 2 个 Operation      │
└──────────────────────────────────────────────┘

编辑服务目标
基本信息：ID、名称、说明
绑定环境：☑ demo  ☐ production
▾ demo 环境的 Endpoint
  Endpoint baseUrl *
  认证配置
  超时
  ▸ 高级网络策略
▸ production 环境的 Endpoint
[取消] [保存服务目标]
```

Service Target 依赖 Environment，视觉顺序应纵向表达。Endpoint 默认只展开当前编辑/缺失配置的环境；高级网络字段包括 Host、CIDR、私网、端口、响应大小、重定向次数等，安全语义不改变。

### 5.4 Operation 编辑器线框

```text
编辑 Operation · 未保存                         [关闭]

▾ 基本信息
  显示名称 *          operationId *
  [GET] [Path]        服务目标 *
  Tag                 摘要
  描述

▾ 请求定义
  Parameters                    [结构化编辑 | JSON 高级模式]
  Request Body                 [结构化编辑 | JSON 高级模式]

▾ 响应定义
  200  成功
  400  参数错误
  [JSON 高级模式]

▾ Agent 权限与安全
  Operation 状态
  [✓] Operation 已启用
  [✓] 允许 Agent 发现和调用

  访问类型
  (●) 只读   ( ) 可能修改数据
  [ ] 允许写操作
  [ ] 每次调用前需要人工确认

  [风险说明，仅在允许写操作时展开]
  Agent 可能通过此 Operation 修改业务数据；仍需通过 Kit、环境、Host
  安全策略和人工确认。

[尚有未保存修改]                         [取消] [保存 Operation]
```

第一版可以先实现分组/Disclosure和保留 JSON 高级模式；Parameters/Responses 的结构化编辑列为独立后续子任务，不能为了 UI 先改变内部 JSON 结构。

### 5.5 OpenAPI 三步线框

```text
导入 API
① 检查文档  →  ② 配置导入  →  ③ 确认变更

步骤 1：检查文档
[粘贴 OpenAPI/Swagger JSON]
[校验并预览]
OpenAPI 3.0 · 订单系统 API
2 个 Paths · 2 个 Operations · 1 个 Server 候选
提示：Server URL 仅用于展示，不会自动信任为执行地址。

步骤 2：配置导入
导入目标： (●) 新建 API 套件  ( ) 添加到现有套件
目标套件、Tag、Service Target、默认 Environment、Auth Profile
Tag： [全部] [order 12] [user 4]

步骤 3：确认变更
即将导入到：RPA
绑定服务目标：订单服务
默认环境：demo
新增 1 · 更新 1 · 跳过 0 · 冲突 0
写操作 1 个，默认禁止 Agent 调用
冲突处理：[全部保留本地] [全部覆盖] [全部跳过]

[返回配置] [取消] [导入到套件]
```

步骤状态必须同时有视觉和语义表达：使用 `aria-current="step"` 或等价的已确认 Slot/primitive 语义；不能只用颜色和数字。当前仍可在一个 React 组件内实现分步显示，不要求立即拆出新路由。

---

## 6. 分阶段任务拆分

> 推荐一次会话完成一个 UI 子任务。每个任务均给出前置条件、主要文件、实施要点和完成标准。若某任务需要 Host 数据字段，应先标记“兼容层/依赖 Host”，不要在客户端伪造统计。

### UI-00：运行时与基线复核

- **优先级**：P0，准备任务
- **状态**：已完成
- **依赖**：无
- **目标**：在改代码前确认当前 DSH Web 的 Slot、remote、官方 primitive、theme token 和客户端注入契约。
- **完成记录**：2026-08-30 已完成当前运行时 Inspect、客户端边界复核和静态/合同/全量回归基线；详见“2026-08-30 / UI-00”交接记录。
- **主要文件**：`lib/client.js`、`package.json`、`cordis.patch.yml`；必要时隔离 Profile。
- **步骤**：
  1. 用当前运行时 Inspect 查询 `settings.section`、`conversation.input.left`、Client 可用 primitives/theme/tool 相关 Provider。
  2. 记录 Slot scope、props、register 必填项；维持当前 `sessionId` 读取方式和 `dsh-api-kit`/`api-kit` ID。
  3. 确认官方 Button/Modal/Menu/Disclosure/Toast 是否可用；若不可用，使用插件前缀 CSS + 原生语义元素的兼容实现，不引入第三方运行时。
  4. 记录亮色、暗色及可用 skin 的实际 token，确认 `--dsw-specific-menu` 等特定 token 不被当作普通面板背景。
  5. 保存一次当前合同测试和打包检查结果作为基线。
- **完成标准**：形成会话交接记录；未使用未经确认的 Slot、Service、primitive、token；无代码回退。

### UI-01：统一术语、关系说明与状态摘要

- **优先级**：P0
- **依赖**：UI-00
- **目标**：让用户理解 Kit、Operation、Service Target、Environment 的作用域，并把顶部统计改为“是否可用”导向。
- **主要文件**：`lib/client.js`，必要时新增 `test/client-contract.test.mjs` 合同断言。
- **实施要点**：
  - 增加 `safeCount`/安全视图兼容读取，缺字段时显示保守文案，不把未知当成 0。
  - 增加关系说明区和统计卡；所有文案统一为“API 套件、环境、服务目标、环境地址”。
  - `Operation`、`operationId`、`Path` 等技术字段可以保留，但在用户可理解的标题旁提供解释。
  - 统计卡使用 `font-variant-numeric: tabular-nums`，在窄容器下 3→2→1 列，不强制固定宽度。
- **验收**：无数据、部分数据失败、有 Kit/无 Kit、生产环境和长中文文案下层级清晰；不暴露 host/CIDR/secret。

### UI-02：会话选择器有效范围与共同环境诊断

- **优先级**：P0
- **依赖**：UI-00；建议 UI-01
- **目标**：让用户知道“当前会话最终激活了什么”。
- **主要文件**：`lib/client.js` 中 `ApiKitControl` 及 picker styles；必要时 `test/client-contract.test.mjs`。
- **实施要点**：
  - 保留原有多选、应用、清除、Escape、外部点击、焦点循环/恢复和 Host 权威校验。
  - 增加已选数量、可发现/只读/写操作摘要；字段不存在时显示“Host 未提供统计”，不自行推导危险权限。
  - Kit 卡片使用 listbox/option 或已确认等价语义，至少补充 `aria-selected`；不要把 `aria-current` 当作唯一选择语义。
  - 环境选项保留禁用状态，但旁边/下方增加不兼容原因和各 Kit 可用环境摘要。
  - 生产环境用文字、状态 icon 和语义色共同表达，不仅依赖红色。
  - 触发按钮右侧增加明确“修改”语义或设置 icon；icon-only 时提供 `aria-label`，不使用 emoji。
- **验收**：单 Kit、多 Kit、无共同环境、超过建议 Kit 数、失效激活、生产环境、空数据、加载失败、键盘和窄屏均可理解且可恢复。

### UI-03：替换关键 `multiple select`

- **优先级**：P0
- **依赖**：UI-00；与 UI-02、UI-04 可并行设计，但建议先完成 UI-02 的选择语义
- **目标**：把原生多选列表替换为可理解的 checkbox/chip 选择。
- **主要文件**：`lib/client.js`；可增加局部选择组件函数和样式。
- **实施要点**：
  - Tag：使用“全部 + Tag chip/checkbox”，显示数量，支持清除；长 Tag 可换行并可键盘操作。
  - 默认 API Kit：使用 checkbox list/card，显示已选择数量、搜索（Kit 较多时）、全选/清除；新建 Kit 模式明确显示“添加到现有套件时可配置”。
  - Service Target Environment 绑定：每个 Environment 是带状态说明的 checkbox row，显示可用/生产/已停用及禁用原因；保存前确保至少一个绑定。
  - 保留数组值和 RPC wire，不把 UI 选择顺序误当成业务顺序，使用稳定 ID 作为 key。
  - 当选项数量较大时再增加搜索，避免第一版引入不必要的复杂虚拟列表。
- **验收**：鼠标、键盘、触摸宽度、屏幕阅读器语义、已选数量、禁用原因、长名称和空列表均可用；`client-contract` 不再把关键 `select[multiple]` 作为主交互依赖。

### UI-04：OpenAPI 三阶段导入向导

- **优先级**：P0
- **依赖**：UI-00；依赖现有 `previewOpenApiImport`/`confirmOpenApiImport` 业务语义，不改 Host 事务协议
- **目标**：把当前长表单表达成“检查 → 配置 → 确认变更”的审查流程。
- **主要文件**：`lib/client.js` 中 `OpenApiImportPanel` 及样式；必要时增补客户端合同测试。
- **实施要点**：
  - 引入明确的本地 UI 状态：`input`、`preview`、`previewStale`、`importMode`、`bindingState`、`conflictState`、`confirming`、`result`；不把业务状态传给 Host 以外的地方。
  - Step 1 只突出 JSON、校验/预览、文档元数据、Server display-only 说明、错误和警告。
  - Step 2 只展示绑定、Tag、目标套件、默认 Environment/Auth Profile 和冲突策略；根据“新建/现有”模式隐藏无关字段。
  - Step 3 只展示变更摘要、写操作安全默认、冲突摘要和最终导入按钮；导入前仍保留一次有真实影响范围的确认层。
  - 冲突增加“全部保留本地/全部覆盖/全部跳过”；“覆盖”显示破坏性后果，逐项选择仍保留。
  - stale preview、局部绑定失败、空 Tag 结果、无 Target/Kit、无冲突和导入失败都有就地恢复动作。
  - 不把 Server URL 变成 endpoint，不自动创建 Environment，不在 Client 侧重新计算 Host 权限。
- **验收**：有效 JSON、无效 JSON、预览过期、无绑定、Tag 全部被过滤、冲突未处理、覆盖确认取消、原子导入失败和成功结果均可理解且可恢复；成功文案包含新增/更新/跳过/保留数量。

### UI-05：连接配置纵向信息架构与 Endpoint Disclosure

- **优先级**：P1
- **依赖**：UI-00、UI-01；若统计需要引用数，先确认 Host 安全视图字段
- **目标**：用“先环境、后服务目标”的纵向流程表达依赖关系，降低网络字段负担。
- **主要文件**：`lib/client.js` 的连接配置区、`.dsh-api-kit-connection-*` 样式。
- **实施要点**：
  - 不改变 Environment/Target CRUD RPC 参数和兼容迁移语义。
  - Environment 和 Service Target 使用两个纵向分组；只有当前区域的主按钮使用 primary，其余为 secondary。
  - Service Target 编辑器的绑定环境改成 checkbox rows；默认环境只列出已绑定环境。
  - Endpoint 按环境使用 Disclosure；默认展示 baseUrl、认证配置、超时，Host/CIDR、私网、端口、响应大小、重定向等进入“高级网络策略”。
  - 当前编辑环境、缺失 endpoint 或校验错误的 endpoint 自动展开；展开状态不因普通 refresh 重置。
  - 增加连接测试的 UI 位置和状态契约设计。若当前 Host 没有安全的测试 RPC，不伪造成功按钮；先将功能标为后续 UI-07。
- **验收**：320–768px 单列无溢出；Endpoint 长 URL 可换行；生产、私网和缺失 endpoint 有文字说明；编辑取消不覆盖列表；删除失败显示引用影响和 retry/查看引用入口（若数据可得）。

### UI-06：Operation 编辑器分组、dirty 状态与写风险确认

- **优先级**：P0（安全部分）/P1（表单分组）
- **依赖**：UI-00、UI-01；写确认展示必须符合 T14 Host 规则
- **目标**：让 Operation 基本定义、请求响应 schema 和 Agent 权限彼此分层，并在启用写操作时让影响范围可见。
- **主要文件**：`lib/client.js` 的 `newOperation`、`editOperation`、`saveOperation`、editor JSX/React.createElement 和相关样式。
- **实施要点**：
  - 基本信息：名称、operationId、Method + Path、Service Target、Tag、摘要、描述；编辑已有 Operation 时 ID 默认只读。
  - 请求定义：Parameters、Request Body Disclosure；第一版保留 JSON 高级模式，字段错误仍就地关联 `aria-invalid`/`aria-describedby`。
  - 响应定义：Responses Disclosure；在不改变 JSON wire 的前提下展示状态码摘要。
  - Agent 权限与安全：分为“Operation 状态”“Agent 权限”“访问类型/写操作保护”；保留 `enabled`、`allowAgentCall`、`allowWrite`、`requiresConfirmation` 的业务字段。
  - 只有勾选“允许写操作”后展开风险说明；若允许写操作但未开启人工确认，显示明确警告，而非自动悄悄替换策略。
  - 保存写策略前使用 DSH 风格确认内容：Operation 名称、method/path、Kit、Service Target、当前 Environment（若可确定）和“可能修改真实业务数据”的后果；确认只确认 UI 变更，不让 Client 自行批准 Host confirmation token。
  - 引入表单快照/dirty 判定；编辑标题显示“未保存”，底部 sticky action bar 显示取消和保存。离开、切换 Kit 或重新加载时先询问保留/放弃/取消；若宿主没有可用 Modal，使用可访问的局部 dialog 兼容实现。
  - 成功文案改为“Operation‘…’已更新，下次 Agent 调用时生效”。
- **验收**：四组可折叠且键盘可达；JSON 错误保留草稿；写操作开启/关闭和取消确认行为正确；重复保存被阻止；刷新/切换不会丢失未保存修改；不改变 Host 对写操作的最终门禁。

### UI-07：连接测试、失败恢复与删除确认层

- **优先级**：P1/P2，分两步
- **依赖**：UI-05、UI-06；连接测试需要 Host 提供已批准且复用 Agent 执行器的安全 RPC
- **目标**：提供安全可解释的连接测试和有引用影响的删除确认。
- **实施要点**：
  - 已复核 `lib/index.js`、`lib/typert.host.js`、`lib/configuration.js`、`lib/executor.js` 和客户端 RPC 描述；当前没有 `testConnection`、`probeTarget` 或 `healthCheck` 等安全连接测试 RPC，因此没有新增假按钮或 Client 网络请求。
  - 连接区已明确当前版本只保存配置，真实请求仍由 Host 在 Operation 调用时按固定 Target/Environment、allowlist/CIDR、SSRF、认证、超时、响应大小、重定向和审计策略校验。
  - 已用 Client 安全视图实现 Environment、Service Target、API Kit、Operation 的删除影响摘要；列表部分加载时显示未知，不伪造为 0，Host 仍是最终引用校验者。
  - 删除有已知引用、引用信息未知或 Operation dirty 草稿时要求输入“删除”；无已知引用时仍显示明确二次确认。
  - 删除对话框使用局部 dialog 语义，支持取消、Escape、outside click、Tab 循环、焦点进入/恢复、忙碌禁用和错误后 Retry；Host 失败时保持对话框和页面状态，不实现虚假撤销。
- **验收**：客户端无 `window.confirm`、`fetch` 或未经 Host manifest 批准的连接测试 RPC；删除成功只在既有 delete RPC 成功后清理并刷新，引用拒绝/写入失败保留确认层并提示修复。静态和全量回归通过；真实 Web 验收留给 UI-08。

### UI-08：视觉收口、无障碍、响应式和真实 Web 验收

- **优先级**：P0/P1 完成后的发布门槛
- **依赖**：UI-01～UI-07 中实际纳入版本的任务
- **目标**：在真实 DSH Web 中完成亮/暗主题、窄容器、键盘和失败路径验收。
- **实施要点**：
  - 所有 class 保持 `dsh-api-kit-` 前缀；不写裸 `body/#root/button/input` 全局覆盖。
  - 颜色消费 DSH token；`color-mix` 有 fallback；状态同时使用 icon/文字/语义色；不使用 emoji 作为结构图标。
  - 每个复杂区域审查 default/hover/focus-visible/active/disabled/loading/success/error/empty/readonly/destructive confirmation。
  - 容器优先使用 `@container`；检查 flex/grid 子项 `min-width:0`、`min-height:0`、URL/path/schema 换行和滚动边界。
  - 操作按钮至少具备可见 focus ring；icon-only 具备 `aria-label`；错误关联具体控件；picker/modal 焦点进入、Escape、循环和恢复完整。
  - `prefers-reduced-motion: reduce` 下关闭装饰动画和循环 spinner；避免 CLS、横向溢出和 sticky 遮挡。
  - 真实 GUI 必须是当前 `http://127.0.0.1:3080`（除非用户另行指定）。不要启动替代服务器冒充当前 GUI；若要浏览器验收，使用隔离 Profile/随机端口并明确报告实际 URL。
- **验收**：亮色、暗色、可用 skin、320–375px、480–560px、680–768px、1024px、1440px；Tab/Shift+Tab/Enter/Space/箭头/Escape；慢请求、空数据、局部错误、stale、写风险取消、导入冲突；真实 DSH Web 无 page error、横向溢出和焦点丢失。

### UI-09：P2 体验增强（可选）

- **优先级**：P2
- **依赖**：UI-04、UI-06、UI-08
- **范围**：字段级冲突 diff、Operation 调用预览、curl/Agent 示例、批量启停、删除撤销、最近修改/导入批次、首次使用引导。
- **原则**：每项先证明不会扩大 secret、URL、Host、CIDR 或完整 schema 暴露面；复杂内容默认折叠；每项单独定义 Host/Client 数据契约和容量上限。

---

## 7. 数据与状态契约

### 7.1 Client 可持有的数据

Client 可以持有：

- Host 返回的有限安全视图：Kit/Operation/Target/Environment/Auth Profile 的名称、ID、状态、统计和允许展示的诊断；
- 用户当前表单草稿、Tag/Kit/Environment 选择、折叠状态、预览指纹对应的本地 UI 状态；
- loading、busy、error、notice、success、dirty、stale 等 UI 状态。

Client 不得持有或展示：

- 真实 secret、token、password、Cookie、完整 Authorization；
- 未经安全视图允许的 baseUrl、具体 host/CIDR、内部 Registry、Session/Context live object；
- 任意 URL、代理、重定向策略或模型提供的执行目标；
- Host confirmation token 的批准逻辑或替代审批结果。

### 7.2 统一异步状态机

每个异步区域至少使用以下状态：

```text
idle
  → loading（无旧数据时显示 skeleton/说明）
  → ready（保留旧数据，显示刷新中时用 busy）
  → saving/testing/importing
  → success（说明影响范围）
  → error（原因 + 受影响范围 + retry/fix）
```

规则：

- 新请求开始时不清空可继续使用的旧列表或草稿；
- 每个 loader/action 绑定 request generation 和 mounted guard；
- 一个绑定列表失败不能清空其他已成功的列表；
- error 文案不能只显示内部 code；保留 code 便于诊断，但给出用户下一步；
- stale preview 必须明确要求重新预览；不能用旧预览继续导入；
- 成功反馈必须说明新增/更新/跳过/保留或“下次 Agent 调用生效”。

### 7.3 Dirty 草稿策略

每个编辑器记录：

```text
initialSnapshot
currentDraft
isDirty = stableSerialize(initialSnapshot) !== stableSerialize(currentDraft)
```

实现注意：

- 仅对自有普通 JSON 做稳定比较；不序列化 Host Service、Session、Fiber、React element 等 live object；
- ID、operationId、绑定关系和策略字段变化要单独标记影响；
- 保存成功后更新 snapshot；失败保留 draft；取消恢复 snapshot；
- 组件卸载不代表用户同意放弃，离开确认必须由明确的 UI action 触发。

---

## 8. 写操作与危险操作 UI 规则

### 8.1 Operation 权限层级

UI 必须把下列概念分开：

```text
Operation 状态
  enabled：定义是否启用

Agent 权限
  allowAgentCall：是否允许 Agent 发现和调用

访问副作用
  allowWrite：是否允许该 Operation 进入写策略候选

安全护栏
  requiresConfirmation：调用前是否必须人工确认
```

“允许写操作”并不等于“立即可以写入”。最终还必须满足：

- Operation 和 Kit 的写策略；
- 当前 Session 激活和 Environment 可用性；
- Service Target/Endpoint 和 Host 安全策略；
- 请求参数、Registry fingerprint 和确认绑定；
- Host approval 为允许一次；
- T14 的 `api_write_prepare`/`api_write_execute` 规则。

UI 文案建议：

```text
允许写操作
此 Operation 可能修改业务数据。启用后仍需通过 API 套件策略、当前环境、
Host 安全策略和人工确认。
```

### 8.2 写操作保存确认内容

确认层必须显示真实可知的影响，不使用通用“确认保存？”：

```text
即将启用写操作

Operation：更新订单
Method：POST · Path：/orders/{id}
套件：RPA
服务目标：订单服务
当前环境：demo（若当前上下文可确定）

这可能修改真实业务数据。保存后，符合其他安全条件时 Agent 可以发起写请求，
调用仍需要 Host 侧一次性人工确认。

[取消] [保存并启用写操作]
```

如果 UI 只是在编辑表单中保存“允许写操作”策略，不要声称请求已执行；确认按钮文案使用“保存并启用”，而不是“执行”。

### 8.3 删除确认内容

```text
删除服务目标？

订单服务

影响：
• 2 个 Operation 将失去调用目标
• API 套件定义和审计记录不会自动删除
• Environment 不会被删除
• 删除失败时会保留当前配置

输入“删除”以确认
[取消] [删除服务目标]
```

真实引用数必须来自 Host 安全视图；如果不可用，使用“引用关系将在 Host 保存时校验”并禁止伪造数量。

---

## 9. 视觉、主题与组件约束

### 9.1 Token 映射

组件只消费 DSH token 或根节点局部 semantic alias：

```css
.dsh-api-kit-settings {
  --dsh-api-kit-surface: var(--dsw-alias-bg-layer-1);
  --dsh-api-kit-surface-raised: var(--dsw-alias-bg-layer-3, var(--dsw-alias-bg-layer-2));
  --dsh-api-kit-surface-input: var(--dsw-alias-bg-input, var(--dsw-alias-bg-base));
  --dsh-api-kit-border: var(--dsw-alias-border-l2, var(--dsw-alias-border-l1));
  --dsh-api-kit-divider: var(--dsw-alias-border-l1);
  --dsh-api-kit-text: var(--dsw-alias-label-primary);
  --dsh-api-kit-muted: var(--dsw-alias-label-secondary);
  --dsh-api-kit-accent: var(--dsw-alias-brand-primary);
}
```

说明：以上是实施方向，不代表无需 Inspect 就可以直接使用每一个 token。普通面板不使用 `--dsw-specific-sidebar-fill`；菜单/Popover 优先官方 primitive 或已确认的 menu token。

### 9.2 表面、间距和按钮

- 普通设置组：`layer-1 + border`，不默认使用 `shadow-lv3`；
- 内嵌详情/输入：`layer-2` 或 input token；
- Popover/Modal：由官方 primitive 管理层级和阴影；
- 小控件 6–8px radius，普通卡片 8–12px，设置大组 12–16px；
- 以 4px 为基础节奏，组内 8–12px，卡片 padding 12–16px，section gap 14–20px；
- 设置区域每个分组只有一个 Primary；刷新、编辑、取消、重试使用 secondary/ghost；删除使用 destructive；
- 视觉控件可以 compact，但关键可操作命中区不低于 44×44px，不能让用户只能点击 16px 字形。

### 9.3 图标与状态

- 使用同一套 SVG icon，`currentColor` 驱动，不使用 emoji；
- icon-only 按钮必须 `aria-label`，Tooltip 只能补充；
- 成功/警告/错误使用图标 + 文字 + 语义色；
- 生产、写操作、覆盖导入和删除不可只靠颜色区分；
- 颜色 fallback 仅作为宿主 token 缺失时的接近 DSH baseline 兜底。

---

## 10. 测试与验收矩阵

### 10.1 静态/合同测试

每次 UI 子任务至少执行：

```powershell
node --check lib\client.js
node --test test\client-contract.test.mjs
pnpm test
pnpm run check
pnpm pack --dry-run
git diff --check
```

根据改动增补 `test/client-contract.test.mjs`，重点断言：

- Slot 名和入口仍为 `conversation.input.left`、`settings.section`；
- Client 没有 `fetch(`、`webServer`、自由 URL 执行逻辑；
- Remote descriptor、RPC method 名和参数 wire 未被 UI 重构破坏；
- 关键状态文案、stale guard、`aria-*`、`role`、`focus-visible`、reduced-motion、container query 和 token 仍存在；
- 写风险提示明确包含 Host/Kit/Environment/人工确认边界；
- 多选 UI 使用稳定 ID，不依赖数组 index 作为 React key；
- CSS 没有未经授权的全局 selector 或独立 palette。

合同测试是结构防回退，不替代浏览器交互验收；不要为了通过正则测试而写无意义 marker。

### 10.2 浏览器验收

在真实 DSH Web，而不是独立 Vite 页面中验收：

| 维度 | 必测内容 |
|---|---|
| 主题 | 亮色、暗色、可用自定义 skin；surface、文字、边界、状态可读 |
| 宽度 | 320–375px、480–560px、680–768px、1024px、1440px |
| 会话选择 | 单/多 Kit、共同环境、无共同环境、生产、失效、清除、应用、Escape、焦点恢复 |
| 导入 | 空/坏 JSON、预览、stale、Tag、绑定局部失败、冲突批量/逐项、确认取消、成功/失败 |
| 编辑 | 新建/编辑、JSON 错误、dirty、切换/离开确认、写风险开关、保存成功/失败 |
| 连接 | 无 Environment、无 Target、绑定、Endpoint 折叠、长 URL、私网/生产提示；连接测试若已接入则测全部状态 |
| 删除 | 无引用、有引用、失败、取消、Escape、焦点恢复；撤销仅在底层支持时测 |
| 键盘 | Tab/Shift+Tab、Enter/Space、箭头（若使用 listbox/radio）、Escape；无键盘陷阱 |
| 动效 | reduced-motion 下无循环装饰动画、无明显布局跳动 |
| 文本 | 长中文、英文、URL、Path、operationId、大字号、浏览器缩放；无横向溢出 |
| 错误隔离 | 单个区域错误不让整个 settings Slot 白屏；可 retry 或返回 |

### 10.3 真实打包与运行环境

- 客户端是发布版 `window.__ModuleLoader__` bundle，不把 `apps/web` Vite entry 当作独立应用。
- 若依赖 Client plugin HMR，先确认同一 Harness checkout 中 `pnpm run dev:web` watcher 正在运行；否则不要承诺修改会自动出现在 3080。
- apps/web shell 或普通 package 修改需要重新构建受影响 Web artifact，并刷新真实页面。
- 优先用新的本地 tgz 安装到一次性 `DSH_HOME` 和独立 profile，随机端口启动，记录实际 URL；不要重启、替换或覆盖用户当前 `http://127.0.0.1:3080`。
- 若没有可重复 Playwright/浏览器驱动，只报告隔离 Profile 启动和未自动化 checklist，不能宣称完整 UI smoke 通过。

---

## 11. 任务依赖图与推荐会话顺序

```text
UI-00 运行时/基线复核
  ├─→ UI-01 术语/关系/摘要
  │    ├─→ UI-02 会话有效范围
  │    └─→ UI-05 连接纵向结构
  ├─→ UI-03 多选控件
  └─→ UI-04 OpenAPI 三阶段导入

UI-05 连接结构 ──→ UI-07 连接测试/删除确认
UI-01 + UI-00 ──→ UI-06 Operation 分组/dirty/写风险
UI-01～UI-07 ──→ UI-08 发布前验收
UI-04 + UI-06 + UI-08 ──→ UI-09 P2 增强
```

推荐会话顺序：

1. **会话 A：UI-00**，只做契约和基线记录；
2. **会话 B：UI-01**，统一术语、关系说明、摘要统计；
3. **会话 C：UI-02**，会话范围摘要和共同环境诊断；
4. **会话 D：UI-03**，替换三个关键 multiple select；
5. **会话 E：UI-04**，导入三步 UI；
6. **会话 F：UI-05**，连接配置纵向重组和 Endpoint disclosure；
7. **会话 G：UI-06**，Operation 分组、dirty 和写风险确认；
8. **会话 H：UI-07**，只有 Host 契约已确认时接连接测试，并完善删除确认；
9. **会话 I：UI-08**，静态、隔离 Profile 和真实浏览器验收；
10. **后续会话：UI-09**，按价值逐项实现 P2。

若某会话无法完成全部内容，应保留可运行状态，更新“进行中”以及下一步精确到组件/函数，不要标记为已完成。

---

## 12. 当前进度与交接记录

### UI-08 / 2026-08-31 真实 Web 验收记录

- **本轮提交**：`0787022 T8: harden UI acceptance paths`；仅包含 `lib/client.js` 与 `test/client-contract.test.mjs`，未夹带工作区既有 Host/README/测试修改。
- **前置核对**：当前 3080 为官方 `dsh web` 服务；未发现同一 checkout 的 `pnpm run dev:web` watcher。旧 web profile 曾实际加载 `dsh-api-kit-0.1.0-crud-visible.tgz`，请求 bundle 含 `window.confirm`；本轮用源码重新 `pnpm pack` 生成 `C:\Users\48444\.dsh-tmp\dsh-api-kit-0.1.0.tgz` 并在不重启服务的情况下更新 web profile 安装，刷新后 live bundle 与最新包 hash 一致，且不含 `window.confirm`。
- **真实通过**：使用本机已安装 Chrome 通过 Playwright 连接 `http://127.0.0.1:3080`；settings.section 与 conversation.input.left 均实际挂载；1440px 与 375px 页面 `body/document scrollWidth === viewport`；最新设置页显示作用域说明、摘要、导入、连接配置和 Workbench；reduced-motion context 下无 console error/pageerror。删除确认层实际打开后首焦点进入确认输入框，连续 Tab/Shift+Tab 均在 dialog 内循环，Escape 关闭。
- **本轮修复**：新增通用 `FOCUSABLE_SELECTOR`/`trapDialogTab`，为导入/放弃/写风险确认补齐焦点进入与 Tab trap；绑定加载使用独立 generation 并清理 stale busy；Auth Profile 加载增加 generation guard；Settings 初始加载不再把空态误报为“暂无”；Kit 使用 `aria-pressed` 补充选中语义；关键 choice/step/summary/checkbox 增加 focus-visible；picker 触控高度提高到 44px；隐藏未经证明安全的 Server URL 与 endpoint baseUrl 展示。
- **未完成验收**：当前真实页面仍未覆盖所有导入成功/失败、编辑 dirty/write confirmation、连接配置保存拒绝、删除 Host 拒绝/写失败 retry、亮/暗/custom skin 对比度、320/480/560/680/768 多容器宽度和读屏 Accessibility Tree；这些不是已通过项。
- **环境限制**：本轮只读刷新 3080，没有重启服务；web profile 的本地 package metadata 已恢复到原 `dsh-api-kit-0.1.0-crud-visible.tgz` 声明，但正在运行的 3080 进程已经读取最新 bundle，后续如重启会回到旧包。要持久复验最新 UI，需用户在重启前将受管 profile 指向新 tarball，或重新安装最新包。

### 进度总表

| ID | 任务 | 状态 | 当前结果 | 下一步 |
|---|---|---|---|---|
| UI-00 | 运行时与基线复核 | 已完成 | 已完成当前 Slot、Client Service/Builtin、Theme Inspect；`node --check`、合同测试、全量测试、manifest、打包和 diff 检查通过；真实浏览器 smoke 仍未完成 | 进入 UI-01，基于冻结契约实现术语、关系说明和状态摘要 |
| UI-01 | 术语、关系说明、状态摘要 | 已完成 | 已加入作用域关系说明、统一设置页术语、六项保守状态摘要和部分加载保护；客户端合同/全量回归/manifest/打包/diff 检查通过；真实浏览器 smoke 仍未完成 | 进入 UI-02，会话选择器增加当前会话有效范围摘要 |
| UI-02 | 会话有效范围摘要 | 已完成 | `ApiKitControl` 已加入当前会话范围摘要、共同环境诊断、生产/写风险说明、draft/committed 区分和选择语义；合同/全量回归/manifest/打包/diff 检查通过；真实浏览器 smoke 仍未完成 | 进入 UI-03，替换设置页关键 `multiple select` |
| UI-03 | 替换关键 multiple select | 已完成 | 已用局部受控 `CheckboxChipSelect` 替换 Tag、默认 Kit、Environment 绑定三处原生多选；保留 string 数组 wire、搜索/全选/清除、禁用原因、未知已选项和至少一个 Environment 校验；合同/全量回归/manifest/打包/diff 检查通过；真实浏览器 smoke 仍未完成 | 进入 UI-04，先将 OpenAPI 导入表达为“检查文档 → 配置导入 → 确认变更”三阶段 |
| UI-04 | OpenAPI 三阶段导入 | 已完成 | 已加入“检查文档 → 配置导入 → 确认变更”步骤导航、筛选后影响摘要、冲突批量决策、局部可访问确认层和 stale/绑定/失败恢复提示；保留现有 preview/confirm RPC wire 与 Host 原子语义；合同/全量回归/manifest/打包/diff 检查通过；真实浏览器 smoke 仍未完成 | 进入 UI-05，重组连接配置为纵向依赖结构并折叠 Endpoint 高级策略 |
| UI-05 | 连接配置纵向结构 | 已完成 | 已将连接区改为 Environment → Service Target 纵向结构；Target 列表增加 Endpoint/Operation 完整度摘要，目标级认证使用安全视图选择，Endpoint 按环境 Disclosure 并将网络策略折叠到“高级网络策略”；保留既有 CRUD payload 和 Host 校验；真实浏览器 smoke 仍未完成 | 进入 UI-06，重组 Operation 编辑器并加入 dirty/写风险确认 |
| UI-06 | Operation 编辑与写风险 | 已完成 | 已将编辑器拆分为基本信息、请求定义、响应定义、Agent 权限与安全四组；保留 JSON 高级模式，加入表单快照/dirty 状态、离开保护、写操作风险提示和本地保存确认层；既有 Operation ID 只读，Host/RPC 写门禁不变；真实浏览器 smoke 仍未完成 | 进入 UI-07，确认连接测试 RPC 契约并完善连接测试/删除确认层 |
| UI-07 | 连接测试/删除确认 | 已完成 | 已确认当前没有安全连接测试 RPC，因此仅更新不可用说明；删除入口已改为基于安全视图影响摘要的统一可访问确认层，支持未知引用保护、输入“删除”、Escape/Tab/焦点恢复、失败保留与重试；真实浏览器 smoke 仍未完成 | 进入 UI-08；若未来 Host 提供安全测试 RPC，再单独评审 UI-07-B |
| UI-08 | 视觉/无障碍/真实 Web 验收 | 进行中 | 已修复并提交 UI-08 焦点 trap、独立请求 generation、初始 loading、选中语义和敏感 URL 展示问题；用最新 tarball 刷新 web profile 后，真实 3080 已验证两个 Slot、1440/375px 无横向溢出、删除 dialog Tab/Shift+Tab/Escape、reduced-motion 和 0 console/pageerror。完整亮暗/custom skin、导入/编辑/连接失败路径和最终验收记录仍待补齐 | 继续 UI-08D/E；需覆盖完整主题与失败路径矩阵后才能标记完成 |
| UI-09 | P2 体验增强 | 延期 | 不阻塞 P0/P1 | 逐项评估数据和安全边界 |

### 2026-08-30 / UI 计划建立

- **完成内容**：根据 UI 审查建议、当前 `lib/client.js`、`REQUIREMENTS.zh-CN.md`、`IMPLEMENTATION_PLAN.zh-CN.md`、`README.zh-CN.md` 和 `test/client-contract.test.mjs` 建立可跨会话执行的 UI 子任务计划。
- **已确认现状**：客户端已经具备 T13 的主题、响应式、焦点和异步保护基础；仍存在平铺设置页、原生 multiple select、长 Operation 表单、四个权限 checkbox 并列、左右连接配置、单屏导入和通用 `window.confirm` 等待调整点。
- **安全边界**：本计划不改变 Host/RPC 的安全语义；OpenAPI Server 继续 display-only；写操作继续由 T14 Host 策略和人工确认门最终决定；Client 不持有 secret、token、任意 URL 或 live Cordis 对象。
- **本轮未实现**：未修改插件源码、未执行真实浏览器 UI smoke；本文件只作为后续实现和交接基线。
- **下一步建议**：UI-00 已完成；UI-01 已完成后，下一步进入 UI-02；后续实现仍需以当前运行时 Inspect 为准。

### 2026-08-31 / UI-08

- **状态**：进行中；真实挂载和基础键盘/响应式验收通过，完整发布前矩阵未完成。
- **下一步**：继续 UI-08D/E，优先在持久化最新 tarball 的 profile 上完成亮/暗/custom skin、导入/编辑/连接/删除失败路径与宽度矩阵；全部通过后再路径限定提交计划完成记录。
- **遗留决策**：是否由用户重启 3080 前先把 web profile 的 dsh-api-kit 依赖稳定指向 `C:\Users\48444\.dsh-tmp\dsh-api-kit-0.1.0.tgz`；若不调整，下一次重启会恢复旧 bundle。

### 2026-08-30 / UI-07

- **状态**：已完成代码实现和静态回归；真实浏览器 UI smoke 保留到 UI-08。
- **Host/RPC 复核**：`lib/index.js`、`lib/typert.host.js`、`lib/configuration.js`、`lib/executor.js` 与 Client descriptors 均未提供 `testConnection`、`probeTarget` 或 `healthCheck`；本轮没有新增未经批准的 descriptor、假测试按钮或 Client 网络请求。
- **连接测试边界**：连接区明确当前版本只保存配置，真实请求仍由 Host 在 Operation 调用时按固定 Target/Environment、allowlist/CIDR、SSRF、认证、超时、响应大小、重定向和审计策略校验。
- **删除确认**：Environment、Service Target、API Kit、Operation 四类删除统一使用安全视图影响摘要和局部 dialog；部分加载或影响不可证明时显示未知并要求输入“删除”，不伪造引用为 0。已有引用、Operation dirty 草稿、Host 拒绝和写入失败均有明确提示；删除成功后才清理选中项/草稿并刷新。
- **键盘与恢复**：支持取消、outside click、Escape、Tab/Shift+Tab 循环、焦点进入/恢复、忙碌禁用和 dialog 内错误；未实现前端伪造撤销。
- **验证结果**：`node --check lib\\client.js`、`node --test test\\client-contract.test.mjs`（12/12）、`pnpm test`（171/171）、`pnpm run check`、`pnpm pack --dry-run` 均通过；`git diff --check` 仅报告既有 LF→CRLF 转换提示。
- **遗留问题**：未启动替代 Web 服务，未刷新当前 `http://127.0.0.1:3080`；亮暗主题、窄屏、真实焦点/读屏和删除失败路径仍需 UI-08 验收。未来若 Host 增加安全连接测试 RPC，另开 UI-07-B 兼容任务。
- **下一步**：进入 UI-08，执行真实 DSH Web 的视觉、无障碍、响应式和失败路径验收。

### 2026-08-30 / UI-06

- **状态**：已完成代码实现和静态回归；真实浏览器 UI smoke 保留到 UI-08。
- **编辑器分组**：Operation 编辑器改为“基本信息 / 请求定义 / 响应定义 / Agent 权限与安全”四组；Parameters、Request Body、Responses 仍为 JSON 高级模式，没有改变内部结构或 RPC wire。
- **字段与权限**：已有 Operation 的 ID 通过 `disabled` 只读；保留 `enabled`、`policy.allowAgentCall`、`policy.allowWrite`、`policy.requiresConfirmation`；写操作开启后显示真实业务数据风险，未开启调用前确认时显示明确警告。
- **dirty 保护**：新增 `operationFormFingerprint`、`formSnapshot`、`formDirty` 和 `pendingFormAction`；编辑器标题和底部动作栏显示未保存状态。切换 Kit、打开其他 Operation、重新加载或取消时，不会静默丢弃草稿；局部对话框提供“保留草稿/放弃修改”。
- **写策略确认**：允许写操作的保存先打开局部 `role="dialog"` 确认层，展示 Operation、Method + Path、API Kit、Service Target 及真实数据修改后果；Escape/取消恢复焦点，不调用写执行工具、不生成 confirmation token，确认后仍只调用既有 `createOperation`/`updateOperation`。
- **反馈与边界**：保存期间按钮禁用；JSON 错误继续保留草稿和字段关联；成功文案包含“下次 Agent 调用时生效”；Host 仍是最终权限和安全门禁。
- **测试结果**：UI 合同测试 11 项全部通过；此前全量测试 169/169、manifest、打包和 diff 检查通过；本轮代码变更后完成语法与 Client 合同回归。
- **遗留问题**：未启动替代服务器，未刷新当前 `http://127.0.0.1:3080`；真实亮暗主题、窄屏、键盘、读屏和失败路径验证仍留给 UI-08。
- **下一步**：进入 UI-08，执行真实 DSH Web 的视觉、无障碍、响应式和失败路径验收。

### 2026-08-30 / UI-05

- **状态**：已完成代码实现和静态回归；真实浏览器 UI smoke 保留到 UI-08。
- **纵向信息架构**：连接配置改为“1. Environment → 2. Service Target”的纵向分组；Environment 作为前置依赖，Service Target 列表展示绑定环境、Endpoint 配置完整度、Operation 数量及启用/Agent 状态。
- **Target 编辑器**：保留 `environmentIds`、`defaultEnvironmentId`、`authProfileIds`、`endpoints`、`enabled`、`agentEnabled` 等既有 payload；绑定 Environment 继续使用 `CheckboxChipSelect`，默认环境只列出当前绑定项；认证配置使用 `listAuthProfiles` 的安全视图，未接触 secret/token/Authorization。
- **Endpoint Disclosure**：每个绑定环境使用原生按钮、`aria-expanded`、`aria-controls` 和 `hidden` 的渐进披露；默认环境与缺失 `baseUrl` 的环境自动展开。`baseUrl` 与超时默认可见，Host/CIDR、私网、端口、响应大小、重定向、特权端口进入“高级网络策略”。长 URL 使用换行边界；生产、私网和缺失 Endpoint 提供文字状态。
- **连接测试边界**：当前没有已确认的安全连接测试 RPC，因此没有伪造测试按钮；界面明确说明当前只保存并由 Host 校验，连接测试留给 UI-07。
- **安全与兼容**：未修改 Host/RPC、旧目标迁移和 endpoint 回退语义；Client 不执行 URL/网络请求；删除操作的既有 `window.confirm` 未在本轮改造。
- **测试结果**：UI 合同测试 10 项全部通过；`pnpm test`、`pnpm run check`、`pnpm pack --dry-run`、`git diff --check` 结果记录在本轮交接中。
- **下一步**：进入 UI-06，重组 Operation 编辑器并处理 dirty 状态与写风险确认。

### 2026-08-30 / UI-04

- **状态**：已完成代码实现和静态回归；真实浏览器 UI smoke 保留到 UI-08。
- **主要改动**：`OpenApiImportPanel` 增加 `activeStep` 与 `confirming` 本地状态，顶部提供带 `aria-current="step"` 的“1. 检查文档 / 2. 配置导入 / 3. 确认变更”导航；预览成功后进入配置阶段，stale 输入回到检查阶段并保留旧预览。
- **检查阶段**：保留 JSON 输入、Host 预览元数据、统计、Operation 摘要、错误/重试和 Server display-only 说明；Server URL 没有被转成 Endpoint 或执行目标。
- **配置阶段**：集中导入目标、UI-03 Tag/Kit 选择、Target/Environment/Auth Profile、当前筛选 Operation 数量和冲突处理；增加“全部保留本地/全部覆盖/全部跳过”，批量动作只填充既有 `conflicts[sourceKey]`。
- **确认阶段**：增加筛选后新增/更新/跳过/冲突摘要、Target/Environment/Kit 上下文、写操作风险说明和一次性 Registry 写入警示；最终按钮先打开局部 `role="dialog"` 确认层，支持 Escape、取消、焦点进入/恢复和 `aria-busy`。
- **提交边界**：确认通过后仍只调用原有 `confirmOpenApiImport`；`includedSourceKeys`、`conflictDecisions`、`defaultKitIds`、Target/Environment/Auth 字段和 `selection` 结构未改变；未新增 Client 写执行、审批 token、网络请求或 Host/RPC。
- **测试结果**：UI 合同测试 9 项全部通过；`pnpm test` 168/168 通过；`node --check lib\\client.js`、`pnpm run check`、`pnpm pack --dry-run`、`git diff --check` 均通过。
- **遗留问题**：本轮未启动替代 Web 服务，也未刷新当前 `http://127.0.0.1:3080`；真实主题、键盘、触摸、窄屏、读屏、确认层 overlay 层级和失败路径验收仍需 UI-08。
- **下一步**：进入 UI-05，重组连接配置为“先 Environment、后 Service Target”的纵向结构，并为 Endpoint 增加渐进披露。

### 2026-08-30 / UI-03

- **状态**：已完成代码实现和静态回归；真实浏览器 UI smoke 保留到 UI-08。
- **主要改动**：在 `lib/client.js` 增加局部受控 `CheckboxChipSelect`，使用 `fieldset/legend`、原生 checkbox、稳定业务 ID、计数、搜索、全选/清除、禁用原因和未知已选项的可移除状态。
- **三处接入**：OpenAPI Tag 筛选替换为“全部 Tag（不筛选，包含无 Tag 的 Operation）”及 Tag checkbox；默认 API Kit 替换为可搜索的 checkbox 列表；Service Target 环境绑定替换为带可用/生产/Agent 状态说明的 checkbox 列表。
- **提交边界**：`selectedTags`、`kitIds`、`targetForm.environmentIds` 仍为 `string[]`；现有 `selectedOperations`、`defaultKitIds`、`selection.defaultKitIds` 和 Service Target CRUD payload 未改变；没有新增 RPC，也没有改变 Host 的存在性、权限、环境归属和安全校验。
- **选择与刷新语义**：搜索只过滤展示，不改变值；全选只作用于当前可见且未禁用项；Tag 空数组仍表示全部筛选范围；已选但当前列表未返回的 ID 保留为可移除项。绑定列表首次加载仍保留兼容的默认第一个可用 Kit，但后续刷新不再静默丢失或补回用户选择。
- **可访问性与响应式**：选择组和搜索均有语义 label；禁用/状态说明通过 `aria-describedby` 关联；保留 focus-visible、插件前缀、DSH token、容器布局和 reduced-motion 规则；未引入未经确认的 DSH primitive。
- **测试结果**：UI 合同测试 8 项全部通过；`pnpm test` 167/167 通过；`node --check lib\\client.js`、`pnpm run check`、`pnpm pack --dry-run`、`git diff --check` 均通过。
- **遗留问题**：本轮未启动替代 Web 服务，也未刷新当前 `http://127.0.0.1:3080`；真实主题、键盘、触摸、窄屏、读屏和错误路径验收仍需 UI-08。默认 Environment 单选控件不属于 UI-03，保留至后续连接配置任务。
- **下一步**：进入 UI-04，优先在现有 `OpenApiImportPanel` 内实现“检查文档 → 配置导入 → 确认变更”三阶段视觉和语义状态，不修改 preview/confirm RPC。

### 2026-08-30 / UI-02

- **状态**：已完成代码实现和静态回归；真实浏览器 UI smoke 保留到 UI-08。
- **主要改动**：`lib/client.js` 的 `ApiKitControl` 新增 `selectedKitViews`、`commonEnvironmentState`、`kitEnvironmentSummary`、`sessionScopeSummary` 等纯 Client 派生逻辑；弹层新增“当前会话范围”区块，展示已选套件、环境、Operation 范围和读写风险。
- **提交边界**：没有新增或修改 RPC，没有改变 `setSessionActivation`/`clearSessionActivation` 的参数和 Host 校验；Client 只消费 activation 返回的安全字段，不接触 endpoint、Host/CIDR、secret、token 或 live 对象。
- **共同环境诊断**：保留原有禁用 `<option>`，同时增加共同环境列表、无共同环境时各套件的可用环境说明、兼容字段缺失时的“暂不可统计”、生产环境提示和修复指引；环境选择框增加 `aria-invalid` 状态。
- **选择器状态**：保留 committed activation 与 draft selection；弹层内摘要跟随 draft，关闭后的按钮跟随 committed；按钮支持多套件文案、生产环境文字提示和明确的“修改当前会话的 API 套件和环境选择” `aria-label`。超过建议数量的 Host warning/既有错误仍由 Host 决定。
- **注意事项**：多 Kit 时 Operation 统计仅对单套件展示 Host 安全计数；多套件无法安全去重时显示“多个套件或字段不足，暂不可去重统计”，不将逐套件计数相加成可调用总数。
- **测试结果**：UI 合同测试由 7 项增至 8 项并全部通过；`pnpm test` 164/164 通过；`node --check lib\\client.js`、`pnpm run check`、`pnpm pack --dry-run`、`git diff --check` 均通过。
- **遗留问题**：本轮未启动替代 Web 服务，也未刷新当前 `http://127.0.0.1:3080`；真实主题、键盘、窄屏、读屏和错误路径验收仍需 UI-08。UI-03 仍负责设置页 Tag/默认套件/服务目标环境绑定的 multiple select 替换。
- **下一步**：进入 UI-03，优先替换设置页关键 `multiple select`，不改会话环境的原生单选控件和 Host 兼容计算。

### 2026-08-30 / UI-01

- **状态**：已完成代码实现和静态回归；真实浏览器 UI smoke 保留到 UI-08。
- **主要改动**：`lib/client.js` 增加了安全的 `settingsSummary()` 派生函数和加载状态记录；设置页新增 Kit → Operation → 服务目标 → 环境的关系说明、OpenAPI Server URL display-only 提示，并将旧的三项摘要替换为 API 套件、Operation、只读操作、写操作、可用环境、配置问题六项摘要。
- **统计口径**：只读为 GET/HEAD，写操作为 POST/PUT/PATCH/DELETE，可用环境为 `enabled !== false && agentEnabled !== false`；配置问题只在 Kit、Operation、服务目标、环境四类列表均成功加载时计算，部分加载失败显示“—”及解释，不把未知当成 0，也不将摘要命名为“可调用操作”。
- **保留边界**：仅消费现有 Host 安全视图和既有 RPC；未新增 Slot、RPC、Host 字段或 Client 网络能力；不展示 endpoint、host/CIDR、secret、token 或 Authorization；写操作仍默认禁止 Agent，最终可调用性仍由 Session/Host 校验。
- **可访问性/响应式**：关系区使用 section、标题、段落和 aria label；摘要数字使用 `tabular-nums`；六项摘要在 720px/520px 容器断点下自动降列，长名称/文案允许换行。
- **测试结果**：UI 合同测试由 5 项增至 6 项并全部通过；`pnpm test` 165/165 通过；`node --check lib\\client.js`、`pnpm run check`、`pnpm pack --dry-run`、`git diff --check` 均通过。
- **遗留问题**：本轮没有启动替代 Web 服务，也没有刷新当前 `http://127.0.0.1:3080`；真实主题、键盘、窄屏和错误路径仍需 UI-08 验收。当前 `lib/client.js` 中原有部分 token（如 input/menu/interactive/shadow 相关）尚未被本轮 Theme Inspect 直接确认，继续沿用已有 fallback，后续新增依赖前需重新 Inspect。
- **下一步**：进入 UI-02，为会话选择器增加当前会话有效范围摘要和共同环境不兼容原因。

### 2026-08-30 / UI-00

- **状态**：已完成。
- **Slot 复核**：当前 Client Inspect 确认 `settings.section` 为 root-scope `list`，`id` 必填、`order`/`label` 可选，owner props 提供 `close()`；`conversation.input.left` 为 session-scope `list`，同样要求 `id`，其 owner props/标准 props 提供 `sessionId`、Conversation/Input 快照和相关 hooks/actions。当前占用分别包含 `api-kit`（order 30）与 `dsh-api-kit`（order 93），均无 ID 冲突，因此后续继续沿用现有 Slot 注册点和排序。
- **Client 能力复核**：确认 `slots` 可通过 `ctx.get('slots')` 可选读取，`register`/`inject` 具备调用方 Fiber disposer 语义；确认 `locale`、`theme`、`sessions` 等 Client Service，但本插件当前 UI 不需要新增 Service 依赖。Client Builtin 确认 `React.createElement`、Host JSON RPC、受控样式插入和 package-tagged console；不得使用 import、JSX、TypeScript 或传递非 JSON live object。
- **官方 primitive 结论**：本次 Client Inspect 未暴露可直接依赖的 Button/Modal/Menu/Disclosure/Toast primitive contract。后续不能凭参考插件猜测 props；在没有新契约前，继续使用现有 `button()` helper、原生语义元素和插件前缀局部样式，或先重新 Inspect 后再采用官方 primitive。
- **Theme 复核**：当前直接确认的 token 为 `--dsw-alias-bg-base`、`--dsw-alias-bg-layer-1`、`--dsw-alias-bg-layer-2`、`--dsw-alias-bg-overlay`、`--dsw-alias-border-l1`、`--dsw-alias-border-l2`、`--dsw-alias-brand-primary`、`--dsw-alias-label-primary`、`--dsw-alias-label-secondary`、`--dsw-alias-state-error-primary`、`--dsw-alias-state-success-primary`、`--dsw-alias-state-warn-primary`。`--dsw-specific-sidebar-fill` 仅属宿主侧栏语义，不能用作普通插件面板背景。当前客户端中还存在 `bg-input`、`label-tertiary`、interactive/button foreground/hover、specific-menu、shadow 等未在本次 token 清单中返回的引用，已记录为兼容风险；后续新增或依赖这些 token 前必须重新确认并提供 fallback。
- **源码边界**：确认客户端继续使用 `window.__ModuleLoader__.load`、`remote.api-kit` 和既有 descriptor/RPC wire；两个 UI Slot 是唯一注册点。现有多 Kit/共同 Environment、生产/失效提示、Escape、外部点击、焦点循环/恢复、OpenAPI preview/confirm/stale/partial retry、mounted/request-generation guard 均保留。Host/Typert、Registry、HTTP、SSRF、OAuth、审计和写确认仍是业务权威，本任务未修改。
- **基线命令**：`node --check lib\\client.js` 通过；`node --test test\\client-contract.test.mjs` 5/5 通过；`pnpm test` 164/164 通过；`pnpm run check` manifest checks passed；`pnpm pack --dry-run` 通过并包含当前发布文件；`git diff --check` 通过。
- **工作树说明**：基线执行时工作树已包含本会话之前的源码/测试修改及本轮创建的 UI 文档；这些预-existing 修改不归因于 UI-00。本任务未修改插件源码，只有本实施文档发生变化。
- **浏览器验收**：本轮未启动替代 Web 服务，未重启或刷新当前 `http://127.0.0.1:3080`，未完成真实浏览器主题/键盘/窄屏 smoke；该项保留到 UI-08，不虚报通过。
- **交接结论**：UI-00 已满足“契约可追溯、边界不回退、基线可复现”的完成标准。下一会话进入 UI-01：在同一 `settings.section` 内实现统一术语、Kit → Operation → Service Target → Environment 关系说明和保守的状态摘要，不扩展 Host/RPC 数据契约。

---

## 13. 发布前最终门槛

只有同时满足以下条件，才可将本轮 UI 调整标为完成：

```text
关系上：用户能区分 Kit、Operation、Service Target、Environment 和 Endpoint
范围上：会话选择器明确显示 Kit、Environment、可发现/只读/写范围
流程上：导入按检查、配置、确认分步，预览失效和冲突有恢复路径
安全上：写操作、生产、覆盖、删除的影响可见；最终门禁仍在 Host
表单上：Operation 与连接配置渐进披露；dirty、saving、success、error 可恢复
主题上：亮/暗/skin 由 DSH token 驱动，无独立网站感和 emoji 结构图标
可访问性：语义 HTML、键盘、focus-visible、ARIA 关联、Escape、reduced-motion 完整
响应式：真实 settings/sidebar 宽度下无横向溢出、sticky 遮挡、CLS 和滚动跳闪
工程上：Slot/RPC/Host 边界不回退，CSS 隔离，旧数据/草稿和错误恢复保留
验收上：合同测试、全量回归、隔离打包和真实 DSH Web checklist 均有记录
```
