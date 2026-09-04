## Context

当前 `OpenApiImportPanel` 在一次成功预览后保存 `selectedTags`，但下一次成功预览只替换预览数据和冲突决策，没有根据新文档的 Tag 集合协调筛选状态。筛选结果通过派生的 `selectedOperations` 控制配置完成度，因此失效筛选会让页面显示新预览，却无法进入确认阶段。设置页 CSS 基础按钮虽为 44px，`.dsh-api-kit-settings .dsh-api-kit-button` 又将其覆盖为 40px；导入步骤按钮在窄容器下也有 40px 覆盖。连接配置中的两个创建动作目前都使用 primary。

本设计对应 `proposal.md` 和 `specs/plugin-settings-ui/spec.md`，只处理 Client 的展示状态和交互反馈；既有 `remote.api-kit` 调用、导入事务 payload、Host 校验以及会话/Registry 数据保持不变。真实浏览器验证使用独立测试实例（例如 3091），不得连接、刷新、安装插件或重启当前 3080 实例。

## Goals / Non-Goals

**Goals:**

- 让每次成功预览后的 Tag 筛选成为当前预览文档的有效子集，避免筛选状态与预览数据脱节。
- 区分“用户主动清除筛选”和“系统因文档切换而移除失效筛选”，提供一次短暂且不重复扩散的提示。
- 在选择结果为零时给出可理解的状态说明，并维持提交防护。
- 建立一个明确的 44px 关键操作命中区边界，同时不让 checkbox/radio 被普通控件规则放大。
- 用 secondary 层级表达 Service Target 创建动作在 Environment 之后的流程位置。
- 通过静态合同测试和隔离实例 smoke 覆盖行为、尺寸、键盘和安全边界。

**Non-Goals:**

- 不改变 RPC 名称、参数、返回值、请求次数、Registry 模型、Host/Typert、安全策略或任何实际 API 请求行为。
- 不实现本次 UI 复审中的 live region、`:has()`、container/media、dvh、实例 ID 等 Change B 内容。
- 不把“配置问题”统计卡片改造成导航入口，不新增搜索、批量操作或持久化布局偏好。
- 不在 3080 上进行调试、插件安装、浏览器 smoke、刷新或重启。

## Decisions

### 1. 在成功预览边界协调 Tag，而不是在派生计算中隐式修正

预览成功是输入文档身份切换的唯一明确边界。成功返回后，从新预览的 `tagCounts` 或可导入 Operation 的 tags 构造规范化 Tag 集合，并将旧 `selectedTags` 与该集合求交；若交集为空，则设置为空数组并产生“已清除失效筛选”的提示。预览失败时不修改筛选，避免错误响应覆盖当前可审查状态。

**原因：**在 `selectedOperations` 派生计算阶段修改 React state 会造成渲染期副作用，也难以区分文档切换和普通筛选操作。成功预览回调已拥有新文档数据和请求代次，适合作为状态迁移点。

**替代方案：**每次渲染都把 `selectedTags` 过滤为有效集合。该方案会在渲染中产生隐式状态不一致，且无法可靠产生一次性提示，因此不采用。

### 2. 保留有效 Tag，全部失效时恢复“不筛选”语义

Tag 比较使用与当前筛选相同的大小写不敏感语义；展示名称以新预览提供的 Tag key 为准。部分失效时仅删除不存在的项；全部失效时设置 `[]`。由于现有组件约定空数组代表“全部可导入 Operation”，同时保留无 Tag Operation，因此提示必须明确说明导入范围已经恢复为全部可导入项。

**替代方案：**任何文档切换都无条件清空 Tag。实现更简单，但会丢失用户仍然适用的筛选意图，故只作为异常兜底而非默认策略。

### 3. 用独立的短暂提示状态承载筛选迁移反馈

在导入面板内增加仅用于 UI 的提示状态，例如 `filterNotice`，在新预览成功时根据被移除的 Tag 设置消息；普通用户手动改变输入、重新开始预览或发生新错误时清除过时提示。提示采用现有非阻塞 status/notice 视觉样式，不进入任何导入 payload，也不替代错误。零结果状态则由当前派生数量决定，并用独立的短说明与 disabled 确认按钮并列呈现。

