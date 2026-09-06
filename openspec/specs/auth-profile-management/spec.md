# auth-profile-management Specification

## Purpose

为 API Kit 提供可审查、可维护且不泄露敏感值的认证配置生命周期，让用户能够管理请求认证元数据和凭据状态，并安全地将认证配置绑定到固定 Service Target 与 Operation。

## Requirements

### Requirement: Auth Profile 支持安全元数据生命周期管理

系统 MUST 支持用户创建、查看、编辑、启用/停用和删除 Auth Profile。Auth Profile MUST 使用唯一稳定 ID、显示名称、认证类型和该类型所需的非敏感元数据；支持 `none`、Bearer、Header API Key、Query API Key、Basic 和 OAuth2 Client Credentials。编辑时未提供的字段 MUST 保留原值，未知认证类型 MUST 被拒绝而不是降级为 `none`。

#### Scenario: 创建 Bearer Auth Profile
- **WHEN** 用户提交唯一 ID、名称、Bearer 类型和有效的凭据引用
- **THEN** Host 保存 Auth Profile 元数据并返回不含凭据引用和真实 secret 的安全视图

#### Scenario: 创建认证类型缺少必需元数据
- **WHEN** 用户创建 Header API Key 但未提供 Header 名称，或创建 Basic 但未提供用户名
- **THEN** Host 拒绝保存并返回可定位到字段的校验错误，Registry 不发生部分写入

#### Scenario: 编辑时省略字段
- **WHEN** 用户只修改 Auth Profile 的名称或 enabled 状态
- **THEN** 其他认证类型、非敏感参数、凭据引用和引用关系保持不变，返回值仍为安全视图

#### Scenario: 提交未知认证类型
- **WHEN** 用户提交不在支持列表中的认证类型
- **THEN** Host 拒绝请求并返回 `AUTH_TYPE_UNSUPPORTED` 或等价的稳定错误，不能将其保存为无认证配置

### Requirement: 凭据值只能通过 Host credentials 边界维护

系统 MUST 将真实 secret 保留在 Host credentials 服务中，Registry 只保存单个 `secretRef` 或等价凭据引用。系统 MUST 提供设置/替换和删除 Auth Profile secret 的受控操作；这些操作的请求和结果 MUST 不回显真实值，Client MUST 只能看到是否已配置、来源和是否可写等状态。凭据服务不可用、凭据引用无效或写入失败时，系统 MUST fail closed 并保持既有 Registry 元数据不被部分修改。

#### Scenario: 首次设置 secret
- **WHEN** 用户在已保存的非 `none` Auth Profile 中提交非空 secret
- **THEN** Host 通过 credentials 服务写入该 Profile 的 secretRef，并返回更新后的安全状态，不返回 secret 原文

#### Scenario: 替换 secret
- **WHEN** 用户提交新 secret 替换已配置凭据
- **THEN** Host 原子完成凭据服务的替换语义，后续请求使用新值，历史值、输入值和返回值均不可从普通界面或 RPC 结果读取

#### Scenario: 删除 secret
- **WHEN** 用户确认删除某个 Auth Profile 的 secret
- **THEN** Host 从 credentials 服务移除该值并返回 `hasSecret: false` 等安全状态；Auth Profile 元数据仍保留

#### Scenario: 凭据服务不可用
- **WHEN** credentials 服务不可用、不可写或写入/删除失败
- **THEN** Host 返回明确的非敏感错误，Registry 不记录真实值，UI 保留当前配置状态并提供重试路径

### Requirement: Auth Profile 安全视图和引用关系必须受保护

列出或获取 Auth Profile 时，返回值 MUST 仅包含安全元数据和凭据状态，不得包含 `secretRef`、secret、password、token、Authorization、Cookie、client secret 或完整 OAuth token endpoint URL。被 Service Target 或 Operation 引用的 Auth Profile MUST 不能删除；删除失败 MUST 返回引用位置或等价的可行动信息。停用的 Auth Profile MUST 保留配置但不能作为新的可执行认证配置使用。

#### Scenario: 查看安全视图
- **WHEN** 用户打开 Auth Profile 列表或详情
- **THEN** 页面可以看到名称、类型、非敏感配置和凭据是否已配置，但看不到凭据引用、secret 原文或完整 OAuth endpoint URL

#### Scenario: 删除仍被引用的 Profile
- **WHEN** 用户删除被 Service Target 或 Operation 引用的 Auth Profile
- **THEN** Host 拒绝删除并返回 `AUTH_PROFILE_IN_USE` 及可行动引用信息，Registry 和凭据值保持不变

#### Scenario: 停用 Auth Profile
- **WHEN** 用户停用一个已被配置的 Auth Profile
- **THEN** 既有元数据和凭据状态保留，但新的导入绑定和请求认证解析拒绝使用该 Profile，错误不泄露 secret

