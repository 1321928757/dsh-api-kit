---
name: dsh-openspec-workflow
description: Lightweight, human-reviewed OpenSpec workflow for software projects, with optional DeepSeek Harness guidance. Use when a user wants AI to explore, plan, implement, verify, and archive a change without manually writing every artifact or running every command.
allowed-tools: Bash(openspec:*)
license: MIT
compatibility: Requires openspec CLI and a project initialized with OpenSpec.
metadata:
  author: dsh-api-kit
  version: "1.0"
---

# 轻量 OpenSpec 工作流

本 Skill 提供一套适用于软件项目的轻量、可审阅 Spec-Driven Development（SDD）工作流。它不绑定特定语言、框架、仓库类型或部署方式，可以用于功能开发、缺陷修复、重构、文档改进和 UI 优化等任务。

本 Skill 部署在 DSH 的 Agent Skills 环境中，因此额外包含一个可选的 DSH 适配小节；只有项目确实是 DSH 插件时，才应用其中的 Slot、Client/Host、主题令牌和真实 DSH Web 约束。其它项目只遵循通用流程和项目自身的技术约定。

核心目标是让用户只负责：

1. 提出需求或想法；
2. 审阅 AI 生成的 OpenSpec 规划文档；
3. 明确批准实现；
4. 审阅验证结果。

AI 负责：

1. 调查代码和需求；
2. 生成 proposal、spec、design、tasks；
3. 按已批准的 tasks 修改代码；
4. 测试和验证；
5. 在用户确认完成后归档 change。

## 核心流程

需求明确时，使用最短链路：

```text
[用户提出需求]
        |
        v
[propose: AI 生成规划文档]
        |
        v
[人工审阅文档]
   |                 |
   | 需要修改        | 通过
   v                 v
[修改规划]       [apply: AI 实现]
                     |
                     v
             [verify: AI 验证]
               |          |
               | 有问题   | 可接受
               v          v
          [修复/重新探索] [archive: 归档]
```

需求模糊、较大或存在多种方案时，在 propose 前加入可选的 explore：

```text
[用户想法]
    |
    v
[explore: 调查、澄清、比较方案] -- 可选
    |
    v
[propose: 生成正式 change 文档]
    |
    v
[人工审阅]
    |
    v
[apply] -> [verify] -> [archive]
```

`explore` 是思考阶段，不是强制阶段；`propose`、`apply`、`verify`、`archive` 才是正式 change 生命周期的主要节点。

---

## 1. Explore：探索和澄清

### 用途

`explore` 用于把模糊想法变成较清晰的问题定义和候选方案。它回答：

- 当前真正要解决的问题是什么？
- 需求边界在哪里？
- 是否应该拆成多个 change？
- 有哪些实现方案和取舍？
- 会影响哪些挂载点、组件、数据通道、测试或部署/运行环境？如果是 DSH 插件，再检查 Slot、Client bundle、Host RPC 和真实 Web 验收；
- 有哪些风险、依赖和未决问题？

它更像“技术/产品讨论伙伴”，而不是执行流程。

### 适用时机

以下情况优先使用 Explore：

- 用户只说“页面很乱”“认证系统需要重构”等模糊问题；
- 需求包含多个相互关联的问题；
- 需求可能过大，需要拆分成多个 change；
- 存在多种实现方式，需要比较复杂度和风险；
- Apply 过程中发现原设计与实际代码不一致；
- 不确定是否需要修改 Host、RPC、Registry 或安全边界。

以下情况可以跳过 Explore，直接进入 Propose：

- 用户已经明确目标、范围、非目标和验收标准；
- 这是一个局部、低风险且实现方式明显的修复；
- 用户已经在之前的 Explore 中确认了方案。

### 基本使用方式

可以使用：

```text
/openspec-explore
```

或直接用自然语言说明：

```text
请先进入 Explore 模式，只调查当前 dsh-api-kit 设置页的实现，分析问题和方案，不修改代码。
```

AI 在 Explore 阶段可以：

- 运行 `openspec list --json` 查看当前 change；
- 读取 `openspec/config.yaml` 和已有 change 工件；
- 只读扫描项目代码、测试和文档；
- 画 ASCII 结构图；
- 比较候选方案；
- 提出澄清问题；
- 建议 change 名称、范围和 Non-Goals。

AI 在 Explore 阶段不得：

