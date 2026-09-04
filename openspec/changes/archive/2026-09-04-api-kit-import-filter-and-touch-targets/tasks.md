## 1. OpenAPI Tag 筛选状态协调

- [x] 1.1 在 Client 导入预览成功边界计算新文档的规范化 Tag 集合，并以大小写不敏感规则将已有筛选裁剪为当前文档仍存在的 Tag；验证部分失效 Tag 被移除、有效 Tag 被保留，且不在渲染期修改状态
- [x] 1.2 处理全部已选 Tag 均失效的情况，将筛选恢复为空数组代表的“不筛选”语义；验证无 Tag Operation 仍被包含，并确认预览失败时不会擅自清理筛选
- [x] 1.3 增加筛选迁移提示和零结果提示，分别说明自动移除/清除的 Tag、当前将导入的范围，以及“0 个可导入 Operation”时清除或重新选择 Tag 的操作路径；验证提示不替代错误且确认按钮仍在零结果时禁用

## 2. 触控命中区与操作层级

- [x] 2.1 调整设置页按钮覆盖样式，使主要按钮、导入步骤按钮和 Operation 行操作按钮的垂直命中区至少为 44px；验证既有宽度约束、换行和窄容器布局不会产生横向溢出
- [x] 2.2 为 checkbox/radio 的外围选择标签提供至少 44px 的可操作区域，同时保持原生 checkbox/radio 不受普通 input 高度规则影响；验证选择语义、键盘操作和焦点样式未改变
- [x] 2.3 将连接配置中的“添加 Service Target”调整为 secondary/outline，并验证“添加 Environment”仍为 primary、两个按钮回调和可用性不变

## 3. 合同测试与静态边界

- [x] 3.1 更新 `test/client-contract.test.mjs`，覆盖 Tag reconciliation、全部失效恢复不筛选、零结果指导文案、44px 命中区、checkbox/radio 排除及 Service Target secondary class；验证 Client 不新增直接 `fetch(`、RPC 描述或安全边界代码
- [x] 3.2 运行 `node --check lib/client.js`、`node --check test/client-contract.test.mjs`、`pnpm test`、`pnpm run check` 和 `git diff --check`，确认完整测试与 manifest 校验通过
- [x] 3.3 运行 `openspec validate "api-kit-import-filter-and-touch-targets" --type change --strict` 和 `openspec validate --specs`，验证本变更 artifacts 与主 spec 结构有效

## 4. 隔离实例 Smoke 验证

- [x] 4.1 准备仅用于测试的独立 DSH 实例/配置并确认监听 `127.0.0.1:3091`；验证测试过程不安装、刷新、调试、操作或重启 `3080`，且不把测试数据写入用户正在使用的实例
- [x] 4.2 在 3091 的设置页执行文档 A 预览、选择 Tag、替换为不含该 Tag 的文档 B；验证预览成功、失效筛选被修剪或清除、零结果假性卡死消失且未执行导入/保存/删除
- [x] 4.3 在 3091 的约 556px、520px 以下及 320–375px 容器中验证关键按钮和步骤按钮至少 44px、Operation 行操作可达、checkbox/radio 标签可点击、键盘 Tab/Shift+Tab/Enter/Space 路径可用，并确认 `scrollWidth === clientWidth`
