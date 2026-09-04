## Context

当前 `settings.section` 由 `lib/client.js` 的动态 Client 渲染，表单字段主要通过 `textField()` 生成，同时仍有若干直接嵌套在 `<label>` 中的 `select`。现有控件样式依赖 `.dsh-api-kit-form`，而真实设置容器约 556px 宽时，部分字段位于 `.dsh-api-kit-field` 或 bare label 下，因此回退到浏览器默认控件样式。导入卡片的 `.dsh-api-kit-import-heading` 仍是横向 flex，标题、步骤导航和主按钮在窄容器中互相争夺宽度。上一项变更已经建立顶层分组、紧凑列表和渐进展示，本变更只在其上修复表单基础和导入 header，不重做信息架构或业务交互。

## Goals / Non-Goals

**Goals:**

- 以一个可复用的 Client 字段/控件样式边界覆盖所有普通输入和选择字段，同时保持 checkbox/radio 的独立语义。
- 让普通 input/select/textarea 在真实 settings 容器和窄宽下具备稳定、可读、主题一致的尺寸，并消除 flex/grid stretch 导致的异常高度。
- 将字段 ID 从展示 label 推导改为调用上下文提供的稳定标识；对重复 Environment Endpoint 字段使用环境上下文构造唯一 ID。
- 在 556px 左右的真实容器内让导入标题、步骤和主动作有明确的分行关系，并在更窄容器进一步降级。
- 通过静态合同断言和真实 DSH Web smoke 验证尺寸、ID、响应式、键盘和无横向溢出。

**Non-Goals:**

- 不改变 RPC、HTTP、导入事务、Registry 模型、Host/Typert、安全校验、凭据处理或连接测试。
- 不增加 Operation 搜索/筛选、批量操作、更多菜单或持久化布局偏好。
- 不在本变更中重构顶层 `details/summary` disclosure，不改变默认分组策略。
- 不引入第三方 UI 库、独立 CSS 框架或新的 DSH Slot。

## Decisions

### 1. 采用显式控件类加字段 helper 的双重边界

普通控件样式应同时由显式的插件控件类和字段上下文选择器兜底，而不是继续依赖某个父级是否叫 `.dsh-api-kit-form`。`textField()` 生成的 input/textarea、导入配置中的直接 select、Operation 的 Method、Target/Environment/Auth Profile select 均应落入统一边界。checkbox/radio 使用已有的 choice/check/import-mode 选择器，并通过 `type` 或专属 class 排除普通控件规则。

**原因：**当前缺陷正是父级结构不一致造成的；显式类能让新增字段不必依赖 DOM 层级，字段范围兜底可降低遗漏现有 bare label 的风险。

**替代方案：**只把 CSS 选择器扩大到 `.dsh-api-kit-settings label > input`。这种方式能快速覆盖，但会把 checkbox/radio 一并命中，且无法清楚表达字段控件契约，因此不采用为唯一方案。

### 2. 普通控件固定单行高度，textarea 独立覆盖

普通 text/search input 和 select 使用 `box-sizing:border-box`、`width:100%`、`height/min-height:40px`、DSH border/surface/text token 和 `font:inherit`；textarea 使用 `height:auto` 与至少 112px 的最小高度。OpenAPI JSON textarea 保留单独的 150–180px 约束。控件类不设置 `appearance:none` 作为硬要求，以保留宿主浏览器 select 的可识别下拉 affordance；若后续需要自定义箭头，另行设计。

**原因：**同时解决默认 23px 控件和 111px flex stretch，保持 DSH 主题和原生控件可用性，避免为视觉一致性引入额外图标依赖。

**替代方案：**只使用 `min-height:40px`。它无法阻止 flex/grid 将单行 input 拉高，因此必须同时设置 `height:40px` 和合适的 `align-self`/容器布局规则。

### 3. 字段 ID 采用业务上下文显式传入

保留 `textField(label, ...)` 的展示 label 参数，但将稳定 ID 作为 options 的明确输入，并为通用调用提供不会由中文归一化产生空 ID 的稳定 fallback。现有重复字段调用点应传入业务语义 ID；Endpoint 的 ID 以 endpoint 容器稳定 ID加字段后缀构造。help/error ID 继续由控件 ID 派生，保证一对一关联。实现不得使用每次渲染递增的模块级 counter 作为唯一解决方案，也不得让 ID 随列表索引变化。

**原因：**显式业务 ID 能让 label、help、error、自动化测试和焦点关系可审查，并且在多 Environment 重复渲染时保持唯一。

