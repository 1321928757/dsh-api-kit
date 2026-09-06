import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const client = await readFile(path.join(root, 'lib/client.js'), 'utf8')
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')
const matchLiteral = (value) => new RegExp(escapeRegExp(value))

function extractFunctionBody(name) {
  const start = client.indexOf(`function ${name}(`)
  assert.notEqual(start, -1, `missing ${name}`)
  const bodyStart = client.indexOf('{', start)
  let depth = 0
  for (let index = bodyStart; index < client.length; index += 1) {
    if (client[index] === '{') depth += 1
    if (client[index] === '}') {
      depth -= 1
      if (depth === 0) return client.slice(start, index + 1)
    }
  }
  assert.fail(`unterminated ${name}`)
}


test('T13 retains the inspected Client slots and JSON-only boundary', () => {
  assert.match(client, /conversation\.input\.left/)
  assert.match(client, /settings\.section/)
  assert.match(client, /window\.__ModuleLoader__\.load/)
  assert.doesNotMatch(client, /fetch\s*\(/)
  assert.doesNotMatch(client, /webServer/)
})

test('T13 uses inspected theme tokens and responsive reduced-motion rules', () => {
  for (const token of [
    '--dsw-alias-bg-base', '--dsw-alias-bg-layer-1', '--dsw-alias-bg-layer-2',
    '--dsw-alias-bg-overlay', '--dsw-alias-border-l1', '--dsw-alias-border-l2',
    '--dsw-alias-brand-primary', '--dsw-alias-label-primary', '--dsw-alias-label-secondary',
    '--dsw-alias-state-error-primary', '--dsw-alias-state-success-primary', '--dsw-alias-state-warn-primary',
  ]) assert.match(client, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(client, /@media\(max-width:720px\)/)
  assert.match(client, /@media\(max-width:520px\)/)
  assert.match(client, /prefers-reduced-motion:reduce/)
  assert.match(client, /100dvh/)
  assert.match(client, /--dsw-alias-label-tertiary/)
  assert.match(client, /overflow-x:(?:clip|hidden)/)
  assert.match(client, /state-success-primary/)
})

test('UI-01 presents scope relationships and conservative settings summary', () => {
  for (const marker of ['理解 API 套件的作用域', 'API 套件关系', '服务目标', '可用环境', '配置问题', 'OpenAPI Server URL 仅用于预览']) assert.match(client, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')))
  assert.match(client, /settingsSummary\(kits, operations, targets, environments, loaded\)/)
  assert.match(client, /summaryItem\('写操作'/)
  assert.match(client, /summaryItem\('只读操作'/)
  assert.match(client, /summaryItem\('可用环境'/)
  assert.match(client, /summaryItem\('配置问题'/)
  assert.match(client, /font-variant-numeric:tabular-nums/)
  assert.match(client, /allCollectionsKnown/)
  assert.match(client, /summaryValue\(value\)/)
  assert.doesNotMatch(client, /自由 URL|任意 URL.*执行/)
})

test('UI-02 explains session scope and common environment diagnostics', () => {
  for (const marker of ['当前会话范围', '尚未激活 API 套件', 'Operation 范围', '读写风险', '共同可用环境', '当前套件没有共同可用环境', '共同环境暂不可统计', '默认禁止 Agent 调用', 'aria-describedby']) {
    assert.match(client, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')))
  }
  assert.match(client, /sessionScopeSummary\(kitIds, kits, environmentId, environments\)/)
  assert.match(client, /commonEnvironmentState\(kitIds, kits, environments\)/)
  assert.match(client, /selectedKitNames/)
  assert.match(client, /draftScope\.selectedKitCount/)
  assert.match(client, /draftScope\.known && draftScope\.ids\.length === 0/)
  assert.match(client, /scopeAccessibleName\(selectedScope, \{ loading, invalid: selectedIsInvalid \}\)/)
  assert.match(client, /title: scopeTitle, 'aria-label': scopeAriaLabel/)
  assert.doesNotMatch(client, /api_write_execute|confirmationToken|secretRef/)
})

test('UI-03 replaces key multiple selects with controlled checkbox choices', () => {
  assert.match(client, /function CheckboxChipSelect\(props\)/)
  assert.match(client, /normalizeChoiceValue\(props\.value\)/)
  assert.match(client, /props\.onChange\(normalizeChoiceValue\(next\)\)/)
  for (const marker of ['dsh-api-kit-import-tags', 'dsh-api-kit-import-kits', 'dsh-api-kit-target-environments', '已选 ', '全选当前结果', '清除选择', 'aria-controls', 'disabledReason', '已选择但当前列表未返回']) {
    assert.match(client, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')))
  }
  assert.match(client, /React\.createElement\('fieldset'/)
  assert.match(client, /type: 'checkbox'/)
  assert.match(client, /key: item\.id/)
  assert.match(client, /value: selectedTags, onChange: updateSelectedTags/)
  assert.match(client, /defaultKitIds: importMode === 'existing' \? kitIds : \[\]/)
  assert.match(client, /value: targetForm\.environmentIds, onChange: \(environmentIds\) => (?:setTargetForm|\{)/)
  assert.match(client, /Service Target 至少要绑定一个 Environment/)
  assert.doesNotMatch(client, /selectedOptions/)
  assert.doesNotMatch(client, /select\\s*\\[multiple\\]/)
})

test('UI-04 presents the OpenAPI import as an inspect-config-confirm flow', () => {
  for (const marker of ['activeStep', 'confirming', '检查文档', '配置导入', '确认变更', 'aria-current', '继续配置导入', '查看变更确认', 'dsh-api-kit-import-review', 'dsh-api-kit-import-confirmation', 'role: \'dialog\'', 'aria-modal', 'confirmationDialogRef', 'Escape', '全部保留本地', '全部覆盖', '全部跳过', 'Server 候选（仅显示，不是执行目标）', '一次性写入本地 Registry', '默认禁止 Agent 调用']) {
    assert.match(client, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')))
  }
  assert.match(client, /setActiveStep\('configure'\)/)
  assert.match(client, /setActiveStep\('confirm'\)/)
  assert.match(client, /previewStale/)
  assert.match(client, /const canConfigure/)
  assert.match(client, /const canConfirm/)
  assert.match(client, /confirmOpenApiImport/)
  assert.match(client, /includedSourceKeys: selectedOperations\.map/)
  assert.match(client, /conflictDecisions/)
  assert.doesNotMatch(client, /window\.confirm\('确认按当前筛选、绑定和冲突决策导入/)
})

test('UI-05 presents vertical connection configuration and endpoint disclosure', () => {
  for (const marker of ['dsh-api-kit-connection-stack', '先完成环境，再在下方 Service Target', 'Service Target 依赖上方已建立的 Environment', 'Endpoint Disclosure', 'endpointDomId', 'expandedEndpointIds', 'aria-expanded', 'aria-controls', 'hidden: !expanded', '高级网络策略', 'Endpoint baseUrl', '超时毫秒', '允许访问的 Host', '允许访问的私网网段', '允许内网地址', '最大响应字节', '最大重定向次数', '允许特权端口', 'dsh-api-kit-target-auth-profiles', 'targetForm.authProfileIds', 'listAuthProfiles', '认证配置列表加载失败', '当前版本没有可用的安全连接测试 RPC', '不会直接发起网络请求']) {
    assert.match(client, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')))
  }
  assert.match(client, /targetForm\.environmentIds\.map\(endpointFields\)/)
  assert.match(client, /defaultEnvironmentId.*targetForm\.environmentIds\.map/)
  assert.match(client, /endpointValue = \(endpoint, key\).*safeString\(endpoint\[key\]\)/)
  assert.match(client, /patchTargetEndpoint\(environmentId, 'allowedHosts', value\)/)
  assert.match(client, /patchTargetEndpoint\(environmentId, 'allowedCidrs', value\)/)
  assert.match(client, /authProfileIds: Array\.isArray\(targetForm\.authProfileIds\)/)
  assert.match(client, /createServiceTarget/)
  assert.match(client, /updateServiceTarget/)
  assert.match(client, /endpoints/)
  assert.doesNotMatch(client, /自由 URL.*执行/)
  assert.doesNotMatch(client, /api_write_execute|confirmationToken|secretRef/)
})

test('UI-07 provides safe deletion confirmation and documents unavailable connection testing', () => {
  assert.doesNotMatch(client, /window\.confirm/)
  for (const marker of ['deleteImpact', 'requestDelete', 'confirmDelete', 'cancelDelete', 'deleteRequest', 'deleteConfirmationInput', 'deleteDialogError', 'deleteRequestRef', 'deleteDialogRef', 'ENVIRONMENT_IN_USE', 'TARGET_IN_USE', 'OPERATION_IN_USE', '引用关系将在 Host 保存时校验', '输入“删除”以确认', '当前配置仍保留', 'dsh-api-kit-delete-confirmation', 'role: \'dialog\'', 'aria-modal', 'aria-labelledby', 'aria-describedby', 'aria-busy', 'Escape', '当前版本没有可用的安全连接测试 RPC', '不会直接发起网络请求', 'deleteEnvironment', 'deleteServiceTarget', 'deleteKit', 'deleteOperation']) {
    assert.match(client, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')))
  }
  assert.doesNotMatch(client, /testConnection|probeTarget|healthCheck/)
  assert.doesNotMatch(client, /api_write_execute|confirmationToken|secretRef/)
})

test('UI-06 groups Operation editing and protects dirty/write-risk saves', () => {
  for (const marker of ['operationFormFingerprint', 'formSnapshot', 'formDirty', 'pendingFormAction', 'discardDialogOpen', 'writeConfirming', 'requestFormAction', 'discardAndContinue', '放弃未保存修改', '保留草稿', '放弃修改', '基本信息', '请求定义', '响应定义', 'Agent 权限与安全', 'dsh-api-kit-operation-editor', 'dsh-api-kit-operation-group', 'dsh-api-kit-operation-dirty', '尚有未保存修改', 'Parameters JSON', 'Request Body JSON', 'Responses JSON', 'ID', 'disabled:', '允许 Agent 发现和调用', '允许写操作', '调用前需要确认', 'dsh-api-kit-operation-write-risk', '真实业务数据', '尚未开启调用前人工确认', 'requestOperationSave', '确认保存写操作策略', 'API Kit：', 'Service Target：', '不代表已经执行 API 请求', '下次 Agent 调用时生效', 'createOperation', 'updateOperation', 'aria-modal', 'aria-busy', 'Escape']) {
    assert.match(client, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')))
  }
  assert.match(client, /form\.policy\.allowWrite/)
  assert.match(client, /form\.policy\.requiresConfirmation/)
  assert.match(client, /requestFormAction\(\(\) => setSelectedKit/)
  assert.doesNotMatch(client, /api_write_execute|confirmationToken|secretRef/)
})

test('T14 uses the compact semantic session picker contract', () => {
  for (const marker of ['dsh-api-kit-picker-button', 'dsh-api-kit-picker-summary', 'dsh-api-kit-picker-chevron', 'data-scope-summary', 'is-active', 'is-expanded', 'is-invalid', 'min-width:0', 'white-space:nowrap', 'text-overflow:ellipsis', 'min-height:44px', 'prefers-reduced-motion:reduce']) assert.match(client, matchLiteral(marker))
  assert.match(client, /title: scopeTitle, 'aria-label': scopeAriaLabel/)
  assert.match(client, /ref: triggerRef, type: 'button', className: 'dsh-api-kit-button dsh-api-kit-picker-button'/)
  assert.match(client, /'aria-haspopup': 'dialog'/)
  assert.match(client, /dsh-api-kit-picker-chip/)
  assert.match(client, /scopeIcon\('api', 'dsh-api-kit-picker-icon'\)/)
  assert.match(client, /scopeIcon\('chevron', 'dsh-api-kit-picker-chevron'\)/)
  assert.match(client, /data-dsh-api-kit-icon-source.*source/)
  assert.match(client, /compactScopeSummary\(selectedScope, \{ loading, invalid: selectedIsInvalid \}\)/)
  assert.match(client, /transition:background-color \.18s ease,color \.18s ease,box-shadow \.18s ease/)
  assert.match(client, /:hover:not\(:disabled\).*interactive-bg-hover/)
  assert.match(client, /\.dsh-api-kit-picker \.dsh-api-kit-picker-button:hover:not\(:disabled\),\.dsh-api-kit-picker \.dsh-api-kit-picker-button\.is-active,\.dsh-api-kit-picker \.dsh-api-kit-picker-button\.is-expanded\{background:transparent!important/)
  assert.match(client, /\.dsh-api-kit-picker \.dsh-api-kit-picker-button:hover:not\(:disabled\) \.dsh-api-kit-picker-chip,\.dsh-api-kit-picker \.dsh-api-kit-picker-button\.is-active \.dsh-api-kit-picker-chip,\.dsh-api-kit-picker \.dsh-api-kit-picker-button\.is-expanded \.dsh-api-kit-picker-chip\{background:var\(--dsw-alias-interactive-bg-hover\)!important/)
  assert.doesNotMatch(client, /\.dsh-api-kit-picker \.dsh-api-kit-picker-button:hover:not\(:disabled\)\{background:var\(--dsw-alias-interactive-bg-hover\)!important/)
  assert.doesNotMatch(client, /\.dsh-api-kit-picker \.dsh-api-kit-picker-button\.is-active,\.dsh-api-kit-picker \.dsh-api-kit-picker-button\.is-expanded\{background:var\(--dsw-alias-interactive-bg-active/)
  assert.match(client, /:focus-visible\{outline:0;box-shadow:/)
  assert.match(client, /is-expanded \.dsh-api-kit-picker-chevron\{transform:rotate\(180deg\)\}/)
  assert.match(client, /@media\(prefers-reduced-motion:reduce\)/)
})

test('UI-15 keeps scope summaries pure and vocabulary/status markers stable', () => {
  const compact = extractFunctionBody('compactScopeSummary')
  const full = extractFunctionBody('fullScopeText')
  const title = extractFunctionBody('scopeTitleText')
  const accessible = extractFunctionBody('scopeAccessibleName')
  for (const body of [compact, full, title, accessible]) assert.doesNotMatch(body, /set[A-Z]|useState|api\[|fetch\s*\(/)
  assert.match(client, /function compactScopeSummary\(scope, state = \{\}\)/)
  assert.match(client, /function fullScopeText\(scope\)/)
  assert.match(client, /function scopeTitleText\(scope, state = \{\}\)/)
  assert.match(client, /function scopeAccessibleName\(scope, state = \{\}\)/)
  for (const marker of ['API 套件', '未选择 API 套件', '环境：', '生产环境', '当前选择失效', '正在加载', '需要修复', '当前会话 API 套件：', '点击修改选择']) assert.match(client, matchLiteral(marker))
  assert.match(client, /selectedEnvironmentIsProduction/)
  assert.match(client, /state\.loading \? '正在加载'/)
  assert.match(client, /state\.invalid \|\| scope\?\.unavailable/)
})

test('T15 resolves optional primitives with an accessible SVG fallback', () => {
  assert.match(client, /require\('@deepseek-ai\/dsh-client-ui-primitives'\)/)
  assert.match(client, /IconApiOutline14/)
  assert.match(client, /IconChevronDownOutline14/)
  assert.match(client, /function fallbackIcon\(kind, className\)/)
  assert.match(client, /viewBox: '0 0 16 16'/)
  assert.match(client, /stroke: 'currentColor'/)
  assert.match(client, /strokeWidth: 1\.4/)
  assert.match(client, /'aria-hidden': true, focusable: false/)
  assert.match(client, /function iconComponent\(value\)/)
  assert.match(client, /Primitive \? React\.createElement\(Primitive/)
})

test('T16 preserves RPC names, calls, package metadata, and no direct-network boundary', () => {
  const methods = ['listKits', 'getKit', 'createKit', 'updateKit', 'deleteKit', 'addOperationsToKit', 'removeOperationsFromKit', 'listOperations', 'getOperation', 'createOperation', 'updateOperation', 'deleteOperation', 'setOperationEnabled', 'listServiceTargets', 'getServiceTarget', 'createServiceTarget', 'updateServiceTarget', 'deleteServiceTarget', 'listEnvironments', 'getEnvironment', 'createEnvironment', 'updateEnvironment', 'deleteEnvironment', 'listAuthProfiles', 'getAuthProfile', 'createAuthProfile', 'updateAuthProfile', 'deleteAuthProfile', 'setAuthSecret', 'unsetAuthSecret', 'getSessionActivation', 'setSessionActivation', 'clearSessionActivation', 'previewOpenApiImport', 'confirmOpenApiImport']
  const rpc = client.match(/const RPC_METHODS = \[([\s\S]*?)\]/)?.[1] || ''
  for (const method of methods) assert.match(rpc, matchLiteral(`'${method}'`))
  assert.match(client, /const call = async \(name, args = \{\}\)/)
  assert.match(client, /api\[name\]\(\.\.\.parameters\)/)
  assert.doesNotMatch(client, /fetch\s*\(|new URL\s*\(|window\.location|webServer|innerHTML|dangerouslySetInnerHTML/)
  assert.equal(packageJson.peerDependencies?.['@deepseek-ai/dsh-client-ui-primitives'], '^0.1.1-rc.2')
  assert.equal(packageJson.peerDependenciesMeta?.['@deepseek-ai/dsh-client-ui-primitives']?.optional ?? true, true)
  assert.deepEqual(packageJson.dsh?.client?.inject, ['@deepseek-ai/dsh-client-runtime', '@deepseek-ai/dsh-client-ui-conversation'])
})

test('Auth Profile management stays Host-only and exposes safe settings flows', () => {
  for (const marker of ['createAuthProfile', 'updateAuthProfile', 'deleteAuthProfile', 'setAuthSecret', 'unsetAuthSecret', 'Auth Profile', 'authProfileForm', 'authProfileFormView', 'hasSecret', 'credentialSource', 'writable', 'api-key-query', '凭据可能进入 URL', 'allowQuery', 'oauth2-client-credentials', 'Token Endpoint', 'data-auth-profile-list', '删除凭据', 'secret、Authorization 和完整 token 不会展示']) assert.match(client, matchLiteral(marker))
  assert.match(client, /type: multiline \? undefined : options\.type/)
  assert.doesNotMatch(client, /fetch\s*\(|new URL\s*\(/)
  assert.doesNotMatch(client, /secretRef/)
  assert.match(client, /credentialSource/)
  assert.match(client, /writable/)
})

test('T13 provides keyboard focus and semantic status/error feedback', () => {
  for (const marker of ['focus-visible', 'aria-expanded', 'aria-controls', 'aria-modal', 'aria-labelledby', 'role: \'alert\'', 'aria-live', 'fieldset', 'legend', 'Escape']) assert.match(client, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(client, /returnFocusRef/)
  assert.match(client, /querySelectorAll\('button:not\(\[disabled\]\)/)
  assert.match(client, /min-height:44px/)
})

test('UI-08 preserves dialog focus, independent request generations, loading state, and selected semantics', () => {
  assert.match(client, /const FOCUSABLE_SELECTOR/)
  assert.match(client, /trapDialogTab\(event, activeDialogRef\)/)
  assert.match(client, /const bindingRequestRef = React\.useRef\(0\)/)
  assert.match(client, /requestId !== bindingRequestRef\.current/)
  assert.match(client, /bindingBusyRef\.current = false; setBindingBusy\(false\)/)
  assert.match(client, /const authRequestRef = React\.useRef\(0\)/)
  assert.match(client, /const \[hasLoadedOnce, setHasLoadedOnce\]/)
  assert.match(client, /kitIds: Array\.isArray\(form\.kitIds\)/)
  assert.match(client, /setHasLoadedOnce\(true\)/)
  assert.match(client, /'aria-pressed': selectedKit === kit\.id/)
  assert.match(client, /\.dsh-api-kit-choice-action:focus-visible/)
  assert.match(client, /\.dsh-api-kit-operation-group>summary:focus-visible/)
  assert.match(client, /overflow-x:hidden/)
})

test('UI-09 provides compact settings lists, progressive disclosure, and grouped sections', () => {
  for (const marker of ['SETTINGS_LIST_INITIAL_LIMIT', 'expandedOperationList', 'expandedTargetList', 'settingsGroups', 'settingsGroup', 'dsh-api-kit-settings-group', '还有 ', '个）', '收起', 'kind', 'aria-pressed', 'dsh-api-kit-operation-card{display:grid', 'dsh-api-kit-connection-item{display:grid', 'overflow-wrap:anywhere']) {
    assert.match(client, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')))
  }
  assert.match(client, /visibleKitOperations = expandedOperationList \? kitOperations : kitOperations\.slice\(0, SETTINGS_LIST_INITIAL_LIMIT\)/)
  assert.match(client, /visibleTargets = expandedTargetList \? targets : targets\.slice\(0, SETTINGS_LIST_INITIAL_LIMIT\)/)
  assert.match(client, /progressiveListControl\('Operation'/)
  assert.match(client, /progressiveListControl\('Service Target'/)
  assert.match(client, /React\.Fragment, null, React\.createElement\('section', \{ className: 'dsh-api-kit-card dsh-api-kit-connection-section'/)
  assert.match(client, /className: 'dsh-api-kit-settings-group-summary'.*onClick: \(event\) => \{ event\.preventDefault\(\); toggleSettingsGroup\(key\) \}/)
})

test('T13 guards stale async responses and preserves actionable JSON errors', () => {
  assert.match(client, /mountedRef/)
  assert.match(client, /requestRef/)
  assert.match(client, /requestId !== requestRef\.current/)
  assert.match(client, /parseJsonValue/)
  assert.match(client, /JSON 格式无效/)
  assert.match(client, /重试读取\/预览/)
  assert.match(client, /重试绑定列表/)
  assert.match(client, /IMPORT_STALE_PREVIEW/)
  assert.match(client, /aria-busy/)
})

test('UI-10 keeps ordinary controls sized and excludes choice controls', () => {
  assert.match(client, /\.dsh-api-kit-control:not\(\[type=checkbox\]\):not\(\[type=radio\]\):not\(\.dsh-api-kit-control-textarea\)/)
  assert.match(client, /height:40px;min-height:40px/)
  assert.match(client, /\.dsh-api-kit-control-textarea[^}]*height:auto;min-height:112px/)
  assert.match(client, /dsh-api-kit-control#dsh-api-kit-openapi-json[^}]*min-height:150px;max-height:180px/)
  assert.match(client, /dsh-api-kit-settings \.dsh-api-kit-field>input:not\(\[type=checkbox\]\):not\(\[type=radio\]\)/)
  assert.match(client, /dsh-api-kit-create-row>\.dsh-api-kit-field>\.dsh-api-kit-control[^}]*height:40px;min-height:40px/)
  assert.doesNotMatch(client, /(^|[,{])\.dsh-api-kit-control\{[^}]*height:40px/)
  for (const match of client.matchAll(/React\.createElement\('select', \{([^}]*)\}/g)) {
    assert.match(match[1], /className: 'dsh-api-kit-control'/)
  }
})

test('UI-11 gives dynamic fields stable IDs and one-to-one associations', () => {
  assert.match(client, /function fieldId\(label, explicit, fallback\)/)
  assert.match(client, /function domIdSegment\(value\)/)
  assert.match(client, /function choiceDomId\(id, value\)/)
  assert.doesNotMatch(client, /dsh-api-kit-field--/)
  for (const id of [
    'dsh-api-kit-environment-id', 'dsh-api-kit-environment-name', 'dsh-api-kit-environment-description',
    'dsh-api-kit-target-id', 'dsh-api-kit-target-name', 'dsh-api-kit-target-description',
    'dsh-api-kit-target-default-environment', 'dsh-api-kit-target-auth-profiles',
    'dsh-api-kit-import-target', 'dsh-api-kit-import-environment', 'dsh-api-kit-import-auth-profile',
    'dsh-api-kit-import-mode-new', 'dsh-api-kit-import-mode-existing',
    'dsh-api-kit-operation-id', 'dsh-api-kit-operation-operation-id', 'dsh-api-kit-operation-name',
    'dsh-api-kit-operation-method', 'dsh-api-kit-operation-service-target',
  ]) assert.match(client, new RegExp(id.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')))
  for (const marker of ['${id}-base-url', '${id}-timeout', '${id}-allowed-hosts', '${id}-allowed-cidrs', '${id}-port', '${id}-max-response-bytes', '${id}-max-redirects', '${id}-allow-private-network', '${id}-allow-privileged-port']) {
    assert.ok(client.includes(marker), `missing dynamic endpoint marker: ${marker}`)
  }
  assert.match(client, /'aria-describedby': describedBy/)
  assert.match(client, /targetForm\.environmentIds\.map\(endpointFields\)/)
  assert.match(client, /htmlFor: 'dsh-api-kit-import-target'/)
  assert.match(client, /htmlFor: 'dsh-api-kit-operation-service-target'/)
})

test('UI-13 reconciles import filters across previews and keeps zero-result guidance actionable', () => {
  assert.match(client, /function reconcilePreviewTags\(preview, selectedTags\)/)
  assert.match(client, /const selectedTagsRef = React\.useRef\(\[\]\)/)
  assert.match(client, /const tagReconciliation = reconcilePreviewTags\(next, selectedTagsRef\.current\)/)
  assert.match(client, /selectedTagsRef\.current = tagReconciliation\.tags/)
  assert.match(client, /setSelectedTags\(tagReconciliation\.tags\)/)
  assert.match(client, /原筛选 Tag 在新文档中均不存在，已清除筛选；当前将导入全部可导入 Operation/)
  assert.match(client, /已移除 .*在新文档中不存在的 Tag/)
  assert.match(client, /当前筛选导致 0 个可导入 Operation，请清除 Tag 筛选或重新选择/)
  assert.match(client, /selectedTags\.length > 0 && importable\.length > 0 && selectedOperations\.length === 0/)
  assert.match(client, /value: selectedTags, onChange: updateSelectedTags/)
  assert.match(client, /setFilterNotice\(null\)/)
  assert.doesNotMatch(client, /selectedOperations\s*=.*setSelectedTags/)
})

test('UI-14 gives key actions touch-sized hit areas without stretching choice controls', () => {
  assert.match(client, /\.dsh-api-kit-settings \.dsh-api-kit-button\{min-height:44px/)
  assert.match(client, /\.dsh-api-kit-import-step-button\{min-height:44px/)
  assert.match(client, /\.dsh-api-kit-check,.dsh-api-kit-choice,.dsh-api-kit-selection,.dsh-api-kit-import-mode label\{min-height:44px/)
  assert.match(client, /\.dsh-api-kit-import-mode label\{display:flex;align-items:center;gap:7px;min-height:44px/)
  assert.match(client, /button\('添加 Environment'.*'primary'/)
  assert.match(client, /button\('添加 Service Target'.*'secondary'/)
  assert.match(client, /\.dsh-api-kit-import-mode label:has\(input:checked\)/)
})

test('UI-12 protects the OpenAPI import heading at settings container widths', () => {
  assert.match(client, /\.dsh-api-kit-import-heading\{display:grid;grid-template-columns:minmax\(0,1fr\) auto/)
  assert.match(client, /\.dsh-api-kit-import-heading>\.dsh-api-kit-import-steps\{grid-column:1 \/ -1;width:100%;min-width:0\}/)
  assert.match(client, /@container \(max-width:720px\)\{[^}]*\.dsh-api-kit-import-heading\{grid-template-columns:1fr\}/)
  assert.match(client, /dsh-api-kit-import-heading>\.dsh-api-kit-import-steps ol\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)\}/)
  assert.match(client, /dsh-api-kit-import-heading>\.dsh-api-kit-button\{width:100%;min-height:44px\}/)
  assert.match(client, /@container \(max-width:520px\)\{[^}]*dsh-api-kit-import-heading>\.dsh-api-kit-import-steps ol\{grid-template-columns:1fr\}/)
  assert.match(client, /dsh-api-kit-import-step-button\{min-height:44px\}/)
  assert.match(client, /setActiveStep\('configure'\)/)
  assert.match(client, /setActiveStep\('confirm'\)/)
  assert.doesNotMatch(client, /fetch\s*\(/)
})

test('UI-16 bounds picker width, popup density, and settings group defaults', () => {
  assert.match(client, /max-width:min\(260px,100%\)/)
  assert.match(client, /flex:0 1 260px/)
  assert.match(client, /\.dsh-api-kit-picker\{display:block;min-width:0;max-width:100%\}/)
  assert.match(client, /\.dsh-api-kit-picker-chip\{width:100%\}/)
  assert.match(client, /\.dsh-api-kit-popover\{[^}]*max-width:100%[^}]*box-sizing:border-box;font-size:13px;line-height:1\.45/)
  assert.match(client, /\.dsh-api-kit-popover-header h3\{[^}]*font-size:14px/)
  assert.match(client, /\.dsh-api-kit-popover \.dsh-api-kit-status\{[^}]*font-size:12px/)
  assert.match(client, /\.dsh-api-kit-popover \.dsh-api-kit-selection-title\{[^}]*text-overflow:ellipsis[^}]*white-space:nowrap;font-size:13px/)
  assert.match(client, /\.dsh-api-kit-popover \.dsh-api-kit-button\{min-height:44px[^}]*font-size:12px/)
  assert.match(client, /const SETTINGS_GROUP_DEFAULTS = \{ import: false, connection: false, auth: false, workbench: false \}/)
  assert.match(client, /setSettingsGroups\(SETTINGS_GROUP_DEFAULTS\)/)
  assert.doesNotMatch(client, /setSettingsGroups\(kits\.length > 0 \? \{ import: false, connection: false, workbench: true \}/)
  assert.match(client, /const open = Boolean\(settingsGroups\[key\] \|\| forcedOpen\)/)
})

test('UI-17 limits the visible picker summary to five characters without shortening accessible details', () => {
  const truncate = extractFunctionBody('truncatePickerLabel')
  assert.match(truncate, /maxLength = 5/)
  assert.match(truncate, /Array\.from\(text\)/)
  assert.match(truncate, /characters\.length > maxLength/)
  assert.match(truncate, /characters\.slice\(0, maxLength\)\.join\(''\) \+ '\.\.\.'/)
  assert.match(client, /const buttonLabel = truncatePickerLabel\(compactScopeSummary\(selectedScope, \{ loading, invalid: selectedIsInvalid \}\)\)/)
  assert.match(client, /title: scopeTitle, 'aria-label': scopeAriaLabel/)
  assert.match(client, /function fullScopeText\(scope\)/)
  assert.match(client, /function scopeAccessibleName\(scope, state = \{\}\)/)
})