- 修改业务代码；
- 修改测试、配置或构建产物；
- 直接实现用户需求；
- 因为用户回答了设计问题，就把回答当成代码修改授权。

如果用户在 Explore 阶段要求实现，AI 必须说明当前处于思考模式，并建议先完成 Propose、人工审阅，再由用户明确启动 Apply。

### Explore 的输出

Explore 不要求固定文档，但通常应输出：

- 问题总结；
- 当前代码结构和相关文件；
- 候选方案及取舍；
- 推荐的最小 change 切片；
- 明确的 Non-Goals；
- 风险和未决问题；
- 是否已经适合进入 Propose。

示例：针对 dsh-api-kit 设置页，Explore 可以建议先只做“Operation/Service Target 列表紧凑化和渐进展示”，把术语统一、重复安全说明和输入框高度拆成后续 change。

### Explore 与已有 Change

如果用户指定已有 change，先读取：

```text
proposal.md
specs/.../spec.md
design.md
tasks.md
```

然后围绕已有工件讨论。确定新的设计决定、需求、范围或任务后，先告诉用户准备修改哪些 OpenSpec 工件，并等待明确确认；不要自动捕获讨论结果。

建议的捕获位置：

| 探索结论 | 工件 |
|---|---|
| 范围变化 | `proposal.md` |
| 新增或修改需求 | `specs/<capability-path>/spec.md` |
| 技术方案变化 | `design.md` |
| 新增实施工作 | `tasks.md` |

---

## 2. Propose：生成正式规划

### 用途

`propose` 把用户需求或 Explore 结论正式变成一个 OpenSpec change，并一次性生成实施所需的规划工件。

默认使用 `spec-driven` schema，通常包括：

```text
openspec/changes/<change-name>/
├── proposal.md
├── specs/<capability-path>/spec.md
├── design.md
└── tasks.md
```

### 适用时机

当以下信息基本明确后进入 Propose：

- 要解决的问题；
- 本次 change 的目标；
- 主要范围和 Non-Goals；
- 大致验收标准；
- 是否需要保留现有兼容性和安全行为。

如果这些信息仍然不清楚，应先 Explore，而不是让 Propose 猜测一个很大的范围。

### 基本使用方式

用户可以输入：

```text
/openspec-propose
```

并附上自然语言需求。例如：

```text
请为 dsh-api-kit 设置页创建一个轻量 OpenSpec change。
本次只处理 Operation 和 Service Target 列表紧凑化、长列表渐进展示以及首屏分组。
不修改 Host、RPC、Registry、Typert 和安全策略，也不处理术语统一与输入框高度。
请一次性生成 proposal、specs、design 和 tasks，只做规划，不修改代码。
```

AI 应在内部完成必要的 OpenSpec CLI 操作：

```bash
openspec new change "<change-name>"
openspec status --change "<change-name>" --json
openspec instructions <artifact-id> --change "<change-name>" --json
```

用户通常不需要亲自运行这些命令，也不需要手写 Markdown。

### Propose 的内容要求

#### Proposal

至少说明：

- 为什么要做；
- 要改变什么；
- 明确的 Non-Goals；
- 影响哪些文件或模块；
- 项目兼容性、安全边界和集成约束；对于 DSH 插件，再补充 Slot、Client/Host 等宿主约束。

#### Spec

使用可验证的需求和场景：

```markdown
### Requirement: Compact operation list

#### Scenario: Operation 数量较多

- **WHEN** 当前套件包含大量 Operation
- **THEN** 页面默认使用紧凑列表
- **AND** 用户可以查看全部条目
- **AND** 编辑、启用/禁用和删除操作仍然可用
```

适用时应覆盖：

- 正常状态；
- 空状态；
- 加载状态；
- 错误和重试；
- disabled/readonly；
- 键盘和无障碍；
- 窄容器和长文本；
- 项目自身的主题、权限、安全边界和兼容性；
- 对 DSH 插件，再覆盖 DSH 主题、宿主安全边界和真实 Web 验收。

#### Design

至少记录：

- 当前项目的挂载点、集成点和相关组件；如果是 DSH 插件，则记录 Slot、Client bundle 和 Host/Remote 边界；
- 数据来源和状态管理；
- 关键技术决策及原因；
- 响应式、键盘和错误处理策略；
- 明确不修改的 Host/RPC/安全部分；
- 风险和回滚方式。

#### Tasks

每一项都应是可执行复选框，并包含验证方式：

