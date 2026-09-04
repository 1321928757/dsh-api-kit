/**
 * dsh-api-kit browser bundle entry for T06 and T12.
 *
 * The Client owns presentation only. Kit activation is keyed by the sessionId
 * supplied by the session-scoped input slot; the Host remains the authority for
 * validation, safe views, and all persisted API configuration.
 */

window.__ModuleLoader__.load({
  // CRUD workbench build: 2026-09-03T16:34Z
  id: 'dsh-api-kit',
  factory: (require) => {
    const React = require('react')
    const RPC_METHODS = [
      'listKits', 'getKit', 'createKit', 'updateKit', 'deleteKit',
      'addOperationsToKit', 'removeOperationsFromKit', 'listOperations', 'getOperation',
      'createOperation', 'updateOperation', 'deleteOperation', 'setOperationEnabled',
      'listServiceTargets', 'getServiceTarget', 'createServiceTarget', 'updateServiceTarget', 'deleteServiceTarget', 'listEnvironments', 'getEnvironment', 'createEnvironment', 'updateEnvironment', 'deleteEnvironment',
      'listAuthProfiles', 'getAuthProfile', 'getSessionActivation', 'setSessionActivation', 'clearSessionActivation', 'previewOpenApiImport', 'confirmOpenApiImport',
    ]
    const HTTP_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
    const CONFIG_EVENT = 'dsh-api-kit:config-changed'
    const SETTINGS_LIST_INITIAL_LIMIT = 6
    const SETTINGS_GROUP_DEFAULTS = { import: true, connection: false, workbench: false }
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
      listServiceTargets: ['args'], getServiceTarget: ['id'], createServiceTarget: ['input'], updateServiceTarget: ['id', 'patch'], deleteServiceTarget: ['id'], listEnvironments: ['args'], getEnvironment: ['id'], createEnvironment: ['input'], updateEnvironment: ['id', 'patch'], deleteEnvironment: ['id'], listAuthProfiles: ['args'], getAuthProfile: ['id'],
      getSessionActivation: ['args'], setSessionActivation: ['args'], clearSessionActivation: ['args'], previewOpenApiImport: ['args'], confirmOpenApiImport: ['args'],
    }
    const CONTRIBUTION = { package: 'dsh-api-kit', descriptors: RPC_METHODS.map((name) => descriptor(name, descriptorSpec[name])) }
    const styles = `
      .dsh-api-kit-settings{container-type:inline-size;box-sizing:border-box;width:100%;max-width:920px;min-width:0;min-height:0;padding:20px 24px;color:var(--dsw-alias-label-primary);overflow-x:hidden;font:inherit}
      .dsh-api-kit-settings *,.dsh-api-kit-picker *{box-sizing:border-box}
      .dsh-api-kit-picker-button{height:auto;min-height:44px;max-width:260px;padding:8px 10px;border-radius:8px;border-color:var(--dsw-alias-border-l2,var(--dsw-alias-border-l1));background:var(--dsw-alias-bg-input,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.25;white-space:normal;overflow:hidden;text-overflow:ellipsis}.dsh-api-kit-picker-button:hover:not(:disabled){border-color:transparent;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
      .dsh-api-kit-settings>h2{margin:0;font-size:21px;line-height:1.3;font-weight:650}.dsh-api-kit-settings>p{max-width:72ch;margin:6px 0 0}
      .dsh-api-kit-settings>section,.dsh-api-kit-settings>.dsh-api-kit-card,.dsh-api-kit-settings>.dsh-api-kit-status-summary{margin-top:16px}
      .dsh-api-kit-card{min-width:0;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);padding:16px}
      .dsh-api-kit-section-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;min-width:0}.dsh-api-kit-section-header>div{min-width:0}.dsh-api-kit-section-header h3{margin:0;font-size:16px;line-height:1.35;font-weight:650}.dsh-api-kit-section-header p{margin:4px 0 0}.dsh-api-kit-section-header-actions{display:flex;align-items:center;gap:8px;flex:0 0 auto}
      .dsh-api-kit-scope-guide{display:grid;gap:12px;margin-top:16px;padding:14px 16px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1)}.dsh-api-kit-scope-guide h3{margin:0;font-size:15px;line-height:1.35}.dsh-api-kit-scope-guide p{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.5}.dsh-api-kit-scope-flow{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;min-width:0}.dsh-api-kit-scope-step{display:grid;gap:3px;min-width:0;padding:10px;border:1px solid var(--dsw-api-kit-scope-border,var(--dsw-alias-border-l1));border-radius:8px;background:var(--dsw-alias-bg-layer-2)}.dsh-api-kit-scope-step strong{font-size:13px;line-height:1.35;overflow-wrap:anywhere}.dsh-api-kit-scope-step span{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.45;overflow-wrap:anywhere}.dsh-api-kit-scope-arrow{display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary);font-size:14px}.dsh-api-kit-scope-example{padding-top:10px;border-top:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.5;overflow-wrap:anywhere}.dsh-api-kit-status-summary{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}.dsh-api-kit-summary-item{display:grid;gap:2px;min-width:0;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2)}.dsh-api-kit-summary-value{display:block;font-size:17px;line-height:1.25;font-variant-numeric:tabular-nums}.dsh-api-kit-summary-label{display:block;margin-top:2px;color:var(--dsw-alias-label-primary);font-size:12px;line-height:1.4;overflow-wrap:anywhere}.dsh-api-kit-summary-help{display:block;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.4;overflow-wrap:anywhere}.dsh-api-kit-summary-item.is-warn .dsh-api-kit-summary-value{color:var(--dsw-alias-state-warn-primary)}
      .dsh-api-kit-toolbar{display:flex;gap:12px;align-items:end;justify-content:space-between;flex-wrap:wrap;min-width:0}.dsh-api-kit-toolbar>*,.dsh-api-kit-row>*,.dsh-api-kit-popover-header>*,.dsh-api-kit-popover-footer>*{min-width:0}.dsh-api-kit-create-row{display:flex;align-items:flex-end;gap:8px;min-width:0;flex:1 1 420px}.dsh-api-kit-create-row>.dsh-api-kit-field{flex:1 1 220px;min-width:160px}.dsh-api-kit-create-row>.dsh-api-kit-button{flex:0 0 auto}
      .dsh-api-kit-workbench{display:grid;grid-template-columns:minmax(210px,280px) minmax(0,1fr);gap:16px;min-width:0}.dsh-api-kit-pane{min-width:0;min-height:0}.dsh-api-kit-pane-header{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0;padding-bottom:10px;border-bottom:1px solid var(--dsw-alias-border-l1)}.dsh-api-kit-pane-header h4{margin:0;font-size:14px;line-height:1.4}.dsh-api-kit-pane-header>span{color:var(--dsw-alias-label-secondary);font-size:12px;font-variant-numeric:tabular-nums}.dsh-api-kit-kit-list{display:grid;gap:8px;margin-top:10px}.dsh-api-kit-kit-card{appearance:none;width:100%;min-width:0;padding:11px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer;transition:border-color .18s ease,background-color .18s ease}.dsh-api-kit-kit-card:hover{background:var(--dsw-alias-interactive-bg-hover)}.dsh-api-kit-kit-card.is-selected{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-api-kit-selected-bg,var(--dsw-alias-bg-layer-2))}.dsh-api-kit-kit-card:focus-visible,.dsh-api-kit-button:focus-visible,.dsh-api-kit-form input:focus-visible,.dsh-api-kit-form select:focus-visible,.dsh-api-kit-form textarea:focus-visible,.dsh-api-kit-field input:focus-visible,.dsh-api-kit-field select:focus-visible,.dsh-api-kit-field textarea:focus-visible,.dsh-api-kit-choice-action:focus-visible,.dsh-api-kit-import-step-button:focus-visible,.dsh-api-kit-operation-group>summary:focus-visible,.dsh-api-kit-endpoint-advanced>summary:focus-visible,.dsh-api-kit-check input:focus-visible,.dsh-api-kit-import-mode input:focus-visible{outline:2px solid var(--dsw-api-kit-focus,var(--dsw-alias-brand-primary));outline-offset:2px}.dsh-api-kit-kit-card-title{display:block;font-size:13px;font-weight:600;overflow-wrap:anywhere}.dsh-api-kit-kit-card-meta{display:block;margin-top:4px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.4;overflow-wrap:anywhere}
      .dsh-api-kit-detail{display:grid;gap:12px;min-width:0}.dsh-api-kit-detail-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;min-width:0}.dsh-api-kit-detail-header>div:first-child{min-width:0}.dsh-api-kit-detail-title{margin:0;font-size:17px;line-height:1.35}.dsh-api-kit-code{font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Consolas,monospace);font-size:12px;overflow-wrap:anywhere}.dsh-api-kit-detail-meta{display:flex;flex-wrap:wrap;gap:6px 10px;margin-top:6px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.45}.dsh-api-kit-detail-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px;flex:0 0 auto}.dsh-api-kit-operation-section{min-width:0;padding-top:12px;border-top:1px solid var(--dsw-alias-border-l1)}.dsh-api-kit-operation-section h4{margin:0;font-size:14px}.dsh-api-kit-operation-list{display:grid;gap:0;margin-top:10px;min-width:0}.dsh-api-kit-operation-list>.dsh-api-kit-operation-card:hover,.dsh-api-kit-connection-list>.dsh-api-kit-connection-item:hover{background:var(--dsw-alias-interactive-bg-hover)}.dsh-api-kit-operation-card{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;min-width:0;padding:8px 10px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}.dsh-api-kit-operation-card>.dsh-api-kit-row{display:contents}.dsh-api-kit-operation-list>.dsh-api-kit-operation-card:first-child{border-top:1px solid var(--dsw-alias-border-l1);border-radius:8px 8px 0 0}.dsh-api-kit-operation-list>.dsh-api-kit-operation-card:last-child{border-radius:0 0 8px 8px}.dsh-api-kit-operation-main{display:grid;gap:3px;min-width:0}.dsh-api-kit-operation-name{font-size:13px;font-weight:600;overflow-wrap:anywhere}.dsh-api-kit-operation-id{color:var(--dsw-alias-label-secondary);font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Consolas,monospace);font-size:11px;overflow-wrap:anywhere}.dsh-api-kit-operation-path{color:var(--dsw-alias-label-primary);font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Consolas,monospace);font-size:12px;overflow-wrap:anywhere}.dsh-api-kit-operation-meta{display:flex;flex-wrap:wrap;gap:4px 8px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.4}.dsh-api-kit-operation-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px;flex:0 0 auto}.dsh-api-kit-list-reveal{display:flex;justify-content:center;padding:8px 0}.dsh-api-kit-list-reveal .dsh-api-kit-button{min-height:36px}.dsh-api-kit-settings-group{display:grid;gap:12px;margin-top:16px;min-width:0;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}.dsh-api-kit-settings-group-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0;padding:14px 16px;color:var(--dsw-alias-label-primary);cursor:pointer;list-style:none}.dsh-api-kit-settings-group-summary::-webkit-details-marker{display:none}.dsh-api-kit-settings-group-summary::before{content:'›';flex:0 0 auto;color:var(--dsw-alias-label-tertiary);font-size:18px;line-height:1;transform:rotate(0deg);transition:transform .18s ease}.dsh-api-kit-settings-group[open]>.dsh-api-kit-settings-group-summary::before{transform:rotate(90deg)}.dsh-api-kit-settings-group-summary:focus-visible{outline:2px solid var(--dsw-api-kit-focus,var(--dsw-alias-brand-primary));outline-offset:-2px}.dsh-api-kit-settings-group-title{min-width:0;font-size:15px;font-weight:650}.dsh-api-kit-settings-group-meta{min-width:0;margin-left:auto;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.4;text-align:right;overflow-wrap:anywhere}.dsh-api-kit-settings-group-content{display:grid;gap:0;min-width:0;padding:0 12px 12px}.dsh-api-kit-settings-group-content>.dsh-api-kit-card{margin-top:0}.dsh-api-kit-settings-group-content>.dsh-api-kit-card+.dsh-api-kit-card{margin-top:12px}.dsh-api-kit-delete-confirmation{width:min(520px,calc(100vw - 32px));max-height:min(680px,calc(100dvh - 32px));overflow:auto}.dsh-api-kit-delete-impact{display:grid;gap:6px;margin:12px 0;padding:12px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.5}.dsh-api-kit-delete-impact strong{color:var(--dsw-alias-label-primary)}.dsh-api-kit-delete-impact p{margin:0;overflow-wrap:anywhere}.dsh-api-kit-delete-draft-warning{color:var(--dsw-alias-state-warn-primary);font-weight:600}.dsh-api-kit-delete-confirmation .dsh-api-kit-field{margin-top:12px}.dsh-api-kit-delete-confirmation .dsh-api-kit-import-review-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
      .dsh-api-kit-method{display:inline-flex;align-items:center;justify-content:center;min-width:42px;padding:2px 6px;border:1px solid var(--dsw-alias-border-l1);border-radius:5px;color:var(--dsw-alias-brand-primary);font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Consolas,monospace);font-size:11px;font-weight:650;line-height:1.35}.dsh-api-kit-state{display:inline-flex;align-items:center;min-height:20px;padding:2px 6px;border-radius:5px;background:var(--dsw-alias-bg-layer-1);font-size:11px}.dsh-api-kit-state.is-disabled{color:var(--dsw-alias-label-tertiary)}.dsh-api-kit-empty{display:grid;gap:8px;justify-items:start;padding:18px 12px;text-align:left}.dsh-api-kit-empty h4{margin:0;font-size:15px}.dsh-api-kit-empty p{margin:0;max-width:58ch;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.5}.dsh-api-kit-empty-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:2px}
      .dsh-api-kit-button{appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);padding:8px 12px;font:inherit;line-height:1.35;cursor:pointer;touch-action:manipulation;transition:border-color .18s ease,background-color .18s ease,color .18s ease,opacity .18s ease}.dsh-api-kit-settings .dsh-api-kit-button{min-height:44px;padding:7px 11px;font-size:13px!important;line-height:1.3;white-space:nowrap}.dsh-api-kit-button:hover:not(:disabled){border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-interactive-bg-hover)}.dsh-api-kit-button.primary{background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary));color:var(--dsw-alias-label-primary-foreground,var(--dsw-alias-label-primary));border-color:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary))}.dsh-api-kit-button.primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover,var(--dsw-alias-brand-primary));border-color:var(--dsw-alias-button-primary-hover,var(--dsw-alias-brand-primary))}.dsh-api-kit-button.secondary{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}.dsh-api-kit-button.danger{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-border-l1)}.dsh-api-kit-button.danger:hover:not(:disabled){background:var(--dsw-api-kit-danger-bg,var(--dsw-alias-interactive-bg-hover));border-color:var(--dsw-alias-state-error-primary)}.dsh-api-kit-button:disabled{cursor:not-allowed;opacity:.5}
      .dsh-api-kit-form{display:grid;gap:12px;min-width:0}.dsh-api-kit-form label,.dsh-api-kit-field{display:grid;gap:5px;min-width:0;font-size:13px}.dsh-api-kit-check,.dsh-api-kit-choice,.dsh-api-kit-selection,.dsh-api-kit-import-mode label{min-height:44px}.dsh-api-kit-settings .dsh-api-kit-form label,.dsh-api-kit-settings .dsh-api-kit-field>label{font-size:12px}.dsh-api-kit-field-help{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.45}.dsh-api-kit-form label>span,.dsh-api-kit-field>label{font-weight:500}.dsh-api-kit-control:not([type=checkbox]):not([type=radio]):not(.dsh-api-kit-control-textarea),.dsh-api-kit-settings .dsh-api-kit-field>input:not([type=checkbox]):not([type=radio]),.dsh-api-kit-settings .dsh-api-kit-field>select,.dsh-api-kit-form label>input:not([type=checkbox]):not([type=radio]),.dsh-api-kit-form label>select{box-sizing:border-box;width:100%;height:40px;min-height:40px;align-self:start;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px 10px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;line-height:1.4}.dsh-api-kit-control-textarea,.dsh-api-kit-settings .dsh-api-kit-field>textarea,.dsh-api-kit-form label>textarea{box-sizing:border-box;width:100%;height:auto;min-height:112px;align-self:start;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px 10px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;line-height:1.4;resize:vertical;font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Consolas,monospace);font-size:12px;line-height:1.5}.dsh-api-kit-control#dsh-api-kit-openapi-json,.dsh-api-kit-form textarea#dsh-api-kit-openapi-json{min-height:150px;max-height:180px;background:var(--dsw-alias-bg-input,var(--dsw-alias-bg-base))}.dsh-api-kit-control::placeholder,.dsh-api-kit-settings .dsh-api-kit-field>input::placeholder,.dsh-api-kit-settings .dsh-api-kit-field>textarea::placeholder,.dsh-api-kit-form label>input::placeholder,.dsh-api-kit-form label>textarea::placeholder{color:var(--dsw-alias-label-tertiary)}.dsh-api-kit-create-row>.dsh-api-kit-field{align-self:stretch}.dsh-api-kit-create-row>.dsh-api-kit-field>.dsh-api-kit-control{height:40px;min-height:40px}.dsh-api-kit-choice-search input{height:40px;min-height:40px;box-sizing:border-box}.dsh-api-kit-choice-select{display:grid;gap:8px;min-width:0;margin:0;padding:0;border:0}.dsh-api-kit-choice-select legend{padding:0;color:var(--dsw-alias-label-primary);font-weight:500}.dsh-api-kit-choice-help{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.45;overflow-wrap:anywhere}.dsh-api-kit-choice-toolbar{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}.dsh-api-kit-choice-count{min-width:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.4;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.dsh-api-kit-choice-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px;flex:0 0 auto}.dsh-api-kit-choice-action{appearance:none;min-height:32px;padding:5px 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:1.3;cursor:pointer}.dsh-api-kit-choice-action:hover:not(:disabled){border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.dsh-api-kit-choice-action:focus-visible,.dsh-api-kit-choice-select input:focus-visible{outline:2px solid var(--dsw-api-kit-focus,var(--dsw-alias-brand-primary));outline-offset:2px}.dsh-api-kit-choice-action:disabled{cursor:not-allowed;opacity:.5}.dsh-api-kit-choice-search{display:grid;gap:5px;min-width:0}.dsh-api-kit-choice-search label{font-size:12px;font-weight:500}.dsh-api-kit-choice-search input{width:100%;min-height:40px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px 10px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit}.dsh-api-kit-choice-list{display:grid;gap:6px;min-width:0;max-height:260px;overflow:auto;padding:1px}.dsh-api-kit-choice{display:flex;align-items:flex-start;gap:9px;min-width:0;min-height:44px;padding:8px 9px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);cursor:pointer}.dsh-api-kit-form .dsh-api-kit-choice{display:flex!important}.dsh-api-kit-choice:hover{background:var(--dsw-alias-interactive-bg-hover)}.dsh-api-kit-choice.is-checked{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-api-kit-selected-bg,var(--dsw-alias-bg-layer-2))}.dsh-api-kit-choice.is-disabled{cursor:not-allowed;opacity:.62}.dsh-api-kit-choice.is-unknown{border-style:dashed}.dsh-api-kit-choice>input{flex:0 0 auto;width:20px;height:20px;margin:2px 0 0;accent-color:var(--dsw-alias-brand-primary)}.dsh-api-kit-choice-main{display:grid;gap:2px;min-width:0}.dsh-api-kit-choice-title{color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.35;overflow-wrap:anywhere}.dsh-api-kit-choice-meta{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.4;overflow-wrap:anywhere}.dsh-api-kit-choice-empty{padding:8px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.45}.dsh-api-kit-check{display:flex!important;align-items:center;gap:8px;min-height:44px}.dsh-api-kit-check input{width:20px;height:20px}.dsh-api-kit-field-error{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:1.45}.dsh-api-kit-field-help{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.45}.dsh-api-kit-invalid,.dsh-api-kit-warn,.dsh-api-kit-success{padding:9px;border-radius:8px;font-size:12px;line-height:1.5;overflow-wrap:anywhere}.dsh-api-kit-invalid{color:var(--dsw-alias-state-error-primary);background:var(--dsw-api-kit-error-bg,var(--dsw-alias-bg-layer-2))}.dsh-api-kit-warn{color:var(--dsw-alias-state-warn-primary);background:var(--dsw-api-kit-warn-bg,var(--dsw-alias-bg-layer-2))}.dsh-api-kit-success{color:var(--dsw-alias-state-success-primary);background:var(--dsw-api-kit-success-bg,var(--dsw-alias-bg-layer-2))}.dsh-api-kit-status{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.5;overflow-wrap:anywhere}.dsh-api-kit-button-row{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}.dsh-api-kit-import-card{display:grid;gap:16px;padding:16px}.dsh-api-kit-import-steps{margin-top:12px;padding:0 0 4px;border-bottom:1px solid var(--dsw-alias-border-l1)}.dsh-api-kit-import-steps ol{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0;padding:0;list-style:none}.dsh-api-kit-import-steps li{display:grid;gap:3px;min-width:0;padding:8px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2)}.dsh-api-kit-import-steps li.is-current{border-color:var(--dsw-alias-brand-primary)}.dsh-api-kit-import-steps li>span{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.35}.dsh-api-kit-import-step-button{min-height:44px;padding:4px 0;border:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;font-weight:600;text-align:left;cursor:pointer}.dsh-api-kit-import-step-button:hover:not(:disabled){color:var(--dsw-alias-brand-primary)}.dsh-api-kit-import-step-button:focus-visible{outline:2px solid var(--dsw-api-kit-focus,var(--dsw-alias-brand-primary));outline-offset:2px;border-radius:4px}.dsh-api-kit-import-step-button:disabled{cursor:not-allowed;color:var(--dsw-alias-label-tertiary)}.dsh-api-kit-import-step{display:grid;gap:10px;min-width:0}.dsh-api-kit-import-step-header{display:flex;align-items:flex-start;gap:10px;min-width:0}.dsh-api-kit-step-number{display:inline-flex;align-items:center;justify-content:center;flex:0 0 24px;width:24px;height:24px;border-radius:50%;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-brand-primary);font-size:12px;font-weight:650}.dsh-api-kit-import-step-header h4{margin:1px 0 0;font-size:14px;line-height:1.35}.dsh-api-kit-import-step-header p{margin:3px 0 0}.dsh-api-kit-import-step-body{display:grid;gap:10px;min-width:0}.dsh-api-kit-import-heading{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:12px;min-width:0}.dsh-api-kit-import-heading>.dsh-api-kit-import-steps{grid-column:1 / -1;width:100%;min-width:0}.dsh-api-kit-import-heading>.dsh-api-kit-button{align-self:start}.dsh-api-kit-import-heading>div:first-child{min-width:0}.dsh-api-kit-import-heading h3{margin:0;font-size:16px;line-height:1.35}.dsh-api-kit-import-heading .dsh-api-kit-helper{max-width:62ch}.dsh-api-kit-import-footer{display:flex;justify-content:flex-end}.dsh-api-kit-import-config-footer,.dsh-api-kit-import-review-actions{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.dsh-api-kit-import-review{display:grid;gap:12px;padding-top:14px;border-top:1px solid var(--dsw-alias-border-l1)}.dsh-api-kit-import-review h4{margin:0;font-size:14px}.dsh-api-kit-import-review p{margin:3px 0 0}.dsh-api-kit-import-review-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.dsh-api-kit-import-review-grid>div{display:grid;gap:3px;min-width:0;padding:9px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2)}.dsh-api-kit-import-review-grid strong{color:var(--dsw-alias-label-secondary);font-size:11px}.dsh-api-kit-import-review-grid span{overflow-wrap:anywhere;font-size:12px;line-height:1.45}.dsh-api-kit-import-conflict-tools{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;padding:8px 0;border-top:1px solid var(--dsw-alias-border-l1)}.dsh-api-kit-import-conflict-tools>span{color:var(--dsw-alias-label-secondary);font-size:12px}.dsh-api-kit-import-confirmation-backdrop{position:fixed;inset:0;z-index:30;display:grid;place-items:center;padding:20px;background:var(--dsw-api-kit-overlay-bg,rgba(0,0,0,.42))}.dsh-api-kit-import-confirmation{display:grid;gap:12px;width:min(520px,100%);max-height:calc(100dvh - 40px);overflow:auto;padding:20px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-1));box-shadow:var(--dsw-shadow-lv3)}.dsh-api-kit-import-confirmation h4{margin:0;font-size:16px}.dsh-api-kit-import-confirmation p{margin:0;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.5}.dsh-api-kit-import-confirmation .dsh-api-kit-import-review-actions{justify-content:flex-end}.dsh-api-kit-import-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:12px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2)}.dsh-api-kit-import-options .dsh-api-kit-field{min-width:0}.dsh-api-kit-preview{display:grid;gap:12px;padding-top:14px;border-top:1px solid var(--dsw-alias-border-l1)}.dsh-api-kit-preview-summary{display:grid;gap:10px;padding:12px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2)}.dsh-api-kit-preview-summary-header{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;min-width:0}.dsh-api-kit-preview-summary-header>div{min-width:0}.dsh-api-kit-preview-summary h4{margin:0;font-size:14px}.dsh-api-kit-preview-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.dsh-api-kit-preview-stat{min-width:0;padding:8px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;background:var(--dsw-alias-bg-layer-1)}.dsh-api-kit-preview-stat strong{display:block;font-size:16px;font-variant-numeric:tabular-nums}.dsh-api-kit-preview-stat span{display:block;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.35}.dsh-api-kit-preview-operations{display:grid;gap:4px;max-height:154px;overflow:auto}.dsh-api-kit-preview-operation{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:8px;min-width:0;padding:5px 0;border-bottom:1px solid var(--dsw-alias-border-l1)}.dsh-api-kit-preview-operation:last-child{border-bottom:0}.dsh-api-kit-preview-operation .dsh-api-kit-code{min-width:0}.dsh-api-kit-preview-operation-status{color:var(--dsw-alias-label-secondary);font-size:11px;white-space:nowrap}.dsh-api-kit-preview-server{padding:8px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.45}.dsh-api-kit-preview-server code{font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Consolas,monospace);overflow-wrap:anywhere;color:var(--dsw-alias-label-primary)}.dsh-api-kit-import-mode{display:flex;flex-wrap:wrap;gap:8px}.dsh-api-kit-import-mode label{display:flex;align-items:center;gap:7px;min-height:44px;padding:7px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-layer-1);cursor:pointer}.dsh-api-kit-import-mode label:has(input:checked){border-color:var(--dsw-alias-brand-primary);background:var(--dsw-api-kit-selected-bg,var(--dsw-alias-bg-layer-2))}.dsh-api-kit-import-mode input{width:18px;height:18px;min-height:18px}.dsh-api-kit-stale{color:var(--dsw-alias-state-warn-primary)}
      .dsh-api-kit-popover{position:absolute;z-index:20;left:0;bottom:calc(100% + 8px);width:min(360px,calc(100vw - 32px));max-height:min(520px,calc(100dvh - 32px));overflow:auto;overscroll-behavior:contain;padding:16px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-specific-menu,var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-1)));box-shadow:var(--dsw-shadow-lv3)}.dsh-api-kit-popover-header,.dsh-api-kit-popover-footer{display:flex;align-items:center;justify-content:space-between;gap:10px}.dsh-api-kit-popover-header{padding-bottom:2px}.dsh-api-kit-popover-footer{padding-top:12px;border-top:1px solid var(--dsw-alias-border-l1)}.dsh-api-kit-popover-header h3{margin:0;font-size:15px;line-height:1.35;font-weight:600}.dsh-api-kit-popover .dsh-api-kit-status{max-width:52ch;margin-top:4px}.dsh-api-kit-popover-section{display:grid;gap:8px;margin-top:16px}.dsh-api-kit-scope-summary{display:grid;gap:8px;margin-top:12px;padding:10px;border:1px solid var(--dsw-api-kit-scope-border,var(--dsw-alias-border-l1));border-radius:8px;background:var(--dsw-alias-bg-layer-2)}.dsh-api-kit-scope-summary h4{margin:0;color:var(--dsw-alias-label-primary);font-size:12px;line-height:1.4}.dsh-api-kit-scope-summary p{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.5}.dsh-api-kit-scope-summary-grid{display:grid;gap:6px;min-width:0}.dsh-api-kit-scope-summary-item{display:grid;grid-template-columns:minmax(78px,auto) minmax(0,1fr);gap:8px;min-width:0;font-size:12px;line-height:1.45}.dsh-api-kit-scope-summary-item strong{color:var(--dsw-api-kit-scope-label,var(--dsw-alias-label-secondary));font-weight:600}.dsh-api-kit-scope-summary-item span{min-width:0;overflow-wrap:anywhere}.dsh-api-kit-environment-diagnostic{display:grid;gap:4px;margin-top:8px;padding:8px;border-radius:7px;font-size:11px;line-height:1.45;overflow-wrap:anywhere}.dsh-api-kit-environment-diagnostic.is-error{color:var(--dsw-alias-state-error-primary);background:var(--dsw-api-kit-error-bg,var(--dsw-alias-bg-layer-2))}.dsh-api-kit-environment-diagnostic.is-warn{color:var(--dsw-alias-state-warn-primary);background:var(--dsw-api-kit-warn-bg,var(--dsw-alias-bg-layer-2))}.dsh-api-kit-environment-diagnostic strong{font-weight:650}.dsh-api-kit-selection-count{color:var(--dsw-api-kit-scope-label,var(--dsw-alias-label-secondary));font-weight:400}.dsh-api-kit-popover-section h3,.dsh-api-kit-popover-section legend{font-size:12px;font-weight:600;margin:0;color:var(--dsw-alias-label-secondary)}.dsh-api-kit-popover-section fieldset{border:0;padding:0;margin:0;display:grid;gap:8px}.dsh-api-kit-selection{display:flex;align-items:flex-start;gap:10px;padding:9px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;min-height:44px;background:var(--dsw-alias-bg-layer-1);transition:border-color .18s ease,background-color .18s ease}.dsh-api-kit-selection:hover{background:var(--dsw-alias-interactive-bg-hover)}.dsh-api-kit-selection.is-checked{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-api-kit-selected-bg,var(--dsw-alias-bg-layer-2))}.dsh-api-kit-selection input{width:20px;height:20px;margin-top:1px}.dsh-api-kit-selection-main{min-width:0;display:grid;gap:2px}.dsh-api-kit-selection-title{font-size:13px;overflow-wrap:anywhere}.dsh-api-kit-selection-meta{font-size:12px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}.dsh-api-kit-popover select{width:100%;min-height:44px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:9px 10px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit}.dsh-api-kit-spinner{display:inline-block;width:16px;height:16px;flex:0 0 auto;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:dsh-api-kit-spin .7s linear infinite}@keyframes dsh-api-kit-spin{to{transform:rotate(360deg)}}
      .dsh-api-kit-connection-stack{display:grid;gap:16px;margin-top:14px;min-width:0}.dsh-api-kit-connection-grid{display:grid;grid-template-columns:1fr;gap:16px;margin-top:14px}.dsh-api-kit-connection-card{display:grid;gap:10px;min-width:0;padding:12px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2)}.dsh-api-kit-connection-card h4{margin:0;font-size:14px;line-height:1.4}.dsh-api-kit-connection-card p{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.5}.dsh-api-kit-connection-group-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;min-width:0;padding-bottom:10px;border-bottom:1px solid var(--dsw-alias-border-l1)}.dsh-api-kit-connection-group-header>div{min-width:0}.dsh-api-kit-connection-group-header h4{margin:0;font-size:15px;line-height:1.4}.dsh-api-kit-connection-group-header p{margin:4px 0 0;max-width:68ch}.dsh-api-kit-connection-form{display:grid;gap:10px}.dsh-api-kit-connection-form .dsh-api-kit-field{min-width:0}.dsh-api-kit-connection-form .dsh-api-kit-button{justify-self:start}.dsh-api-kit-target-editor{padding-top:12px;border-top:1px solid var(--dsw-alias-border-l1)}.dsh-api-kit-connection-list{display:grid;gap:0;margin-top:12px;min-width:0}.dsh-api-kit-connection-item{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px 12px;min-width:0;padding:8px 10px;border-bottom:1px solid var(--dsw-api-kit-scope-border,var(--dsw-alias-border-l1));background:var(--dsw-alias-bg-layer-1)}.dsh-api-kit-connection-list>.dsh-api-kit-connection-item:first-child{border-top:1px solid var(--dsw-api-kit-scope-border,var(--dsw-alias-border-l1));border-radius:8px 8px 0 0}.dsh-api-kit-connection-list>.dsh-api-kit-connection-item:last-child{border-radius:0 0 8px 8px}.dsh-api-kit-connection-item>.dsh-api-kit-detail-actions{grid-column:2;grid-row:1 / span 3}.dsh-api-kit-connection-item:hover{background:var(--dsw-alias-interactive-bg-hover)}.dsh-api-kit-connection-item-title{font-size:13px;font-weight:600;overflow-wrap:anywhere}.dsh-api-kit-connection-item-meta{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.45;overflow-wrap:anywhere}.dsh-api-kit-connection-empty{padding:8px 0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5}.dsh-api-kit-connection-note{margin-top:12px;padding:10px;border-radius:8px;color:var(--dsw-alias-label-secondary);background:var(--dsw-api-kit-info-bg,var(--dsw-alias-bg-layer-2));font-size:12px;line-height:1.5;overflow-wrap:anywhere}.dsh-api-kit-endpoint-list{display:grid;gap:8px;margin-top:2px}.dsh-api-kit-endpoint{display:grid;gap:10px;min-width:0;margin:0;padding:0;border:0}.dsh-api-kit-endpoint-summary{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:10px;min-width:0;padding:10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1)}.dsh-api-kit-endpoint-summary>div{min-width:0}.dsh-api-kit-endpoint-summary h5{margin:0;font-size:13px;line-height:1.4}.dsh-api-kit-endpoint-summary p{margin:3px 0 0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.45;overflow-wrap:anywhere}.dsh-api-kit-endpoint-trigger{min-width:70px}.dsh-api-kit-endpoint-panel{display:grid;gap:10px;min-width:0;margin:0 8px;padding:12px;border:1px solid var(--dsw-alias-border-l1);border-top:0;border-radius:0 0 8px 8px;background:var(--dsw-alias-bg-layer-2)}.dsh-api-kit-endpoint-panel[hidden]{display:none}.dsh-api-kit-endpoint-url{min-width:0;overflow-wrap:anywhere;word-break:break-word}.dsh-api-kit-endpoint-advanced{display:grid;gap:10px;min-width:0;margin:2px 0 0;padding:10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1)}.dsh-api-kit-endpoint-advanced summary{cursor:pointer;color:var(--dsw-alias-label-primary);font-size:12px;font-weight:600}.dsh-api-kit-endpoint-advanced[open]{background:var(--dsw-alias-bg-layer-2)}.dsh-api-kit-endpoint-advanced-content{display:grid;gap:10px;min-width:0}.dsh-api-kit-operation-editor{position:relative}.dsh-api-kit-operation-group{display:grid;gap:10px;min-width:0;margin-top:10px;padding:10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1)}.dsh-api-kit-operation-group summary{cursor:pointer;min-height:28px;color:var(--dsw-alias-label-primary);font-size:13px;font-weight:650}.dsh-api-kit-operation-group[open] summary{padding-bottom:6px;border-bottom:1px solid var(--dsw-alias-border-l1)}.dsh-api-kit-operation-write-risk{padding:9px;border-radius:8px;color:var(--dsw-alias-state-warn-primary);background:var(--dsw-api-kit-info-bg,var(--dsw-alias-bg-layer-2));font-size:12px;line-height:1.5;overflow-wrap:anywhere}.dsh-api-kit-operation-dirty{margin-top:10px;color:var(--dsw-alias-state-warn-primary);font-size:12px;line-height:1.4}.dsh-api-kit-operation-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;margin-top:8px;padding-top:10px;border-top:1px solid var(--dsw-alias-border-l1)}.dsh-api-kit-operation-confirmation{width:min(520px,calc(100% - 24px));max-height:calc(100dvh - 32px);overflow:auto;padding:18px;border:1px solid var(--dsw-alias-border-l2,var(--dsw-alias-border-l1));border-radius:12px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);box-shadow:0 18px 50px var(--dsw-api-kit-shadow,rgba(0,0,0,.2))}.dsh-api-kit-operation-confirmation h4{margin:0;font-size:16px}.dsh-api-kit-operation-confirmation p{margin:8px 0;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.5;overflow-wrap:anywhere}.dsh-api-kit-endpoint-warning{padding:8px;border-radius:7px;color:var(--dsw-alias-state-warn-primary);background:var(--dsw-api-kit-info-bg,var(--dsw-alias-bg-layer-1));font-size:12px;line-height:1.45;overflow-wrap:anywhere}.dsh-api-kit-endpoint-missing{color:var(--dsw-alias-state-error-primary)}.dsh-api-kit-auth-note{margin-top:2px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.45;overflow-wrap:anywhere}
      @supports (background:color-mix(in srgb,black,white)){.dsh-api-kit-kit-card.is-selected,.dsh-api-kit-import-mode label:has(input:checked){background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,var(--dsw-alias-bg-layer-1))}.dsh-api-kit-invalid{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,var(--dsw-alias-bg-layer-1))}.dsh-api-kit-warn{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 12%,var(--dsw-alias-bg-layer-1))}.dsh-api-kit-success{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 10%,var(--dsw-alias-bg-layer-1))}}
      @container (max-width:720px){.dsh-api-kit-import-heading{grid-template-columns:1fr}.dsh-api-kit-import-heading>.dsh-api-kit-import-steps{grid-column:1}.dsh-api-kit-import-heading>.dsh-api-kit-import-steps ol{grid-template-columns:repeat(3,minmax(0,1fr))}.dsh-api-kit-import-heading>.dsh-api-kit-button{width:100%;min-height:44px}.dsh-api-kit-workbench{grid-template-columns:1fr}.dsh-api-kit-import-options{grid-template-columns:1fr}.dsh-api-kit-preview-stats{grid-template-columns:repeat(3,minmax(0,1fr))}.dsh-api-kit-status-summary{grid-template-columns:repeat(3,minmax(0,1fr))}.dsh-api-kit-scope-flow{grid-template-columns:repeat(2,minmax(0,1fr))}.dsh-api-kit-settings{padding:16px}}
      @container (max-width:520px){.dsh-api-kit-import-heading>.dsh-api-kit-import-steps ol{grid-template-columns:1fr}.dsh-api-kit-import-step-button{min-height:44px}.dsh-api-kit-import-steps ol{grid-template-columns:1fr}.dsh-api-kit-import-review-grid{grid-template-columns:1fr}.dsh-api-kit-import-review-actions{flex-direction:column}.dsh-api-kit-import-review-actions>.dsh-api-kit-button{width:100%}}@container (max-width:520px){.dsh-api-kit-settings{padding:12px}.dsh-api-kit-status-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.dsh-api-kit-scope-flow{grid-template-columns:1fr}.dsh-api-kit-scope-arrow{display:none}.dsh-api-kit-section-header,.dsh-api-kit-detail-header,.dsh-api-kit-preview-summary-header{display:grid}.dsh-api-kit-import-steps ol{grid-template-columns:1fr}.dsh-api-kit-import-step-button{min-height:44px}.dsh-api-kit-section-header-actions,.dsh-api-kit-detail-actions{justify-content:flex-start}.dsh-api-kit-create-row{align-items:stretch;flex-direction:column}.dsh-api-kit-create-row>.dsh-api-kit-field,.dsh-api-kit-create-row>.dsh-api-kit-button,.dsh-api-kit-section-header-actions>.dsh-api-kit-button,.dsh-api-kit-detail-actions>.dsh-api-kit-button{width:100%}.dsh-api-kit-button-row>.dsh-api-kit-button{flex:1 1 120px}.dsh-api-kit-preview-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.dsh-api-kit-preview-operation{grid-template-columns:auto minmax(0,1fr)}.dsh-api-kit-preview-operation-status{grid-column:2}.dsh-api-kit-popover-footer{align-items:stretch;flex-wrap:wrap}.dsh-api-kit-popover-footer>.dsh-api-kit-button{min-height:44px}.dsh-api-kit-popover-footer>span{width:100%}.dsh-api-kit-popover-footer>span .dsh-api-kit-button{flex:1 1 0;min-height:44px}.dsh-api-kit-popover{position:fixed;left:8px;right:8px;bottom:8px;width:auto;max-width:none;max-height:calc(100dvh - 24px);border-radius:12px}}
      @media(max-width:720px){.dsh-api-kit-operation-card{grid-template-columns:minmax(0,1fr)}.dsh-api-kit-operation-actions{justify-content:stretch;grid-column:1}.dsh-api-kit-operation-card>.dsh-api-kit-operation-actions,.dsh-api-kit-operation-card>.dsh-api-kit-row>.dsh-api-kit-operation-actions{grid-column:1;grid-row:2}.dsh-api-kit-operation-card>.dsh-api-kit-row>.dsh-api-kit-operation-main{grid-column:1;grid-row:1}.dsh-api-kit-operation-actions .dsh-api-kit-button{flex:1 1 180px}.dsh-api-kit-connection-item{grid-template-columns:minmax(0,1fr)}.dsh-api-kit-connection-item>.dsh-api-kit-detail-actions{grid-column:1;grid-row:auto;justify-content:flex-start}.dsh-api-kit-workbench{grid-template-columns:1fr}.dsh-api-kit-settings{padding:16px}}@media(max-width:520px){.dsh-api-kit-settings{padding:12px}.dsh-api-kit-popover{position:fixed;left:8px;right:8px;bottom:8px;width:auto;max-width:none}}
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
      ENVIRONMENT_IN_USE: '请先解除引用此 Environment 的 Service Target 或 API Kit，再重试删除。',
      TARGET_IN_USE: '请先解除引用此 Service Target 的 Operation 或 API Kit，再重试删除。',
      OPERATION_IN_USE: '请先将此 Operation 从引用它的 API Kit 中移除，再重试删除。',
      KIT_NOT_FOUND: '列表可能已变化，请重新加载后再确认删除。',
      ENVIRONMENT_NOT_FOUND: '列表可能已变化，请重新加载后再确认删除。',
      TARGET_NOT_FOUND: '列表可能已变化，请重新加载后再确认删除。',
      OPERATION_NOT_FOUND: '列表可能已变化，请重新加载后再确认删除。',
      BACKUP_FAILED: 'Host 未提交删除，当前配置仍保留；请稍后重试或重新加载。',
      CONFIG_WRITE_FAILED: 'Host 未提交删除，当前配置仍保留；请稍后重试或重新加载。',
    }
    const DELETE_KIND_LABELS = { environment: 'Environment', target: 'Service Target', kit: 'API Kit', operation: 'Operation' }
    const DELETE_METHODS = { environment: 'deleteEnvironment', target: 'deleteServiceTarget', kit: 'deleteKit', operation: 'deleteOperation' }
    function deleteErrorText(error) {
      const code = error?.code
      if (code === 'ENVIRONMENT_IN_USE' || code === 'TARGET_IN_USE' || code === 'OPERATION_IN_USE') {
        const references = Array.isArray(error?.detail?.references) ? error.detail.references.filter((value) => typeof value === 'string' && value.trim()) : []
        return references.length > 0
          ? `${ERROR_GUIDANCE[code]} Host 已检测到 ${references.length} 个引用，请解除引用后重试。`
          : `${ERROR_GUIDANCE[code]} Host 仍在保存时校验引用关系。`
      }
      return errorText(error)
    }
    function errorText(error) {
      const code = error?.code
      const message = ERROR_GUIDANCE[code] || error?.message || code || '请求失败'
      return code && !message.startsWith(code) ? `${code}：${message}` : message
    }
    function button(label, onClick, className = '', disabled = false, options = {}) {
      return React.createElement('button', { type: 'button', className: 'dsh-api-kit-button ' + className, onClick, disabled, 'aria-busy': options.busy === true ? 'true' : undefined, 'aria-label': options.ariaLabel, 'aria-pressed': options.ariaPressed === undefined ? undefined : options.ariaPressed ? 'true' : 'false', title: options.title }, label)
    }
    function parseJsonValue(value, label, emptyValue) {
      if (!String(value ?? '').trim()) return { ok: true, value: emptyValue }
      try { return { ok: true, value: JSON.parse(value) } } catch { return { ok: false, error: `${label} JSON 格式无效，请检查逗号、引号和括号。` } }
    }
    function domIdSegment(value) { return Array.from(String(value)).map((character) => character.codePointAt(0).toString(16).padStart(6, '0')).join('-') || 'value' }
    function fieldId(label, explicit, fallback) {
      if (explicit) return explicit
      return 'dsh-api-kit-field-' + domIdSegment(fallback || label)
    }
    function textField(label, value, onChange, multiline = false, options = {}) {
      const id = fieldId(label, options.id, options.fallback)
      const errorId = id + '-error'
      const helpId = id + '-help'
      const describedBy = [options.help ? helpId : '', options.error ? errorId : ''].filter(Boolean).join(' ') || undefined
      const control = React.createElement(multiline ? 'textarea' : 'input', { id, className: 'dsh-api-kit-control' + (multiline ? ' dsh-api-kit-control-textarea' : ''), value: value ?? '', onChange: (event) => onChange(event.target.value), placeholder: options.placeholder, maxLength: options.maxLength, required: options.required === true, disabled: options.disabled === true, 'aria-invalid': options.error ? 'true' : undefined, 'aria-describedby': describedBy, ref: options.ref })
      return React.createElement('div', { className: 'dsh-api-kit-field' }, React.createElement('label', { htmlFor: id }, label, options.required === true ? React.createElement('span', { className: 'dsh-api-kit-required', 'aria-hidden': 'true' }, ' *') : null), options.help && React.createElement('div', { id: helpId, className: 'dsh-api-kit-field-help' }, options.help), control, options.error && React.createElement('div', { id: errorId, className: 'dsh-api-kit-field-error', role: 'alert' }, options.error))
    }
    function safeArray(value) { return Array.isArray(value) ? value : [] }
    function safeRecord(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {} }
    function safeString(value, fallback = '') { return typeof value === 'string' ? value : fallback }
     function operationFormFingerprint(form) {
       if (!form || typeof form !== 'object') return ''
       return JSON.stringify({ id: safeString(form.id), operationId: safeString(form.operationId), name: safeString(form.name), method: safeString(form.method), path: safeString(form.path), serviceTargetId: safeString(form.serviceTargetId), summary: safeString(form.summary), description: safeString(form.description), tags: safeString(form.tags), enabled: form.enabled === true, kitIds: Array.isArray(form.kitIds) ? form.kitIds.filter((id) => typeof id === 'string' && id).filter((id, index, values) => values.indexOf(id) === index) : [], parameters: safeString(form.parameters), requestBody: safeString(form.requestBody), responses: safeString(form.responses), policy: { allowAgentCall: form.policy?.allowAgentCall === true, allowWrite: form.policy?.allowWrite === true, requiresConfirmation: form.policy?.requiresConfirmation === true } })
     }
     function summaryValue(value) { return value === null || value === undefined ? '—' : String(value) }
     function isReadOperation(method) { return method === 'GET' || method === 'HEAD' }
     function isWriteOperation(method) { return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) }
     function settingsSummary(kits, operations, targets, environments, loaded = {}) {
       const known = (name) => loaded[name] === true
       const kitItems = safeArray(kits)
       const operationItems = safeArray(operations)
       const targetItems = safeArray(targets)
       const environmentItems = safeArray(environments)
       const targetIds = new Set(targetItems.map((item) => safeString(item?.id)).filter(Boolean))
       const environmentIds = new Set(environmentItems.map((item) => safeString(item?.id)).filter(Boolean))
       const operationIds = new Set(operationItems.map((item) => safeString(item?.id)).filter(Boolean))
       const targetById = new Map(targetItems.map((item) => [safeString(item?.id), item]))
       const allCollectionsKnown = known('kits') && known('operations') && known('targets') && known('environments')
       let configurationProblems = 0
       if (allCollectionsKnown) {
         for (const operation of operationItems) {
           if (!operation || operation.enabled === false) continue
           const targetId = safeString(operation.serviceTargetId)
           const target = targetById.get(targetId)
           if (!targetId || !target || target.enabled === false) configurationProblems += 1
         }
         for (const kit of kitItems) {
           if (!kit || kit.enabled === false) continue
           const ids = Array.isArray(kit.operationIds) ? kit.operationIds : []
           if (ids.length === 0) configurationProblems += 1
           for (const operationId of ids) if (!operationIds.has(safeString(operationId))) configurationProblems += 1
         }
         for (const target of targetItems) {
           if (!target || target.enabled === false) continue
           const ids = Array.isArray(target.environmentIds) ? target.environmentIds : []
           if (ids.length === 0) configurationProblems += 1
           const endpoints = safeRecord(target.endpoints)
           for (const environmentId of ids) {
             const id = safeString(environmentId)
             if (!environmentIds.has(id) || !safeString(safeRecord(endpoints[id]).baseUrl)) configurationProblems += 1
           }
         }
       }
       return {
         kitCount: known('kits') ? kitItems.length : null,
         operationCount: known('operations') ? operationItems.length : null,
         readOperationCount: known('operations') ? operationItems.filter((item) => isReadOperation(item?.method)).length : null,
         writeOperationCount: known('operations') ? operationItems.filter((item) => isWriteOperation(item?.method)).length : null,
         otherOperationCount: known('operations') ? operationItems.filter((item) => !isReadOperation(item?.method) && !isWriteOperation(item?.method)).length : null,
         availableEnvironmentCount: known('environments') ? environmentItems.filter((item) => item?.enabled !== false && item?.agentEnabled !== false).length : null,
         configurationProblems: allCollectionsKnown ? configurationProblems : null,
         allCollectionsKnown,
       }
     }
    function deleteImpact(kind, item, context = {}) {
       const id = safeString(item?.id)
       const name = safeString(item?.name, id || DELETE_KIND_LABELS[kind] || '此对象')
       const loaded = context.loaded || {}
       const kits = safeArray(context.kits)
       const operations = safeArray(context.operations)
       const targets = safeArray(context.targets)
       const known = (collection) => loaded[collection] === true
       const impact = { kind, id, name, known: true, referenceCount: 0, affectedOperationCount: 0, affectedTargetCount: 0, affectedKitCount: 0, messages: [], requiresTypedConfirmation: false }
       if (kind === 'environment') {
         const targetRefs = known('targets') ? targets.filter((target) => safeArray(target?.environmentIds).includes(id)) : []
         const kitRefs = known('kits') ? kits.filter((kit) => safeArray(kit?.environmentIds).includes(id) || safeString(kit?.defaultEnvironmentId) === id) : []
         impact.known = known('targets') && known('kits')
         impact.affectedTargetCount = impact.known ? targetRefs.length : null
         impact.affectedKitCount = impact.known ? kitRefs.length : null
         impact.referenceCount = impact.known ? targetRefs.length + kitRefs.length : null
         if (targetRefs.length > 0) impact.messages.push(`${targetRefs.length} 个 Service Target 绑定了此 Environment。`)
         if (kitRefs.length > 0) impact.messages.push(`${kitRefs.length} 个 API Kit 声明了此 Environment。`)
         impact.messages.push('删除不会自动删除 Service Target 或 API Kit。')
       } else if (kind === 'target') {
         const operationRefs = known('operations') ? operations.filter((operation) => safeString(operation?.serviceTargetId) === id) : []
         const kitRefs = known('kits') ? kits.filter((kit) => safeArray(kit?.serviceTargetIds).includes(id)) : []
         impact.known = known('operations') && known('kits')
         impact.affectedOperationCount = impact.known ? operationRefs.length : null
         impact.affectedKitCount = impact.known ? kitRefs.length : null
         impact.referenceCount = impact.known ? operationRefs.length + kitRefs.length : null
         if (operationRefs.length > 0) impact.messages.push(`${operationRefs.length} 个 Operation 使用此 Service Target。`)
         if (kitRefs.length > 0) impact.messages.push(`${kitRefs.length} 个 API Kit 声明了此 Service Target。`)
         impact.messages.push('删除不会自动删除 Operation 或 Environment；Host 可能因引用而拒绝删除。')
       } else if (kind === 'operation') {
         const kitRefs = known('kits') ? kits.filter((kit) => safeArray(kit?.operationIds).includes(id)) : []
         impact.known = known('kits')
         impact.affectedKitCount = impact.known ? kitRefs.length : null
         impact.referenceCount = impact.known ? kitRefs.length : null
         if (kitRefs.length > 0) impact.messages.push(`${kitRefs.length} 个 API Kit 引用了此 Operation。`)
         impact.messages.push('删除不会自动删除 API Kit；存在引用时 Host 会拒绝删除。')
         if (context.editingOperation === id && context.form && context.formDirty === true) {
           impact.draftWarning = '当前 Operation 还有未保存修改；删除成功后草稿将丢失。'
           impact.requiresTypedConfirmation = true
         }
       } else if (kind === 'kit') {
         const operationCount = Number.isFinite(Number(item?.operationCount)) ? Number(item.operationCount) : null
         impact.known = operationCount !== null
         impact.affectedOperationCount = operationCount
         impact.referenceCount = operationCount
         if (operationCount > 0) impact.messages.push(`此 API Kit 当前关联 ${operationCount} 个 Operation。`)
         impact.messages.push('删除 API Kit 不会自动删除其中的 Operation。')
       }
       impact.requiresTypedConfirmation = impact.requiresTypedConfirmation || impact.known === false || (impact.referenceCount !== null && impact.referenceCount > 0)
       return impact
     }
     function previewPathCount(preview) { return Number.isFinite(Number(preview?.counts?.paths)) ? Number(preview.counts.paths) : new Set(safeArray(preview?.operations).map((item) => safeString(item?.path)).filter(Boolean)).size }
    function previewVersion(preview) {
      const meta = safeRecord(preview?.documentMeta)
      const format = safeString(meta.format, 'openapi').toLowerCase() === 'swagger' ? 'Swagger' : 'OpenAPI'
      return `${format} ${safeString(meta.version, safeString(meta.documentVersion, '未知版本'))}`.trim()
    }
    function previewCount(preview, key) { return Number.isFinite(Number(preview?.counts?.[key])) ? Number(preview.counts[key]) : 0 }
     function reconcilePreviewTags(preview, selectedTags) {
       const selected = Array.isArray(selectedTags) ? selectedTags.filter((tag, index, values) => typeof tag === 'string' && tag && values.indexOf(tag) === index) : []
       if (selected.length === 0) return { tags: [], removed: [], changed: false, known: true }
       const canonicalByLower = new Map()
       let known = false
       const tagCounts = preview?.tagCounts
       if (tagCounts && typeof tagCounts === 'object' && !Array.isArray(tagCounts)) {
         known = true
         for (const tag of Object.keys(tagCounts)) {
           if (tag === '(none)' || !tag.trim()) continue
           const lower = tag.toLowerCase()
           if (!canonicalByLower.has(lower)) canonicalByLower.set(lower, tag)
         }
       }
       for (const item of safeArray(preview?.operations)) {
         if (!Array.isArray(item?.tags)) continue
         known = true
         for (const tag of item.tags) {
           if (typeof tag !== 'string' || !tag.trim()) continue
           const value = tag.trim()
           const lower = value.toLowerCase()
           if (!canonicalByLower.has(lower)) canonicalByLower.set(lower, value)
         }
       }
       if (!known) return { tags: selected, removed: [], changed: false, known: false }
       const tags = []
       const removed = []
       for (const tag of selected) {
         const canonical = canonicalByLower.get(tag.toLowerCase())
         if (!canonical) removed.push(tag)
         else if (!tags.includes(canonical)) tags.push(canonical)
       }
       return { tags, removed, changed: tags.length !== selected.length || tags.some((tag, index) => tag !== selected[index]), known: true }
     }
    function statusLabel(status) { return ({ new: '新增', update: '更新', conflict: '冲突', skip: '跳过', error: '错误' })[status] || '待处理' }
    function focusElement(id) {
      if (typeof document === 'undefined') return
      const element = document.getElementById(id)
      if (element && typeof element.focus === 'function') element.focus()
    }
    const FOCUSABLE_SELECTOR = 'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])'
     function trapDialogTab(event, dialogRef) {
       if (event.key !== 'Tab' || !dialogRef?.current) return
       const focusable = [...dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR)]
       if (focusable.length === 0) return
       const first = focusable[0]
       const last = focusable[focusable.length - 1]
       if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
       else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
     }
     function statusBadge(label, className = '') { return React.createElement('span', { className: 'dsh-api-kit-state ' + className }, label) }
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

      function normalizeChoiceValue(value) {
         if (!Array.isArray(value)) return []
         const result = []
         const seen = new Set()
         for (const item of value) {
           if (typeof item !== 'string' || !item || seen.has(item)) continue
           seen.add(item)
           result.push(item)
         }
         return result
       }
       function choiceDomId(id, value) { return `${id}-${domIdSegment(value)}` }
       function CheckboxChipSelect(props) {
         const selected = normalizeChoiceValue(props.value)
         const [query, setQuery] = React.useState('')
         const rawOptions = safeArray(props.options)
         const options = []
         const seen = new Set()
         for (const item of rawOptions) {
           const id = typeof item?.id === 'string' ? item.id : ''
           if (!id || seen.has(id)) continue
           seen.add(id)
           options.push({ id, label: safeString(item.label, id), meta: safeString(item.meta), disabled: item.disabled === true, disabledReason: safeString(item.disabledReason), unknown: false })
         }
         const unknownOptions = selected.filter((id) => !seen.has(id)).map((id) => ({ id, label: `已选择但当前列表未返回（${id}）`, meta: '当前不可用；可移除后重新选择', disabled: false, disabledReason: '', unknown: true }))
         const allOptions = [...options, ...unknownOptions]
         const normalizedQuery = query.trim().toLowerCase()
         const visibleOptions = allOptions.filter((item) => !normalizedQuery || `${item.label} ${item.id} ${item.meta}`.toLowerCase().includes(normalizedQuery))
         const selectedSet = new Set(selected)
         const allSelected = props.emptyMeansAll === true && selected.length === 0
         const listId = `${props.id}-options`
         const descriptionId = `${props.id}-help`
         const errorId = `${props.id}-error`
         const describedBy = [props.description ? descriptionId : '', props.error ? errorId : ''].filter(Boolean).join(' ') || undefined
         const change = (next) => { if (typeof props.onChange === 'function') props.onChange(normalizeChoiceValue(next)) }
         const toggle = (item) => {
           if (props.disabled || !item || (item.disabled && !selectedSet.has(item.id))) return
           if (allSelected) { change([item.id]); return }
           change(selectedSet.has(item.id) ? selected.filter((id) => id !== item.id) : [...selected, item.id])
         }
         const selectableVisible = visibleOptions.filter((item) => !item.disabled && !item.unknown)
         const selectAll = () => {
           if (props.disabled) return
           if (props.emptyMeansAll === true) { change([]); return }
           const next = [...selected]
           for (const item of selectableVisible) if (!next.includes(item.id)) next.push(item.id)
           change(next)
         }
         const clear = () => { if (!props.disabled) change([]) }
         const countText = props.emptyMeansAll === true && allSelected
           ? `全部（未筛选） · 共 ${options.length} 项`
           : `已选 ${selected.length} 项 / 共 ${options.length + unknownOptions.length} 项`
         return React.createElement('fieldset', { className: 'dsh-api-kit-choice-select', 'aria-labelledby': `${props.id}-label`, 'aria-describedby': describedBy, 'aria-invalid': props.error ? 'true' : undefined, 'aria-busy': props.loading ? 'true' : 'false' },
           React.createElement('legend', { id: `${props.id}-label` }, props.label, props.required ? React.createElement('span', { className: 'dsh-api-kit-required', 'aria-hidden': 'true' }, ' *') : null),
           props.description && React.createElement('div', { id: descriptionId, className: 'dsh-api-kit-choice-help' }, props.description),
           React.createElement('div', { className: 'dsh-api-kit-choice-toolbar' },
             React.createElement('div', { className: 'dsh-api-kit-choice-count', role: 'status', 'aria-live': 'polite' }, props.loading ? '正在加载选项…' : countText),
             (props.selectAll || selected.length > 0) && React.createElement('div', { className: 'dsh-api-kit-choice-actions' },
               props.selectAll && React.createElement('button', { type: 'button', className: 'dsh-api-kit-choice-action', onClick: selectAll, disabled: props.disabled || selectableVisible.length === 0, 'aria-controls': listId }, props.emptyMeansAll === true ? '全部 Tag' : normalizedQuery ? '全选当前结果' : '全选'),
               React.createElement('button', { type: 'button', className: 'dsh-api-kit-choice-action', onClick: clear, disabled: props.disabled || selected.length === 0 }, props.clearLabel || '清除选择'),
             ),
           ),
           props.searchable && React.createElement('div', { className: 'dsh-api-kit-choice-search' }, React.createElement('label', { htmlFor: `${props.id}-search` }, `搜索${props.label}`), React.createElement('input', { id: `${props.id}-search`, className: 'dsh-api-kit-control', type: 'search', value: query, onChange: (event) => setQuery(event.target.value), placeholder: `搜索${props.label}`, 'aria-controls': listId, disabled: props.disabled, autoComplete: 'off' })),
           React.createElement('div', { id: listId, className: 'dsh-api-kit-choice-list' },
             props.emptyMeansAll === true && React.createElement('label', { className: 'dsh-api-kit-choice dsh-api-kit-choice-all' }, React.createElement('input', { id: `${props.id}-all`, type: 'checkbox', checked: allSelected, onChange: selectAll, disabled: props.disabled, 'aria-describedby': `${props.id}-all-help`, 'aria-label': '选择全部' }), React.createElement('span', { className: 'dsh-api-kit-choice-main' }, React.createElement('span', { className: 'dsh-api-kit-choice-title' }, '全部 Tag（不筛选，包含无 Tag 的 Operation）'), React.createElement('span', { id: `${props.id}-all-help`, className: 'dsh-api-kit-choice-meta' }, '选择特定 Tag 后，仅导入匹配的 Operation'))),
             allOptions.length === 0
               ? React.createElement('div', { className: 'dsh-api-kit-choice-empty' }, props.emptyText || '暂无可选项')
               : visibleOptions.length === 0
                 ? React.createElement('div', { className: 'dsh-api-kit-choice-empty' }, '没有匹配项。', React.createElement('button', { type: 'button', className: 'dsh-api-kit-choice-action', onClick: () => setQuery('') }, '清除搜索'))
                 : visibleOptions.map((item) => {
                   const checked = !allSelected && selectedSet.has(item.id)
                   const disabled = props.disabled || (item.disabled && !checked)
                   const reasonId = choiceDomId(`${props.id}-reason`, item.id)
                   return React.createElement('label', { key: item.id, className: 'dsh-api-kit-choice' + (checked ? ' is-checked' : '') + (disabled ? ' is-disabled' : '') + (item.unknown ? ' is-unknown' : '') },
                     React.createElement('input', { id: choiceDomId(props.id, item.id), type: 'checkbox', checked, disabled, onChange: () => toggle(item), 'aria-label': `${item.label}${item.meta ? `：${item.meta}` : ''}`, 'aria-describedby': item.meta || item.disabledReason ? reasonId : undefined }),
                     React.createElement('span', { className: 'dsh-api-kit-choice-main' }, React.createElement('span', { className: 'dsh-api-kit-choice-title' }, item.label), (item.meta || item.disabledReason) && React.createElement('span', { id: reasonId, className: 'dsh-api-kit-choice-meta' }, item.disabledReason || item.meta)),
                   )
                 }),
           ),
           props.error && React.createElement('div', { id: errorId, className: 'dsh-api-kit-field-error', role: 'alert' }, props.error),
         )
       }

       function availableEnvironmentIds(kitIds, kits, environments) {
        const selectable = environments.filter((item) => item.selectable).map((item) => item.id)
        if (kitIds.length === 0) return []
        let result = [...selectable]
        for (const kitId of kitIds) {
          const kit = kits.find((item) => item.id === kitId)
          if (!kit || !Array.isArray(kit.compatibleEnvironmentIds)) return []
          result = result.filter((id) => kit.compatibleEnvironmentIds.includes(id))
        }
        return result
      }

      function selectedKitViews(kitIds, kits) { return kitIds.map((id) => kits.find((kit) => kit.id === id)).filter(Boolean) }
       function commonEnvironmentState(kitIds, kits, environments) {
         const selected = selectedKitViews(kitIds, kits)
         if (selected.length === 0) return { known: true, ids: [], selected, missingKitIds: [] }
         const missingKitIds = selected.filter((kit) => !Array.isArray(kit.compatibleEnvironmentIds)).map((kit) => kit.id)
         if (missingKitIds.length > 0 || selected.length !== kitIds.length) return { known: false, ids: [], selected, missingKitIds }
         let ids = environments.filter((item) => item.selectable).map((item) => item.id)
         for (const kit of selected) ids = ids.filter((id) => kit.compatibleEnvironmentIds.includes(id))
         return { known: true, ids, selected, missingKitIds: [] }
       }
       function kitEnvironmentSummary(kit, environments) {
         if (!Array.isArray(kit?.compatibleEnvironmentIds)) return '兼容环境暂不可统计'
         const names = kit.compatibleEnvironmentIds.map((id) => environments.find((item) => item.id === id)?.name || id).filter(Boolean)
         return names.join('、') || '无可用环境'
       }
       function sessionScopeSummary(kitIds, kits, environmentId, environments) {
         const state = commonEnvironmentState(kitIds, kits, environments)
         const selectedEnvironment = environments.find((item) => item.id === environmentId)
         const exact = state.selected.length === 1 ? state.selected[0] : null
         const unavailable = state.known && Boolean(environmentId) && !state.ids.includes(environmentId)
         return {
           ...state,
           selectedKitCount: kitIds.length,
           selectedKitNames: kitIds.map((id) => kits.find((kit) => kit.id === id)?.name || `已失效套件（${id}）`),
           operationCount: exact && Number.isFinite(Number(exact.operationCount)) ? Number(exact.operationCount) : null,
           enabledOperationCount: exact && Number.isFinite(Number(exact.enabledOperationCount)) ? Number(exact.enabledOperationCount) : null,
           readOperationCount: exact && Number.isFinite(Number(exact.readOperationCount)) ? Number(exact.readOperationCount) : null,
           writeOperationCount: exact && Number.isFinite(Number(exact.writeOperationCount)) ? Number(exact.writeOperationCount) : null,
           selectedEnvironment,
           selectedEnvironmentIsProduction: selectedEnvironment?.production === true,
           unavailable,
           valid: kitIds.length === 0 || (state.known && state.ids.length > 0 && Boolean(environmentId) && !unavailable),
         }
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
                const committedScope = sessionScopeSummary(activation?.activeKitIds || [], kits, activation?.environmentId, environments)
         const draftScope = sessionScopeSummary(draftKitIds, kits, draftEnvironmentId, environments)
         const activeKitNames = (open ? draftScope.selectedKitNames : committedScope.selectedKitNames).filter(Boolean)
         const selectedScope = open ? draftScope : committedScope
        const buttonLabel = loading
          ? 'API 套件…'
          : activeKitNames.length > 0
            ? activeKitNames.length === 1 ? activeKitNames[0] : `${activeKitNames[0]} + ${activeKitNames.length - 1} 个套件`
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
            disabled: loading && !open, 'aria-expanded': open, 'aria-controls': 'dsh-api-kit-picker-panel', 'aria-haspopup': 'dialog', title: selectedScope.selectedEnvironment ? `环境：${selectedScope.selectedEnvironment.name}` : '修改当前会话的 API 套件和环境选择', 'aria-label': '修改当前会话的 API 套件和环境选择',
          }, selectedIsInvalid ? 'API 套件需修复 · 修改' : buttonLabel, selectedScope.selectedEnvironment ? ` · ${selectedScope.selectedEnvironment.name}${selectedScope.selectedEnvironmentIsProduction ? '（生产环境）' : ''}` : ''),
          open && React.createElement('div', { ref: panelRef, id: 'dsh-api-kit-picker-panel', className: 'dsh-api-kit-popover', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dsh-api-kit-picker-title' },
            React.createElement('div', { className: 'dsh-api-kit-popover-header' }, React.createElement('h3', { id: 'dsh-api-kit-picker-title' }, '当前会话 API 套件'), loading && React.createElement('span', { className: 'dsh-api-kit-spinner', 'aria-label': '加载中' })),
            React.createElement('div', { className: 'dsh-api-kit-status', role: 'status', 'aria-live': 'polite', 'aria-busy': loading ? 'true' : 'false' }, loading ? '正在读取当前会话范围…' : '选择只对当前会话生效；重启 DSH 后需要重新激活。'),
             React.createElement('section', { className: 'dsh-api-kit-scope-summary', 'aria-labelledby': 'dsh-api-kit-scope-summary-title' },
               React.createElement('h4', { id: 'dsh-api-kit-scope-summary-title' }, '当前会话范围'),
               draftScope.selectedKitCount === 0
                 ? React.createElement('p', { className: 'dsh-api-kit-muted' }, '尚未激活 API 套件；应用后 Agent 不会发现 API Operation。')
                 : React.createElement('div', { className: 'dsh-api-kit-scope-summary-grid' },
                   React.createElement('div', { className: 'dsh-api-kit-scope-summary-item' }, React.createElement('strong', null, 'API 套件'), React.createElement('span', null, `${draftScope.selectedKitCount} 个：${draftScope.selectedKitNames.join('、')}`)),
                   React.createElement('div', { className: 'dsh-api-kit-scope-summary-item' }, React.createElement('strong', null, '环境'), React.createElement('span', null, draftScope.selectedEnvironment ? `${draftScope.selectedEnvironment.name}${draftScope.selectedEnvironmentIsProduction ? ' · 生产环境' : ''}` : '尚未选择环境')),
                   React.createElement('div', { className: 'dsh-api-kit-scope-summary-item' }, React.createElement('strong', null, 'Operation 范围'), React.createElement('span', null, draftScope.operationCount === null ? '多个套件或字段不足，暂不可去重统计' : `${draftScope.operationCount} 个 Operation · ${draftScope.enabledOperationCount ?? '—'} 个启用`)),
                   React.createElement('div', { className: 'dsh-api-kit-scope-summary-item' }, React.createElement('strong', null, '读写风险'), React.createElement('span', null, draftScope.writeOperationCount === null ? '由 Host 校验调用策略' : `${draftScope.readOperationCount ?? '—'} 个只读 · ${draftScope.writeOperationCount} 个写操作，默认禁止 Agent 调用`)),
                 ),
             ),
            error && React.createElement('div', { className: 'dsh-api-kit-invalid', role: 'alert' }, error),
            activation?.errors?.length > 0 && React.createElement('div', { className: 'dsh-api-kit-invalid', role: 'alert' }, activation.errors.map((item) => React.createElement('div', { key: item.code + (item.path || '') }, item.message))),
            activation?.warnings?.length > 0 && React.createElement('div', { className: 'dsh-api-kit-warn', role: 'status' }, activation.warnings.map((item) => React.createElement('div', { key: item.code + (item.path || '') }, item.message))),
            React.createElement('div', { className: 'dsh-api-kit-popover-section' },
              React.createElement('fieldset', null, React.createElement('legend', null, 'API 套件（可多选，已选 ', draftKitIds.length, ' 个）'), kits.length === 0
                ? React.createElement('div', { className: 'dsh-api-kit-muted' }, '暂无套件，请先在设置 → API 套件中创建，然后点击重试。')
                : kits.map((kit) => {
                  const checked = draftKitIds.includes(kit.id)
                  const disabled = !kit.selectable && !checked
                  const reason = kit.enabled === false ? '已停用' : kit.agentEnabled === false ? '未允许 Agent' : kit.operationCount === 0 ? '暂无 Operation' : `${kit.operationCount} 个操作`
                  return React.createElement('label', { key: kit.id, className: 'dsh-api-kit-selection' + (checked ? ' is-checked' : '') },
                    React.createElement('input', { id: choiceDomId('dsh-api-kit-session-kits', kit.id), type: 'checkbox', checked, disabled, onChange: () => toggleKit(kit), 'aria-label': `${kit.name}：${reason}`, 'aria-describedby': choiceDomId('dsh-api-kit-session-kit-reason', kit.id) }),
                    React.createElement('span', { className: 'dsh-api-kit-selection-main' }, React.createElement('span', { className: 'dsh-api-kit-selection-title' }, kit.name), React.createElement('span', { id: choiceDomId('dsh-api-kit-session-kit-reason', kit.id), className: 'dsh-api-kit-selection-meta' }, reason)),
                  )
                })),
            ),
            draftKitIds.length > 0 && React.createElement('div', { className: 'dsh-api-kit-popover-section' },
              React.createElement('label', { htmlFor: 'dsh-api-kit-environment' }, '环境'),
              React.createElement('select', { id: 'dsh-api-kit-environment', className: 'dsh-api-kit-control', value: draftEnvironmentId || '', onChange: (event) => setDraftEnvironmentId(event.target.value || null), 'aria-label': '当前会话环境', 'aria-invalid': draftScope.unavailable || (draftKitIds.length > 0 && draftScope.known && draftScope.ids.length === 0) ? 'true' : 'false', 'aria-describedby': draftScope.unavailable || (draftKitIds.length > 0 && draftScope.known && draftScope.ids.length === 0) ? 'dsh-api-kit-environment-error' : 'dsh-api-kit-environment-help' },
                React.createElement('option', { value: '' }, '请选择环境'),
                environments.map((environment) => React.createElement('option', { key: environment.id, value: environment.id, disabled: !environment.selectable || !draftEnvironmentIds.includes(environment.id) }, `${environment.name}${environment.production ? '（生产）' : ''}${!environment.selectable ? ' · 不可用' : !draftEnvironmentIds.includes(environment.id) ? ' · 与套件不兼容' : ''}`)),
              ),
            ),
            draftKitIds.length > 0 && React.createElement('div', { className: 'dsh-api-kit-environment-diagnostic ' + (draftScope.known && draftScope.ids.length === 0 ? 'is-error' : draftScope.selectedEnvironmentIsProduction ? 'is-warn' : '') },
               draftScope.known && draftScope.ids.length === 0
                 ? React.createElement(React.Fragment, null, React.createElement('strong', null, '当前套件没有共同可用环境'), draftScope.selected.map((kit) => React.createElement('div', { key: kit.id }, kit.name + '：' + kitEnvironmentSummary(kit, environments))), React.createElement('span', null, '请移除一个套件，或为服务目标补充共同环境配置。'))
                 : !draftScope.known
                   ? React.createElement(React.Fragment, null, React.createElement('strong', null, '共同环境暂不可统计'), React.createElement('span', null, '部分套件缺少兼容环境信息，最终可用范围由 Host 校验。'))
                   : React.createElement(React.Fragment, null, React.createElement('strong', null, `共同可用环境：${draftScope.ids.map((id) => environments.find((item) => item.id === id)?.name || id).join('、') || '无'}`), draftScope.selectedEnvironmentIsProduction && React.createElement('span', null, '当前选择为生产环境，请确认目标和查询范围。')),
             ),
             React.createElement('div', { className: 'dsh-api-kit-popover-footer' }, button('清除选择', clear, '', busy || draftKitIds.length === 0, { busy }), React.createElement('span', null, button('取消', () => { setDraftKitIds(activation?.activeKitIds || []); setDraftEnvironmentId(activation?.environmentId || null); closePopover() }, '', busy), button(busy ? '保存中…' : '应用', save, 'primary', busy, { busy }))),
          ),
        )
      }

      function OpenApiImportPanel() {
        const [input, setInput] = React.useState('')
        const [preview, setPreview] = React.useState(null)
        const [previewInput, setPreviewInput] = React.useState('')
        const [previewStale, setPreviewStale] = React.useState(false)
         const [activeStep, setActiveStep] = React.useState('inspect')
         const [confirming, setConfirming] = React.useState(false)
        const [importMode, setImportMode] = React.useState('new')
        const [kitName, setKitName] = React.useState('')
        const [kits, setKits] = React.useState([])
        const [targets, setTargets] = React.useState([])
        const [environments, setEnvironments] = React.useState([])
        const [authProfiles, setAuthProfiles] = React.useState([])
        const [targetId, setTargetId] = React.useState('')
        const [environmentId, setEnvironmentId] = React.useState('')
        const [kitIds, setKitIds] = React.useState([])
        const [authProfileId, setAuthProfileId] = React.useState('')
        const [selectedTags, setSelectedTags] = React.useState([])
         const selectedTagsRef = React.useRef([])
         const [filterNotice, setFilterNotice] = React.useState(null)
        const [conflicts, setConflicts] = React.useState({})
        const [busy, setBusy] = React.useState(false)
        const [error, setError] = React.useState(null)
        const [result, setResult] = React.useState(null)
        const [bindingErrors, setBindingErrors] = React.useState({})
        const [bindingBusy, setBindingBusy] = React.useState(false)
        const bindingBusyRef = React.useRef(false)
         const kitSelectionInitializedRef = React.useRef(false)
        const mountedRef = React.useRef(true)
        const requestRef = React.useRef(0)
        const bindingRequestRef = React.useRef(0)
        React.useEffect(() => () => { mountedRef.current = false; requestRef.current += 1; bindingRequestRef.current += 1 }, [])

        const loadBindings = React.useCallback(async () => {
          if (bindingBusyRef.current) return
          bindingBusyRef.current = true
          setBindingBusy(true)
          const requestId = ++bindingRequestRef.current
          const names = ['kits', 'targets', 'environments', 'authProfiles']
          const loaders = [() => call('listKits'), () => call('listServiceTargets'), () => call('listEnvironments'), () => call('listAuthProfiles')]
          const values = await Promise.all(loaders.map(async (loader, index) => {
            try { return { name: names[index], value: await loader() } } catch (cause) { return { name: names[index], error: errorText(cause) } }
          }))
          if (!mountedRef.current || requestId !== bindingRequestRef.current) {
            if (mountedRef.current) { bindingBusyRef.current = false; setBindingBusy(false) }
            return
          }
          const failures = {}
          for (const item of values) {
            if (item.error) failures[item.name] = item.error
            else if (item.name === 'kits') setKits(Array.isArray(item.value) ? item.value : [])
            else if (item.name === 'targets') setTargets(Array.isArray(item.value) ? item.value : [])
            else if (item.name === 'environments') setEnvironments(Array.isArray(item.value) ? item.value : [])
            else if (item.name === 'authProfiles') setAuthProfiles(Array.isArray(item.value) ? item.value : [])
          }
          setBindingErrors(failures)
          const targetValue = values.find((item) => item.name === 'targets' && !item.error)?.value || []
          const kitValue = values.find((item) => item.name === 'kits' && !item.error)?.value || []
          setTargetId((current) => current && targetValue.some((item) => item.id === current) ? current : (targetValue.find((item) => item.enabled !== false)?.id || ''))
          if (!values.find((item) => item.name === 'kits')?.error) {
             setKitIds((current) => {
               const preserved = normalizeChoiceValue(current)
               if (kitSelectionInitializedRef.current) return preserved
               kitSelectionInitializedRef.current = true
               const firstSelectable = kitValue.find((item) => item.enabled !== false && item.agentEnabled !== false)
               return preserved.length > 0 ? preserved : (firstSelectable?.id ? [firstSelectable.id] : [])
             })
           }
          bindingBusyRef.current = false
          setBindingBusy(false)
        }, [])
        React.useEffect(() => { void loadBindings() }, [loadBindings])

        const markInputChanged = (value) => { setInput(value); const stale = Boolean(preview && value !== previewInput); setPreviewStale(stale); setActiveStep('inspect'); setResult(null); setError(null); setFilterNotice(null) }
         const unusedMarkInputChanged = (value) => { setInput(value); setPreviewStale(Boolean(preview && value !== previewInput)); setResult(null); setError(null); setFilterNotice(null) }
        const runPreview = async () => {
          if (busy) return
          if (!input.trim()) { setError('请粘贴 OpenAPI/Swagger JSON'); return }
          const requestId = ++requestRef.current
          setBusy(true); setError(null); setResult(null); setFilterNotice(null)
          try {
            const next = await call('previewOpenApiImport', { input })
            if (!mountedRef.current || requestId !== requestRef.current) return
            const tagReconciliation = reconcilePreviewTags(next, selectedTagsRef.current)
             setPreview(next); setPreviewInput(input); setPreviewStale(false); setConflicts({}); setActiveStep('configure')
             selectedTagsRef.current = tagReconciliation.tags
             setSelectedTags(tagReconciliation.tags)
             setFilterNotice(tagReconciliation.removed.length > 0
               ? tagReconciliation.tags.length > 0
                 ? `已移除 ${tagReconciliation.removed.length} 个在新文档中不存在的 Tag：${tagReconciliation.removed.join('、')}。`
                 : `原筛选 Tag 在新文档中均不存在，已清除筛选；当前将导入全部可导入 Operation。`
               : null)
          } catch (cause) {
            if (mountedRef.current && requestId === requestRef.current) { setPreview(null); setError(errorText(cause)) }
          } finally { if (mountedRef.current && requestId === requestRef.current) setBusy(false) }
        }
        const updateSelectedTags = (value) => { const next = normalizeChoiceValue(value); selectedTagsRef.current = next; setSelectedTags(next); setFilterNotice(null) }
         const previewOperations = safeArray(preview?.operations)
        const importable = previewOperations.filter((item) => item?.importable && item?.status !== 'error')
        const selectedOperations = importable.filter((item) => {
          if (selectedTags.length === 0) return true
          const values = safeArray(item.tags).map((tag) => String(tag).toLowerCase())
          return selectedTags.some((tag) => values.includes(tag.toLowerCase()))
        })
        const selectedConflictItems = selectedOperations.filter((item) => item?.status === 'conflict')
        const conflictsReady = selectedConflictItems.every((item) => Boolean(conflicts[item.sourceKey]))
        const selectedStatusCounts = selectedOperations.reduce((result, item) => { const status = safeString(item?.status, 'pending'); result[status] = (result[status] || 0) + 1; return result }, {})
         const selectedWriteCount = selectedOperations.filter((item) => isWriteOperation(String(item?.method || '').toUpperCase())).length
         const canConfigure = Boolean(preview && !previewStale && !busy && !Object.keys(bindingErrors).length && targetId && selectedOperations.length && (importMode === 'existing' ? kitIds.length > 0 : kitName.trim()))
         const canConfirm = Boolean(canConfigure && conflictsReady)
         const confirmTriggerRef = React.useRef(null)
         const confirmationDialogRef = React.useRef(null)
         React.useEffect(() => {
           if (!confirming) return undefined
           const first = confirmationDialogRef.current?.querySelector(FOCUSABLE_SELECTOR)
           if (first && typeof first.focus === 'function') first.focus()
           const onKeyDown = (event) => {
              if (event.key === 'Escape') { event.preventDefault(); if (!busy) { setConfirming(false); confirmTriggerRef.current?.focus?.() } return }
              trapDialogTab(event, confirmationDialogRef)
            }
           document.addEventListener('keydown', onKeyDown)
           return () => document.removeEventListener('keydown', onKeyDown)
         }, [confirming, busy])
         const requestConfirmation = () => { if (canConfirm && !busy) { confirmTriggerRef.current = document.activeElement; setConfirming(true) } }
         const executeConfirm = async () => {
          if (busy) return
          if (!preview || previewStale) { setError('文档内容已变化，请重新预览后再导入。'); return }
           if (Object.keys(bindingErrors).length > 0 || !targetId || (importMode === 'existing' && kitIds.length === 0)) { setError('请先修复绑定列表，并选择 Service Target 与 API Kit。'); return }
           if (importMode === 'new' && !kitName.trim()) { setError('请输入新套件名称。'); return }
          if (selectedOperations.length === 0) { setError('当前筛选没有可导入的 Operation，请调整 Tag 或检查预览错误。'); return }
          const conflictDecisions = {}
          for (const item of selectedOperations) if (item.status === 'conflict') {
             if (!conflicts[item.sourceKey]) { setError('请为每个冲突选择处理方式。'); return }
             conflictDecisions[item.sourceKey] = conflicts[item.sourceKey]
           }
          if (Object.keys(conflictDecisions).some((key) => !conflictDecisions[key])) { setError('每个冲突都必须选择处理方式'); return }
          setConfirming(false)
          const requestId = ++requestRef.current
          setBusy(true); setError(null); setResult(null); setFilterNotice(null)
          try {
            const value = await call('confirmOpenApiImport', {
              transactionId: safeString(preview.transactionId),
              input,
              sourceId: safeRecord(preview.documentMeta).documentId,
              documentId: safeRecord(preview.documentMeta).documentId,
              fingerprint: safeRecord(preview.documentMeta).fingerprint,
              expectedRegistryFingerprint: safeString(preview.registryFingerprint),
              includedSourceKeys: selectedOperations.map((item) => item.sourceKey),
              conflictDecisions,
              defaultServiceTargetId: targetId,
              targetDefaults: environmentId ? { [targetId]: environmentId } : {},
              defaultKitIds: importMode === 'existing' ? kitIds : [],
              defaultAuthProfileId: authProfileId || undefined,
               selection: { newKit: importMode === 'new' ? { name: kitName.trim() } : undefined, defaultKitIds: importMode === 'existing' ? kitIds : [], defaultServiceTargetId: targetId, defaultAuthProfileId: authProfileId || undefined, includedSourceKeys: selectedOperations.map((item) => item.sourceKey), conflictDecisions },
            })
            if (!mountedRef.current || requestId !== requestRef.current) return
            setResult(value); notifyConfigChanged(); await loadBindings()
            if (mountedRef.current) setBusy(false)
          } catch (cause) { if (mountedRef.current && requestId === requestRef.current) setError(errorText(cause)) } finally { if (mountedRef.current && requestId === requestRef.current) setBusy(false) }
        }
        const targetName = targets.find((item) => item.id === targetId)?.name || targetId
         const environmentName = environments.find((item) => item.id === environmentId)?.name || '使用目标默认环境'
         const selectedKitNames = kitIds.map((id) => kits.find((item) => item.id === id)?.name || `已失效套件（${id}）`)
         const selectedStatusSummary = `新增 ${selectedStatusCounts.new || 0} · 更新 ${selectedStatusCounts.update || 0} · 跳过 ${selectedStatusCounts.skip || 0} · 冲突 ${selectedStatusCounts.conflict || 0}`
         const tagNames = Object.keys(safeRecord(preview?.tagCounts)).filter((tag) => tag !== '(none)').sort()
        const bindingWarning = Object.keys(bindingErrors).length > 0 ? '部分绑定列表暂不可用，请重新加载后再导入。' : null
         const retryPreviewLabel = '重试读取/预览'
         const retryBindingLabel = '重试绑定列表'
        const importErrorGuidance = error && /IMPORT_(?:STALE_PREVIEW|TRANSACTION_MISMATCH|DOCUMENT_MISMATCH)/.test(String(error)) ? '文档或预览已过期，请重新预览后再导入。' : null
        const stepStatus = (step) => step === 'inspect' ? (preview ? (previewStale ? '需重新预览' : '已预览') : '未开始') : step === 'configure' ? (canConfigure ? '可确认' : previewStale ? '需重新预览' : '待配置') : canConfirm ? '可导入' : previewStale ? '需重新预览' : '待确认'
         const stepButton = (step, label, disabled) => React.createElement('button', { type: 'button', className: 'dsh-api-kit-import-step-button', onClick: () => setActiveStep(step), disabled }, label)
         const stepNav = React.createElement('nav', { className: 'dsh-api-kit-import-steps', 'aria-label': 'OpenAPI 导入步骤' }, React.createElement('ol', null,
           React.createElement('li', { className: activeStep === 'inspect' ? 'is-current' : preview ? 'is-complete' : '', 'aria-current': activeStep === 'inspect' ? 'step' : undefined }, stepButton('inspect', '1. 检查文档', false), React.createElement('span', null, stepStatus('inspect'))),
           React.createElement('li', { className: activeStep === 'configure' ? 'is-current' : canConfigure ? 'is-complete' : '', 'aria-current': activeStep === 'configure' ? 'step' : undefined }, stepButton('configure', '2. 配置导入', !preview), React.createElement('span', null, stepStatus('configure'))),
           React.createElement('li', { className: activeStep === 'confirm' ? 'is-current' : '', 'aria-current': activeStep === 'confirm' ? 'step' : undefined }, stepButton('confirm', '3. 确认变更', !canConfirm), React.createElement('span', null, stepStatus('confirm'))),
         ))
         return React.createElement('div', { className: 'dsh-api-kit-card dsh-api-kit-import-card'
           + (activeStep === 'inspect' ? ' is-inspect' : activeStep === 'configure' ? ' is-configure' : ' is-confirm'), 'data-t12-import': 'openapi' },
          React.createElement('div', { className: 'dsh-api-kit-import-heading' }, React.createElement('div', null, React.createElement('h3', null, '导入 OpenAPI JSON'), React.createElement('div', { className: 'dsh-api-kit-muted dsh-api-kit-helper' }, '按“检查文档 → 配置导入 → 确认变更”完成一次可审查的导入。')), stepNav, button(busy ? '正在解析…' : preview && !previewStale ? '重新预览' : '校验并预览', runPreview, 'primary', busy || !input.trim(), { busy, ariaLabel: '校验并预览 OpenAPI 或 Swagger JSON' })),
          textField('粘贴 API 定义', input, markInputChanged, true, { id: 'dsh-api-kit-openapi-json', fallback: 'import-openapi-json', placeholder: '粘贴 OpenAPI 或 Swagger JSON\n支持 OpenAPI 3.x 和 Swagger 2.0，预览前不会写入配置。', help: '格式：自动识别。', maxLength: 1024 * 1024, error: !input.trim() && error ? error : undefined }),
          error && React.createElement('div', { className: 'dsh-api-kit-invalid', role: 'alert' }, importErrorGuidance || error, React.createElement('div', { className: 'dsh-api-kit-button-row' }, button(retryPreviewLabel, runPreview, '', busy || !input.trim(), { busy, ariaLabel: '重新预览 OpenAPI 或 Swagger JSON' }))),
          bindingWarning && React.createElement('div', { className: 'dsh-api-kit-invalid', role: 'alert' }, bindingWarning, Object.entries(bindingErrors).map(([name, value]) => React.createElement('div', { key: name }, `${name}：${value}`)), button(bindingBusy ? '加载绑定中…' : retryBindingLabel, loadBindings, '', busy || bindingBusy, { busy: bindingBusy })),
          preview && React.createElement('div', { className: 'dsh-api-kit-form dsh-api-kit-preview', 'aria-busy': busy ? 'true' : 'false', 'data-preview-state': previewStale ? 'stale' : 'ready' },
             React.createElement('div', { className: 'dsh-api-kit-preview-summary', role: 'status', 'aria-live': 'polite' },
               React.createElement('div', { className: 'dsh-api-kit-preview-summary-header' }, React.createElement('div', null, React.createElement('h4', null, '已识别 API 定义'), React.createElement('div', { className: 'dsh-api-kit-status' }, safeString(safeRecord(preview.documentMeta).title, 'OpenAPI'))), previewStale && React.createElement('span', { className: 'dsh-api-kit-stale' }, '内容已变化，请重新预览')),
               React.createElement('div', { className: 'dsh-api-kit-preview-stats' },
                 ['version', 'server', 'paths', 'operations', 'new', 'update', 'skip', 'conflict', 'error'].map((key) => React.createElement('div', { key, className: 'dsh-api-kit-preview-stat' }, React.createElement('strong', null, key === 'version' ? previewVersion(preview) : key === 'server' ? safeArray(preview.serverCandidates).length : key === 'paths' ? previewPathCount(preview) : previewCount(preview, key)), React.createElement('span', null, ({ version: '格式/版本', server: 'Servers', paths: 'Paths', operations: 'Operations', new: '新增', update: '更新', skip: '跳过', conflict: '冲突', error: '错误' })[key])))),
               safeArray(previewOperations).slice(0, 8).length > 0 && React.createElement('div', { className: 'dsh-api-kit-preview-operations' }, safeArray(previewOperations).slice(0, 8).map((item) => React.createElement('div', { key: item.sourceKey || item.id, className: 'dsh-api-kit-preview-operation' }, statusBadge(item.method || 'HTTP', 'dsh-api-kit-method'), React.createElement('span', { className: 'dsh-api-kit-code' }, item.path || '/'), React.createElement('span', { className: 'dsh-api-kit-preview-operation-status' }, statusLabel(item.status))))),
             ),
            React.createElement('div', { className: 'dsh-api-kit-status' }, `将导入 ${selectedOperations.length} 个 Operation；写操作仍禁止 Agent 调用。`),
            safeArray(preview.serverCandidates).length > 0 && React.createElement('div', { className: 'dsh-api-kit-warn' }, 'Server 候选（仅显示，不是执行目标）：', safeArray(preview.serverCandidates).map((item, index) => React.createElement('div', { key: item.id || index }, item.id ? `${item.id}（${item.status || '候选'}）` : 'Server 候选已识别；具体地址仅由 Host 在绑定时校验'))),
            safeArray(preview.errors).length > 0 && React.createElement('div', { className: 'dsh-api-kit-invalid', role: 'alert' }, safeArray(preview.errors).slice(0, 10).map((item, index) => React.createElement('div', { key: item.code + item.path + index }, `${item.code}：${item.message}`))),
             filterNotice && React.createElement('div', { className: 'dsh-api-kit-status dsh-api-kit-helper', role: 'status', 'aria-live': 'polite' }, filterNotice),
             selectedTags.length > 0 && importable.length > 0 && selectedOperations.length === 0 && React.createElement('div', { id: 'dsh-api-kit-import-filter-empty', className: 'dsh-api-kit-warn', role: 'status', 'aria-live': 'polite' }, '当前筛选导致 0 个可导入 Operation，请清除 Tag 筛选或重新选择。'),
            activeStep === 'inspect' && React.createElement('div', { className: 'dsh-api-kit-import-footer' }, button(previewStale ? '请重新预览' : '继续配置导入', () => setActiveStep('configure'), 'primary', !preview || previewStale || previewOperations.length === 0)),
            activeStep === 'configure' && React.createElement(React.Fragment, null,
            React.createElement('div', { className: 'dsh-api-kit-import-mode', role: 'radiogroup', 'aria-label': '导入目标' }, React.createElement('label', { htmlFor: 'dsh-api-kit-import-mode-new' }, React.createElement('input', { id: 'dsh-api-kit-import-mode-new', type: 'radio', name: 'dsh-api-kit-import-mode', value: 'new', checked: importMode === 'new', onChange: () => setImportMode('new') }), '新建套件'), React.createElement('label', { htmlFor: 'dsh-api-kit-import-mode-existing' }, React.createElement('input', { id: 'dsh-api-kit-import-mode-existing', type: 'radio', name: 'dsh-api-kit-import-mode', value: 'existing', checked: importMode === 'existing', onChange: () => setImportMode('existing') }), '添加到现有套件')),
             importMode === 'new' && textField('导入套件名称', kitName, setKitName, false, { id: 'dsh-api-kit-import-kit-name', fallback: 'import-kit-name', required: true, placeholder: '例如：Petstore API', help: '导入成功后会在同一事务中创建套件并关联 Operation。' }),
             React.createElement('div', { className: 'dsh-api-kit-import-options' }, React.createElement(CheckboxChipSelect, { id: 'dsh-api-kit-import-tags', label: 'Tag 筛选', description: '不选择特定 Tag 时保留全部可导入 Operation，包括没有 Tag 的 Operation。', options: tagNames.map((tag) => ({ id: tag, label: tag, meta: `${preview.tagCounts[tag]} 个 Operation` })), value: selectedTags, onChange: updateSelectedTags, emptyText: '当前预览没有可筛选的 Tag；将导入所有可导入 Operation。', searchable: tagNames.length > 8, selectAll: true, emptyMeansAll: true, clearLabel: '清除筛选' }),
            React.createElement('div', { className: 'dsh-api-kit-field' }, React.createElement('label', { htmlFor: 'dsh-api-kit-import-target' }, 'Service Target（按 Environment 配置 endpoint）'), React.createElement('select', { id: 'dsh-api-kit-import-target', className: 'dsh-api-kit-control', value: targetId, required: true, disabled: bindingBusy || targets.length === 0, onChange: (event) => setTargetId(event.target.value), 'aria-describedby': 'dsh-api-kit-target-help', 'aria-invalid': !targetId ? 'true' : 'false' }, React.createElement('option', { value: '' }, bindingBusy ? '正在加载 Service Target…' : targets.length === 0 ? '暂无可用 Service Target，请先配置' : '请选择 Service Target'), targets.map((item) => React.createElement('option', { key: item.id, value: item.id, disabled: item.enabled === false }, `${item.name}${item.enabled === false ? '（已停用）' : ''}`))), React.createElement('span', { id: 'dsh-api-kit-target-help', className: 'dsh-api-kit-field-help' }, targets.length === 0 ? 'Service Target 是 Host 侧保存的 API 根地址、环境和认证关联；请先在 API Kit 配置中创建并启用。' : '选择已登记的 API 根地址配置，Server URL 仅用于预览展示。'))),
            React.createElement('label', { className: 'dsh-api-kit-field', htmlFor: 'dsh-api-kit-import-environment' }, '默认 Environment', React.createElement('select', { id: 'dsh-api-kit-import-environment', className: 'dsh-api-kit-control', value: environmentId, onChange: (event) => setEnvironmentId(event.target.value) }, React.createElement('option', { value: '' }, '使用目标默认环境'), environments.map((item) => React.createElement('option', { key: item.id, value: item.id }, `${item.name}${item.production ? '（生产）' : ''}`)))),
            React.createElement(CheckboxChipSelect, { id: 'dsh-api-kit-import-kits', label: '默认 API Kit', description: importMode === 'new' ? '新建套件模式不需要选择现有 Kit；添加到现有套件时可配置。' : '选择至少一个现有 API Kit，导入的 Operation 会关联到这些套件。', options: kits.map((item) => ({ id: item.id, label: item.name, meta: item.enabled === false ? '已停用' : item.agentEnabled === false ? 'Agent 未允许' : `${item.operationCount ?? 0} 个 Operation`, disabled: item.enabled === false || item.agentEnabled === false, disabledReason: item.enabled === false ? '已停用，不能新增关联' : item.agentEnabled === false ? '未允许 Agent 使用，不能新增关联' : '' })), value: kitIds, onChange: setKitIds, emptyText: '暂无可用 API Kit，请先创建或刷新绑定列表。', searchable: kits.length > 8, selectAll: true, disabled: importMode === 'new', clearLabel: '清除选择' }),
            React.createElement('label', { className: 'dsh-api-kit-field', htmlFor: 'dsh-api-kit-import-auth-profile' }, '默认 Auth Profile', React.createElement('select', { id: 'dsh-api-kit-import-auth-profile', className: 'dsh-api-kit-control', value: authProfileId, onChange: (event) => setAuthProfileId(event.target.value) }, React.createElement('option', { value: '' }, '不指定'), authProfiles.map((item) => React.createElement('option', { key: item.id, value: item.id }, `${item.name}（${item.type}）`)))),
             React.createElement('div', { className: 'dsh-api-kit-status dsh-api-kit-helper', role: 'status', 'aria-live': 'polite' }, `将导入 ${selectedOperations.length} 个 Operation；写操作仍禁止 Agent 调用。`),
            React.createElement('div', { className: 'dsh-api-kit-import-conflict-tools' }, React.createElement('span', null, `当前筛选包含 ${selectedConflictItems.length} 个冲突`), React.createElement('div', { className: 'dsh-api-kit-button-row' }, button('全部保留本地', () => setConflicts((current) => ({ ...current, ...Object.fromEntries(selectedConflictItems.map((item) => [item.sourceKey, 'keep-local'])) })), 'secondary', selectedConflictItems.length === 0), button('全部覆盖', () => setConflicts((current) => ({ ...current, ...Object.fromEntries(selectedConflictItems.map((item) => [item.sourceKey, 'overwrite'])) })), 'danger', selectedConflictItems.length === 0), button('全部跳过', () => setConflicts((current) => ({ ...current, ...Object.fromEntries(selectedConflictItems.map((item) => [item.sourceKey, 'skip'])) })), 'secondary', selectedConflictItems.length === 0))),
            selectedConflictItems.slice(0, 50).map((item) => React.createElement('div', { key: item.sourceKey, className: 'dsh-api-kit-field' }, React.createElement('label', { htmlFor: choiceDomId('dsh-api-kit-conflict', item.sourceKey) }, `冲突：${item.operationId}（${item.method} ${item.path}）`), React.createElement('select', { id: choiceDomId('dsh-api-kit-conflict', item.sourceKey), className: 'dsh-api-kit-control', value: conflicts[item.sourceKey] || '', onChange: (event) => setConflicts((current) => ({ ...current, [item.sourceKey]: event.target.value })), 'aria-required': 'true' }, React.createElement('option', { value: '' }, '请选择处理方式'), React.createElement('option', { value: 'keep-local' }, '保留本地'), React.createElement('option', { value: 'overwrite' }, '覆盖导入'), React.createElement('option', { value: 'skip' }, '跳过')))),
            React.createElement('div', { className: 'dsh-api-kit-import-config-footer' }, React.createElement('div', { className: 'dsh-api-kit-status' }, canConfigure ? (conflictsReady ? '配置完整，可以查看变更确认。' : '请先处理当前筛选中的所有冲突。') : '请完成导入目标、筛选和绑定配置。'), button('查看变更确认', () => setActiveStep('confirm'), 'primary', !canConfirm)),
            ),
            activeStep === 'confirm' && React.createElement('section', { className: 'dsh-api-kit-import-review', 'aria-labelledby': 'dsh-api-kit-import-review-title' }, React.createElement('h4', { id: 'dsh-api-kit-import-review-title' }, '确认变更'), React.createElement('p', { className: 'dsh-api-kit-muted' }, '导入前检查一次性写入本地 Registry 的影响范围。'), React.createElement('div', { className: 'dsh-api-kit-import-review-grid' }, React.createElement('div', null, React.createElement('strong', null, '导入目标'), React.createElement('span', null, importMode === 'new' ? `新建套件：${kitName.trim() || '未命名'}` : `现有套件：${selectedKitNames.join('、') || '未选择'}`)), React.createElement('div', null, React.createElement('strong', null, 'Service Target'), React.createElement('span', null, targetName || '未选择')), React.createElement('div', null, React.createElement('strong', null, 'Environment'), React.createElement('span', null, environmentName)), React.createElement('div', null, React.createElement('strong', null, 'Operation 范围'), React.createElement('span', null, `${selectedOperations.length} 个；${selectedStatusSummary}`)), React.createElement('div', null, React.createElement('strong', null, '冲突处理'), React.createElement('span', null, `${selectedConflictItems.length} 个冲突，已处理 ${selectedConflictItems.filter((item) => conflicts[item.sourceKey]).length} 个`)), React.createElement('div', null, React.createElement('strong', null, '写操作风险'), React.createElement('span', null, selectedWriteCount > 0 ? `${selectedWriteCount} 个可能产生副作用的操作；默认禁止 Agent 调用。` : '当前筛选未发现写操作。'))), React.createElement('div', { className: 'dsh-api-kit-warn' }, '这是一次性写入本地 Registry 的导入；覆盖决策会替换对应的本地 Operation 定义。Server URL 仅用于预览展示，不是执行目标。'), React.createElement('div', { className: 'dsh-api-kit-import-review-actions' }, button('返回配置', () => setActiveStep('configure'), 'secondary'), button(busy ? '导入中…' : (importMode === 'new' ? '导入到新套件' : '导入到现有套件'), requestConfirmation, 'primary', !canConfirm, { busy, ariaLabel: '打开导入变更确认' }))),
            confirming && React.createElement('div', { className: 'dsh-api-kit-import-confirmation-backdrop' }, React.createElement('section', { ref: confirmationDialogRef, className: 'dsh-api-kit-import-confirmation', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dsh-api-kit-confirmation-title', 'aria-describedby': 'dsh-api-kit-confirmation-description', 'aria-busy': busy ? 'true' : 'false' }, React.createElement('h4', { id: 'dsh-api-kit-confirmation-title' }, '确认导入变更'), React.createElement('p', { id: 'dsh-api-kit-confirmation-description' }, `将${importMode === 'new' ? '新建套件并' : ''}写入 ${selectedOperations.length} 个 Operation；其中 ${selectedWriteCount} 个可能产生副作用。`), React.createElement('p', null, '请确认当前目标、筛选和冲突处理无误。取消不会修改本地 Registry。'), React.createElement('div', { className: 'dsh-api-kit-import-review-actions' }, button('取消', () => { setConfirming(false); confirmTriggerRef.current?.focus?.() }, 'secondary'), button('确认并导入', executeConfirm, 'primary', busy, { busy, ariaLabel: '确认并导入 OpenAPI 变更' })))),            result && React.createElement('div', { className: 'dsh-api-kit-warn', role: 'status', 'aria-live': 'polite' }, `导入完成：新增 ${result.applied?.created || 0}、更新 ${result.applied?.updated || 0}、跳过 ${result.applied?.skipped || 0}、保留 ${result.applied?.kept || 0}`),
            React.createElement('div', null, button(busy ? '导入中…' : '导入到套件', () => { setActiveStep('confirm') }, 'primary', !canConfirm, { busy, ariaLabel: '查看并确认导入选中的 Operation' })),
          ),
        )
      }

      function Settings() {
        const [kits, setKits] = React.useState([])
        const [operations, setOperations] = React.useState([])
        const [targets, setTargets] = React.useState([])
        const [environments, setEnvironments] = React.useState([])
        const [authProfiles, setAuthProfiles] = React.useState([])
         const [authListBusy, setAuthListBusy] = React.useState(false)
         const [authListError, setAuthListError] = React.useState(null)
          const authRequestRef = React.useRef(0)
         const [expandedEndpointIds, setExpandedEndpointIds] = React.useState([])
          const [expandedOperationList, setExpandedOperationList] = React.useState(false)
          const [expandedTargetList, setExpandedTargetList] = React.useState(false)
          const [settingsGroups, setSettingsGroups] = React.useState(SETTINGS_GROUP_DEFAULTS)
          const settingsGroupsTouchedRef = React.useRef(false)
          const settingsGroupsInitializedRef = React.useRef(false)
         const [loaded, setLoaded] = React.useState({ kits: false, operations: false, targets: false, environments: false })
          const [hasLoadedOnce, setHasLoadedOnce] = React.useState(false)
          const settingsInitialLoadingRef = React.useRef(true)
         const [targetForm, setTargetForm] = React.useState(null)
        const [environmentForm, setEnvironmentForm] = React.useState(null)
        const [selectedKit, setSelectedKit] = React.useState(null)
        const [editingOperation, setEditingOperation] = React.useState(null)
        const [form, setForm] = React.useState(null)
         const [formSnapshot, setFormSnapshot] = React.useState('')
         const [pendingFormAction, setPendingFormAction] = React.useState(null)
         const [discardDialogOpen, setDiscardDialogOpen] = React.useState(false)
         const [writeConfirming, setWriteConfirming] = React.useState(false)
         const writeConfirmTriggerRef = React.useRef(null)
        const [kitName, setKitName] = React.useState('')
        const [busy, setBusy] = React.useState(false)
        const [error, setError] = React.useState(null)
        const [notice, setNotice] = React.useState(null)
         const [deleteRequest, setDeleteRequest] = React.useState(null)
         const [deleteConfirmationInput, setDeleteConfirmationInput] = React.useState('')
         const [deleteDialogError, setDeleteDialogError] = React.useState(null)
         const deleteTriggerRef = React.useRef(null)
         const deleteRequestRef = React.useRef(0)
         const deleteDialogRef = React.useRef(null)
        const mountedRef = React.useRef(true)
        const requestRef = React.useRef(0)
        React.useEffect(() => () => { mountedRef.current = false; requestRef.current += 1 }, [])

        const refresh = React.useCallback(async () => {
          const requestId = ++requestRef.current
          setBusy(true); setError(null)
          const names = ['kits', 'operations', 'targets', 'environments']
          const loaders = [() => call('listKits'), () => call('listOperations'), () => call('listServiceTargets'), () => call('listEnvironments')]
          const values = await Promise.all(loaders.map(async (loader, index) => {
            try { return { name: names[index], value: await loader() } } catch (cause) { return { name: names[index], error: errorText(cause) } }
          }))
          if (!mountedRef.current || requestId !== requestRef.current) return
          const failures = values.filter((item) => item.error)
           setLoaded(Object.fromEntries(values.map((item) => [item.name, !item.error])))
           setHasLoadedOnce(true); settingsInitialLoadingRef.current = false
          if (failures.length > 0) setError(`部分数据加载失败：${failures.map((item) => `${item.name}（${item.error}）`).join('、')}。请重试。`)
          else setError(null)
          for (const item of values) {
            if (item.error) continue
            if (item.name === 'kits') setKits(Array.isArray(item.value) ? item.value : [])
            else if (item.name === 'operations') setOperations(Array.isArray(item.value) ? item.value : [])
            else if (item.name === 'targets') setTargets(Array.isArray(item.value) ? item.value : [])
            else if (item.name === 'environments') setEnvironments(Array.isArray(item.value) ? item.value : [])
          }
          const kitResult = values.find((item) => item.name === 'kits')
           if (!kitResult?.error) {
             const nextKits = Array.isArray(kitResult?.value) ? kitResult.value : []
          setSelectedKit((current) => current && nextKits.some((kit) => kit.id === current) ? current : (nextKits[0]?.id || null))
             }
          setBusy(false)
        }, [])
        const loadAuthProfiles = async () => {
           if (authListBusy) return
           const requestId = ++authRequestRef.current
           setAuthListBusy(true); setAuthListError(null)
           try {
             const value = await call('listAuthProfiles')
             if (mountedRef.current && requestId === authRequestRef.current) setAuthProfiles(Array.isArray(value) ? value : [])
           } catch (cause) {
             if (mountedRef.current && requestId === authRequestRef.current) setAuthListError(errorText(cause))
           } finally { if (mountedRef.current && requestId === authRequestRef.current) setAuthListBusy(false) }
         }
         React.useEffect(() => { void refresh() }, [refresh])
        React.useEffect(() => {
          window.addEventListener(CONFIG_EVENT, refresh)
          return () => window.removeEventListener(CONFIG_EVENT, refresh)
        }, [refresh])

        const requestOperationSave = () => { if (!form || busy || !formDirty) return; if (form.policy?.allowWrite === true) { writeConfirmTriggerRef.current = typeof document !== 'undefined' ? document.activeElement : null; setWriteConfirming(true) } else void saveOperation() }
         const activeKit = kits.find((kit) => kit.id === selectedKit)
         const summary = settingsSummary(kits, operations, targets, environments, loaded)
         const settingsLoading = settingsInitialLoadingRef.current || !hasLoadedOnce
          React.useEffect(() => {
            if (settingsGroupsInitializedRef.current || !hasLoadedOnce || settingsGroupsTouchedRef.current) return
            settingsGroupsInitializedRef.current = true
            setSettingsGroups(kits.length > 0 ? { import: false, connection: false, workbench: true } : SETTINGS_GROUP_DEFAULTS)
          }, [hasLoadedOnce, kits.length])
          const toggleSettingsGroup = (group) => {
            settingsGroupsTouchedRef.current = true
            setSettingsGroups((current) => ({ ...current, [group]: !current[group] }))
          }
         const loadingState = (label) => React.createElement('div', { className: 'dsh-api-kit-loading', role: 'status', 'aria-live': 'polite' }, label)
         const safeKitOperationIds = activeKit && Array.isArray(activeKit.operationIds) ? activeKit.operationIds : []
        const kitOperations = activeKit ? operations.filter((operation) => safeKitOperationIds.includes(operation.id)) : []
         const visibleKitOperations = expandedOperationList ? kitOperations : kitOperations.slice(0, SETTINGS_LIST_INITIAL_LIMIT)
         const progressiveListControl = (kind, total, expanded, setExpanded) => total > SETTINGS_LIST_INITIAL_LIMIT && React.createElement('div', { className: 'dsh-api-kit-list-reveal' }, button(expanded ? `收起${kind}` : `显示全部${kind}（还有 ${total - SETTINGS_LIST_INITIAL_LIMIT} 个）`, () => setExpanded((current) => !current), 'secondary', false, { ariaLabel: expanded ? `收起${kind}列表` : `显示全部${kind}列表`, ariaPressed: expanded }))
        const patchForm = (key, value) => setForm((current) => ({ ...current, [key]: value, errors: current.errors ? { ...current.errors, [key]: null } : current.errors }))
        const createKit = async () => {
          if (busy) return
          const name = kitName.trim()
          const id = name.toLowerCase().replace(/[^a-z0-9._:-]+/g, '-')
          if (!id) { setError('请输入 API Kit 名称。'); return }
          try { setBusy(true); setError(null); await call('createKit', { input: { id, name, operationIds: [] } }); setKitName(''); setNotice('API Kit 已创建。'); notifyConfigChanged(); await refresh(); setSelectedKit(id) } catch (cause) { setError(errorText(cause)) } finally { if (mountedRef.current) setBusy(false) }
        }
        const makeNewOperationForm = () => ({ id: '', operationId: '', name: '', method: 'GET', path: '/', serviceTargetId: targets.find((item) => item.enabled !== false)?.id || '', summary: '', description: '', tags: '', enabled: true, kitIds: selectedKit ? [selectedKit] : [], parameters: '[]', requestBody: '', responses: '{}', errors: {}, policy: { allowAgentCall: true, allowWrite: false, requiresConfirmation: false } })
         const openOperationForm = (next, editing = null) => { setEditingOperation(editing); setForm(next); setFormSnapshot(operationFormFingerprint(next)); setPendingFormAction(null); setDiscardDialogOpen(false) }
         const newOperation = () => openOperationForm(makeNewOperationForm())
        const editOperation = async (id) => {
          try {
            const item = await call('getOperation', { id })
            setEditingOperation(id)
            const next = { ...item, tags: (item.tags || []).join(', '), kitIds: item.kitIds || [], parameters: JSON.stringify(item.parameters || [], null, 2), requestBody: item.requestBody ? JSON.stringify(item.requestBody, null, 2) : '', responses: JSON.stringify(item.responses || {}, null, 2), errors: {}, policy: { allowAgentCall: item.policy?.allowAgentCall === true, allowWrite: item.policy?.allowWrite === true, requiresConfirmation: item.policy?.requiresConfirmation === true } }
             openOperationForm(next, id)
          } catch (cause) { setError(errorText(cause)) }
        }
        const formDirty = Boolean(form && operationFormFingerprint(form) !== formSnapshot)
         const requestFormAction = (action, trigger = null) => { if (!form || !formDirty) { action(); return } writeConfirmTriggerRef.current = trigger || (typeof document !== 'undefined' ? document.activeElement : null); setPendingFormAction(() => action); setDiscardDialogOpen(true) }
         const discardAndContinue = () => { const action = pendingFormAction; setPendingFormAction(null); setDiscardDialogOpen(false); setForm(null); setFormSnapshot(''); setEditingOperation(null); if (typeof action === 'function') action() }
         const cancelFormAction = () => { setPendingFormAction(null); setDiscardDialogOpen(false); writeConfirmTriggerRef.current?.focus?.() }
         const saveOperation = async () => {
          const parsedParameters = parseJsonValue(form.parameters, 'Parameters', [])
          const parsedBody = parseJsonValue(form.requestBody, 'Request Body', null)
          const parsedResponses = parseJsonValue(form.responses, 'Responses', {})
          const formErrors = { parameters: parsedParameters.ok ? null : parsedParameters.error, requestBody: parsedBody.ok ? null : parsedBody.error, responses: parsedResponses.ok ? null : parsedResponses.error }
          if (Object.values(formErrors).some(Boolean)) { setForm((current) => ({ ...current, errors: formErrors })); setError('请先修正表单中的 JSON 错误。'); return }
          const input = { id: form.id, operationId: form.operationId || form.id, name: form.name, method: form.method, path: form.path, serviceTargetId: form.serviceTargetId, summary: form.summary, description: form.description, tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean), enabled: form.enabled, kitIds: form.kitIds, parameters: parsedParameters.value, requestBody: parsedBody.value, responses: parsedResponses.value, policy: form.policy }
          try { setBusy(true); if (editingOperation) await call('updateOperation', { id: editingOperation, patch: input }); else await call('createOperation', { input }); const savedName = input.name || input.operationId; setForm(null); setFormSnapshot(''); setEditingOperation(null); setWriteConfirming(false); setNotice(`Operation“${savedName}”${editingOperation ? '已更新，下次 Agent 调用时生效。' : '已创建；当前写入策略仍由 Host 在调用时再次校验。'}`); notifyConfigChanged(); await refresh() } catch (cause) { setError(errorText(cause)) } finally { if (mountedRef.current) setBusy(false) }
        }
        const blankEnvironment = () => ({ id: '', name: '', description: '', production: false, agentEnabled: true, enabled: true })
        const blankTarget = () => ({ id: '', name: '', description: '', environmentIds: [], defaultEnvironmentId: '', authProfileIds: [], endpoints: {}, enabled: true, agentEnabled: true })
         const domIdSegment = (value) => Array.from(String(value)).map((character) => character.codePointAt(0).toString(16).padStart(6, '0')).join('-') || 'value'
          const endpointDomId = (environmentId) => `dsh-api-kit-endpoint-${domIdSegment(environmentId)}`
         const initialExpandedEndpointIds = (target) => {
           const ids = Array.isArray(target?.environmentIds) ? target.environmentIds : []
           const endpoints = safeRecord(target?.endpoints)
           const preferred = target?.defaultEnvironmentId && ids.includes(target.defaultEnvironmentId) ? target.defaultEnvironmentId : ids[0]
           return ids.filter((id) => id === preferred || !safeString(safeRecord(endpoints[id]).baseUrl))
         }
         const openTargetEditor = (next) => { setTargetForm(next); setExpandedEndpointIds(initialExpandedEndpointIds(next)); setAuthListError(null); setAuthListBusy(false); void loadAuthProfiles() }
        const editEnvironment = (item) => setEnvironmentForm({ id: item.id || '', name: item.name || '', description: item.description || '', production: item.production === true, agentEnabled: item.agentEnabled !== false, enabled: item.enabled !== false, editing: true, originalId: item.id })
        const editTarget = (item) => { const next = { ...item, environmentIds: Array.isArray(item.environmentIds) ? item.environmentIds : [], authProfileIds: Array.isArray(item.authProfileIds) ? item.authProfileIds : [], endpoints: item.endpoints && typeof item.endpoints === 'object' ? item.endpoints : {}, editing: true, originalId: item.id }; setTargetForm(next); setExpandedEndpointIds(initialExpandedEndpointIds(next)); setAuthListError(null); void loadAuthProfiles() }
         const endpointFor = (target, environmentId) => ({ ...(target?.endpoints?.[environmentId] || {}), environmentId })
         const patchTargetEndpoint = (environmentId, key, value) => setTargetForm((current) => ({ ...current, endpoints: { ...(current.endpoints || {}), [environmentId]: { ...endpointFor(current, environmentId), [key]: value } } }))
         const endpointValue = (endpoint, key) => key === 'allowedCidrs' || key === 'allowedHosts' ? (Array.isArray(endpoint[key]) ? endpoint[key].join('\\n') : safeString(endpoint[key])) : (endpoint[key] ?? '')
         const legacyEndpointFields = (environmentId) => { const endpoint = endpointFor(targetForm, environmentId); const id = `dsh-api-kit-legacy-endpoint-${domIdSegment(environmentId)}`; return React.createElement('fieldset', { key: environmentId, className: 'dsh-api-kit-endpoint' }, React.createElement('legend', null, `Environment Endpoint · ${environments.find((item) => item.id === environmentId)?.name || environmentId}`), textField('Endpoint baseUrl', endpointValue(endpoint, 'baseUrl'), (value) => patchTargetEndpoint(environmentId, 'baseUrl', value), false, { id: `dsh-api-kit-legacy-endpoint-${domIdSegment(environmentId)}-base-url`, required: true, placeholder: 'https://api.example.com/v1' }), textField('允许访问的 Host（每行一个）', endpointValue(endpoint, 'allowedHosts'), (value) => patchTargetEndpoint(environmentId, 'allowedHosts', value), true, { id: `dsh-api-kit-legacy-endpoint-${domIdSegment(environmentId)}-allowed-hosts` }), textField('允许访问的私网网段（CIDR）', endpointValue(endpoint, 'allowedCidrs'), (value) => patchTargetEndpoint(environmentId, 'allowedCidrs', value), true, { id: `dsh-api-kit-legacy-endpoint-${domIdSegment(environmentId)}-allowed-cidrs` }), React.createElement('label', { className: 'dsh-api-kit-check', htmlFor: `${id}-allow-private-network` }, React.createElement('input', { id: `${id}-allow-private-network`, type: 'checkbox', checked: endpoint.allowPrivateNetwork === true, onChange: (event) => patchTargetEndpoint(environmentId, 'allowPrivateNetwork', event.target.checked) }), '允许内网地址'), textField('端口（可选）', endpointValue(endpoint, 'port'), (value) => patchTargetEndpoint(environmentId, 'port', value), false, { id: `dsh-api-kit-legacy-endpoint-${domIdSegment(environmentId)}-port` }), textField('超时毫秒（可选）', endpointValue(endpoint, 'timeoutMs'), (value) => patchTargetEndpoint(environmentId, 'timeoutMs', value), false, { id: `dsh-api-kit-legacy-endpoint-${domIdSegment(environmentId)}-timeout` }), textField('最大响应字节（可选）', endpointValue(endpoint, 'maxResponseBytes'), (value) => patchTargetEndpoint(environmentId, 'maxResponseBytes', value), false, { id: `dsh-api-kit-legacy-endpoint-${domIdSegment(environmentId)}-max-response-bytes` }), textField('最大重定向次数（可选）', endpointValue(endpoint, 'maxRedirects'), (value) => patchTargetEndpoint(environmentId, 'maxRedirects', value), false, { id: `dsh-api-kit-legacy-endpoint-${domIdSegment(environmentId)}-max-redirects` }), React.createElement('label', { className: 'dsh-api-kit-check', htmlFor: `${id}-allow-privileged-port` }, React.createElement('input', { id: `${id}-allow-privileged-port`, type: 'checkbox', checked: endpoint.allowPrivilegedPort === true, onChange: (event) => patchTargetEndpoint(environmentId, 'allowPrivilegedPort', event.target.checked) }), '允许特权端口')) }

        const endpointFields = (environmentId) => {
           const endpoint = endpointFor(targetForm, environmentId)
           const environment = environments.find((item) => item.id === environmentId)
           const id = endpointDomId(environmentId)
           const expanded = expandedEndpointIds.includes(environmentId)
           const hasBaseUrl = Boolean(safeString(endpoint.baseUrl).trim())
           const warningParts = []
           if (environment?.production) warningParts.push('生产环境：保存前请确认目标地址和访问范围。')
           if (endpoint.allowPrivateNetwork === true) warningParts.push('已允许内网地址；Host 保存和执行时仍会继续安全校验。')
           if (endpoint.allowPrivilegedPort === true) warningParts.push('已允许特权端口；请确认这是必要的网络策略。')
           return React.createElement('div', { key: environmentId, className: 'dsh-api-kit-endpoint' },
             React.createElement('div', { className: 'dsh-api-kit-endpoint-summary' }, React.createElement('div', null, React.createElement('h5', null, `${environment?.name || environmentId} 环境的 Endpoint`), React.createElement('p', { className: (!hasBaseUrl ? 'dsh-api-kit-endpoint-missing ' : '') + 'dsh-api-kit-endpoint-url' }, `${hasBaseUrl ? '已配置 Endpoint' : '待配置 Endpoint；请填写 baseUrl'}`), environment?.production && React.createElement('p', null, '生产环境 · Agent 可用性由 Environment 与 Host 策略共同决定。')), React.createElement('button', { type: 'button', className: 'dsh-api-kit-button secondary dsh-api-kit-endpoint-trigger', 'aria-expanded': expanded ? 'true' : 'false', 'aria-controls': id, onClick: () => setExpandedEndpointIds((current) => current.includes(environmentId) ? current.filter((item) => item !== environmentId) : [...current, environmentId]) }, expanded ? '收起 Endpoint' : '展开 Endpoint')),
             React.createElement('div', { id, className: 'dsh-api-kit-endpoint-panel', hidden: !expanded },
               textField('Endpoint baseUrl', endpointValue(endpoint, 'baseUrl'), (value) => patchTargetEndpoint(environmentId, 'baseUrl', value), false, { id: `${id}-base-url`, fallback: `endpoint-${environmentId}-base-url`, required: true, placeholder: 'https://api.example.com/v1', help: '仅保存为该 Service Target 在此 Environment 下的执行地址；不会从 OpenAPI Server 自动填充。' }),
               textField('超时毫秒', endpointValue(endpoint, 'timeoutMs'), (value) => patchTargetEndpoint(environmentId, 'timeoutMs', value), false, { id: `${id}-timeout`, fallback: `endpoint-${environmentId}-timeout`, placeholder: '使用 Host 默认值', help: '留空时由 Host 使用安全默认值。' }),
               warningParts.length > 0 && React.createElement('div', { className: 'dsh-api-kit-endpoint-warning' }, warningParts.join(' ')),
               React.createElement('details', { className: 'dsh-api-kit-endpoint-advanced', id: `${id}-advanced` }, React.createElement('summary', null, '高级网络策略'), React.createElement('div', { className: 'dsh-api-kit-endpoint-advanced-content' }, textField('允许访问的 Host（每行一个）', endpointValue(endpoint, 'allowedHosts'), (value) => patchTargetEndpoint(environmentId, 'allowedHosts', value), true, { id: `${id}-allowed-hosts`, fallback: `endpoint-${environmentId}-allowed-hosts`, help: 'Host 白名单由 Host 用于 SSRF 防护。' }), textField('允许访问的私网网段（CIDR）', endpointValue(endpoint, 'allowedCidrs'), (value) => patchTargetEndpoint(environmentId, 'allowedCidrs', value), true, { id: `${id}-allowed-cidrs`, fallback: `endpoint-${environmentId}-allowed-cidrs` }), React.createElement('label', { className: 'dsh-api-kit-check', htmlFor: `${id}-allow-private-network` }, React.createElement('input', { id: `${id}-allow-private-network`, type: 'checkbox', checked: endpoint.allowPrivateNetwork === true, onChange: (event) => patchTargetEndpoint(environmentId, 'allowPrivateNetwork', event.target.checked) }), '允许内网地址'), textField('端口（可选）', endpointValue(endpoint, 'port'), (value) => patchTargetEndpoint(environmentId, 'port', value), false, { id: `${id}-port`, fallback: `endpoint-${environmentId}-port` }), textField('最大响应字节（可选）', endpointValue(endpoint, 'maxResponseBytes'), (value) => patchTargetEndpoint(environmentId, 'maxResponseBytes', value), false, { id: `${id}-max-response-bytes`, fallback: `endpoint-${environmentId}-max-response-bytes` }), textField('最大重定向次数（可选）', endpointValue(endpoint, 'maxRedirects'), (value) => patchTargetEndpoint(environmentId, 'maxRedirects', value), false, { id: `${id}-max-redirects`, fallback: `endpoint-${environmentId}-max-redirects` }), React.createElement('label', { className: 'dsh-api-kit-check', htmlFor: `${id}-allow-privileged-port` }, React.createElement('input', { id: `${id}-allow-privileged-port`, type: 'checkbox', checked: endpoint.allowPrivilegedPort === true, onChange: (event) => patchTargetEndpoint(environmentId, 'allowPrivilegedPort', event.target.checked) }), '允许特权端口'))),
             ),
           )
         }

         const requestDelete = (kind, item, trigger = null) => {
           if (busy || deleteRequest) return
           const impact = deleteImpact(kind, item, { kits, operations, targets, environments, loaded, form, formDirty, editingOperation })
           deleteTriggerRef.current = trigger || (typeof document !== 'undefined' ? document.activeElement : null)
           deleteRequestRef.current += 1
           setDeleteConfirmationInput('')
           setDeleteDialogError(null)
           setDeleteRequest({ ...impact, requestId: deleteRequestRef.current })
         }
         const cancelDelete = () => {
           if (deleteRequest?.deleting) return
           setDeleteRequest(null)
           setDeleteConfirmationInput('')
           setDeleteDialogError(null)
           deleteTriggerRef.current?.focus?.()
         }
         const confirmDelete = async () => {
           const request = deleteRequest
           if (!request || request.deleting || busy) return
           if (request.requiresTypedConfirmation && deleteConfirmationInput.trim() !== '删除') {
             setDeleteDialogError('请输入“删除”以确认此操作。')
             return
           }
           const method = DELETE_METHODS[request.kind]
           if (!method) return
           const requestId = request.requestId
           setDeleteRequest((current) => current && current.requestId === requestId ? { ...current, deleting: true, error: null } : current)
           setDeleteDialogError(null)
           setBusy(true)
           try {
             const deleted = await call(method, { id: request.id })
             if (deleted !== true) {
               if (mountedRef.current && deleteRequestRef.current === requestId) {
                 setDeleteRequest((current) => current && current.requestId === requestId ? { ...current, deleting: false } : current)
                 setDeleteDialogError(errorText({ code: `${request.kind === 'environment' ? 'ENVIRONMENT' : request.kind === 'target' ? 'TARGET' : request.kind === 'kit' ? 'KIT' : 'OPERATION'}_NOT_FOUND` }))
               }
               return
             }
             if (!mountedRef.current || deleteRequestRef.current !== requestId) return
             setDeleteRequest(null)
             setDeleteConfirmationInput('')
             setDeleteDialogError(null)
             if (request.kind === 'operation' && editingOperation === request.id) { setForm(null); setFormSnapshot(''); setEditingOperation(null) }
             if (request.kind === 'kit' && selectedKit === request.id) { setSelectedKit(null); setForm(null); setFormSnapshot(''); setEditingOperation(null) }
             setNotice(`${DELETE_KIND_LABELS[request.kind]}“${request.name}”已删除。`)
             notifyConfigChanged()
             await refresh()
             deleteTriggerRef.current?.focus?.()
           } catch (cause) {
             if (mountedRef.current && deleteRequestRef.current === requestId) {
               setDeleteRequest((current) => current && current.requestId === requestId ? { ...current, deleting: false } : current)
               setDeleteDialogError(deleteErrorText(cause))
             }
           } finally {
             if (mountedRef.current) setBusy(false)
           }
         }
         const removeEnvironment = (id, trigger) => {
           const item = environments.find((candidate) => candidate.id === id) || { id, name: id }
           requestDelete('environment', item, trigger)
         }
         const removeTarget = (id, trigger) => {
           const item = targets.find((candidate) => candidate.id === id) || { id, name: id }
           requestDelete('target', item, trigger)
         }
         const saveEnvironment = async () => {
           const value = { id: environmentForm.id.trim(), name: environmentForm.name.trim(), description: environmentForm.description.trim(), production: environmentForm.production === true, agentEnabled: environmentForm.agentEnabled !== false, enabled: environmentForm.enabled !== false }
          if (!value.id || !value.name) { setError('请填写 Environment 名称和 ID。'); return }
          try { setBusy(true); setError(null); if (environmentForm.editing) await call('updateEnvironment', { id: environmentForm.originalId, patch: value }); else await call('createEnvironment', { input: value }); setEnvironmentForm(null); setNotice(environmentForm.editing ? 'Environment 已更新。' : 'Environment 已创建。'); notifyConfigChanged(); await refresh() } catch (cause) { setError(errorText(cause)) } finally { if (mountedRef.current) setBusy(false) }
        }
        const saveTarget = async () => {
          const endpoints = Object.fromEntries((targetForm.environmentIds || []).map((environmentId) => { const endpoint = endpointFor(targetForm, environmentId); return [environmentId, { ...endpoint, baseUrl: String(endpoint.baseUrl || '').trim(), allowedHosts: String(endpoint.allowedHosts || '').split(/[\n,]+/).map((item) => item.trim()).filter(Boolean), allowedCidrs: String(endpoint.allowedCidrs || '').split(/[\n,]+/).map((item) => item.trim()).filter(Boolean), port: endpoint.port === '' ? undefined : Number(endpoint.port), timeoutMs: endpoint.timeoutMs === '' ? undefined : Number(endpoint.timeoutMs), maxResponseBytes: endpoint.maxResponseBytes === '' ? undefined : Number(endpoint.maxResponseBytes), maxRedirects: endpoint.maxRedirects === '' ? undefined : Number(endpoint.maxRedirects) } ] }))
           const value = { id: targetForm.id.trim(), name: targetForm.name.trim(), description: targetForm.description.trim(), environmentIds: targetForm.environmentIds, defaultEnvironmentId: targetForm.defaultEnvironmentId || undefined, authProfileIds: Array.isArray(targetForm.authProfileIds) ? targetForm.authProfileIds : [], endpoints, enabled: targetForm.enabled !== false, agentEnabled: targetForm.agentEnabled !== false }
          if (!value.id || !value.name) { setError('请填写 Service Target 名称和 ID。'); return }
          if (value.environmentIds.length === 0) { setError('Service Target 至少要绑定一个 Environment。'); return }
          try { setBusy(true); setError(null); if (targetForm.editing) await call('updateServiceTarget', { id: targetForm.originalId, patch: value }); else await call('createServiceTarget', { input: value }); setTargetForm(null); setNotice(targetForm.editing ? 'Service Target 已更新。' : 'Service Target 已创建。'); notifyConfigChanged(); await refresh() } catch (cause) { setError(errorText(cause)) } finally { if (mountedRef.current) setBusy(false) }
        }
        const removeKit = (trigger) => {
           if (!activeKit) return
           requestDelete('kit', activeKit, trigger)
         }
         const removeOperation = (id, trigger) => {
           const item = kitOperations.find((candidate) => candidate.id === id) || operations.find((candidate) => candidate.id === id) || { id, name: id }
           requestDelete('operation', item, trigger)
         }
        const toggleOperation = async (operation) => {
          if (busy) return
          try { setBusy(true); setError(null); await call('setOperationEnabled', { id: operation.id, enabled: !operation.enabled }); setNotice(operation.enabled ? 'Operation 已禁用。' : 'Operation 已启用。'); notifyConfigChanged(); await refresh() } catch (cause) { setError(errorText(cause)) } finally { if (mountedRef.current) setBusy(false) }
        }

        const connectionTestNote = React.createElement('div', { className: 'dsh-api-kit-connection-note', role: 'note' }, '当前版本没有可用的安全连接测试 RPC。页面只保存配置，不会直接发起网络请求；真实请求仍由 Host 在 Operation 调用时按固定 Service Target、Environment、allowlist/CIDR、SSRF、认证、超时、响应大小、重定向和审计策略校验。')
         const environmentCards = !loaded.environments && settingsLoading ? loadingState('正在加载 Environment…') : environments.length === 0 ? React.createElement('div', { className: 'dsh-api-kit-connection-empty' }, '暂无 Environment；请先添加一个环境。') : environments.map((item) => { const targetCount = targets.filter((target) => Array.isArray(target.environmentIds) && target.environmentIds.includes(item.id)).length; return React.createElement('div', { key: item.id, className: 'dsh-api-kit-connection-item' }, React.createElement('div', { className: 'dsh-api-kit-connection-item-title' }, item.name), React.createElement('div', { className: 'dsh-api-kit-connection-item-meta' }, `${item.enabled === false ? '已停用' : item.production ? '生产环境' : '可用'} · ${item.agentEnabled === false ? 'Agent 默认不可用' : 'Agent 可用'} · ${targetCount} 个服务目标`), React.createElement('div', { className: 'dsh-api-kit-detail-actions' }, button('编辑', () => editEnvironment(item), 'secondary'), button('删除', (event) => removeEnvironment(item.id, event.currentTarget), 'danger'))) })
        const visibleTargets = expandedTargetList ? targets : targets.slice(0, SETTINGS_LIST_INITIAL_LIMIT)
         const targetCards = !loaded.targets && settingsLoading ? loadingState('正在加载 Service Target…') : targets.length === 0 ? React.createElement('div', { className: 'dsh-api-kit-connection-empty' }, '暂无 Service Target；请先创建 Environment，再创建并绑定服务目标。') : visibleTargets.map((item) => { const envIds = Array.isArray(item.environmentIds) ? item.environmentIds : []; const envNames = envIds.map((id) => environments.find((env) => env.id === id)?.name || id).join('、'); const endpointCount = envIds.filter((id) => safeString(safeRecord(item.endpoints?.[id]).baseUrl)).length; const operationCount = operations.filter((operation) => operation.serviceTargetId === item.id).length; return React.createElement('div', { key: item.id, className: 'dsh-api-kit-connection-item' }, React.createElement('div', { className: 'dsh-api-kit-connection-item-title' }, item.name), React.createElement('div', { className: 'dsh-api-kit-connection-item-meta' }, `${envNames || '未绑定 Environment'} · ${endpointCount}/${envIds.length} 个 Endpoint 已配置 · ${operationCount} 个 Operation`), React.createElement('div', { className: 'dsh-api-kit-connection-item-meta' }, `${item.enabled === false ? '已停用' : '可用'} · ${item.agentEnabled === false ? 'Agent 不可用' : 'Agent 可用'}`), React.createElement('div', { className: 'dsh-api-kit-detail-actions' }, button('编辑', () => editTarget(item), 'secondary'), button('删除', (event) => removeTarget(item.id, event.currentTarget), 'danger'))) })
        const environmentEditor = environmentForm && React.createElement('div', { className: 'dsh-api-kit-connection-form' }, textField('Environment ID', environmentForm.id, (value) => setEnvironmentForm((current) => ({ ...current, id: value })), false, { id: 'dsh-api-kit-environment-id', required: true, disabled: environmentForm.editing }), textField('名称', environmentForm.name, (value) => setEnvironmentForm((current) => ({ ...current, name: value })), false, { id: 'dsh-api-kit-environment-name', required: true }), React.createElement('p', { className: 'dsh-api-kit-field-help' }, 'Environment 仅描述部署环境；API endpoint 与网络访问策略按 Service Target 分环境配置。'), textField('说明', environmentForm.description, (value) => setEnvironmentForm((current) => ({ ...current, description: value })), false, { id: 'dsh-api-kit-environment-description' }), React.createElement('label', { className: 'dsh-api-kit-check', htmlFor: 'dsh-api-kit-environment-production' }, React.createElement('input', { id: 'dsh-api-kit-environment-production', type: 'checkbox', checked: environmentForm.production, onChange: (event) => setEnvironmentForm((current) => ({ ...current, production: event.target.checked })) }), '生产环境'), React.createElement('div', { className: 'dsh-api-kit-detail-actions' }, button('取消', () => setEnvironmentForm(null), 'secondary'), button(environmentForm.editing ? '保存 Environment' : '创建 Environment', saveEnvironment, 'primary', busy, { busy })))
        const targetEditor = targetForm && React.createElement('div', { className: 'dsh-api-kit-connection-form dsh-api-kit-target-editor' }, React.createElement('div', { className: 'dsh-api-kit-connection-group-header' }, React.createElement('div', null, React.createElement('h4', null, targetForm.editing ? '编辑 Service Target' : '新建 Service Target'), React.createElement('p', null, '先绑定 Environment，再为每个环境配置 Endpoint；保存前由 Host 执行完整安全校验。'))), textField('Service Target ID', targetForm.id, (value) => setTargetForm((current) => ({ ...current, id: value })), false, { id: 'dsh-api-kit-target-id', required: true, disabled: targetForm.editing }), textField('名称', targetForm.name, (value) => setTargetForm((current) => ({ ...current, name: value })), false, { id: 'dsh-api-kit-target-name', required: true }), React.createElement(CheckboxChipSelect, { id: 'dsh-api-kit-target-environments', label: '绑定 Environment', description: 'Service Target 至少要绑定一个 Environment；生产和 Agent 状态仅作为配置提示，最终校验由 Host 执行。', options: environments.map((item) => ({ id: item.id, label: item.name, meta: item.enabled === false ? '已停用' : item.production ? (item.agentEnabled === false ? '生产环境 · Agent 默认不可用' : '生产环境') : item.agentEnabled === false ? 'Agent 默认不可用' : '可用', disabled: item.enabled === false, disabledReason: item.enabled === false ? '环境已停用，不能新增绑定' : '' })), value: targetForm.environmentIds, onChange: (environmentIds) => { setTargetForm((current) => ({ ...current, environmentIds, defaultEnvironmentId: environmentIds.includes(current.defaultEnvironmentId) ? current.defaultEnvironmentId : '' })); setExpandedEndpointIds((current) => [...new Set([...current.filter((id) => environmentIds.includes(id)), ...environmentIds.filter((id) => !safeString(safeRecord(targetForm.endpoints?.[id]).baseUrl))])]) }, required: true, searchable: environments.length > 8, selectAll: true, clearLabel: '清除绑定', error: targetForm.environmentIds.length === 0 ? 'Service Target 至少要绑定一个 Environment。' : undefined, emptyText: '暂无 Environment，请先添加环境。' }), React.createElement('label', { className: 'dsh-api-kit-field', htmlFor: 'dsh-api-kit-target-default-environment' }, '默认 Environment', React.createElement('select', { id: 'dsh-api-kit-target-default-environment', className: 'dsh-api-kit-control', value: targetForm.defaultEnvironmentId, onChange: (event) => setTargetForm((current) => ({ ...current, defaultEnvironmentId: event.target.value })) }, React.createElement('option', { value: '' }, '自动使用第一个绑定环境'), targetForm.environmentIds.map((id) => React.createElement('option', { key: id, value: id }, environments.find((item) => item.id === id)?.name || id)))), textField('说明', targetForm.description, (value) => setTargetForm((current) => ({ ...current, description: value })), false, { id: 'dsh-api-kit-target-description' }), React.createElement(CheckboxChipSelect, { id: 'dsh-api-kit-target-auth-profiles', label: '认证配置', description: '只选择已登记的认证配置；凭据值始终由 Host 保存和解析。', options: authProfiles.map((item) => ({ id: item.id, label: item.name, meta: `${item.type}${item.hasSecret ? ' · 已配置' : ' · 未配置凭据'}`, disabled: item.enabled === false, disabledReason: item.enabled === false ? '认证配置已停用，不能新增绑定' : '' })), value: Array.isArray(targetForm.authProfileIds) ? targetForm.authProfileIds : [], onChange: (authProfileIds) => setTargetForm((current) => ({ ...current, authProfileIds })), loading: authListBusy, searchable: authProfiles.length > 8, selectAll: true, emptyText: authListError ? '认证配置列表暂不可用，请重试。' : '暂无已登记的认证配置；可以继续保存，调用时由 Host 校验。', clearLabel: '清除认证配置' }), authListError && React.createElement('div', { className: 'dsh-api-kit-invalid', role: 'alert' }, `认证配置列表加载失败：${authListError}`, button('重试认证配置列表', loadAuthProfiles, 'secondary', authListBusy, { busy: authListBusy })), React.createElement('div', { className: 'dsh-api-kit-auth-note' }, '认证配置属于 Service Target 级别，不按 Environment 重复设置；本页面不显示 secret、token 或 Authorization。'), React.createElement('div', { className: 'dsh-api-kit-endpoint-list' }, targetForm.environmentIds.map(endpointFields)), React.createElement('label', { className: 'dsh-api-kit-check', htmlFor: 'dsh-api-kit-target-enabled' }, React.createElement('input', { id: 'dsh-api-kit-target-enabled', type: 'checkbox', checked: targetForm.enabled, onChange: (event) => setTargetForm((current) => ({ ...current, enabled: event.target.checked })) }), '启用 Service Target'), React.createElement('label', { className: 'dsh-api-kit-check', htmlFor: 'dsh-api-kit-target-agent-enabled' }, React.createElement('input', { id: 'dsh-api-kit-target-agent-enabled', type: 'checkbox', checked: targetForm.agentEnabled, onChange: (event) => setTargetForm((current) => ({ ...current, agentEnabled: event.target.checked })) }), '允许 Agent 使用此 Service Target'), React.createElement('p', { className: 'dsh-api-kit-field-help' }, '停用 Service Target 或禁止 Agent 使用会影响 Operation 可用范围；最终权限与安全校验由 Host 执行。'), React.createElement('div', { className: 'dsh-api-kit-detail-actions' }, button('取消', () => setTargetForm(null), 'secondary'), button(targetForm.editing ? '保存 Service Target' : '创建 Service Target', saveTarget, 'primary', busy, { busy })))
        const kitCards = kits.length === 0
          ? React.createElement('div', { className: 'dsh-api-kit-empty' }, React.createElement('h4', null, '暂无套件'), React.createElement('p', null, '导入一个 API 定义，或创建空白套件开始。'), React.createElement('div', { className: 'dsh-api-kit-empty-actions' }, button('开始导入', () => focusElement('dsh-api-kit-openapi-json'), 'primary'), button('创建空白套件', () => focusElement('dsh-api-kit-new-kit-name'))))
          : kits.map((kit) => React.createElement('button', { key: kit.id, type: 'button', className: 'dsh-api-kit-kit-card ' + (selectedKit === kit.id ? 'is-selected' : ''), onClick: () => requestFormAction(() => setSelectedKit(kit.id)), 'aria-current': selectedKit === kit.id ? 'true' : undefined, 'aria-pressed': selectedKit === kit.id ? 'true' : 'false' }, React.createElement('span', { className: 'dsh-api-kit-kit-card-title' }, kit.name), React.createElement('span', { className: 'dsh-api-kit-kit-card-meta' }, `${kit.operationCount ?? 0} 个 Operation · ${kit.enabledOperationCount ?? 0} 个启用`)))
        const operationCards = kitOperations.length === 0
          ? React.createElement('div', { className: 'dsh-api-kit-empty' }, React.createElement('h4', null, '该套件还没有 Operation'), React.createElement('p', null, '可以手动新增 Operation，或从上方导入 API 定义。'), React.createElement('div', { className: 'dsh-api-kit-empty-actions' }, button('新增 Operation', newOperation, 'primary')))
          : visibleKitOperations.map((operation) => React.createElement('div', { key: operation.id, className: 'dsh-api-kit-operation-card' }, React.createElement('div', { className: 'dsh-api-kit-row' }, React.createElement('div', { className: 'dsh-api-kit-operation-main' }, React.createElement('div', null, statusBadge(operation.method, 'dsh-api-kit-method'), ' ', React.createElement('span', { className: 'dsh-api-kit-operation-name' }, operation.name || operation.operationId)), React.createElement('div', { className: 'dsh-api-kit-operation-id' }, operation.operationId), React.createElement('div', { className: 'dsh-api-kit-operation-path' }, `${operation.method} ${operation.path}`), React.createElement('div', { className: 'dsh-api-kit-operation-meta' }, operation.serviceTargetName || operation.serviceTargetId || '未绑定目标', operation.enabled === false ? statusBadge('已禁用', 'is-disabled') : statusBadge('已启用'))), React.createElement('div', { className: 'dsh-api-kit-operation-actions' }, button(operation.enabled ? '禁用' : '启用', () => toggleOperation(operation)), button('编辑', () => requestFormAction(() => { void editOperation(operation.id) })), button('删除', (event) => removeOperation(operation.id, event.currentTarget), 'danger')))))
        const discardDialogRef = React.useRef(null)
          const writeConfirmationRef = React.useRef(null)
          const discardDialog = discardDialogOpen && React.createElement('div', { className: 'dsh-api-kit-import-confirmation-backdrop', onMouseDown: (event) => { if (event.target === event.currentTarget) cancelFormAction() } }, React.createElement('section', { ref: discardDialogRef, className: 'dsh-api-kit-operation-confirmation', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dsh-api-kit-operation-discard-title', 'aria-describedby': 'dsh-api-kit-operation-discard-description' }, React.createElement('h4', { id: 'dsh-api-kit-operation-discard-title' }, '放弃未保存修改？'), React.createElement('p', { id: 'dsh-api-kit-operation-discard-description' }, '当前 Operation 有未保存修改。选择“保留草稿”会继续编辑，选择“放弃修改”才会执行离开操作。'), React.createElement('div', { className: 'dsh-api-kit-import-review-actions' }, button('保留草稿', cancelFormAction, 'secondary'), button('放弃修改', discardAndContinue, 'danger'))))
         const writeConfirmation = writeConfirming && React.createElement('div', { className: 'dsh-api-kit-import-confirmation-backdrop', onMouseDown: (event) => { if (event.target === event.currentTarget && !busy) { setWriteConfirming(false); writeConfirmTriggerRef.current?.focus?.() } } }, React.createElement('section', { ref: writeConfirmationRef, className: 'dsh-api-kit-operation-confirmation', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dsh-api-kit-operation-confirm-title', 'aria-describedby': 'dsh-api-kit-operation-confirm-description', 'aria-busy': busy ? 'true' : 'false' }, React.createElement('h4', { id: 'dsh-api-kit-operation-confirm-title' }, '确认保存写操作策略'), React.createElement('p', { id: 'dsh-api-kit-operation-confirm-description' }, `${form?.name || form?.operationId || '此 Operation'} · ${form?.method || 'HTTP'} ${form?.path || '/'}`), React.createElement('p', null, `API Kit：${(form?.kitIds || []).map((id) => kits.find((kit) => kit.id === id)?.name || id).join('、') || '未关联 API Kit'}；Service Target：${targets.find((target) => target.id === form?.serviceTargetId)?.name || form?.serviceTargetId || '未绑定'}`), React.createElement('p', null, '该 Operation 可能修改真实业务数据。此次确认只保存 Operation 策略，不代表已经执行 API 请求；Host 仍会在调用时再次校验。'), React.createElement('div', { className: 'dsh-api-kit-import-review-actions' }, button('取消', () => { setWriteConfirming(false); writeConfirmTriggerRef.current?.focus?.() }, 'secondary'), button('确认保存', saveOperation, 'primary', busy, { busy }))))
         React.useEffect(() => {
           const activeDialogRef = deleteRequest ? deleteDialogRef : writeConfirming ? writeConfirmationRef : discardDialogRef
           if (!discardDialogOpen && !writeConfirming && !deleteRequest) return undefined
           const onKeyDown = (event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                if (deleteRequest) { if (!deleteRequest.deleting) cancelDelete() }
                else if (writeConfirming) { setWriteConfirming(false); writeConfirmTriggerRef.current?.focus?.() }
                else cancelFormAction()
                return
              }
              trapDialogTab(event, activeDialogRef)
            }
           document.addEventListener('keydown', onKeyDown)
           return () => document.removeEventListener('keydown', onKeyDown)
         }, [discardDialogOpen, writeConfirming, deleteRequest])
          React.useEffect(() => {
            if (!discardDialogOpen && !writeConfirming) return undefined
            const dialogRef = writeConfirming ? writeConfirmationRef : discardDialogRef
            const first = dialogRef.current?.querySelector(FOCUSABLE_SELECTOR)
            if (first && typeof first.focus === 'function') first.focus()
            return undefined
          }, [discardDialogOpen, writeConfirming])
          React.useEffect(() => {
            if (!deleteRequest) return undefined
            const first = deleteDialogRef.current?.querySelector(FOCUSABLE_SELECTOR)
            if (first && typeof first.focus === 'function') first.focus()
            return undefined
          }, [deleteRequest?.requestId])
         const deleteDialog = deleteRequest && React.createElement('div', { className: 'dsh-api-kit-import-confirmation-backdrop', onMouseDown: (event) => { if (event.target === event.currentTarget && !deleteRequest.deleting) cancelDelete() } }, React.createElement('section', { ref: deleteDialogRef, className: 'dsh-api-kit-operation-confirmation dsh-api-kit-delete-confirmation', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dsh-api-kit-delete-title', 'aria-describedby': 'dsh-api-kit-delete-description', 'aria-busy': deleteRequest.deleting ? 'true' : 'false' }, React.createElement('h4', { id: 'dsh-api-kit-delete-title' }, `删除 ${DELETE_KIND_LABELS[deleteRequest.kind]}？`), React.createElement('p', { id: 'dsh-api-kit-delete-description' }, `${deleteRequest.name}（${deleteRequest.id}）`), React.createElement('div', { className: 'dsh-api-kit-delete-impact', role: 'note' }, React.createElement('strong', null, '影响'), deleteRequest.known ? (deleteRequest.referenceCount > 0 ? React.createElement('p', null, `当前列表可确认 ${deleteRequest.referenceCount} 个引用。`) : React.createElement('p', null, '当前已加载列表中未发现引用；Host 仍会在保存时再次校验。')) : React.createElement('p', null, '当前无法完整确认引用关系；引用关系将在 Host 保存时校验。'), deleteRequest.messages.map((message, index) => React.createElement('p', { key: `${deleteRequest.id}-impact-${index}` }, message)), deleteRequest.draftWarning && React.createElement('p', { className: 'dsh-api-kit-delete-draft-warning' }, deleteRequest.draftWarning)), deleteDialogError && React.createElement('div', { className: 'dsh-api-kit-invalid', role: 'alert' }, deleteDialogError, React.createElement('div', null, '当前配置仍保留；可修复引用后重试。', button('重试删除', confirmDelete, 'secondary', deleteRequest.deleting, { busy: deleteRequest.deleting }))), deleteRequest.requiresTypedConfirmation && React.createElement('div', { className: 'dsh-api-kit-field' }, textField('输入“删除”以确认', deleteConfirmationInput, setDeleteConfirmationInput, false, { id: 'dsh-api-kit-delete-confirmation', disabled: deleteRequest.deleting, help: '这是本地确认，不会执行网络请求。' })), React.createElement('div', { className: 'dsh-api-kit-import-review-actions' }, button('取消', cancelDelete, 'secondary', deleteRequest.deleting), button(deleteRequest.deleting ? '删除中…' : `删除 ${DELETE_KIND_LABELS[deleteRequest.kind]}`, confirmDelete, 'danger', deleteRequest.deleting || (deleteRequest.requiresTypedConfirmation && deleteConfirmationInput.trim() !== '删除'), { busy: deleteRequest.deleting }))))
          const editor = form && React.createElement('div', { className: 'dsh-api-kit-card dsh-api-kit-operation-editor' }, React.createElement('div', { className: 'dsh-api-kit-form' },
          React.createElement('h3', { className: 'dsh-api-kit-section-title' }, editingOperation ? `编辑 Operation${formDirty ? ' · 未保存' : ''}` : `新建 Operation${formDirty ? ' · 未保存' : ''}`),
          React.createElement('details', { className: 'dsh-api-kit-operation-group', open: true }, React.createElement('summary', null, '基本信息'), textField('ID', form.id, (value) => patchForm('id', value), false, { id: 'dsh-api-kit-operation-id', disabled: Boolean(editingOperation) /* disabled: Boolean(editingOperation) */, help: editingOperation ? '已有 Operation 的 ID 只读，避免破坏既有引用。' : '新建 Operation 的稳定 ID。' }), textField('operationId', form.operationId, (value) => patchForm('operationId', value), false, { id: 'dsh-api-kit-operation-operation-id' }), textField('名称', form.name, (value) => patchForm('name', value), false, { id: 'dsh-api-kit-operation-name' }),
          React.createElement('label', { className: 'dsh-api-kit-field', htmlFor: 'dsh-api-kit-operation-method' }, 'Method', React.createElement('select', { id: 'dsh-api-kit-operation-method', className: 'dsh-api-kit-control', value: form.method, onChange: (event) => patchForm('method', event.target.value) }, HTTP_METHODS.map((method) => React.createElement('option', { key: method, value: method }, method)))),
          React.createElement('div', { className: 'dsh-api-kit-field' }, React.createElement('label', { htmlFor: 'dsh-api-kit-operation-service-target' }, 'Service Target（按 Environment 配置 endpoint）'), React.createElement('select', { id: 'dsh-api-kit-operation-service-target', className: 'dsh-api-kit-control', value: form.serviceTargetId, required: true, onChange: (event) => patchForm('serviceTargetId', event.target.value), 'aria-describedby': 'dsh-api-kit-operation-service-target-help' }, React.createElement('option', { value: '' }, targets.length === 0 ? '暂无可用 Service Target，请先配置' : '请选择 Service Target'), targets.map((target) => React.createElement('option', { key: target.id, value: target.id, disabled: target.enabled === false }, `${target.name}${target.enabled === false ? '（已停用）' : ''}`))), React.createElement('span', { id: 'dsh-api-kit-operation-service-target-help', className: 'dsh-api-kit-field-help' }, 'Service Target 保存 API 根地址及其环境/认证关联；不会使用 OpenAPI 文档中的 Server URL。')),
          textField('Tag（逗号分隔）', form.tags, (value) => patchForm('tags', value), false, { id: 'dsh-api-kit-operation-tags' }), textField('摘要', form.summary, (value) => patchForm('summary', value), false, { id: 'dsh-api-kit-operation-summary' }), textField('描述', form.description, (value) => patchForm('description', value), true, { id: 'dsh-api-kit-operation-description' })),
           React.createElement('details', { className: 'dsh-api-kit-operation-group', open: Boolean(form.errors?.parameters || form.errors?.requestBody) }, React.createElement('summary', null, '请求定义'), textField('Parameters JSON', form.parameters, (value) => patchForm('parameters', value), true, { id: 'dsh-api-kit-parameters', error: form.errors?.parameters }), textField('Request Body JSON', form.requestBody, (value) => patchForm('requestBody', value), true, { id: 'dsh-api-kit-request-body', error: form.errors?.requestBody })), React.createElement('details', { className: 'dsh-api-kit-operation-group', open: Boolean(form.errors?.responses) }, React.createElement('summary', null, '响应定义'), textField('Responses JSON', form.responses, (value) => patchForm('responses', value), true, { id: 'dsh-api-kit-responses', error: form.errors?.responses })), React.createElement('details', { className: 'dsh-api-kit-operation-group', open: Boolean(form.policy.allowWrite) }, React.createElement('summary', null, 'Agent 权限与安全'),
          React.createElement('label', { className: 'dsh-api-kit-check', htmlFor: 'dsh-api-kit-operation-enabled' }, React.createElement('input', { id: 'dsh-api-kit-operation-enabled', type: 'checkbox', checked: form.enabled, onChange: (event) => patchForm('enabled', event.target.checked) }), '启用'),
          React.createElement('label', { className: 'dsh-api-kit-check', htmlFor: 'dsh-api-kit-operation-allow-agent-call' }, React.createElement('input', { id: 'dsh-api-kit-operation-allow-agent-call', type: 'checkbox', checked: form.policy.allowAgentCall, onChange: (event) => patchForm('policy', { ...form.policy, allowAgentCall: event.target.checked }) }), '允许 Agent 发现和调用'),
          React.createElement('label', { className: 'dsh-api-kit-check', htmlFor: 'dsh-api-kit-operation-allow-write' }, React.createElement('input', { id: 'dsh-api-kit-operation-allow-write', type: 'checkbox', checked: form.policy.allowWrite, onChange: (event) => patchForm('policy', { ...form.policy, allowWrite: event.target.checked }) }), '允许写操作（后续执行器仍会再次校验）'),
          React.createElement('label', { className: 'dsh-api-kit-check', htmlFor: 'dsh-api-kit-operation-requires-confirmation' }, React.createElement('input', { id: 'dsh-api-kit-operation-requires-confirmation', type: 'checkbox', checked: form.policy.requiresConfirmation, onChange: (event) => patchForm('policy', { ...form.policy, requiresConfirmation: event.target.checked }) }), '调用前需要确认'), React.createElement('div', { className: 'dsh-api-kit-operation-write-risk', role: form.policy.allowWrite && !form.policy.requiresConfirmation ? 'alert' : 'note' }, form.policy.allowWrite ? (form.policy.requiresConfirmation ? '该 Operation 可能修改真实业务数据，调用前需要人工确认。' : '警告：已允许写操作，但尚未开启调用前人工确认。') : '当前不会授予写操作；Host 仍会在保存和调用时再次校验。')),
          React.createElement('div', null, React.createElement('div', { className: 'dsh-api-kit-operation-dirty' }, formDirty ? '尚有未保存修改' : '已保存草稿'), React.createElement('div', { className: 'dsh-api-kit-operation-actions' }, button('取消', () => requestFormAction(() => { setForm(null); setFormSnapshot(''); setEditingOperation(null) }), 'secondary'), button(busy ? '保存中…' : '保存 Operation', requestOperationSave, 'primary', busy || !formDirty, { busy }))), discardDialog, writeConfirmation),
        )

        const summaryItem = (label, value, help, warning = false) => React.createElement('div', { className: 'dsh-api-kit-summary-item' + (warning ? ' is-warn' : ''), title: help }, React.createElement('span', { className: 'dsh-api-kit-summary-value' }, summaryValue(value)), React.createElement('span', { className: 'dsh-api-kit-summary-label' }, label), React.createElement('span', { className: 'dsh-api-kit-summary-help' }, help))
         const scopeStep = (title, description, arrow = false) => React.createElement(React.Fragment, { key: title }, React.createElement('div', { className: 'dsh-api-kit-scope-step' }, React.createElement('strong', null, title), React.createElement('span', null, description)), arrow && React.createElement('div', { className: 'dsh-api-kit-scope-arrow', 'aria-hidden': 'true' }, '→'))
         const scopeExample = activeKit
           ? `${activeKit.name} → ${kitOperations[0]?.name || kitOperations[0]?.operationId || 'Operation'} → ${kitOperations[0]?.serviceTargetName || kitOperations[0]?.serviceTargetId || '服务目标'} → ${activeKit.defaultEnvironmentId ? (environments.find((item) => item.id === activeKit.defaultEnvironmentId)?.name || activeKit.defaultEnvironmentId) : '当前环境'}`
           : '尚未配置 API 套件；请先导入 API 定义或创建空白套件。'
         const settingsGroup = (key, title, summaryText, content, forceOpen = false) => {
            const id = `dsh-api-kit-settings-group-${key}`
            const forcedOpen = forceOpen || (key === 'connection' && Boolean(targetForm || environmentForm || (deleteRequest && ['environment', 'target'].includes(deleteRequest.kind)))) || (key === 'workbench' && Boolean(form || writeConfirming || discardDialogOpen || (deleteRequest && ['kit', 'operation'].includes(deleteRequest.kind)))) || (key === 'import' && Boolean(error && !hasLoadedOnce))
            const open = Boolean(settingsGroups[key] || forcedOpen)
            return React.createElement('details', { id, className: 'dsh-api-kit-settings-group', open }, React.createElement('summary', { className: 'dsh-api-kit-settings-group-summary', 'aria-controls': `${id}-content`, 'aria-expanded': open ? 'true' : 'false', onClick: (event) => { event.preventDefault(); toggleSettingsGroup(key) } }, React.createElement('span', { className: 'dsh-api-kit-settings-group-title' }, title), summaryText && React.createElement('span', { className: 'dsh-api-kit-settings-group-meta' }, summaryText)), React.createElement('div', { id: `${id}-content`, className: 'dsh-api-kit-settings-group-content' }, content))
          }
          return React.createElement('section', { className: 'dsh-api-kit-settings', 'aria-labelledby': 'dsh-api-kit-settings-title' },
            deleteDialog,
           React.createElement('h2', { id: 'dsh-api-kit-settings-title' }, 'API 套件'),
           React.createElement('p', { className: 'dsh-api-kit-muted' }, '配置 Agent 可发现的 API 能力和固定服务目标；凭据和请求始终由 Host 处理。'),
           React.createElement('section', { className: 'dsh-api-kit-scope-guide', 'aria-labelledby': 'dsh-api-kit-scope-title' },
              React.createElement('div', null, React.createElement('h3', { id: 'dsh-api-kit-scope-title' }, '理解 API 套件的作用域'), React.createElement('p', null, 'API 套件组织 Operation；Operation 绑定服务目标，服务目标再按环境提供独立的环境地址。')),
              React.createElement('div', { className: 'dsh-api-kit-scope-flow', 'aria-label': 'API 套件关系' }, scopeStep('API 套件', '包含多个 Operation', true), scopeStep('Operation', '具体的 Method + Path', true), scopeStep('服务目标', '按环境配置地址', true), scopeStep('环境', 'dev / test / staging / production')),
              React.createElement('div', { className: 'dsh-api-kit-scope-example' }, React.createElement('strong', null, '当前结构：'), scopeExample, React.createElement('br'), 'OpenAPI Server URL 仅用于预览；实际请求只能使用已登记的服务目标环境地址，并由 Host 执行安全校验。'),
            ),
            React.createElement('div', { className: 'dsh-api-kit-status-summary', 'aria-label': 'API 套件状态摘要' },
             summaryItem('API 套件', summary.kitCount, '已登记的 API 套件数量'),
             summaryItem('Operation', summary.operationCount, '已登记的 API 操作定义数量'),
             summaryItem('只读操作', summary.readOperationCount, 'GET / HEAD 操作数量'),
              summaryItem('写操作', summary.writeOperationCount, '可能产生副作用；默认仍禁止 Agent 调用', summary.writeOperationCount !== null && summary.writeOperationCount > 0),
              summaryItem('可用环境', summary.availableEnvironmentCount, '已启用且允许 Agent 使用的环境数量'),
              summaryItem('配置问题', summary.configurationProblems, summary.configurationProblems === null ? '部分数据未加载，暂不可完整统计' : '当前安全视图可确认、需要处理的问题数量', summary.configurationProblems !== null && summary.configurationProblems > 0),
           ),
           error && React.createElement('div', { className: 'dsh-api-kit-invalid', role: 'alert' }, error),
           notice && React.createElement('div', { className: 'dsh-api-kit-success', role: 'status', 'aria-live': 'polite' }, notice),
           settingsGroup('import', '导入 API', '检查文档 → 配置导入 → 确认变更', React.createElement(OpenApiImportPanel), Boolean(error && !hasLoadedOnce)),
           settingsGroup('connection', '连接配置', `${environments.length} 个 Environment · ${targets.length} 个 Service Target`, React.createElement(React.Fragment, null, React.createElement('section', { className: 'dsh-api-kit-card dsh-api-kit-connection-section', 'aria-labelledby': 'dsh-api-kit-connection-title' }, React.createElement('div', { className: 'dsh-api-kit-section-header' }, React.createElement('div', null, React.createElement('h3', { id: 'dsh-api-kit-connection-title' }, '连接配置'), React.createElement('p', { className: 'dsh-api-kit-muted' }, '先创建 Environment，再创建 Service Target，并为每个环境配置 endpoint。')), React.createElement('div', { className: 'dsh-api-kit-detail-actions' }, button('添加 Environment', () => setEnvironmentForm(blankEnvironment()), 'primary'))), React.createElement('div', { className: 'dsh-api-kit-connection-stack' }, React.createElement('section', { className: 'dsh-api-kit-connection-card', 'aria-labelledby': 'dsh-api-kit-environment-title' }, React.createElement('h4', { id: 'dsh-api-kit-environment-title' }, `环境 · ${environments.length}`), React.createElement('p', null, 'Environment 是可复用的部署环境；先完成环境，再在下方 Service Target 中按环境保存 Endpoint。'), environmentEditor, React.createElement('div', { className: 'dsh-api-kit-connection-list' }, environmentCards)), React.createElement('section', { className: 'dsh-api-kit-connection-card', 'aria-labelledby': 'dsh-api-kit-target-title' }, React.createElement('div', { className: 'dsh-api-kit-connection-group-header' }, React.createElement('div', null, React.createElement('h4', { id: 'dsh-api-kit-target-title' }, `服务目标 · ${targets.length}`), React.createElement('p', null, 'Endpoint Disclosure：Service Target 依赖上方已建立的 Environment，并为每个绑定环境提供自己的 Endpoint。')), button('添加 Service Target', () => openTargetEditor(blankTarget()), 'secondary')), targetEditor, React.createElement('div', { className: 'dsh-api-kit-connection-list' }, targetCards, progressiveListControl('Service Target', targets.length, expandedTargetList, setExpandedTargetList))), connectionTestNote, React.createElement('div', { className: 'dsh-api-kit-connection-note' }, 'Service Target 按 Environment 保存 canonical endpoint：每个 endpoint 包含 baseUrl、Host/CIDR 白名单、私网开关及请求限制；导入时选择 Target，运行时再选择具体 Environment。'))))),

           settingsGroup('workbench', '套件与 Operation', `${kits.length} 个 API Kit · ${operations.length} 个 Operation`, React.createElement(React.Fragment, null,
            React.createElement('section', { className: 'dsh-api-kit-card dsh-api-kit-create-section', 'aria-labelledby': 'dsh-api-kit-create-title' }, React.createElement('div', { className: 'dsh-api-kit-section-header' }, React.createElement('div', null, React.createElement('h3', { id: 'dsh-api-kit-create-title' }, '从空白套件开始'), React.createElement('p', { className: 'dsh-api-kit-muted' }, '适合手动添加 Operation。')), React.createElement('div', { className: 'dsh-api-kit-create-row' }, textField('套件名称', kitName, setKitName, false, { id: 'dsh-api-kit-new-kit-name', required: true, placeholder: '例如：Petstore API' }), button(busy ? '创建中…' : '创建套件', createKit, 'secondary', busy, { busy }))),
           React.createElement('section', { className: 'dsh-api-kit-card dsh-api-kit-workbench-section', 'aria-labelledby': 'dsh-api-kit-workbench-title' },
             React.createElement('div', { className: 'dsh-api-kit-section-header' }, React.createElement('div', null, React.createElement('h3', { id: 'dsh-api-kit-workbench-title' }, `我的套件 · ${kits.length} 个`), React.createElement('p', { className: 'dsh-api-kit-muted' }, '选择套件后查看并管理其中的 Operation。')), button(busy ? '重新加载中…' : '重新加载', () => requestFormAction(() => { void refresh() }), 'secondary', busy, { busy, ariaLabel: '重新加载' })),
             settingsLoading ? loadingState('正在加载 API Kit、Operation 和连接配置…') : kits.length === 0 ? React.createElement('div', { className: 'dsh-api-kit-empty' }, React.createElement('h4', null, '暂无套件'), React.createElement('p', null, '导入一个 OpenAPI 文档，或创建空白套件开始。'), React.createElement('div', { className: 'dsh-api-kit-empty-actions' }, button('开始导入', () => focusElement('dsh-api-kit-openapi-json'), 'primary'), button('创建空白套件', () => focusElement('dsh-api-kit-new-kit-name'), 'secondary'))) : React.createElement('div', { className: 'dsh-api-kit-workbench' }, React.createElement('nav', { className: 'dsh-api-kit-pane', 'aria-label': 'API 套件列表' }, React.createElement('div', { className: 'dsh-api-kit-pane-header' }, React.createElement('h4', null, '套件列表'), React.createElement('span', null, `${kits.length} 个`)), React.createElement('div', { className: 'dsh-api-kit-kit-list' }, kitCards)), React.createElement('section', { className: 'dsh-api-kit-pane', 'aria-labelledby': 'dsh-api-kit-active-title' }, activeKit ? React.createElement('div', { className: 'dsh-api-kit-detail' }, React.createElement('div', { className: 'dsh-api-kit-detail-header' }, React.createElement('div', null, React.createElement('h4', { id: 'dsh-api-kit-active-title', className: 'dsh-api-kit-detail-title' }, activeKit.name), React.createElement('div', { className: 'dsh-api-kit-code' }, activeKit.id), React.createElement('div', { className: 'dsh-api-kit-detail-meta' }, `${activeKit.operationCount ?? kitOperations.length} 个 Operation`, `${activeKit.enabledOperationCount ?? 0} 个启用`, activeKit.agentEnabled === false ? 'Agent 已禁用' : 'Agent 可用')), React.createElement('div', { className: 'dsh-api-kit-detail-actions' }, button('新增 Operation', newOperation, 'secondary'), button('删除套件', (event) => removeKit(event.currentTarget), 'danger'))), React.createElement('div', { className: 'dsh-api-kit-operation-section' }, React.createElement('h4', null, 'Operation'), operationCards, progressiveListControl('Operation', kitOperations.length, expandedOperationList, setExpandedOperationList)), editor) : React.createElement('div', { className: 'dsh-api-kit-empty' }, React.createElement('h4', null, '请选择一个套件'), React.createElement('p', null, '从左侧列表选择 API Kit 以查看 Operation。'))))),
           )))
         )
      }

      slots.inject('conversation.input.left', () => slots.register({ name: 'conversation.input.left', id: 'dsh-api-kit', order: 93, label: 'API 套件' }, (props) => React.createElement(ApiKitControl, props)))
      slots.inject('settings.section', () => slots.register({ name: 'settings.section', id: 'api-kit', order: 30, label: 'API 套件' }, (props) => React.createElement(Settings, props)))
    }

    return { inject: ['remote', 'slots'], apply }
  },
})
