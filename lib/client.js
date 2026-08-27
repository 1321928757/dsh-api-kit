/**
 * dsh-api-kit browser bundle entry for T05.
 * The Client owns presentation only; every mutation and validation remains in
 * the Host configuration service. No credentials or arbitrary URLs cross here.
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
      'listAuthProfiles', 'getAuthProfile',
    ]
    const HTTP_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
    const looseCodec = (typeSymbol) => ({ mode: 'strict', typeSymbol, schema: { parse: (value) => value } })
    const descriptor = (name, parameters = []) => ({
      id: 'dsh-api-kit#api-kit/' + name,
      service: 'apiKitConfig',
      namespace: 'api-kit',
      method: name,
      invocation: { kind: 'direct' },
      parameters: parameters.map((item) => ({ name: item, wire: item, source: 'json', codec: looseCodec(item === 'input' || item === 'patch' || item === 'operationIds' ? 'dsh-api-kit#Args' : 'dsh-api-kit#Json') })),
      result: looseCodec('dsh-api-kit#Json'),
    })
    const descriptorSpec = {
      listKits: ['args'], getKit: ['id'], createKit: ['input'], updateKit: ['id', 'patch'], deleteKit: ['id'],
      addOperationsToKit: ['kitId', 'operationIds'], removeOperationsFromKit: ['kitId', 'operationIds'], listOperations: ['args'],
      getOperation: ['id'], createOperation: ['input'], updateOperation: ['id', 'patch'], deleteOperation: ['id'], setOperationEnabled: ['id', 'enabled'],
      listServiceTargets: ['args'], getServiceTarget: ['id'], listEnvironments: ['args'], getEnvironment: ['id'], listAuthProfiles: ['args'], getAuthProfile: ['id'],
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
      @media(max-width:720px){.dsh-api-kit-settings{padding:16px}.dsh-api-kit-grid{grid-template-columns:1fr}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}
    `

    function parseJson(value, fallback) { try { return JSON.parse(value) } catch { return fallback } }
    function errorText(error) { return error?.message || error?.code || '请求失败' }
    function button(label, onClick, className = '', disabled = false) { return React.createElement('button', { type: 'button', className: 'dsh-api-kit-button ' + className, onClick, disabled }, label) }
    function textField(label, value, onChange, multiline = false) {
      return React.createElement('label', null, label, React.createElement(multiline ? 'textarea' : 'input', { value: value ?? '', onChange: (event) => onChange(event.target.value) }))
    }

    async function apply(ctx) {
      const slots = ctx.get('slots')
      const remote = ctx.get('remote')
      if (slots === undefined || remote === undefined || typeof remote.$mount !== 'function') return
      const unmount = await remote.$mount(CONTRIBUTION)
      ctx.effect(() => async () => { await unmount() }, 'dsh-api-kit: remote contribution')
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

        const refresh = async () => {
          setBusy(true); setError(null)
          try {
            const values = await Promise.all([call('listKits'), call('listOperations'), call('listServiceTargets')])
            const nextKits = values[0] || []; const nextOperations = values[1] || []; const nextTargets = values[2] || []
            setKits(nextKits); setOperations(nextOperations); setTargets(nextTargets)
            setSelectedKit((current) => current && nextKits.some((kit) => kit.id === current) ? current : (nextKits[0]?.id || null))
          } catch (cause) { setError(errorText(cause)) } finally { setBusy(false) }
        }
        React.useEffect(() => { void refresh() }, [])

        const activeKit = kits.find((kit) => kit.id === selectedKit)
        const kitOperations = activeKit ? operations.filter((operation) => activeKit.operationIds.includes(operation.id)) : []
        const patchForm = (key, value) => setForm((current) => ({ ...current, [key]: value }))
        const createKit = async () => {
          const id = kitName.trim().toLowerCase().replace(/[^a-z0-9._:-]+/g, '-')
          if (!id) return
          try { await call('createKit', { input: { id, name: kitName, operationIds: [] } }); setKitName(''); await refresh(); setSelectedKit(id) } catch (cause) { setError(errorText(cause)) }
        }
        const newOperation = () => setForm({ id: '', operationId: '', name: '', method: 'GET', path: '/', serviceTargetId: targets[0]?.id || '', summary: '', description: '', tags: '', enabled: true, kitIds: selectedKit ? [selectedKit] : [], parameters: '[]', requestBody: '', responses: '{}', allowAgentCall: true, allowWrite: false, requiresConfirmation: false })
        const editOperation = async (id) => {
          try {
            const item = await call('getOperation', { id })
            setEditingOperation(id)
            setForm({ ...item, tags: (item.tags || []).join(', '), kitIds: item.kitIds || [], parameters: JSON.stringify(item.parameters || [], null, 2), requestBody: item.requestBody ? JSON.stringify(item.requestBody, null, 2) : '', responses: JSON.stringify(item.responses || {}, null, 2), allowAgentCall: item.policy?.allowAgentCall === true, allowWrite: item.policy?.allowWrite === true, requiresConfirmation: item.policy?.requiresConfirmation === true })
          } catch (cause) { setError(errorText(cause)) }
        }
        const saveOperation = async () => {
          const input = { id: form.id, operationId: form.operationId || form.id, name: form.name, method: form.method, path: form.path, serviceTargetId: form.serviceTargetId, summary: form.summary, description: form.description, tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean), enabled: form.enabled, kitIds: form.kitIds, parameters: parseJson(form.parameters, []), requestBody: form.requestBody.trim() ? parseJson(form.requestBody, null) : null, responses: parseJson(form.responses, {}), policy: { allowAgentCall: form.allowAgentCall, allowWrite: form.allowWrite, requiresConfirmation: form.requiresConfirmation } }
          try { setBusy(true); if (editingOperation) await call('updateOperation', { id: editingOperation, patch: input }); else await call('createOperation', { input }); setForm(null); setEditingOperation(null); await refresh() } catch (cause) { setError(errorText(cause)) } finally { setBusy(false) }
        }
        const saveKit = async () => {
          if (!activeKit) return
          try { await call('updateKit', { id: activeKit.id, patch: { description: activeKit.description } }); await refresh() } catch (cause) { setError(errorText(cause)) }
        }
        const removeKit = async () => {
          if (!activeKit || !window.confirm('确认删除此套件？不会删除 Operation。')) return
          try { await call('deleteKit', { id: activeKit.id }); await refresh() } catch (cause) { setError(errorText(cause)) }
        }
        const removeOperation = async (id) => {
          if (!window.confirm('确认删除此 Operation？')) return
          try { await call('deleteOperation', { id }); await refresh() } catch (cause) { setError(errorText(cause)) }
        }

        const kitCards = kits.length === 0
          ? React.createElement('div', { className: 'dsh-api-kit-card dsh-api-kit-muted' }, '暂无套件')
          : kits.map((kit) => React.createElement('button', { key: kit.id, type: 'button', className: 'dsh-api-kit-card ' + (selectedKit === kit.id ? 'is-selected' : ''), style: { width: '100%', textAlign: 'left', color: 'inherit', cursor: 'pointer' }, onClick: () => setSelectedKit(kit.id) }, React.createElement('strong', null, kit.name), React.createElement('div', { className: 'dsh-api-kit-muted' }, `${kit.operationCount} 个操作 · ${kit.enabledOperationCount} 个启用`)))
        const operationCards = kitOperations.length === 0
          ? React.createElement('div', { className: 'dsh-api-kit-card dsh-api-kit-muted' }, '该套件暂无 Operation')
          : kitOperations.map((operation) => React.createElement('div', { key: operation.id, className: 'dsh-api-kit-card' }, React.createElement('div', { className: 'dsh-api-kit-row' }, React.createElement('div', null, React.createElement('strong', null, operation.name), React.createElement('div', { className: 'dsh-api-kit-muted' }, `${operation.method} ${operation.path}`)), React.createElement('div', null, button(operation.enabled ? '禁用' : '启用', () => call('setOperationEnabled', { id: operation.id, enabled: !operation.enabled }).then(refresh).catch((cause) => setError(errorText(cause)))), ' ', button('编辑', () => editOperation(operation.id)), ' ', button('删除', () => removeOperation(operation.id), 'danger')))))
        const editor = form && React.createElement('div', { className: 'dsh-api-kit-card' }, React.createElement('div', { className: 'dsh-api-kit-form' }, React.createElement('h3', { style: { margin: 0 } }, editingOperation ? '编辑 Operation' : '新建 Operation'), textField('ID', form.id, (value) => patchForm('id', value)), textField('operationId', form.operationId, (value) => patchForm('operationId', value)), textField('名称', form.name, (value) => patchForm('name', value)), textField('Path', form.path, (value) => patchForm('path', value)), React.createElement('label', null, 'Method', React.createElement('select', { value: form.method, onChange: (event) => patchForm('method', event.target.value) }, HTTP_METHODS.map((method) => React.createElement('option', { key: method, value: method }, method)))), React.createElement('label', null, 'Service Target', React.createElement('select', { value: form.serviceTargetId, onChange: (event) => patchForm('serviceTargetId', event.target.value) }, targets.map((target) => React.createElement('option', { key: target.id, value: target.id }, target.name)))), textField('Tag（逗号分隔）', form.tags, (value) => patchForm('tags', value)), textField('摘要', form.summary, (value) => patchForm('summary', value)), textField('描述', form.description, (value) => patchForm('description', value), true), textField('Parameters JSON', form.parameters, (value) => patchForm('parameters', value), true), textField('Request Body JSON', form.requestBody, (value) => patchForm('requestBody', value), true), textField('Responses JSON', form.responses, (value) => patchForm('responses', value), true), React.createElement('label', { className: 'dsh-api-kit-check' }, React.createElement('input', { type: 'checkbox', checked: form.enabled, onChange: (event) => patchForm('enabled', event.target.checked) }), '启用'), React.createElement('label', { className: 'dsh-api-kit-check' }, React.createElement('input', { type: 'checkbox', checked: form.allowAgentCall, onChange: (event) => patchForm('allowAgentCall', event.target.checked) }), '允许 Agent 调用'), React.createElement('label', { className: 'dsh-api-kit-check' }, React.createElement('input', { type: 'checkbox', checked: form.allowWrite, onChange: (event) => patchForm('allowWrite', event.target.checked) }), '允许写操作'), React.createElement('div', { style: { display: 'flex', gap: 8 } }, button('取消', () => { setForm(null); setEditingOperation(null) }), button(busy ? '保存中…' : '保存', saveOperation, 'primary', busy))))

        return React.createElement('section', { className: 'dsh-api-kit-settings' }, React.createElement('h2', { style: { margin: 0 } }, 'API 套件'), React.createElement('p', { className: 'dsh-api-kit-muted' }, '手工维护 API Operation 与套件关联。凭据和网络请求始终留在 Host。'), error && React.createElement('div', { className: 'dsh-api-kit-error', role: 'alert' }, error), React.createElement('div', { className: 'dsh-api-kit-toolbar' }, React.createElement('div', { style: { display: 'flex', gap: 8, alignItems: 'end' } }, textField('新套件名称', kitName, setKitName), button('创建套件', createKit, 'primary')), button(busy ? '加载中…' : '刷新', refresh, '', busy)), React.createElement('div', { className: 'dsh-api-kit-grid' }, React.createElement('div', null, kitCards), React.createElement('div', null, activeKit && React.createElement('div', { className: 'dsh-api-kit-card' }, React.createElement('div', { className: 'dsh-api-kit-row' }, React.createElement('div', null, React.createElement('strong', null, activeKit.name), React.createElement('div', { className: 'dsh-api-kit-muted' }, activeKit.description || '未填写描述')), React.createElement('div', null, button('新增 Operation', newOperation, 'primary'), ' ', button('删除套件', removeKit, 'danger')))), operationCards, editor)))
      }

      slots.inject('conversation.input.left', () => slots.register({ name: 'conversation.input.left', id: 'dsh-api-kit', order: 95, label: 'API 套件' }, () => React.createElement('button', { type: 'button', className: 'dsh-api-kit-button', title: 'T06 将提供会话级套件选择' }, 'API 套件')))
      slots.inject('settings.section', () => slots.register({ name: 'settings.section', id: 'api-kit', order: 30, label: 'API 套件' }, (props) => React.createElement(Settings, props)))
    }

    return { inject: ['remote', 'slots'], apply }
  },
})