```markdown
- [ ] 将 Service Target 列表改为紧凑行布局。验证：检查字段、编辑和删除操作。
- [ ] 为超过阈值的 Operation 列表增加显示全部入口。验证：检查 aria-expanded 和键盘操作。
- [ ] 运行客户端合同测试和全量回归。验证：记录命令结果。
```

### Propose 的停止边界

Propose 只负责规划，不负责实现：

1. 创建 change；
2. 生成所需工件；
3. 显示 change 名称、位置和状态；
4. 停止并等待用户审阅。

即使用户最初说“请规划并实现”，本次 Propose 请求也不能自动修改业务代码。Apply 必须由用户在审阅后通过新的明确请求启动。

---

## 3. 人工审阅：Apply 前的批准闸门

人工审阅不是一个 OpenSpec CLI 命令，而是必须保留的用户决策阶段。

用户重点检查：

- Proposal 是否准确描述问题；
- 本次范围是否足够小；
- Non-Goals 是否排除了无关的基础设施、接口、数据、安全和发布工作；
- Specs 是否包含可测试的 Requirement/Scenario；
- 是否覆盖空、错、加载、键盘、窄屏等适用状态；
- Design 是否符合当前项目结构和技术约定；
- 是否继续使用项目现有的挂载点、组件契约和数据通道；
- 如果是 DSH 插件，是否继续使用现有 Slot、主题令牌和宿主边界；
- Tasks 是否可以逐项执行和验收。

用户可以要求 AI 反复修改规划工件：

```text
我审阅了规划文档，请只修改 proposal、specs、design 和 tasks：
1. 将范围限制为 Operation 列表；
2. 增加空列表、加载失败和窄屏场景；
3. 明确不修改 RPC 和 Host 安全策略；
4. 不要开始写代码。
```

只有用户明确表达批准，例如：

```text
规划已审核通过，请按这个 change 实现。
```

或显式调用：

```text
/openspec-apply-change <change-name>
```

才能进入 Apply。

---

## 4. Apply：按批准的任务实现

### 用途

`apply` 根据已经审阅通过的 proposal、specs、design 和 tasks 修改代码，完成任务并更新任务状态。

### 适用时机

只有在以下条件满足时使用：

- Change 已经创建；
- 规划工件齐全；
- 用户已经审阅并批准；
- Change 名称明确。

### 基本使用方式

```text
/openspec-apply-change <change-name>
```

或：

```text
规划已审核通过，请实现 <change-name>，严格按照 tasks 执行。
```

AI 应先在内部读取：

```bash
openspec status --change "<change-name>" --json
openspec instructions apply --change "<change-name>" --json
```

并读取 Apply 指令返回的全部 `contextFiles`，而不是凭对话记忆猜测规划内容。

### Apply 的执行规则

对每个任务：

1. 宣布正在处理的任务；
2. 读取相关代码和测试；
3. 做最小范围修改；
4. 运行该任务对应的检查；
5. 确认行为完整后，把 tasks 中的 `- [ ]` 改为 `- [x]`；
6. 继续下一个任务。

Apply 阶段必须：

- 保持实现与已批准工件一致；
- 不静默扩大范围；
- 保留项目现有的挂载点、组件/接口契约、数据边界和安全门禁，除非工件明确要求修改；
- 对 DSH 插件，继续保留现有 Slot、Client/Host 边界和 RPC 契约；
- 保留 loading、empty、error、retry、disabled、focus-visible、ARIA、窄屏和主题行为；
- UI 项目应使用现有主题令牌和样式命名空间；对 DSH UI 还要遵守宿主主题令牌和插件命名空间；
- 不覆盖用户已有未提交修改；
- 不使用 `git reset --hard` 或 `git clean` 清理工作区。

对于 dsh-api-kit，UI change 默认应优先限制在必要的 Client 和测试文件，避免把 Host 的调用、安全、SSRF、OAuth、审计或 Registry 语义混入纯 UI 需求。

### Apply 必须暂停的情况

遇到以下情况必须暂停并询问用户：

- task 描述不清楚；
- 实际代码与 design 冲突；
- 需要新增工件中没有的需求；
- 需要修改 Host/RPC/Registry/安全边界；
- 测试失败且原因不明确；
- 需要删除、缩小或静默延期某个已批准行为；
- 当前用户工作区存在无法安全区分的既有修改。

可采用的回退路径：