**原因：**将迁移提示与 `error` 分离可避免把可恢复的筛选调整伪装成失败，也避免旧提示覆盖 JSON/Host 错误。

### 4. 44px 规则按交互角色而非所有元素统一放大

移除或覆盖设置页把 `.dsh-api-kit-button` 压到 40px 的规则，使按钮基础命中区达到 44px；导入步骤按钮和窄容器下的按钮不再回落到 40px。Operation 行操作仍通过按钮自身达到 44px，高度变大时允许 flex-wrap 或容器布局自然增高。checkbox/radio 继续使用现有专属 class 和原生 input，不纳入普通 input 的 height 规则；外围 label 通过最小高度、内边距和对齐规则提供触控区域。

**替代方案：**只把 primary 按钮提高到 44px。这样会留下禁用/编辑/删除及步骤操作的低命中区，不满足整体操作可达性要求。

### 5. 只改变 Service Target 创建动作的视觉层级

保留 `添加 Environment` 的 primary class，将 `添加 Service Target` 改为 secondary class，不增加 disabled 条件、不改变回调、不新增引导状态。连接说明继续解释先环境后目标的关系。

**原因：**这是低风险的视觉层级修正，能表达产品流程但不把现有数据可用性或错误语义变成新的业务规则。

## Risks / Trade-offs

- [Risk] 自动清除失效 Tag 可能使导入范围从零项扩大到全部可导入项 → 在同一成功预览更新中显示明确提示，并在配置区和确认摘要继续展示最终 Operation 数量；不自动触发提交。
- [Risk] 新文档的 Tag 来源不完整，导致本应保留的筛选被误删 → 优先使用预览返回的规范 Tag 统计，并以可导入 Operation 的 tags 作为必要的防御性补集；若预览没有可用 Tag 信息，保守地保留筛选并显示零结果指导，而不是擅自扩大导入范围。
- [Risk] 提高按钮高度使窄容器出现新的横向或纵向布局问题 → 保留 `min-width:0`、换行和 `flex-wrap`，在 556px、520px 以下及 320–375px 隔离测试实例中检查 `scrollWidth` 和可见按钮。
- [Risk] 增大行操作按钮后操作列挤压主要内容 → 操作区继续允许换行；窄容器用单列布局，长名称、Path 和 Service Target 使用既有换行保护。
- [Risk] 合同测试只验证 CSS/字符串而遗漏状态语义 → 增加跨文档 A/B 的状态迁移断言，并在隔离浏览器实例执行真实 Tag 选择和预览交互。
- [Risk] 测试操作误触现有用户环境 → 将 3091 隔离约束写入任务和 smoke checklist；禁止任何针对 3080 的调试、安装、刷新或重启命令。

## Migration Plan

1. 在 Client 中增加成功预览后的 Tag reconciliation 和 UI 提示，不改动 RPC 边界或确认 payload。
2. 调整设置页关键按钮、导入步骤按钮、行操作和选择标签的局部命中区样式；将 Service Target 创建按钮改为 secondary。
3. 更新 `test/client-contract.test.mjs`，覆盖 Tag 交集/清空语义、零结果说明、44px 样式边界、checkbox/radio 排除和 action class 层级。
4. 运行 `node --check`、完整 `pnpm test`、`pnpm run check`、`git diff --check` 及 OpenSpec 严格校验。
5. 使用单独的 3091 测试 DSH 实例加载测试包，验证文档 A 选 Tag 后切换到文档 B、键盘路径、按钮尺寸和无横向溢出；明确不触碰 3080。
6. 若出现回归，回滚 `lib/client.js`、Client contract 和本 change artifacts；无需数据迁移、Host 回滚或 Registry 修复。

## Open Questions

无。Tag 的大小写不敏感匹配、全部失效时恢复空筛选、44px 作为关键操作下限，以及 3091 隔离测试边界均已在本设计中确定。
