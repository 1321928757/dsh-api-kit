/**
 * dsh-api-kit browser bundle entry for T06.
 *
 * The Client owns presentation only. Kit activation is keyed by the sessionId
 * supplied by the session-scoped input slot; the Host remains the authority for
 * validation, safe views, and all persisted API configuration.
 */

window.__ModuleLoader__.load({
  id: 'dsh-api-kit',
  factory: (require) => {
    const React = require('react')
    const RPC_METHODS = [
      'listKits', 'getKit', 'createKit', 'updateKit', 'deleteKit',
      'addOperationsToKit', 'removeOperationsFromKit', 'listOperations', 'getOperation',
      'createOperation', 'updateOperation', 'deleteOperation', 'setOperationEnabled',
      'listServiceTargets', 'getServiceTarget', 'listEnvironments', 'getEnvironment',
      'listAuthProfiles', 'getAuthProfile', 'getSessionActivation', 'setSessionActivation', 'clearSessionActivation',
    ]
    const HTTP_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
    const CONFIG_EVENT = 'dsh-api-kit:config-changed'
    const looseCodec = (typeSymbol) => ({ mode: 'strict', typeSymbol, schema: { parse: (value) => value } })
    const descriptor = (name, parameters = []) => ({
      id: 'dsh-api-kit#api-kit/' + name,
      service: 'apiKitConfig',
      namespace: 'api-kit',
      method: name,
      invocation: { kind: 'direct' },
      parameters: parameters.map((item) => ({
        name: item,
        wire: item,
        source: 'json',
        codec: looseCodec(item === 'input' || item === 'patch' || item === 'operationIds' || item === 'args' ? 'dsh-api-kit#Args' : 'dsh-api-kit#Json'),
      })),
      result: looseCodec('dsh-api-kit#Json'),
    })
    const descriptorSpec = {
      listKits: ['args'], getKit: ['id'], createKit: ['input'], updateKit: ['id', 'patch'], deleteKit: ['id'],
      addOperationsToKit: ['kitId', 'operationIds'], removeOperationsFromKit: ['kitId', 'operationIds'], listOperations: ['args'],
      getOperation: ['id'], createOperation: ['input'], updateOperation: ['id', 'patch'], deleteOperation: ['id'], setOperationEnabled: ['id', 'enabled'],
      listServiceTargets: ['args'], getServiceTarget: ['id'], listEnvironments: ['args'], getEnvironment: ['id'], listAuthProfiles: ['args'], getAuthProfile: ['id'],
      getSessionActivation: ['args'], setSessionActivation: ['args'], clearSessionActivation: ['args'],
    }
    const CONTRIBUTION = { package: 'dsh-api-kit', descriptors: RPC_METHODS.map((name) => descriptor(name, descriptorSpec[name])) }
    const styles = `
      .dsh-api-kit-settings{box-sizing:border-box;max-width:1100px;padding:24px;color:var(--dsw-alias-label-primary)}
      .dsh-api-kit-settings *{box-sizing:border-box}.dsh-api-kit-toolbar{display:flex;gap:8px;align-items:end;justify-content:space-between;flex-wrap:wrap;margin:16px 0}
      .dsh-api-kit-grid{display:grid;grid-template-columns:minmax(180px,260px) minmax(0,1fr);gap:16px}.dsh-api-kit-card{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-surface,transparent);padding:14px}
      .dsh-api-kit-card+.dsh-api-kit-card{margin-top:10px}.dsh-api-kit-card.is-selected{border-color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 8%,transparent)}
      .dsh-api-kit-row{display:flex;align-items:center;gap:8px;justify-content:space-between}.dsh-api-kit-muted{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.5}
      .dsh-api-kit-button{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-input,transparent);color:var(--dsw-alias-label-primary);padding:7px 10px;font:inherit;cursor:pointer}
      .dsh-api-kit-button:hover,.dsh-api-kit-button:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}.dsh-api-kit-button.primary{background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-on-brand,#fff);border-color:transparent}.dsh-api-kit-button.danger{color:var(--dsw-alias-state-error-primary,#dc2626)}
      .dsh-api-kit-form{display:grid;gap:10px}.dsh-api-kit-form label{display:grid;gap:4px;font-size:13px}.dsh-api-kit-form input,.dsh-api-kit-form select,.dsh-api-kit-form textarea{width:100%;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px;background:var(--dsw-alias-bg-input,transparent);color:var(--dsw-alias-label-primary);font:inherit}.dsh-api-kit-form textarea{min-height:100px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px}.dsh-api-kit-check{display:flex!important;align-items:center;gap:8px}.dsh-api-kit-check input{width:auto}.dsh-api-kit-error{color:var(--dsw-alias-state-error-primary,#dc2626);padding:8px 0}
      .dsh-api-kit-picker{position:relative;display:inline-flex;align-items:center;min-width:0}.dsh-api-kit-picker-button{max-width:230px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dsh-api-kit-picker-button.is-active{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,transparent);border-color:transparent}
      .dsh-api-kit-popover{position:absolute;z-index:20;left:0;bottom:calc(100% + 8px);width:min(370px,calc(100vw - 32px));max-height:min(560px,calc(100vh - 120px));overflow:auto;padding:14px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-surface,#fff);box-shadow:0 12px 32px color-mix(in srgb,#000 18%,transparent)}
      .dsh-api-kit-popover-header,.dsh-api-kit-popover-footer{display:flex;align-items:center;justify-content:space-between;gap:8px}.dsh-api-kit-popover-section{display:grid;gap:7px;margin-top:12px}.dsh-api-kit-popover-section h3{font-size:13px;margin:0}
      .dsh-api-kit-selection{display:flex;align-items:flex-start;gap:8px;padding:8px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px}.dsh-api-kit-selection.is-checked{border-color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 8%,transparent)}.dsh-api-kit-selection input{margin-top:3px}.dsh-api-kit-selection-main{min-width:0;display:grid;gap:2px}.dsh-api-kit-selection-title{font-size:13px}.dsh-api-kit-selection-meta{font-size:12px;color:var(--dsw-alias-label-secondary)}
      .dsh-api-kit-warn{padding:8px;border-radius:8px;color:var(--dsw-alias-state-warn-primary,#a16207);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#f59e0b) 12%,transparent);font-size:12px;line-height:1.45}.dsh-api-kit-invalid{padding:8px;border-radius:8px;color:var(--dsw-alias-state-error-primary,#b91c1c);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#ef4444) 10%,transparent);font-size:12px;line-height:1.45}.dsh-api-kit-status{font-size:12px;color:var(--dsw-alias-label-secondary)}
      .dsh-api-kit-popover select{width:100%;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px;background:var(--dsw-alias-bg-input,transparent);color:var(--dsw-alias-label-primary);font:inherit}.dsh-api-kit-spinner{display:inline-block;width:12px;height:12px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:dsh-api-kit-spin .7s linear infinite}@keyframes dsh-api-kit-spin{to{transform:rotate(360deg)}}
      @media(max-width:720px){.dsh-api-kit-settings{padding:16px}.dsh-api-kit-grid{grid-template-columns:1fr}.dsh-api-kit-popover{left:-8px;bottom:calc(100% + 6px)}}@media(prefers-reduced-motion:reduce){.dsh-api-kit-spinner{animation:none}*{scroll-behavior:auto!important;transition:none!important}}
    `

    function parseJson(value, fallback) { try { return JSON.parse(value) } catch { return fallback } }
    function errorText(error) { return error?.message || error?.code || '请求失败' }
    function button(label, onClick, className = '', disabled = false) { return React.createElement('button', { type: 'button', className: 'dsh-api-kit-button ' + className, onClick, disabled }, label) }
    function textField(label, value, onChange, multiline = false) {
      return React.createElement('label', null, label, React.createElement(multiline ? 'textarea' : 'input', { value: value ?? '', onChange: (event) => onChange(event.target.value) }))
    }
    function notifyConfigChanged() {
      try { window.dispatchEvent(new CustomEvent(CONFIG_EVENT)) } catch { /* non-browser test doubles */ }
    }

    async function apply(ctx) {
      const slots = ctx.get('slots')
      const remote = ctx.get('remote')
      if (slots === undefined || remote === undefined || typeof remote.$mount !== 'function') return
      const unmount = await remote.$mount(CONTRIBUTION)
      ctx.effect(() => () => { if (typeof unmount === 'function') void unmount() }, 'dsh-api-kit: remote contribution')
      if (typeof document !== 'undefined' && document.head && !document.head.querySelector('style[data-plugin-css="dsh-api-kit"]')) {
        const style = document.createElement('style')
        style.dataset.pluginCss = 'dsh-api-kit'
        style.textContent = styles
        document.head.appendChild(style)
        ctx.effect(() => () => { style.remove() }, 'dsh-api-kit: styles')
      }
      const api = ctx.get('remote.api-kit')
      if (api === undefined) return
      const call = async (name, args = {}) => {
        const parameters = (descriptorSpec[name] || []).map((key) => key === 'args' ? args : args[key])
        const result = await api[name](...parameters)
        if (!result || result.ok !== true) throw Object.assign(new Error(errorText(result?.error)), result?.error || {})
        return result.value
      }

      function getSessionId(props) {
        return props?.sessionId || props?.session?.id || props?.session?.sessionId || ''
      }

      function availableEnvironmentIds(kitIds, kits, environments) {
        const selectable = environments.filter((item) => item.selectable).map((item) => item.id)
        if (kitIds.length === 0) return []
        let result = [...selectable]
        for (const kitId of kitIds) {
          const kit = kits.find((item) => item.id === kitId)
          if (!kit || !Array.isArray(kit.compatibleEnvironmentIds)) continue
          result = result.filter((id) => kit.compatibleEnvironmentIds.includes(id))
        }
        return result
      }

      function ApiKitControl(props) {
        const sessionId = getSessionId(props)
        const rootRef = React.useRef(null)
        const [open, setOpen] = React.useState(false)
        const [busy, setBusy] = React.useState(false)
        const [loading, setLoading] = React.useState(false)
        const [activation, setActivation] = React.useState(null)
        const [draftKitIds, setDraftKitIds] = React.useState([])
        const [draftEnvironmentId, setDraftEnvironmentId] = React.useState(null)
        const [error, setError] = React.useState(null)

        const load = React.useCallback(async () => {
          if (!sessionId) { setActivation(null); setDraftKitIds([]); setDraftEnvironmentId(null); return }
          setLoading(true)
          try {
            const next = await call('getSessionActivation', { sessionId })
            setActivation(next || null)
            setDraftKitIds(Array.isArray(next?.activeKitIds) ? next.activeKitIds : [])
            setDraftEnvironmentId(next?.environmentId || null)
            setError(null)
          } catch (cause) { setError(errorText(cause)) } finally { setLoading(false) }
        }, [sessionId])

        React.useEffect(() => { void load() }, [load])
        React.useEffect(() => {
          const onChange = () => { void load() }
          window.addEventListener(CONFIG_EVENT, onChange)
          return () => window.removeEventListener(CONFIG_EVENT, onChange)
        }, [load])
        React.useEffect(() => {
          if (!open) return undefined
          const onMouseDown = (event) => {
            if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false)
          }
          const onKeyDown = (event) => { if (event.key === 'Escape') setOpen(false) }
          document.addEventListener('mousedown', onMouseDown)
          document.addEventListener('keydown', onKeyDown)
          return () => {
            document.removeEventListener('mousedown', onMouseDown)
            document.removeEventListener('keydown', onKeyDown)
          }
        }, [open])

        const kits = Array.isArray(activation?.kits) ? activation.kits : []
        const environments = Array.isArray(activation?.environments) ? activation.environments : []
        const currentEnvironment = environments.find((item) => item.id === activation?.environmentId)
        const activeKitNames = draftKitIds.map((id) => kits.find((kit) => kit.id === id)?.name || id).filter(Boolean)
        const buttonLabel = loading
          ? 'API 套件…'
          : activeKitNames.length > 0
            ? activeKitNames.length === 1 ? activeKitNames[0] : `${activeKitNames[0]} +${activeKitNames.length - 1}`
            : 'API 套件'
        const draftEnvironmentIds = availableEnvironmentIds(draftKitIds, kits, environments)

        const toggleKit = (kit) => {
          if (!kit || (!kit.selectable && !draftKitIds.includes(kit.id))) return
          const next = draftKitIds.includes(kit.id) ? draftKitIds.filter((id) => id !== kit.id) : [...draftKitIds, kit.id]
          setDraftKitIds(next)
          const choices = availableEnvironmentIds(next, kits, environments)
          if (next.length === 0) setDraftEnvironmentId(null)
          else if (!choices.includes(draftEnvironmentId)) setDraftEnvironmentId(choices[0] || null)
        }
        const save = async () => {
          setBusy(true); setError(null)
          try {
            const next = await call('setSessionActivation', { sessionId, activeKitIds: draftKitIds, environmentId: draftKitIds.length > 0 ? draftEnvironmentId : null })
            setActivation(next); setDraftKitIds(next.activeKitIds || []); setDraftEnvironmentId(next.environmentId || null); setOpen(false)
          } catch (cause) { setError(errorText(cause)) } finally { setBusy(false) }
        }
        const clear = async () => {
          setBusy(true); setError(null)
          try {
            const next = await call('clearSessionActivation', { sessionId })
            setActivation(next); setDraftKitIds([]); setDraftEnvironmentId(null); setOpen(false)
          } catch (cause) { setError(errorText(cause)) } finally { setBusy(false) }
        }

        if (!sessionId) return null
        const selectedIsInvalid = activation && activation.valid === false
        return React.createElement('div', { ref: rootRef, className: 'dsh-api-kit-picker' },
          React.createElement('button', {
            type: 'button', className: 'dsh-api-kit-button dsh-api-kit-picker-button' + (activeKitNames.length > 0 ? ' is-active' : ''),
            onClick: () => { setOpen((value) => !value); if (!open) void load() },
            'aria-expanded': open, 'aria-haspopup': 'dialog', title: currentEnvironment ? `环境：${currentEnvironment.name}` : '选择当前会话的 API 套件',
          }, selectedIsInvalid ? 'API 套件需修复' : buttonLabel, currentEnvironment ? ` · ${currentEnvironment.name}` : ''),
          open && React.createElement('div', { className: 'dsh-api-kit-popover', role: 'dialog', 'aria-label': '当前会话 API 套件选择' },
            React.createElement('div', { className: 'dsh-api-kit-popover-header' }, React.createElement('h3', null, '当前会话 API 套件'), loading && React.createElement('span', { className: 'dsh-api-kit-spinner', 'aria-label': '加载中' })),
            React.createElement('div', { className: 'dsh-api-kit-status' }, '选择只对当前会话生效；重启 DSH 后需要重新激活。'),
            error && React.createElement('div', { className: 'dsh-api-kit-invalid', role: 'alert' }, error),
            activation?.errors?.length > 0 && React.createElement('div', { className: 'dsh-api-kit-invalid', role: 'alert' }, activation.errors.map((item) => React.createElement('div', { key: item.code + (item.path || '') }, item.message))),
            activation?.warnings?.length > 0 && React.createElement('div', { className: 'dsh-api-kit-warn' }, activation.warnings.map((item) => React.createElement('div', { key: item.code + (item.path || '') }, item.message))),
            React.createElement('div', { className: 'dsh-api-kit-popover-section' },
              React.createElement('h3', null, 'API 套件（可多选）'),
              kits.length === 0
                ? React.createElement('div', { className: 'dsh-api-kit-muted' }, '暂无套件，请先在设置 → API 套件中创建。')
                : kits.map((kit) => {
                  const checked = draftKitIds.includes(kit.id)
                  const disabled = !kit.selectable && !checked
                  const reason = kit.enabled === false ? '已停用' : kit.agentEnabled === false ? '未允许 Agent' : kit.operationCount === 0 ? '暂无 Operation' : `${kit.operationCount} 个操作`
                  return React.createElement('label', { key: kit.id, className: 'dsh-api-kit-selection' + (checked ? ' is-checked' : '') },
                    React.createElement('input', { type: 'checkbox', checked, disabled, onChange: () => toggleKit(kit) }),
                    React.createElement('span', { className: 'dsh-api-kit-selection-main' }, React.createElement('span', { className: 'dsh-api-kit-selection-title' }, kit.name), React.createElement('span', { className: 'dsh-api-kit-selection-meta' }, reason)),
                  )
                }),
            ),
            draftKitIds.length > 0 && React.createElement('div', { className: 'dsh-api-kit-popover-section' },
              React.createElement('h3', null, '环境'),
              React.createElement('select', { value: draftEnvironmentId || '', onChange: (event) => setDraftEnvironmentId(event.target.value || null) },
                React.createElement('option', { value: '' }, '请选择环境'),
                environments.map((environment) => React.createElement('option', { key: environment.id, value: environment.id, disabled: !environment.selectable || !draftEnvironmentIds.includes(environment.id) }, `${environment.name}${environment.production ? '（生产）' : ''}${!environment.selectable ? ' · 不可用' : !draftEnvironmentIds.includes(environment.id) ? ' · 与套件不兼容' : ''}`)),
              ),
            ),
            React.createElement('div', { className: 'dsh-api-kit-popover-footer', style: { marginTop: 14 } }, button('清除选择', clear, '', busy || draftKitIds.length === 0), React.createElement('span', { style: { display: 'flex', gap: 8 } }, button('取消', () => { setDraftKitIds(activation?.activeKitIds || []); setDraftEnvironmentId(activation?.environmentId || null); setOpen(false) }, '', busy), button(busy ? '保存中…' : '应用', save, 'primary', busy))),
          ),
        )
      }

      function Settings() {
        const [kits, setKits] = React.useState([])
        const [operations, setOperations] = React.useState([])
        const [targets, setTargets] = React.useState([])
        const [selectedKit, setSelectedKit] = React.useState(null)
        const [editingOperation, setEditingOperation] = React.useState(null)
        const [form, setForm] = React.useState(null)
        const [kitName, setKitName] = React.useState('')
        const [busy, setBusy] = React.useState(false)
        const [error, setError] = React.useState(null)

        const refresh = React.useCallback(async () => {
          setBusy(true); setError(null)
          try {
            const values = await Promise.all([call('listKits'), call('listOperations'), call('listServiceTargets')])
            const nextKits = values[0] || []; const nextOperations = values[1] || []; const nextTargets = values[2] || []
            setKits(nextKits); setOperations(nextOperations); setTargets(nextTargets)
            setSelectedKit((current) => current && nextKits.some((kit) => kit.id === current) ? current : (nextKits[0]?.id || null))
          } catch (cause) { setError(errorText(cause)) } finally { setBusy(false) }
        }, [])
        React.useEffect(() => { void refresh() }, [refresh])
        React.useEffect(() => {
          window.addEventListener(CONFIG_EVENT, refresh)
          return () => window.removeEventListener(CONFIG_EVENT, refresh)
        }, [refresh])

        const activeKit = kits.find((kit) => kit.id === selectedKit)
        const kitOperations = activeKit ? operations.filter((operation) => activeKit.operationIds.includes(operation.id)) : []
        const patchForm = (key, value) => setForm((current) => ({ ...current, [key]: value }))
        const createKit = async () => {
          const id = kitName.trim().toLowerCase().replace(/[^a-z0-9._:-]+/g, '-')
          if (!id) return
          try { await call('createKit', { input: { id, name: kitName, operationIds: [] } }); setKitName(''); notifyConfigChanged(); await refresh(); setSelectedKit(id) } catch (cause) { setError(errorText(cause)) }
        }
        const newOperation = () => setForm({ id: '', operationId: '', name: '', method: 'GET', path: '/', serviceTargetId: targets[0]?.id || '', summary: '', description: '', tags: '', enabled: true, kitIds: selectedKit ? [selectedKit] : [], parameters: '[]', requestBody: '', responses: '{}', policy: { allowAgentCall: true, allowWrite: false, requiresConfirmation: false } })
        const editOperation = async (id) => {
          try {
            const item = await call('getOperation', { id })
            setEditingOperation(id)
            setForm({ ...item, tags: (item.tags || []).join(', '), kitIds: item.kitIds || [], parameters: JSON.stringify(item.parameters || [], null, 2), requestBody: item.requestBody ? JSON.stringify(item.requestBody, null, 2) : '', responses: JSON.stringify(item.responses || {}, null, 2), policy: { allowAgentCall: item.policy?.allowAgentCall === true, allowWrite: item.policy?.allowWrite === true, requiresConfirmation: item.policy?.requiresConfirmation === true } })
          } catch (cause) { setError(errorText(cause)) }
        }
        const saveOperation = async () => {
          const input = { id: form.id, operationId: form.operationId || form.id, name: form.name, method: form.method, path: form.path, serviceTargetId: form.serviceTargetId, summary: form.summary, description: form.description, tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean), enabled: form.enabled, kitIds: form.kitIds, parameters: parseJson(form.parameters, []), requestBody: form.requestBody.trim() ? parseJson(form.requestBody, null) : null, responses: parseJson(form.responses, {}), policy: form.policy }
          try { setBusy(true); if (editingOperation) await call('updateOperation', { id: editingOperation, patch: input }); else await call('createOperation', { input }); setForm(null); setEditingOperation(null); notifyConfigChanged(); await refresh() } catch (cause) { setError(errorText(cause)) } finally { setBusy(false) }
        }
        const removeKit = async () => {
          if (!activeKit || !window.confirm('确认删除此套件？不会删除 Operation。')) return
          try { await call('deleteKit', { id: activeKit.id }); notifyConfigChanged(); await refresh() } catch (cause) { setError(errorText(cause)) }
        }
        const removeOperation = async (id) => {
          if (!window.confirm('确认删除此 Operation？')) return
          try { await call('deleteOperation', { id }); notifyConfigChanged(); await refresh() } catch (cause) { setError(errorText(cause)) }
        }
        const toggleOperation = async (operation) => {
          try { await call('setOperationEnabled', { id: operation.id, enabled: !operation.enabled }); notifyConfigChanged(); await refresh() } catch (cause) { setError(errorText(cause)) }
        }

        const kitCards = kits.length === 0
          ? React.createElement('div', { className: 'dsh-api-kit-card dsh-api-kit-muted' }, '暂无套件')
          : kits.map((kit) => React.createElement('button', { key: kit.id, type: 'button', className: 'dsh-api-kit-card ' + (selectedKit === kit.id ? 'is-selected' : ''), style: { width: '100%', textAlign: 'left', color: 'inherit', cursor: 'pointer' }, onClick: () => setSelectedKit(kit.id) }, React.createElement('strong', null, kit.name), React.createElement('div', { className: 'dsh-api-kit-muted' }, `${kit.operationCount} 个操作 · ${kit.enabledOperationCount} 个启用`)))
        const operationCards = kitOperations.length === 0
          ? React.createElement('div', { className: 'dsh-api-kit-card dsh-api-kit-muted' }, '该套件暂无 Operation')
          : kitOperations.map((operation) => React.createElement('div', { key: operation.id, className: 'dsh-api-kit-card' }, React.createElement('div', { className: 'dsh-api-kit-row' }, React.createElement('div', null, React.createElement('strong', null, operation.name), React.createElement('div', { className: 'dsh-api-kit-muted' }, `${operation.method} ${operation.path}`)), React.createElement('div', null, button(operation.enabled ? '禁用' : '启用', () => toggleOperation(operation)), ' ', button('编辑', () => editOperation(operation.id)), ' ', button('删除', () => removeOperation(operation.id), 'danger')))))
        const editor = form && React.createElement('div', { className: 'dsh-api-kit-card' }, React.createElement('div', { className: 'dsh-api-kit-form' },
          React.createElement('h3', { style: { margin: 0 } }, editingOperation ? '编辑 Operation' : '新建 Operation'),
          textField('ID', form.id, (value) => patchForm('id', value)), textField('operationId', form.operationId, (value) => patchForm('operationId', value)), textField('名称', form.name, (value) => patchForm('name', value)), textField('Path', form.path, (value) => patchForm('path', value)),
          React.createElement('label', null, 'Method', React.createElement('select', { value: form.method, onChange: (event) => patchForm('method', event.target.value) }, HTTP_METHODS.map((method) => React.createElement('option', { key: method, value: method }, method)))),
          React.createElement('label', null, 'Service Target', React.createElement('select', { value: form.serviceTargetId, onChange: (event) => patchForm('serviceTargetId', event.target.value) }, targets.map((target) => React.createElement('option', { key: target.id, value: target.id }, target.name)))),
          textField('Tag（逗号分隔）', form.tags, (value) => patchForm('tags', value)), textField('摘要', form.summary, (value) => patchForm('summary', value)), textField('描述', form.description, (value) => patchForm('description', value), true), textField('Parameters JSON', form.parameters, (value) => patchForm('parameters', value), true), textField('Request Body JSON', form.requestBody, (value) => patchForm('requestBody', value), true), textField('Responses JSON', form.responses, (value) => patchForm('responses', value), true),
          React.createElement('label', { className: 'dsh-api-kit-check' }, React.createElement('input', { type: 'checkbox', checked: form.enabled, onChange: (event) => patchForm('enabled', event.target.checked) }), '启用'),
          React.createElement('label', { className: 'dsh-api-kit-check' }, React.createElement('input', { type: 'checkbox', checked: form.policy.allowAgentCall, onChange: (event) => patchForm('policy', { ...form.policy, allowAgentCall: event.target.checked }) }), '允许 Agent 调用'),
          React.createElement('label', { className: 'dsh-api-kit-check' }, React.createElement('input', { type: 'checkbox', checked: form.policy.allowWrite, onChange: (event) => patchForm('policy', { ...form.policy, allowWrite: event.target.checked }) }), '允许写操作（后续执行器仍会再次校验）'),
          React.createElement('label', { className: 'dsh-api-kit-check' }, React.createElement('input', { type: 'checkbox', checked: form.policy.requiresConfirmation, onChange: (event) => patchForm('policy', { ...form.policy, requiresConfirmation: event.target.checked }) }), '调用前需要确认'),
          React.createElement('div', null, button('取消', () => { setForm(null); setEditingOperation(null) }), ' ', button(busy ? '保存中…' : '保存', saveOperation, 'primary', busy)),
        ))

        return React.createElement('section', { className: 'dsh-api-kit-settings' }, React.createElement('h2', { style: { margin: 0 } }, 'API 套件'), React.createElement('p', { className: 'dsh-api-kit-muted' }, '手工维护 API Operation 与套件关联。凭据和网络请求始终留在 Host。'), error && React.createElement('div', { className: 'dsh-api-kit-error', role: 'alert' }, error), React.createElement('div', { className: 'dsh-api-kit-toolbar' }, React.createElement('div', { style: { display: 'flex', gap: 8, alignItems: 'end' } }, textField('新套件名称', kitName, setKitName), button('创建套件', createKit, 'primary')), button(busy ? '加载中…' : '刷新', refresh, '', busy)), React.createElement('div', { className: 'dsh-api-kit-grid' }, React.createElement('div', null, kitCards), React.createElement('div', null, activeKit && React.createElement('div', { className: 'dsh-api-kit-card' }, React.createElement('div', { className: 'dsh-api-kit-row' }, React.createElement('div', null, React.createElement('strong', null, activeKit.name), React.createElement('div', { className: 'dsh-api-kit-muted' }, activeKit.description || '未填写描述')), React.createElement('div', null, button('新增 Operation', newOperation, 'primary'), ' ', button('删除套件', removeKit, 'danger')))), operationCards, editor)))
      }

      slots.inject('conversation.input.left', () => slots.register({ name: 'conversation.input.left', id: 'dsh-api-kit', order: 93, label: 'API 套件' }, (props) => React.createElement(ApiKitControl, props)))
      slots.inject('settings.section', () => slots.register({ name: 'settings.section', id: 'api-kit', order: 30, label: 'API 套件' }, (props) => React.createElement(Settings, props)))
    }

    return { inject: ['remote', 'slots'], apply }
  },
})