```text
Apply 发现设计问题
        |
        v
回到 Explore 分析方案
        |
        v
更新 proposal/specs/design/tasks
        |
        v
用户重新审阅
        |
        v
继续 Apply
```

---

## 5. Verify：归档前验证

### 用途

`verify` 检查实际实现是否符合 change 工件，而不是只检查“代码能否运行”。

### 适用时机

以下情况使用 Verify：

- 所有实现任务完成后；
- 准备归档前；
- Apply 中途需要确认实现是否偏离设计时；
- 用户要求审查需求覆盖和测试完整性时。

### 基本使用方式

```text
/openspec-verify-change <change-name>
```

AI 应读取：

```bash
openspec status --change "<change-name>" --json
openspec instructions apply --change "<change-name>" --json
```

并读取所有规划工件。

### Verify 的检查维度

#### Completeness：完整性

- tasks 是否全部标记为完成；
- 每个 Requirement 是否都有实现证据；
- 是否遗漏了规划中的文件、测试或集成任务。

#### Correctness：正确性

- 实现是否符合 Requirement 的意图；
- 每个 Scenario 是否有代码处理；
- 测试是否覆盖关键路径；
- 是否保留了错误、空态、加载和恢复行为。

#### Coherence：一致性

- 是否遵守 design.md 的关键决策；
- 是否符合现有项目代码模式；
- 是否违反 DSH Slot、Client/Host、主题、生命周期或安全边界。

报告应区分：

- `CRITICAL`：必须修复后才能归档；
- `WARNING`：应处理或由用户明确接受；
- `SUGGESTION`：可选改进。

### DSH 特别验证

对于 DSH 插件 UI，Verify 不能只依赖静态合同测试，还应在可行时检查：

- 亮色和暗色主题；
- DSH 真实 Web 宿主，而不是独立 Vite 页面；
- 320–375px、480–560px、680–768px 和桌面宽度；
- Tab/Shift+Tab、Enter/Space、Escape；
- focus-visible、ARIA 和错误关联；
- loading、empty、error、retry、disabled 和 success；
- 长中文、长英文、长路径和大字号；
- `prefers-reduced-motion`；
- 没有横向溢出、焦点丢失和 overlay 层级问题。

静态测试可以证明代码合同，不能冒充真实 DSH Web 验收。若浏览器环境不可用，应明确记录为“未验证”或“不适用”，不能声称通过。

### Verify 失败后的处理

```text
[Verify 发现问题]
        |
        +--> 代码遗漏但设计正确 -> 回到 Apply 修复
        |
        +--> 设计不合理 -> 回到 Explore，更新工件后再 Apply
        |
        +--> 需求变化 -> 更新 proposal/specs/tasks，重新审阅
        |
        +--> 仅为可接受建议 -> 用户决定是否处理
```

不要用 `--no-validate` 或其它方式绕过关键问题来强行归档。

---

## 6. Archive：归档决策历史

### 用途

`archive` 表示一个 change 已经完成，并将其规划和实现决策保存为项目历史。

归档不是“删除任务”，也不是替代 Git 提交。它保留：

- 为什么做这次改动；
- 需求和场景是什么；
- 采用了什么设计；
- 任务如何实现和验证；
- 规格是否需要同步到主规格。

### 适用时机

只有在以下条件满足后归档：

- Apply 任务已经完成，或用户明确接受遗留项；
- Verify 没有未处理的 Critical；
- 用户确认验证结果可接受；
- 必要的测试、打包和目标运行环境验收已经完成；如果是 DSH 插件，则包括真实 DSH Web 验收，未验证项已明确记录。

### 基本使用方式

```text
/openspec-archive-change <change-name>
```

或者：

```text
验证结果可以接受，请归档 <change-name>。
```

AI 应使用 OpenSpec 的归档命令和当前 CLI 提示：

```bash
openspec instructions archive --change "<change-name>" --json
openspec status --change "<change-name>" --json
openspec archive "<change-name>" --yes
```

如果存在 delta specs，按 CLI 和用户选择处理主规格同步；不要凭猜测硬编码路径，也不要在同步仍未完成时移动 change。

归档后应报告：

- change 名称；
- 使用的 schema；
- 归档位置；
- 是否同步主规格；
- 是否存在未完成任务或未验证项目；
- 建议用户继续进行 Git diff 审查、提交、打包或发布验收。

### Archive 的边界

归档不等于：

- 代码已经自动提交 Git；
- npm 包已经发布；
- 真实 DSH Web 已经验证；
- 所有后续问题都已经解决。

