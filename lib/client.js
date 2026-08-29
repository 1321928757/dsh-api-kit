/**
 * dsh-api-kit browser bundle entry for T06 and T12.
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
      'listAuthProfiles', 'getAuthProfile', 'getSessionActivation', 'setSessionActivation', 'clearSessionActivation', 'previewOpenApiImport', 'confirmOpenApiImport',
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
      getSessionActivation: ['args'], setSessionActivation: ['args'], clearSessionActivation: ['args'], previewOpenApiImport: ['args'], confirmOpenApiImport: ['args'],
    }
    const CONTRIBUTION = { package: 'dsh-api-kit', descriptors: RPC_METHODS.map((name) => descriptor(name, descriptorSpec[name])) }
    const styles = `
      .dsh-api-kit-settings{box-sizing:border-box;width:100%;max-width:1100px;min-width:0;padding:24px;color:var(--dsw-alias-label-primary);overflow-x:clip}
      .dsh-api-kit-settings *,.dsh-api-kit-picker *{box-sizing:border-box}.dsh-api-kit-toolbar{display:flex;gap:12px;align-items:end;justify-content:space-between;flex-wrap:wrap;margin:16px 0;min-width:0}
      .dsh-api-kit-toolbar>*,.dsh-api-kit-row>*,.dsh-api-kit-popover-header>*,.dsh-api-kit-popover-footer>*{min-width:0}.dsh-api-kit-grid{display:grid;grid-template-columns:minmax(180px,260px) minmax(0,1fr);gap:16px;min-width:0}.dsh-api-kit-card{min-width:0;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);padding:14px}
      .dsh-api-kit-card+.dsh-api-kit-card{margin-top:10px}.dsh-api-kit-card.is-selected{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2)}
      @supports (background:color-mix(in srgb,black,white)){.dsh-api-kit-card.is-selected{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,var(--dsw-alias-bg-layer-1))}}
      .dsh-api-kit-row{display:flex;align-items:center;gap:10px;justify-content:space-between;min-width:0}.dsh-api-kit-row>div:first-child{overflow-wrap:anywhere}.dsh-api-kit-muted{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.5;overflow-wrap:anywhere}
      .dsh-api-kit-button{appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);padding:8px 12px;font:inherit;line-height:1.35;cursor:pointer;touch-action:manipulation;transition:border-color .18s ease,background-color .18s ease,color .18s ease,opacity .18s ease}
      .dsh-api-kit-button:hover:not(:disabled){border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-interactive-bg-hover)}.dsh-api-kit-button:focus-visible,.dsh-api-kit-form input:focus-visible,.dsh-api-kit-form select:focus-visible,.dsh-api-kit-form textarea:focus-visible{outline:2px solid var(--dsw-api-kit-focus,var(--dsw-alias-brand-primary));outline-offset:2px}.dsh-api-kit-button.primary{background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary));color:var(--dsw-alias-label-primary-foreground,var(--dsw-alias-label-primary-inverted,#fff));border-color:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary))}.dsh-api-kit-button.primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover,var(--dsw-alias-brand-primary));border-color:var(--dsw-alias-button-primary-hover,var(--dsw-alias-brand-primary))}.dsh-api-kit-button.danger{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-border-l1)}.dsh-api-kit-button.danger:hover:not(:disabled){background:var(--dsw-api-kit-danger-bg,var(--dsw-alias-interactive-bg-hover));border-color:var(--dsw-alias-state-error-primary)}.dsh-api-kit-button:disabled{cursor:not-allowed;opacity:.5}
      .dsh-api-kit-form{display:grid;gap:12px;min-width:0}.dsh-api-kit-form label,.dsh-api-kit-field{display:grid;gap:5px;min-width:0;font-size:13px}.dsh-api-kit-form label>span,.dsh-api-kit-field>label{font-weight:500}.dsh-api-kit-form input,.dsh-api-kit-form select,.dsh-api-kit-form textarea{width:100%;min-height:44px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:9px 10px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit}.dsh-api-kit-form textarea{min-height:112px;resize:vertical;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;line-height:1.5}.dsh-api-kit-form select[multiple]{min-height:112px}.dsh-api-kit-check{display:flex!important;align-items:center;gap:8px;min-height:44px}.dsh-api-kit-check input{width:20px;height:20px}.dsh-api-kit-field-error{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:1.45}.dsh-api-kit-error{color:var(--dsw-alias-state-error-primary);padding:8px 0;overflow-wrap:anywhere}
      .dsh-api-kit-picker{position:relative;display:inline-flex;align-items:center;min-width:0}.dsh-api-kit-picker-button{height:28px;min-height:28px;max-width:260px;padding:0 10px;border-radius:8px;background:var(--dsw-alias-bg-input,var(--dsw-alias-bg-layer-1));font-size:12px;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dsh-api-kit-picker-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dsh-api-kit-picker-button.is-active{background:var(--dsw-api-kit-active-bg,var(--dsw-alias-interactive-bg-hover));border-color:var(--dsw-alias-brand-primary)}
      .dsh-api-kit-popover{position:absolute;z-index:20;left:0;bottom:calc(100% + 8px);width:min(390px,calc(100vw - 32px));max-height:min(560px,calc(100dvh - 32px));overflow:auto;overscroll-behavior:contain;padding:14px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-overlay);box-shadow:0 12px 32px rgb(0 0 0 / 18%)}
      .dsh-api-kit-popover-header,.dsh-api-kit-popover-footer{display:flex;align-items:center;justify-content:space-between;gap:10px}.dsh-api-kit-popover-section{display:grid;gap:8px;margin-top:14px}.dsh-api-kit-popover-section h3,.dsh-api-kit-popover-section legend{font-size:13px;font-weight:600;margin:0}.dsh-api-kit-popover-section fieldset{border:0;padding:0;margin:0;display:grid;gap:8px}
      .dsh-api-kit-selection{display:flex;align-items:flex-start;gap:10px;padding:9px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;min-height:44px}.dsh-api-kit-selection.is-checked{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2)}.dsh-api-kit-selection input{width:20px;height:20px;margin-top:1px}.dsh-api-kit-selection-main{min-width:0;display:grid;gap:2px}.dsh-api-kit-selection-title{font-size:13px;overflow-wrap:anywhere}.dsh-api-kit-selection-meta{font-size:12px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}
      .dsh-api-kit-warn,.dsh-api-kit-invalid,.dsh-api-kit-success{padding:9px;border-radius:8px;font-size:12px;line-height:1.5;overflow-wrap:anywhere}.dsh-api-kit-warn{color:var(--dsw-alias-state-warn-primary);background:var(--dsw-api-kit-warn-bg,var(--dsw-alias-bg-layer-2))}.dsh-api-kit-invalid{color:var(--dsw-alias-state-error-primary);background:var(--dsw-api-kit-error-bg,var(--dsw-alias-bg-layer-2))}.dsh-api-kit-success{color:var(--dsw-alias-state-success-primary);background:var(--dsw-api-kit-success-bg,var(--dsw-alias-bg-layer-2))}.dsh-api-kit-status{font-size:12px;color:var(--dsw-alias-label-secondary);line-height:1.5;overflow-wrap:anywhere}
      @supports (background:color-mix(in srgb,black,white)){.dsh-api-kit-warn{--dsw-api-kit-warn-bg:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 12%,var(--dsw-alias-bg-layer-1))}.dsh-api-kit-invalid{--dsw-api-kit-error-bg:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,var(--dsw-alias-bg-layer-1))}.dsh-api-kit-success{--dsw-api-kit-success-bg:color-mix(in srgb,var(--dsw-alias-state-success-primary) 10%,var(--dsw-alias-bg-layer-1))}}
      .dsh-api-kit-popover select{width:100%;min-height:44px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:9px 10px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit}.dsh-api-kit-spinner{display:inline-block;width:16px;height:16px;flex:0 0 auto;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:dsh-api-kit-spin .7s linear infinite}@keyframes dsh-api-kit-spin{to{transform:rotate(360deg)}}
      @media(max-width:720px){.dsh-api-kit-settings{padding:16px}.dsh-api-kit-grid{grid-template-columns:1fr}.dsh-api-kit-toolbar>div{width:100%;flex-wrap:wrap}.dsh-api-kit-toolbar>div .dsh-api-kit-field{flex:1 1 220px}.dsh-api-kit-picker-button{max-width:min(260px,calc(100vw - 32px))}}
      @media(max-width:520px){.dsh-api-kit-settings{padding:12px}.dsh-api-kit-toolbar{align-items:stretch}.dsh-api-kit-toolbar>button,.dsh-api-kit-toolbar>div>button{width:100%}.dsh-api-kit-row{align-items:flex-start;flex-wrap:wrap}.dsh-api-kit-row>div:last-child{width:100%;display:flex;flex-wrap:wrap;gap:8px}.dsh-api-kit-row>div:last-child .dsh-api-kit-button{flex:1 1 120px}.dsh-api-kit-popover{position:fixed;left:8px;right:8px;bottom:8px;width:auto;max-width:none;max-height:calc(100dvh - 24px);border-radius:12px}}
      @media(prefers-reduced-motion:reduce){.dsh-api-kit-settings *,.dsh-api-kit-picker *{scroll-behavior:auto!important;transition:none!important}.dsh-api-kit-spinner{animation:none}}
    `

    const ERROR_GUIDANCE = {
      IMPORT_STALE_PREVIEW: '预览已过期，请重新读取并预览原始 JSON 后再确认。',
      IMPORT_TRANSACTION_MISMATCH: '导入事务与当前文档不匹配，请重新预览。',
      IMPORT_DOCUMENT_MISMATCH: '文档内容已变化，请重新预览后再确认。',
      IMPORT_TARGET_BINDING_REQUIRED: '请选择一个已登记且启用的 Service Target。',
      IMPORT_KIT_BINDING_REQUIRED: '请选择至少一个已登记且启用的 API Kit。',
      IMPORT_CONFLICT_DECISION_REQUIRED: '请为每个冲突选择覆盖、保留本地或跳过。',
      IMPORT_SECURITY_MAPPING_UNSUPPORTED: '认证方案无法安全映射，请选择明确的已有 Auth Profile。',
      JSON_INVALID: 'JSON 格式无效，请修正对应字段后重试。',
    }
    function errorText(error) {
      const code = error?.code
      const message = ERROR_GUIDANCE[code] || error?.message || code || '请求失败'
      return code && !message.startsWith(code) ? `${code}：${message}` : message
    }
    function button(label, onClick, className = '', disabled = false, options = {}) {
      return React.createElement('button', { type: 'button', className: 'dsh-api-kit-button ' + className, onClick, disabled, 'aria-busy': options.busy === true ? 'true' : undefined, 'aria-label': options.ariaLabel, title: options.title }, label)
    }
    function parseJsonValue(value, label, emptyValue) {
      if (!String(value ?? '').trim()) return { ok: true, value: emptyValue }
      try { return { ok: true, value: JSON.parse(value) } } catch { return { ok: false, error: `${label} JSON 格式无效，请检查逗号、引号和括号。` } }
    }
    function fieldId(label, explicit) { return explicit || 'dsh-api-kit-field-' + String(label).toLowerCase().replace(/[^a-z0-9]+/g, '-') }
    function textField(label, value, onChange, multiline = false, options = {}) {
      const id = fieldId(label, options.id)
      const errorId = id + '-error'
      const control = React.createElement(multiline ? 'textarea' : 'input', { id, value: value ?? '', onChange: (event) => onChange(event.target.value), placeholder: options.placeholder, maxLength: options.maxLength, 'aria-invalid': options.error ? 'true' : undefined, 'aria-describedby': options.error ? errorId : undefined, ref: options.ref })
      return React.createElement('div', { className: 'dsh-api-kit-field' }, React.createElement('label', { htmlFor: id }, label), control, options.error && React.createElement('div', { id: errorId, className: 'dsh-api-kit-field-error', role: 'alert' }, options.error))
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
        const mountedRef = React.useRef(true)
        const requestRef = React.useRef(0)
        const triggerRef = React.useRef(null)
        const panelRef = React.useRef(null)
        const returnFocusRef = React.useRef(null)
        React.useEffect(() => () => { mountedRef.current = false; requestRef.current += 1 }, [])
        const load = React.useCallback(async () => {
          const requestId = ++requestRef.current
          if (!sessionId) { setActivation(null); setDraftKitIds([]); setDraftEnvironmentId(null); return }
          setLoading(true)
          try {
            const next = await call('getSessionActivation', { sessionId })
            if (!mountedRef.current || requestId !== requestRef.current) return
            setActivation(next || null)
            setDraftKitIds(Array.isArray(next?.activeKitIds) ? next.activeKitIds : [])
            setDraftEnvironmentId(next?.environmentId || null)
            setError(null)
          } catch (cause) {
            if (mountedRef.current && requestId === requestRef.current) setError(errorText(cause))
          } finally {
            if (mountedRef.current && requestId === requestRef.current) setLoading(false)
          }
        }, [sessionId])

        React.useEffect(() => { void load() }, [load])
        React.useEffect(() => {
          const onChange = () => { void load() }
          window.addEventListener(CONFIG_EVENT, onChange)
          return () => window.removeEventListener(CONFIG_EVENT, onChange)
        }, [load])
        const closePopover = React.useCallback(() => setOpen(false), [])
        React.useEffect(() => {
          if (!open) {
            if (returnFocusRef.current && typeof returnFocusRef.current.focus === 'function') {
              returnFocusRef.current.focus()
              returnFocusRef.current = null
            }
            return undefined
          }
          const first = panelRef.current?.querySelector('button:not([disabled]), input:not([disabled]), select:not([disabled])')
          if (first && typeof first.focus === 'function') first.focus()
          const onMouseDown = (event) => {
            if (rootRef.current && !rootRef.current.contains(event.target)) closePopover()
          }
          const onKeyDown = (event) => {
            if (event.key === 'Escape') { event.preventDefault(); closePopover(); return }
            if (event.key !== 'Tab' || !panelRef.current) return
            const focusable = [...panelRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled])')]
            if (focusable.length === 0) return
            const firstFocusable = focusable[0]; const lastFocusable = focusable[focusable.length - 1]
            if (event.shiftKey && document.activeElement === firstFocusable) { event.preventDefault(); lastFocusable.focus() }
            else if (!event.shiftKey && document.activeElement === lastFocusable) { event.preventDefault(); firstFocusable.focus() }
          }
          document.addEventListener('mousedown', onMouseDown)
          document.addEventListener('keydown', onKeyDown)
          return () => {
            document.removeEventListener('mousedown', onMouseDown)
            document.removeEventListener('keydown', onKeyDown)
          }
        }, [open, closePopover])

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
          if (busy) return
          const requestId = ++requestRef.current
          setBusy(true); setError(null)
          try {
            const next = await call('setSessionActivation', { sessionId, activeKitIds: draftKitIds, environmentId: draftKitIds.length > 0 ? draftEnvironmentId : null })
            if (!mountedRef.current || requestId !== requestRef.current) return
            setActivation(next); setDraftKitIds(next.activeKitIds || []); setDraftEnvironmentId(next.environmentId || null); closePopover()
          } catch (cause) { if (mountedRef.current && requestId === requestRef.current) setError(errorText(cause)) } finally { if (mountedRef.current && requestId === requestRef.current) setBusy(false) }
        }
        const clear = async () => {
          if (busy) return
          const requestId = ++requestRef.current
          setBusy(true); setError(null)
          try {
            const next = await call('clearSessionActivation', { sessionId })
            if (!mountedRef.current || requestId !== requestRef.current) return
            setActivation(next); setDraftKitIds([]); setDraftEnvironmentId(null); closePopover()
          } catch (cause) { if (mountedRef.current && requestId === requestRef.current) setError(errorText(cause)) } finally { if (mountedRef.current && requestId === requestRef.current) setBusy(false) }
        }

        if (!sessionId) return null
        const selectedIsInvalid = activation && activation.valid === false
        return React.createElement('div', { ref: rootRef, className: 'dsh-api-kit-picker' },
          React.createElement('button', {
            ref: triggerRef, type: 'button', className: 'dsh-api-kit-button dsh-api-kit-picker-button' + (activeKitNames.length > 0 ? ' is-active' : ''),
            onClick: () => { if (!open) returnFocusRef.current = triggerRef.current; setOpen((value) => !value); if (!open) void load() },
            disabled: loading && !open, 'aria-expanded': open, 'aria-controls': 'dsh-api-kit-picker-panel', 'aria-haspopup': 'dialog', title: currentEnvironment ? `环境：${currentEnvironment.name}` : '选择当前会话的 API 套件',
          }, selectedIsInvalid ? 'API 套件需修复' : buttonLabel, currentEnvironment ? ` · ${currentEnvironment.name}` : ''),
          open && React.createElement('div', { ref: panelRef, id: 'dsh-api-kit-picker-panel', className: 'dsh-api-kit-popover', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dsh-api-kit-picker-title' },
            React.createElement('div', { className: 'dsh-api-kit-popover-header' }, React.createElement('h3', { id: 'dsh-api-kit-picker-title' }, '当前会话 API 套件'), loading && React.createElement('span', { className: 'dsh-api-kit-spinner', 'aria-label': '加载中' })),
            React.createElement('div', { className: 'dsh-api-kit-status', role: 'status', 'aria-live': 'polite', 'aria-busy': loading ? 'true' : 'false' }, '选择只对当前会话生效；重启 DSH 后需要重新激活。'),
            error && React.createElement('div', { className: 'dsh-api-kit-invalid', role: 'alert' }, error),
            activation?.errors?.length > 0 && React.createElement('div', { className: 'dsh-api-kit-invalid', role: 'alert' }, activation.errors.map((item) => React.createElement('div', { key: item.code + (item.path || '') }, item.message))),
            activation?.warnings?.length > 0 && React.createElement('div', { className: 'dsh-api-kit-warn', role: 'status' }, activation.warnings.map((item) => React.createElement('div', { key: item.code + (item.path || '') }, item.message))),
            React.createElement('div', { className: 'dsh-api-kit-popover-section' },
              React.createElement('fieldset', null, React.createElement('legend', null, 'API 套件（可多选）'), kits.length === 0
                ? React.createElement('div', { className: 'dsh-api-kit-muted' }, '暂无套件，请先在设置 → API 套件中创建，然后点击重试。')
                : kits.map((kit) => {
                  const checked = draftKitIds.includes(kit.id)
                  const disabled = !kit.selectable && !checked
                  const reason = kit.enabled === false ? '已停用' : kit.agentEnabled === false ? '未允许 Agent' : kit.operationCount === 0 ? '暂无 Operation' : `${kit.operationCount} 个操作`
                  return React.createElement('label', { key: kit.id, className: 'dsh-api-kit-selection' + (checked ? ' is-checked' : '') },
                    React.createElement('input', { type: 'checkbox', checked, disabled, onChange: () => toggleKit(kit), 'aria-label': `${kit.name}：${reason}` }),
                    React.createElement('span', { className: 'dsh-api-kit-selection-main' }, React.createElement('span', { className: 'dsh-api-kit-selection-title' }, kit.name), React.createElement('span', { className: 'dsh-api-kit-selection-meta' }, reason)),
                  )
                })),
            ),
            draftKitIds.length > 0 && React.createElement('div', { className: 'dsh-api-kit-popover-section' },
              React.createElement('label', { htmlFor: 'dsh-api-kit-environment' }, '环境'),
              React.createElement('select', { id: 'dsh-api-kit-environment', value: draftEnvironmentId || '', onChange: (event) => setDraftEnvironmentId(event.target.value || null), 'aria-label': '当前会话环境' },
                React.createElement('option', { value: '' }, '请选择环境'),
                environments.map((environment) => React.createElement('option', { key: environment.id, value: environment.id, disabled: !environment.selectable || !draftEnvironmentIds.includes(environment.id) }, `${environment.name}${environment.production ? '（生产）' : ''}${!environment.selectable ? ' · 不可用' : !draftEnvironmentIds.includes(environment.id) ? ' · 与套件不兼容' : ''}`)),
              ),
            ),
            React.createElement('div', { className: 'dsh-api-kit-popover-footer', style: { marginTop: 14 } }, button('清除选择', clear, '', busy || draftKitIds.length === 0, { busy }), React.createElement('span', { style: { display: 'flex', gap: 8 } }, button('取消', () => { setDraftKitIds(activation?.activeKitIds || []); setDraftEnvironmentId(activation?.environmentId || null); closePopover() }, '', busy), button(busy ? '保存中…' : '应用', save, 'primary', busy, { busy }))),
          ),
        )
      }

      function OpenApiImportPanel() {
        const [input, setInput] = React.useState('')
        const [preview, setPreview] = React.useState(null)
        const [kits, setKits] = React.useState([])
        const [targets, setTargets] = React.useState([])
        const [environments, setEnvironments] = React.useState([])
        const [authProfiles, setAuthProfiles] = React.useState([])
        const [targetId, setTargetId] = React.useState('')
        const [environmentId, setEnvironmentId] = React.useState('')
        const [kitIds, setKitIds] = React.useState([])
        const [authProfileId, setAuthProfileId] = React.useState('')
        const [selectedTags, setSelectedTags] = React.useState([])
        const [conflicts, setConflicts] = React.useState({})
        const [busy, setBusy] = React.useState(false)
        const [error, setError] = React.useState(null)
        const [result, setResult] = React.useState(null)
        const [bindingErrors, setBindingErrors] = React.useState({})
        const mountedRef = React.useRef(true)
        const requestRef = React.useRef(0)
        React.useEffect(() => () => { mountedRef.current = false; requestRef.current += 1 }, [])

        const loadBindings = React.useCallback(async () => {
          const requestId = ++requestRef.current
          const names = ['kits', 'targets', 'environments', 'authProfiles']
          const loaders = [() => call('listKits'), () => call('listServiceTargets'), () => call('listEnvironments'), () => call('listAuthProfiles')]
          const values = await Promise.all(loaders.map(async (loader, index) => {
            try { return { name: names[index], value: await loader() } } catch (cause) { return { name: names[index], error: errorText(cause) } }
          }))
          if (!mountedRef.current || requestId !== requestRef.current) return
          const failures = {}
          for (const item of values) {
            if (item.error) failures[item.name] = item.error
            else if (item.name === 'kits') setKits(item.value || [])
            else if (item.name === 'targets') setTargets(item.value || [])
            else if (item.name === 'environments') setEnvironments(item.value || [])
            else if (item.name === 'authProfiles') setAuthProfiles(item.value || [])
          }
          setBindingErrors(failures)
          const targetValue = values.find((item) => item.name === 'targets' && !item.error)?.value || []
          const kitValue = values.find((item) => item.name === 'kits' && !item.error)?.value || []
          setTargetId((current) => current || targetValue[0]?.id || '')
          setKitIds((current) => current.length > 0 ? current : (kitValue[0]?.id ? [kitValue[0].id] : []))
        }, [])
        React.useEffect(() => { void loadBindings() }, [loadBindings])

        const runPreview = async () => {
          if (busy) return
          if (!input.trim()) { setError('请粘贴 OpenAPI/Swagger JSON'); return }
          const requestId = ++requestRef.current
          setBusy(true); setError(null); setResult(null)
          try {
            const next = await call('previewOpenApiImport', { input, sourceId: undefined })
            if (!mountedRef.current || requestId !== requestRef.current) return
            setPreview(next); setConflicts({})
          } catch (cause) {
            if (mountedRef.current && requestId === requestRef.current) { setPreview(null); setError(errorText(cause)) }
          } finally { if (mountedRef.current && requestId === requestRef.current) setBusy(false) }
        }
        const importable = (preview?.operations || []).filter((item) => item.importable && item.status !== 'error')
        const selectedOperations = importable.filter((item) => {
          if (selectedTags.length === 0) return true
          const values = (item.tags || []).map((tag) => String(tag).toLowerCase())
          return selectedTags.some((tag) => values.includes(tag.toLowerCase()))
        })
        const confirm = async () => {
          if (busy) return
          if (!preview || !targetId || kitIds.length === 0) { setError('请先预览，并选择 Service Target 与至少一个 API Kit'); return }
          if (selectedOperations.length === 0) { setError('当前筛选没有可导入的 Operation，请调整 Tag 或检查预览错误。'); return }
          const conflictDecisions = {}
          for (const item of preview.operations || []) if (item.status === 'conflict') conflictDecisions[item.sourceKey] = conflicts[item.sourceKey] || 'keep-local'
          if (Object.keys(conflictDecisions).some((key) => !conflictDecisions[key])) { setError('每个冲突都必须选择处理方式'); return }
          if (typeof window !== 'undefined' && !window.confirm('确认按当前筛选、绑定和冲突决策导入？此操作将一次性写入本地 Registry。')) return
          const requestId = ++requestRef.current
          setBusy(true); setError(null); setResult(null)
          try {
            const value = await call('confirmOpenApiImport', {
              transactionId: preview.transactionId,
              input,
              sourceId: preview.documentMeta?.documentId,
              documentId: preview.documentMeta?.documentId,
              fingerprint: preview.documentMeta?.fingerprint,
              expectedRegistryFingerprint: preview.registryFingerprint,
              includedSourceKeys: selectedOperations.map((item) => item.sourceKey),
              conflictDecisions,
              defaultServiceTargetId: targetId,
              targetDefaults: environmentId ? { [targetId]: environmentId } : {},
              defaultKitIds: kitIds,
              defaultAuthProfileId: authProfileId || undefined,
            })
            if (!mountedRef.current || requestId !== requestRef.current) return
            setResult(value); notifyConfigChanged(); await loadBindings()
            if (mountedRef.current) setBusy(false)
          } catch (cause) { if (mountedRef.current && requestId === requestRef.current) setError(errorText(cause)) } finally { if (mountedRef.current && requestId === requestRef.current) setBusy(false) }
        }
        const tagNames = Object.keys(preview?.tagCounts || {}).filter((tag) => tag !== '(none)').sort()
        const bindingWarning = Object.keys(bindingErrors).length > 0 ? '部分绑定列表暂不可用，请点击重试后再导入。' : null
        return React.createElement('div', { className: 'dsh-api-kit-card', 'data-t12-import': 'openapi' },
          React.createElement('div', { className: 'dsh-api-kit-row' }, React.createElement('div', null, React.createElement('h3', { style: { margin: 0 } }, '导入 OpenAPI JSON'), React.createElement('div', { className: 'dsh-api-kit-muted' }, '仅支持内存中的 OpenAPI 3.0/3.1 或 Swagger 2.0 JSON；Server 仅作 display-only 候选，不会自动创建环境。')), button(busy ? '处理中…' : '读取并预览', runPreview, 'primary', busy, { busy })),
          textField('OpenAPI JSON（不支持 URL、YAML 或文件导入）', input, setInput, true, { id: 'dsh-api-kit-openapi-json', placeholder: '{"openapi":"3.0.3","info":...,"paths":...}', maxLength: 1024 * 1024 }),
          error && React.createElement('div', { className: 'dsh-api-kit-invalid', role: 'alert' }, error, React.createElement('div', { style: { marginTop: 8 } }, button('重试读取/预览', runPreview, '', busy, { busy }))),
          bindingWarning && React.createElement('div', { className: 'dsh-api-kit-invalid', role: 'alert' }, bindingWarning, Object.entries(bindingErrors).map(([name, value]) => React.createElement('div', { key: name }, `${name}：${value}`)), button('重试绑定列表', loadBindings, '', busy, { busy })),
          preview && React.createElement('div', { className: 'dsh-api-kit-form', style: { marginTop: 12 } },
            React.createElement('div', { className: 'dsh-api-kit-status' }, `${preview.documentMeta?.title || 'OpenAPI'} · ${preview.documentMeta?.version || ''} · ${preview.counts?.operations || 0} 个操作 · 新增 ${preview.counts?.new || 0} / 更新 ${preview.counts?.update || 0} / 冲突 ${preview.counts?.conflict || 0} / 错误 ${preview.counts?.error || 0}`),
            preview.serverCandidates?.length > 0 && React.createElement('div', { className: 'dsh-api-kit-warn' }, 'Server 候选（仅显示，不是执行目标）：', preview.serverCandidates.map((item) => React.createElement('div', { key: item.id }, item.url || `${item.id}（${item.status}）`))),
            preview.errors?.length > 0 && React.createElement('div', { className: 'dsh-api-kit-invalid' }, preview.errors.slice(0, 10).map((item) => React.createElement('div', { key: item.code + item.path }, `${item.code}：${item.message}`))),
            tagNames.length > 0 && React.createElement('label', null, 'Tag 筛选（不选表示全部）', React.createElement('select', { multiple: true, value: selectedTags, onChange: (event) => setSelectedTags([...event.target.selectedOptions].map((option) => option.value)) }, tagNames.map((tag) => React.createElement('option', { key: tag, value: tag }, `${tag}（${preview.tagCounts[tag]}）`)))),
            React.createElement('label', null, 'Service Target（必须是已登记目标）', React.createElement('select', { value: targetId, onChange: (event) => setTargetId(event.target.value) }, targets.map((item) => React.createElement('option', { key: item.id, value: item.id }, `${item.name}${item.enabled === false ? '（已停用）' : ''}`)))),
            React.createElement('label', null, '默认 Environment（只绑定已有环境）', React.createElement('select', { value: environmentId, onChange: (event) => setEnvironmentId(event.target.value) }, React.createElement('option', { value: '' }, '使用目标默认环境'), environments.map((item) => React.createElement('option', { key: item.id, value: item.id }, `${item.name}${item.production ? '（生产）' : ''}`)))),
            React.createElement('label', null, '默认 API Kit（可多选）', React.createElement('select', { multiple: true, value: kitIds, onChange: (event) => setKitIds([...event.target.selectedOptions].map((option) => option.value)) }, kits.map((item) => React.createElement('option', { key: item.id, value: item.id }, item.name)))),
            React.createElement('label', null, '默认 Auth Profile（仅绑定已有配置；无认证可留空）', React.createElement('select', { value: authProfileId, onChange: (event) => setAuthProfileId(event.target.value) }, React.createElement('option', { value: '' }, '不指定'), authProfiles.map((item) => React.createElement('option', { key: item.id, value: item.id }, `${item.name}（${item.type}）`)))),
            React.createElement('div', { className: 'dsh-api-kit-status', role: 'status', 'aria-live': 'polite' }, `本次将导入 ${selectedOperations.length} 个可导入操作；写操作仍保持 Agent 不可调用。`),
            (preview.operations || []).filter((item) => item.status === 'conflict').slice(0, 50).map((item) => React.createElement('div', { key: item.sourceKey, className: 'dsh-api-kit-field' }, React.createElement('label', { htmlFor: 'dsh-api-kit-conflict-' + item.sourceKey }, `冲突：${item.operationId}（${item.method} ${item.path}）`), React.createElement('select', { id: 'dsh-api-kit-conflict-' + item.sourceKey, value: conflicts[item.sourceKey] || 'keep-local', onChange: (event) => setConflicts((current) => ({ ...current, [item.sourceKey]: event.target.value })) }, React.createElement('option', { value: 'keep-local' }, '保留本地'), React.createElement('option', { value: 'overwrite' }, '覆盖导入'), React.createElement('option', { value: 'skip' }, '跳过')))),
            result && React.createElement('div', { className: 'dsh-api-kit-warn', role: 'status', 'aria-live': 'polite' }, `导入完成：新增 ${result.applied?.created || 0}、更新 ${result.applied?.updated || 0}、跳过 ${result.applied?.skipped || 0}、保留 ${result.applied?.kept || 0}`),
            React.createElement('div', null, button(busy ? '确认中…' : '确认并原子导入', confirm, 'primary', busy || selectedOperations.length === 0, { busy })),
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
        const [notice, setNotice] = React.useState(null)
        const mountedRef = React.useRef(true)
        const requestRef = React.useRef(0)
        React.useEffect(() => () => { mountedRef.current = false; requestRef.current += 1 }, [])

        const refresh = React.useCallback(async () => {
          const requestId = ++requestRef.current
          setBusy(true); setError(null)
          const names = ['kits', 'operations', 'targets']
          const loaders = [() => call('listKits'), () => call('listOperations'), () => call('listServiceTargets')]
          const values = await Promise.all(loaders.map(async (loader, index) => {
            try { return { name: names[index], value: await loader() } } catch (cause) { return { name: names[index], error: errorText(cause) } }
          }))
          if (!mountedRef.current || requestId !== requestRef.current) return
          const failures = values.filter((item) => item.error)
          if (failures.length > 0) setError(`部分数据加载失败：${failures.map((item) => `${item.name}（${item.error}）`).join('、')}。请重试。`)
          for (const item of values) {
            if (item.error) continue
            if (item.name === 'kits') setKits(item.value || [])
            else if (item.name === 'operations') setOperations(item.value || [])
            else if (item.name === 'targets') setTargets(item.value || [])
          }
          const nextKits = values.find((item) => item.name === 'kits' && !item.error)?.value || []
          setSelectedKit((current) => current && nextKits.some((kit) => kit.id === current) ? current : (nextKits[0]?.id || null))
          setBusy(false)
        }, [])
        React.useEffect(() => { void refresh() }, [refresh])
        React.useEffect(() => {
          window.addEventListener(CONFIG_EVENT, refresh)
          return () => window.removeEventListener(CONFIG_EVENT, refresh)
        }, [refresh])

        const activeKit = kits.find((kit) => kit.id === selectedKit)
        const kitOperations = activeKit ? operations.filter((operation) => activeKit.operationIds.includes(operation.id)) : []
        const patchForm = (key, value) => setForm((current) => ({ ...current, [key]: value, errors: current.errors ? { ...current.errors, [key]: null } : current.errors }))
        const createKit = async () => {
          if (busy) return
          const name = kitName.trim()
          const id = name.toLowerCase().replace(/[^a-z0-9._:-]+/g, '-')
          if (!id) { setError('请输入 API Kit 名称。'); return }
          try { setBusy(true); setError(null); await call('createKit', { input: { id, name, operationIds: [] } }); setKitName(''); setNotice('API Kit 已创建。'); notifyConfigChanged(); await refresh(); setSelectedKit(id) } catch (cause) { setError(errorText(cause)) } finally { if (mountedRef.current) setBusy(false) }
        }
        const newOperation = () => setForm({ id: '', operationId: '', name: '', method: 'GET', path: '/', serviceTargetId: targets[0]?.id || '', summary: '', description: '', tags: '', enabled: true, kitIds: selectedKit ? [selectedKit] : [], parameters: '[]', requestBody: '', responses: '{}', errors: {}, policy: { allowAgentCall: true, allowWrite: false, requiresConfirmation: false } })
        const editOperation = async (id) => {
          try {
            const item = await call('getOperation', { id })
            setEditingOperation(id)
            setForm({ ...item, tags: (item.tags || []).join(', '), kitIds: item.kitIds || [], parameters: JSON.stringify(item.parameters || [], null, 2), requestBody: item.requestBody ? JSON.stringify(item.requestBody, null, 2) : '', responses: JSON.stringify(item.responses || {}, null, 2), errors: {}, policy: { allowAgentCall: item.policy?.allowAgentCall === true, allowWrite: item.policy?.allowWrite === true, requiresConfirmation: item.policy?.requiresConfirmation === true } })
          } catch (cause) { setError(errorText(cause)) }
        }
        const saveOperation = async () => {
          const parsedParameters = parseJsonValue(form.parameters, 'Parameters', [])
          const parsedBody = parseJsonValue(form.requestBody, 'Request Body', null)
          const parsedResponses = parseJsonValue(form.responses, 'Responses', {})
          const formErrors = { parameters: parsedParameters.ok ? null : parsedParameters.error, requestBody: parsedBody.ok ? null : parsedBody.error, responses: parsedResponses.ok ? null : parsedResponses.error }
          if (Object.values(formErrors).some(Boolean)) { setForm((current) => ({ ...current, errors: formErrors })); setError('请先修正表单中的 JSON 错误。'); return }
          const input = { id: form.id, operationId: form.operationId || form.id, name: form.name, method: form.method, path: form.path, serviceTargetId: form.serviceTargetId, summary: form.summary, description: form.description, tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean), enabled: form.enabled, kitIds: form.kitIds, parameters: parsedParameters.value, requestBody: parsedBody.value, responses: parsedResponses.value, policy: form.policy }
          try { setBusy(true); if (editingOperation) await call('updateOperation', { id: editingOperation, patch: input }); else await call('createOperation', { input }); setForm(null); setEditingOperation(null); setNotice(editingOperation ? 'Operation 已更新。' : 'Operation 已创建。'); notifyConfigChanged(); await refresh() } catch (cause) { setError(errorText(cause)) } finally { if (mountedRef.current) setBusy(false) }
        }
        const removeKit = async () => {
          if (busy || !activeKit || !window.confirm('确认删除此套件？不会删除 Operation。')) return
          try { setBusy(true); setError(null); await call('deleteKit', { id: activeKit.id }); setNotice('API Kit 已删除。'); notifyConfigChanged(); await refresh() } catch (cause) { setError(errorText(cause)) } finally { if (mountedRef.current) setBusy(false) }
        }
        const removeOperation = async (id) => {
          if (busy || !window.confirm('确认删除此 Operation？')) return
          try { setBusy(true); setError(null); await call('deleteOperation', { id }); setNotice('Operation 已删除。'); notifyConfigChanged(); await refresh() } catch (cause) { setError(errorText(cause)) } finally { if (mountedRef.current) setBusy(false) }
        }
        const toggleOperation = async (operation) => {
          if (busy) return
          try { setBusy(true); setError(null); await call('setOperationEnabled', { id: operation.id, enabled: !operation.enabled }); setNotice(operation.enabled ? 'Operation 已禁用。' : 'Operation 已启用。'); notifyConfigChanged(); await refresh() } catch (cause) { setError(errorText(cause)) } finally { if (mountedRef.current) setBusy(false) }
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
          textField('Tag（逗号分隔）', form.tags, (value) => patchForm('tags', value)), textField('摘要', form.summary, (value) => patchForm('summary', value)), textField('描述', form.description, (value) => patchForm('description', value), true), textField('Parameters JSON', form.parameters, (value) => patchForm('parameters', value), true, { id: 'dsh-api-kit-parameters', error: form.errors?.parameters }), textField('Request Body JSON', form.requestBody, (value) => patchForm('requestBody', value), true, { id: 'dsh-api-kit-request-body', error: form.errors?.requestBody }), textField('Responses JSON', form.responses, (value) => patchForm('responses', value), true, { id: 'dsh-api-kit-responses', error: form.errors?.responses }),
          React.createElement('label', { className: 'dsh-api-kit-check' }, React.createElement('input', { type: 'checkbox', checked: form.enabled, onChange: (event) => patchForm('enabled', event.target.checked) }), '启用'),
          React.createElement('label', { className: 'dsh-api-kit-check' }, React.createElement('input', { type: 'checkbox', checked: form.policy.allowAgentCall, onChange: (event) => patchForm('policy', { ...form.policy, allowAgentCall: event.target.checked }) }), '允许 Agent 调用'),
          React.createElement('label', { className: 'dsh-api-kit-check' }, React.createElement('input', { type: 'checkbox', checked: form.policy.allowWrite, onChange: (event) => patchForm('policy', { ...form.policy, allowWrite: event.target.checked }) }), '允许写操作（后续执行器仍会再次校验）'),
          React.createElement('label', { className: 'dsh-api-kit-check' }, React.createElement('input', { type: 'checkbox', checked: form.policy.requiresConfirmation, onChange: (event) => patchForm('policy', { ...form.policy, requiresConfirmation: event.target.checked }) }), '调用前需要确认'),
          React.createElement('div', null, button('取消', () => { setForm(null); setEditingOperation(null) }), ' ', button(busy ? '保存中…' : '保存', saveOperation, 'primary', busy, { busy })),
        ))

        return React.createElement('section', { className: 'dsh-api-kit-settings', 'aria-labelledby': 'dsh-api-kit-settings-title' }, React.createElement('h2', { id: 'dsh-api-kit-settings-title', style: { margin: 0 } }, 'API 套件'), React.createElement('p', { className: 'dsh-api-kit-muted' }, '手工维护 API Operation 与套件关联。凭据和网络请求始终留在 Host。'), error && React.createElement('div', { className: 'dsh-api-kit-invalid', role: 'alert' }, error), notice && React.createElement('div', { className: 'dsh-api-kit-warn', role: 'status', 'aria-live': 'polite' }, notice), React.createElement(OpenApiImportPanel), React.createElement('div', { className: 'dsh-api-kit-toolbar' }, React.createElement('div', { style: { display: 'flex', gap: 8, alignItems: 'end' } }, textField('新套件名称', kitName, setKitName), button(busy ? '创建中…' : '创建套件', createKit, 'primary', busy, { busy })), button(busy ? '加载中…' : '刷新', refresh, '', busy, { busy })), React.createElement('div', { className: 'dsh-api-kit-grid' }, React.createElement('div', null, kitCards), React.createElement('div', null, activeKit && React.createElement('div', { className: 'dsh-api-kit-card' }, React.createElement('div', { className: 'dsh-api-kit-row' }, React.createElement('div', null, React.createElement('strong', null, activeKit.name), React.createElement('div', { className: 'dsh-api-kit-muted' }, activeKit.description || '未填写描述')), React.createElement('div', null, button('新增 Operation', newOperation, 'primary'), ' ', button('删除套件', removeKit, 'danger')))), operationCards, editor)))
      }

      slots.inject('conversation.input.left', () => slots.register({ name: 'conversation.input.left', id: 'dsh-api-kit', order: 93, label: 'API 套件' }, (props) => React.createElement(ApiKitControl, props)))
      slots.inject('settings.section', () => slots.register({ name: 'settings.section', id: 'api-kit', order: 30, label: 'API 套件' }, (props) => React.createElement(Settings, props)))
    }

    return { inject: ['remote', 'slots'], apply }
  },
})