### Requirement: Query API Key 和 OAuth2 配置必须显式表达风险并 fail closed

Query API Key MUST 被识别为可能将凭据放入 URL 的高风险认证类型，默认禁止执行，只有用户显式开启允许 query 后才可用于请求。OAuth2 Client Credentials MUST 保留 HTTPS token endpoint、Environment allowlist/DNS/IP 校验、支持的 client authentication method、bounded response、缓存隔离和手动重定向拒绝等现有限制。认证管理界面 MUST 展示风险提示，不得通过通用表单绕过这些约束。

#### Scenario: Query API Key 默认关闭
- **WHEN** 用户创建或编辑 Query API Key 且未显式开启允许 query
- **THEN** Auth Profile 可以保存为待配置状态，但请求解析拒绝执行并返回 `QUERY_AUTH_DISABLED` 或等价安全错误，界面明确说明凭据可能进入 URL

#### Scenario: Query API Key 显式开启
- **WHEN** 用户明确开启允许 query 并提交合法 query 参数名
- **THEN** Host 保存该风险配置，后续请求仅在其他目标、会话和策略校验均通过时使用该 query 参数，受控参数名仍被拒绝

#### Scenario: OAuth2 endpoint 不安全
- **WHEN** 用户提交非 HTTPS、含凭据/query/fragment 或不在当前 Environment allowlist 中的 OAuth2 token endpoint
- **THEN** Host 拒绝保存或请求认证，并不发起 token 网络请求

### Requirement: 设置页提供完整 Auth Profile 管理而不处理真实凭据

API Kit 设置页 MUST 提供独立、可发现的 Auth Profile 管理区域，支持列表、空状态、创建/编辑、启用/停用、删除确认、局部加载错误和重试。表单 MUST 根据认证类型显示相应非敏感字段，并显示 `hasSecret`、来源和可写状态；secret 输入 MUST 使用不可回显的替换流程，删除 secret MUST 需要明确确认。设置页 MUST 通过 Host RPC 完成所有配置与凭据操作，不得使用直接 `fetch`、任意 URL、浏览器端网络请求或将 secret 放入普通状态/日志/模型上下文。

#### Scenario: 没有 Auth Profile
- **WHEN** 用户打开 Auth Profile 管理区域且列表为空
- **THEN** 页面显示创建入口和说明，明确真实凭据由 Host 管理，不将空列表误报为加载失败

#### Scenario: 创建或编辑 Profile
- **WHEN** 用户选择认证类型并填写合法非敏感字段后保存
- **THEN** 页面调用 Host RPC，显示安全成功状态并刷新列表；保存失败时保留草稿、显示字段或全局错误并提供重试

#### Scenario: 设置或替换 secret
- **WHEN** 用户在 Auth Profile 编辑器中输入 secret 并确认保存
- **THEN** 页面将 secret 只发送给 Host 受控 RPC，不在列表、详情、错误、成功提示、日志或 DOM 文本中显示原文；完成后只更新“已配置/未配置”等状态

#### Scenario: 删除 Profile
- **WHEN** 用户从列表请求删除 Auth Profile
- **THEN** 页面展示引用影响和二次确认；只有 Host 删除 RPC 成功后才移除列表项，被引用时保留当前状态并展示修复/重试路径

#### Scenario: 局部加载失败
- **WHEN** Auth Profile 列表或凭据状态查询失败而其他设置区域加载成功
- **THEN** Auth Profile 区域显示局部错误与重试入口，其他设置内容仍可用，页面不将凭据状态伪装为未配置

### Requirement: Auth Profile 绑定和既有执行边界保持一致

Service Target、Operation 和 OpenAPI 导入绑定 MUST 继续只引用已登记且启用的 Auth Profile；安全视图和绑定列表不得暴露 secret。Auth Profile 管理不得改变 Session activation、固定 Service Target/Environment、请求时凭据解析、Agent 工具安全摘要、写操作确认、审计脱敏或 Host 最终校验语义。

#### Scenario: 绑定停用或不存在的 Profile
- **WHEN** 用户尝试将停用或不存在的 Auth Profile 绑定到 Service Target、Operation 或导入事务
- **THEN** Host 拒绝绑定并返回稳定的 Profile 状态错误，不写入部分配置

#### Scenario: 认证配置变更后执行请求
- **WHEN** 用户替换 secret、停用 Profile 或修改 Profile 元数据后发起请求
- **THEN** Host 按最新 Registry 和 credentials 状态重新解析认证；缓存或 OAuth token 状态按 Profile 变更失效，不使用过期凭据

#### Scenario: Agent 和浏览器安全边界
- **WHEN** Agent 发现 API Kit 或用户查看设置摘要
- **THEN** 上下文、工具结果、普通 UI 和审计记录均不包含 secretRef、真实 secret、完整认证 Header、Cookie 或不必要的 token endpoint 细节