归档前仍要尊重用户工作区已有修改，不要替用户执行破坏性 Git 操作。

---

## 通用项目约束与 DSH 适配

以下原则适用于绝大多数软件项目；其中的 DSH 适配小节只在项目确实是 DSH 插件时适用。

### 需求和范围

- 优先把大需求拆成多个可独立验证的小 change；
- 每个 change 只保留一个主要目标；
- Proposal 必须有 Non-Goals；
- 新需求、设计变化和任务变化应回写到对应工件；
- 不要因为实现方便就静默改变需求。

### UI 项目通用约束

- 先确认现有 UI 挂载点、组件契约、数据通道和生命周期；
- 不使用未经确认的框架扩展点、组件 API 或主题令牌；
- 使用项目现有的主题/设计令牌和样式命名空间，避免用独立视觉系统覆盖宿主；
- CSS 或样式修改应保持作用域，不随意覆盖全局元素和其它模块；
- 保留语义 HTML、focus-visible、ARIA、键盘、reduced-motion 和响应式行为；
- 所有异步区域有 loading、ready、error、retry 和 success/empty 等适用状态；
- 不把真实 secret、token、权限数据或未授权的外部目标暴露到客户端。

### DSH 插件适配约束

只有项目是 DSH 插件时才适用：

- 进一步确认 Slot、props、Remote/Service 和客户端加载契约；
- 使用 DSH 主题令牌，不用独立品牌色覆盖宿主；
- CSS 使用插件前缀或 CSS Modules，不覆盖全局 `body`、`#root`、裸 `button`、裸 `input`；
- 不把真实 Host、CIDR 或其它不应暴露的数据发送到 Client。

### dsh-api-kit 特别注意

- UI change 默认不要改 Host 的执行器、SSRF、OAuth、审计、Registry 和写确认语义；
- 浏览器 Client 不应直接 `fetch` API；继续通过已批准的 Host 数据通道；
- 不要把 OpenAPI `servers[].url` 自动当作执行目标；
- 不要把静态合同测试当作真实 DSH Web 通过证据；
- 仓库存在未提交修改时，先区分用户已有工作和本次 change，不能重置工作区。

---

## 最简命令参考

用户通常只需要自然语言调用以下五个 Skill：

```text
/openspec-explore                         # 需求不清楚时使用，可选
/openspec-propose                         # 生成完整规划文档
/openspec-apply-change <change-name>      # 用户审阅通过后实现
/openspec-verify-change <change-name>     # 实现后、归档前验证
/openspec-archive-change <change-name>    # 用户确认后归档
```

AI 在内部可能使用以下 CLI，但不应要求用户手动完成全部命令：

```bash
openspec --version
openspec list --json
openspec new change "<change-name>"
openspec status --change "<change-name>" --json
openspec instructions <artifact-id> --change "<change-name>" --json
openspec validate "<change-name>" --type change --strict --no-interactive
openspec archive "<change-name>" --yes
```

默认不需要使用：

- store；
- 自定义 schema；
- bulk archive；
- onboarding 全流程；
- continue-change 的逐个工件模式；
- fast-forward；
- sync-specs，除非确实需要单独同步主规格。

这些是轻量流程的默认建议，不是对其它项目或特殊场景的硬性禁止；如果项目已有团队流程、特殊 schema 或独立规格维护要求，应以项目约定和用户明确要求为准。

---

## AI 行为准则

1. 用户提出需求时，先判断需求是否明确；不明确则 Explore，明确则可直接 Propose。
2. Propose 只写 OpenSpec 规划工件，不改业务代码。
3. 规划完成后必须停下来让用户审阅。
4. 用户审阅通过不等于自动获得实现授权；Apply 需要新的明确请求或显式 Skill 调用。
5. Apply 前读取完整工件，按 tasks 顺序实现，并即时更新复选框。
6. Apply 遇到范围、设计、测试或安全问题时暂停，不要自行猜测或扩大范围。
7. Verify 必须检查完整性、正确性和设计一致性，并如实区分静态验证与真实 DSH Web 验证。
8. Archive 前处理 Critical 问题并确认用户接受结果。
9. 不使用破坏性 Git 操作覆盖用户已有修改。
10. 除非用户另有要求，优先使用当前项目默认 OpenSpec schema，并保持流程轻量；如果项目有明确约定，则遵循项目约定。
