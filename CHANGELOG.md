# Changelog

## 0.1.2

### Per-operation response redaction

- Added Operation `policy.redactResponse` (default `true`); only an explicit persisted `false` opts one Operation out of JSON and text response-body redaction, including non-2xx bodies. Agent call arguments cannot override it.
- Added an unchecked risk-acknowledgement checkbox to the Operation editor, a visible disabled-redaction badge, and safe policy metadata in discovery/description. Editing preserves existing response policies.
- Response size/structure limits, fail-closed malformed/truncated JSON, fixed targets, SSRF, schema validation, controlled headers, Host authentication, and payload-free local audit remain unchanged. Unredacted results and temporary tokens may enter model requests and session history.

## 0.1.3

### API Kit 选择器弹层与选择行

- 输入栏 API Kit 弹层与 Operation 行内菜单改用宿主菜单材质（`--dsw-specific-menu`）加背景模糊（`--dsw-menu-backdrop-filter`），不再透过弹层显示背后的对话正文与输入栏 chip；新增 `--dsw-api-kit-popover-bg` 覆盖点，可整层切换为实心表面，不支持 `backdrop-filter` 的宿主自动回退为实心填充。
- 选择行改为菜单式：去掉逐行描边卡片与可见勾选框列，整行可点击切换，选中由品牌色淡染与行尾绿色“已选择”角标共同表达；原生 checkbox 仅视觉隐藏，保留选择语义、键盘焦点与 44px 命中区。
- 移除弹层内的“当前会话范围”卡片：未激活提示并入状态行，Operation 与只读/写操作计数并入既有的“共同可用环境”诊断行（仅单套件可精确统计时显示），弹层首屏高度明显下降。
- 弹层底部操作按钮改为紧凑 ghost 样式：视觉高度 32px、透明描边、hover 才出现底色，主按钮保持实心；44px 触控命中区由透明覆盖层承担，不再靠撑高按钮实现。
- 弹层 Kit 列表收敛到共享的 `CheckboxChipSelect`（新增 `density`、`showToolbar`、`showLegend`，默认行为不变），与设置页、OpenAPI 导入弹窗和关联已有 Operation 对话框共用同一套选择行与选中态规则。
- Client 合同测试把弹层 CSS 的像素片段断言替换为表面材质、实心回退与选中态的语义断言；44px 命中区、窄容器和无网络请求断言保持不变。

### Kit 目标范围与关联 Operation 同步

- 关联已有 Operation 时，若 Kit 已配置显式 Service Target 白名单，则同步把新关联 Operation 的目标加入白名单；空目标列表仍表示“不限制目标”。
- `normalizeRegistry` 会按已关联 Operation 修复显式目标白名单，避免历史数据里通过关联流程加入的 Operation 因白名单缺失而不可见；设置页 Kit 详情同时展示目标范围摘要。
## Unreleased / remove-write-operation-gates

- Enabled POST/PUT/PATCH/DELETE Operations are now discoverable and execute directly through `api_call`; legacy `allowWrite` and write-method allowlists remain loadable for migration but no longer gate eligible Operations.
- Unified read/write execution keeps fixed Service Target/Environment selection, registered-host and DNS/IP SSRF validation, declared parameter/body Schema checks, request-time Auth Profile resolution, timeout/response limits, redaction, cancellation, and audit projection.
- `api_write_prepare` and `api_write_execute` remain compatibility descriptors that return `WRITE_CONFIRMATION_UNSUPPORTED`; they never send HTTP requests. Use `api_call` with the declared `operationId`.
- OpenAPI-imported Operations use the same Agent eligibility rules as reads after the import transaction is explicitly confirmed. Existing Registry data is not rewritten destructively.

## 0.1.1

- Compatible with DSH 0.2 Host/Client Typert codec factories and client dependencies.
- Removes per-endpoint private-network toggles and CIDR lists; registered intranet API hosts are accepted while local/high-risk addresses remain blocked.
- Preserves and adapts existing Auth Profile credential refs without automatic rewrites.

## Unreleased / DSH 0.2 compatibility

- Added strict Host Typert codec factories for JSON wire values and the `operationIds` string-array parameter; added matching lightweight Client codec factories and Host/Client descriptor regression tests.
- Updated the DSH engine range to `>=0.2.0-rc.2 <0.3.0`, aligned Cordis/UI peer metadata and Client module graph dependencies, and verified the two Client slot identities against the live DSH 0.2 catalogue.
- New Auth Profiles receive bounded collision-resistant credential references; legacy persisted references remain untouched, collision preflight is non-sensitive, and credential writes/deletes fail closed for read-only sources.
- Removed per-endpoint `allowPrivateNetwork` and `allowedCidrs` controls. Registered internal API hosts may resolve to RFC1918/ULA/CGNAT addresses; local, link-local, metadata, multicast, and reserved addresses remain blocked.

## 0.1.0

