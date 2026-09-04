## 1. 列表展示状态与分组骨架

- [x] 1.1 在现有设置页组件内增加 Operation、Service Target 以及顶层分组的局部展开状态，集中定义初始展示阈值，并验证刷新/局部请求完成后不会重置用户主动选择
- [x] 1.2 将导入、连接配置、套件与 Operation 工作台组织为语义清晰的可折叠分组，按“已有套件优先工作台、无套件优先导入”的规则设置默认展开，并验证编辑器、dirty、错误和进行中操作不会被隐藏

## 2. Operation 紧凑列表与渐进展示

- [x] 2.1 将 Operation 卡片渲染调整为紧凑列表行，保留 Method、名称/operationId、Path、Service Target、启用状态及启用/禁用、编辑、删除入口，并验证每个既有回调和稳定 React key 仍然有效
- [x] 2.2 为超过阈值的 Operation 列表加入“显示全部/收起”控件、剩余数量文案和焦点可用的键盘路径，并验证展开/收起仅改变前端展示、不产生额外 RPC
- [x] 2.3 为 Operation 行补充窄容器和长文本布局规则，使用既有 DSH token、`min-width: 0`/换行约束和可见 focus 状态，并在 320–375px、480–560px 与桌面宽度验证无横向溢出

## 3. Service Target 紧凑列表与渐进展示

- [x] 3.1 将 Service Target 卡片渲染调整为紧凑列表行，保留环境、Endpoint 完整度、Operation 数量、启用/Agent 状态及编辑/删除入口，并验证 Endpoint、Host/CIDR、凭据等敏感值未被列表布局暴露
- [x] 3.2 为超过阈值的 Service Target 列表加入“显示全部/收起”控件、剩余数量文案和可访问状态，并验证收起不会清理编辑表单、选择或草稿
- [x] 3.3 为 Service Target 行补充响应式布局、状态层级与加载/空态/局部失败承载样式，并验证失败列表仍显示既有错误和重试路径，不被误判为空

## 4. 既有交互回归与主题验收

- [x] 4.1 验证紧凑行上的 Operation 编辑、启用/禁用、删除以及 Service Target 编辑/删除仍保留 busy、成功、错误、重试、Escape、确认和 Host 校验语义；运行 `pnpm test`
- [x] 4.2 验证设置分组、渐进展示控件和现有表单支持 Tab/Shift+Tab、Enter/Space、可见 `focus-visible` 与窄屏操作，并检查 reduced-motion 下没有不必要动画
- [x] 4.3 验证亮色/暗色 DSH 主题、长中文/英文/路径、初始加载、刷新保留旧数据、空数据和部分加载失败；运行 `pnpm run check` 并确认现有 DSH Web GUI `http://127.0.0.1:3080` 可访问，刷新现有 Chrome tab 后完成 compact groups、row counts 与 Operation progressive-control smoke；修复 native disclosure 初始 toggle 不应覆盖默认分组状态的问题
- [x] 4.4 复核变更只涉及 Client 展示层与局部样式，确认没有新增 RPC、API 请求、连接测试、Registry/Typert/安全策略逻辑或套件名称输入框高度改动；检查 `openspec validate compact-plugin-settings-ui --type change --strict`