**替代方案：**仅增强 label 的 ASCII slug（如添加固定 `field` 前缀）。这仍无法区分同一中文 label 的多个业务字段和多个 Endpoint，排除。

### 4. 导入 header 在 720px 断点先改为 grid，在 520px 断点再单列步骤

宽屏保持标题区和主动作同一行、步骤导航占独立整行的布局；`@container (max-width:720px)` 将 import heading 改为单列或标题/动作加步骤整行的 grid，步骤列表使用三列等宽最小轨道，主按钮占满可用宽度；`@container (max-width:520px)` 将步骤列表降为单列并保留足够的按钮高度。关键是 720px 断点负责捕获真实 556px 设置容器，520px 只负责更窄的最终降级。

**原因：**真实测试表明 556px 时现有 520px 规则不生效，而 720px 规则可以在内容仍有空间时提前阻止 flex shrink。

**替代方案：**仅提高 `flex-shrink:0` 或给步骤设置固定宽度。固定宽度会在更窄容器制造溢出，不能形成连续的响应式降级，排除。

### 5. 仅在 Client contract 中验证静态不变量，浏览器验证行为与尺寸

在 `test/client-contract.test.mjs` 中验证统一控件 class/选择器、40px/112px 样式标记、checkbox/radio 排除、显式字段 ID、Endpoint ID 后缀、720px/520px import header 规则和无直接请求边界。真实 DSH Web 中对 Environment 表单、Operation 编辑器和导入卡片测量 computed height/width，检查重复 ID、label for、aria-describedby、步骤轨道宽度和横向溢出。静态测试不假装替代浏览器测量。

**原因：**plain JavaScript Client 没有独立组件测试 harness；合同测试能防止关键结构回归，浏览器测量能捕获宿主 CSS 和实际容器宽度造成的问题。

**替代方案：**仅运行 `node --check`/`pnpm test`。它们无法发现 computed style、flex shrink 和真实 DOM ID 重复，排除。

## Risks / Trade-offs

- [Risk] 扩大控件 CSS 选择器可能误命中 checkbox/radio 或宿主注入的特殊控件 → 使用显式普通控件 class/类型排除，并在浏览器验证 checkbox/radio 的尺寸与交互。
- [Risk] 显式 ID 漏改某个直接 select 或旧字段调用 → 对所有实际字段调用点逐项盘点；合同测试检查旧的 `dsh-api-kit-field--` 模式不存在，并在真实表单收集全量 `[id]` 验证唯一性。
- [Risk] 固定 40px 高度与宿主大字号或自定义 skin 冲突 → 使用 `box-sizing`、`font:inherit`、可读 line-height 和 DSH token；在亮/暗主题及大字号/长中文路径下检查溢出。
- [Risk] 720px 下步骤三列仍可能因极长本地化文案而拥挤 → 三列使用 `minmax(0,1fr)`，按钮允许换行；520px 下提供单列最终降级，不使用固定像素列宽。
- [Risk] 调整字段 DOM class 或 ID 影响已有自动化选择器 → 保留显式的业务 ID（含既有稳定 ID），只修复重复/空 ID；必要时为旧的显式 ID 保持兼容，不依赖 label slug。
- [Risk] CSS 修复掩盖了导入或保存状态问题 → 不修改回调、payload 或 RPC 路径；运行现有完整测试并验证预览、重试、确认和保存路径仍可用。

## Migration Plan

1. 按现有 `plugin-settings-ui` 主 spec 和本变更 delta，盘点 `lib/client.js` 中所有普通 input/select/textarea 和动态字段 ID 调用点。
2. 在 Client 内加入统一普通控件边界与 textarea/OpenAPI 特殊覆盖，修复 create row 和相关布局的 stretch 行为。
3. 为 Environment、Target、Endpoint、Import、Operation 和选择字段传入稳定业务 ID，并确认 help/error/label 关联。
4. 将 import heading 在 720px/520px container query 下改为不挤压的 grid/单列布局。
5. 更新 Client contract，运行 `node --check lib/client.js`、`pnpm test`、`pnpm run check` 和 `git diff --check`。
6. 刷新已有 DSH Web 的真实 API 套件设置页，测量约 556px、520px 以下和宽屏，验证尺寸、唯一 ID、键盘路径、主题、错误/重试/确认和无横向溢出。
7. 若出现回归，回滚 Client bundle 与合同测试即可；无需 Registry、Host 或数据迁移。

## Open Questions

无。普通控件高度、字段 ID 策略和 720px/520px 响应式分工已经由现有实测结果确定；后续只需在实现中确认所有字段调用点均已覆盖。
