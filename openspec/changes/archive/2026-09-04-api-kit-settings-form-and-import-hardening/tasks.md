## 1. 表单控件样式基础

- [x] 1.1 盘点并标记 `lib/client.js` 中所有普通 text/search input、select、textarea 及 checkbox/radio 渲染点，建立普通控件与选择控件的明确样式边界；用静态检查确认没有遗漏的 bare label select 或会被通用规则命中的 checkbox/radio
- [x] 1.2 为普通 input/select/textarea 增加插件局部统一控件样式，验证普通 input/select 计算高度约为 40px、普通 textarea 初始高度至少 112px，且 OpenAPI JSON textarea 保留 150–180px 专用高度
- [x] 1.3 修复 create row、字段 grid 和窄容器布局中的 stretch/align 行为，验证套件名称、Environment、Service Target 和 Operation 普通单行 input 不再出现约 111px 或浏览器默认 23px 高度
- [x] 1.4 为直接嵌套在 label 中的 Method、Service Target、Environment、Auth Profile 等 select 统一补充字段/控件语义样式，运行 `node --check lib/client.js` 与相关 Client contract 测试确认无业务渲染语法回归

## 2. 稳定字段 ID 与可访问性关联

- [x] 2.1 将通用字段渲染改为接受稳定业务上下文 ID，并为 Environment、Target、Operation、Import 和常规选择字段补齐显式 ID；验证 label 的 `for` 只指向对应控件
- [x] 2.2 为每个 Environment Endpoint 的 baseUrl、timeout、Host/CIDR、高级策略控件构造包含环境上下文的稳定 ID；验证多 Environment 同时展开时所有 ID 唯一且不会随重新渲染或列表位置变化
- [x] 2.3 保持 help/error ID 从字段 ID 稳定派生，补充合同断言检查不存在 `dsh-api-kit-field--`、所有预期字段 ID 标记存在，并在浏览器 DOM 中验证 `aria-describedby` 不跨字段串联

## 3. OpenAPI 导入 header 响应式布局

- [x] 3.1 将导入 header 的标题说明、步骤导航和主按钮重排为不依赖 flex shrink 的响应式布局，验证宽屏下层级清晰且步骤导航拥有独立整行空间
- [x] 3.2 在 `@container (max-width:720px)` 下验证约 556px 真实 DSH 设置容器使用可读的三步等宽布局、主按钮独占可用行且不再压缩到约 59px
- [x] 3.3 在 `@container (max-width:520px)` 下将步骤导航降级为单列或等价可读布局，验证 320–375px/520px 以下无横向溢出、步骤按钮和主动作保持可聚焦且有足够命中区域
- [x] 3.4 更新 Client contract 覆盖 import heading 的 720px/520px 规则、步骤导航布局和主按钮响应式标记，并验证 Enter/Space/Tab 操作路径未改变且不触发额外 RPC

## 4. 集成验证与交付

- [x] 4.1 运行 `node --check lib/client.js`、`pnpm test`、`pnpm run check` 和 `git diff --check`，确认无直接请求、RPC payload、Registry、Host/Typert 或安全边界改动
- [x] 4.2 刷新真实 DSH Web 的 API 套件设置页，在约 556px、520px 以下、320–375px 和宽屏容器分别验证 Environment/Target/Operation/Import 控件 computed 尺寸、唯一 ID、label/help/error 关联与无横向溢出
- [x] 4.3 在亮色、暗色、长中文/英文/URL、键盘 Tab/Shift+Tab/Enter/Space、错误/重试/确认和 `prefers-reduced-motion` 场景完成 smoke，并确认既有分组、列表渐进展示、编辑草稿和安全确认行为保持不变