- Created the initial dsh-api-kit profile bundle skeleton.
- Added Host, Client, and Typert entry points.
- Added placeholder API Kit composer control and settings section.
- Added a DSH-independent Registry store with schema migration, integrity validation, atomic writes, backups, damaged-file recovery, rollback-safe snapshots, and serialized updates.
- Added explicit OpenAPI archive modes: `none` by default, `sanitized`, and opt-in `raw`.
- Added Host-side service target, environment, and authentication profile configuration with safe views, reference protection, production opt-in, and request-time credential resolution.
- Added manual Operation CRUD, minimal API Kit CRUD, strict write validation, Kit/Operation link reconciliation, safe views, and Host-only configuration RPC.
- Added a settings page for creating, editing, enabling/disabling, associating, and deleting Operations and Kits without exposing credentials.
- Added T06 session-scoped API Kit and Environment selection in `conversation.input.left`, with Host-owned in-memory state, multi-Kit selection, compatibility diagnostics, lifecycle cleanup, and authoritative stale-state revalidation.
- Added T07 fixed Host-registered Agent tools `api_kits`, `api_operations`, and `api_describe`, with session-authoritative revalidation, policy intersection, safe summaries, filtering/pagination, stable operation descriptions, and bounded output.
- Added T08 fixed-target `api_call` execution for GET/HEAD Operations, including request-time Host authentication, declared parameter validation, host allowlist checks, cooperative cancellation, timeout and response-size limits, safe JSON/text projection, and injectable fake transport tests.
- Added T09 execution-time DNS/IP/CIDR SSRF policy, IPv4/IPv6 and mapped-address classification, DNS rebinding-resistant pinned HTTP transport, redirect denial, recursive JSON response redaction, and Host-only append-only JSONL audit logging for calls and policy rejections.
- T09 retains GET/HEAD-only execution and defers OpenAPI import, dynamic context, write operations, OAuth, SSE/WebSocket, automatic redirects, and independent MCP export.

## Unreleased / T10

- Added `lib/runtime-context.js` and Host `systemPrompt.context` registration for authoritative per-session, per-assembly API Kit summaries.
- Added runtime-context, registration, and MVP discovery-to-call tests. The context exposes Kit/environment metadata, discoverable operation counts, fixed tool workflow, and security limits without URLs, hosts, CIDRs, credential references/values, headers, cookies, or full schemas.
- T10 keeps GET/HEAD-only execution and defers OpenAPI import, write operations, OAuth, SSE/WebSocket, automatic redirects, and independent MCP export.

## Unreleased / T11

- Added the DSH-independent bounded OpenAPI JSON importer and preview builder for OpenAPI 3.0/3.1 and Swagger 2.0.
- Added local JSON Pointer `$ref` resolution with cycle/depth/count bounds, stable operation provenance, parameter/body/response normalization, server candidates, security templates, and actionable warnings/errors.
- Added deterministic new/update/conflict/skip preview classification without Registry mutation, network access, file access, or secret import; added importer tests and JSON fixtures.
- T11 intentionally deferred confirmation transactions, Tag filtering, multi-service/Kit/Environment/Auth assignment, YAML/URL/Git import, remote refs, OAuth2, uploads, and write-operation confirmation to T12 or later.

## Unreleased / T12

- Added `lib/openapi-import-transaction.js` with a DSH-independent preview/confirmation service. Confirmation re-parses the original bounded JSON, revalidates the current Registry and commits all selected Operations and Kit links through one serialized `store.update` transaction.
- Added bounded transaction IDs, document/Registry fingerprints, stale-preview rejection, dry-run mode, same-transaction idempotent replay, Tag/untagged selection, explicit `overwrite`/`keep-local`/`skip` conflict decisions, existing Target/Environment/Auth Profile/Kit bindings, and fail-closed security mapping.
- Added Host configuration/Gateway and Typert/Client descriptors for `previewOpenApiImport` and `confirmOpenApiImport`, plus a settings-page JSON paste/preview/bind/confirm workflow with explicit second confirmation.
- Server URLs remain display-only; the transaction does not create environments, import secrets, access the network, or enable write Operations for Agent execution. Archive persistence remains separate and best-effort after a successful Registry commit.
- Added T12 transaction tests, manifest checks, and package inclusion for the transaction module.

## Unreleased / T13

- Improved the settings page and session Kit picker for keyboard operation, focus-visible states, Escape handling, focus restoration, semantic status/error announcements, and accessible form labels.
- Added request-generation and mounted guards to prevent stale RPC responses from overwriting current Session or settings state; binding lists now preserve partial results and expose retry actions.
- Added explicit JSON field validation that preserves drafts, actionable import/preview error guidance, duplicate-action guards, and consistent busy/success feedback.
- Updated Client styling to use the inspected DSH light/dark tokens, responsive 720px/520px layouts, viewport-bounded picker behavior, 44px controls, long-text wrapping, and reduced-motion support.

## Unreleased / Auth Profile management

- Added Auth Profile lifecycle RPCs for safe metadata CRUD and Host-only secret set/unset operations.
- Added a dedicated settings Auth Profile section with type-aware forms, safe credential status, enable/disable, deletion protection, Query API Key URL-risk guidance, and OAuth2 metadata fields.
- Auth Profile creation may use a generated Host credential reference; real secret values never enter the Registry, safe views, browser text, Agent context, or ordinary logs.
- Disabled Auth Profiles cannot be newly bound or resolved for requests; Service Target/Operation references and deletion remain Host-validated.

## Unreleased / T14

- Added Host-only OAuth2 Client Credentials profiles with HTTPS endpoint validation, Environment-bound DNS/IP pinning, manual redirect denial, bounded response parsing, request-time credential resolution, cache isolation, single-flight refresh, and safe OAuth metadata views.
- Added direct POST/PUT/PATCH/DELETE execution through the fixed-target `api_call` path. Legacy write policy fields remain loadable for migration but no longer gate eligible Operations; the model has no approval tool.
- Retains `api_write_prepare` and `api_write_execute` as offline unsupported compatibility descriptors while preserving conservative response/error redaction, audit records, and expanded regression/manifest coverage.
- T14 does not add authorization-code/PKCE/OIDC discovery, refresh-token persistence, browser callbacks, arbitrary token endpoints, multipart/uploads, SSE/WebSocket, automatic redirects, or implicit retries.
