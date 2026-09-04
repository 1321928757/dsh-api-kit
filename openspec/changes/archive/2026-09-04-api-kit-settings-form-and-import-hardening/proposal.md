## Why

真实 DSH 设置容器宽度约为 556px 时，API 套件设置页的普通 Environment、Service Target 和 Operation 表单控件仍回退到浏览器默认样式，部分输入框高度约 23px，套件名称输入框还会被布局拉伸到约 111px。与此同时，导入区域的 header 在约 448px 的实际内容宽度中发生 flex 挤压，三步导航被压缩到约 59px 宽，导致导入入口难以扫描和操作。现在需要先修复这两个基础问题，避免继续在不稳定的控件和窄屏布局上叠加信息架构改动。

## What Changes

- 建立插件字段范围内统一的普通表单控件样式，覆盖 text/search input、select 和 textarea，并明确排除 checkbox/radio 等选择控件。
- 统一普通 input/select 的约 40px 控件高度、边框、内边距、字体、背景和 focus 状态；textarea 使用独立的最小高度策略，保留 OpenAPI 文档输入框的专用高度。
- 让 Environment、Service Target、Operation、导入配置和空白套件创建中的所有实际字段都进入统一控件样式范围，包括当前直接嵌在 bare label 中的 select。
- 防止普通输入框被 create row 或其他 flex/grid 容器非预期拉伸，确保套件名称输入框恢复为普通单行控件高度。
- 为动态字段提供稳定且上下文唯一的 ID，避免中文 label 归一化后生成重复的 `dsh-api-kit-field--`，并保持 label、help、error 与控件的正确关联。
- 在真实设置容器宽度下重排 OpenAPI 导入 header：标题说明、步骤导航和“校验并预览”动作不再互相挤压；720px 容器断点下改为可控的单列/整行布局，520px 以下进一步将步骤导航降级为单列。
- 增加控件尺寸、ID 唯一性、窄容器导入布局和键盘/focus 语义的 Client contract 与真实 DSH Web 验收覆盖。
- 保持现有 RPC、参数/结果、Registry 数据模型、Host 校验、安全策略、导入事务、分组状态和其他业务交互不变。

## Capabilities

### New Capabilities
- 无。本变更扩展现有 `plugin-settings-ui` 能力，不引入新的能力目录。

### Modified Capabilities
- `plugin-settings-ui`: 增加表单控件一致性、动态字段唯一语义关联，以及 OpenAPI 导入 header 在窄设置容器中的响应式要求。

## Impact

- 主要影响 `lib/client.js` 的局部 CSS、字段渲染 helper、Environment/Service Target/Operation/导入表单的字段 ID 传递，以及 OpenAPI import header 的 container-query 布局。
- 影响 `test/client-contract.test.mjs`，新增静态合同断言；必要时补充只读浏览器 smoke 检查脚本或记录。
- 不新增 RPC、HTTP 请求、依赖、Host 服务、Typert 方法、Registry 字段、连接测试或安全策略。
- 不改变导入/保存/删除/确认的业务 payload 和现有状态机；本变更仅调整 Client 展示层、DOM 语义和局部响应式样式。
