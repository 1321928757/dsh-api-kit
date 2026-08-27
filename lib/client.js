/**
 * dsh-api-kit browser bundle entry.
 *
 * T01 only mounts two harmless placeholders. API Kit state, RPC and network
 * behavior are intentionally deferred to later tasks.
 */

window.__ModuleLoader__.load({
  id: 'dsh-api-kit',
  factory: (require) => {
    const React = require('react')

    function KitButton() {
      return React.createElement(
        'button',
        {
          type: 'button',
          title: 'API 套件（T01 骨架）',
          'aria-label': 'API 套件（T01 骨架）',
          style: {
            height: '28px',
            padding: '0 10px',
            border: '1px solid var(--dsw-alias-border-l1)',
            borderRadius: '8px',
            background: 'var(--dsw-alias-bg-input, transparent)',
            color: 'var(--dsw-alias-label-secondary)',
            cursor: 'default',
            font: 'inherit',
            fontSize: '12px',
            lineHeight: '1',
          },
        },
        'API 套件',
      )
    }

    function SettingsPlaceholder() {
      return React.createElement(
        'section',
        {
          style: {
            maxWidth: '720px',
            padding: '24px',
            color: 'var(--dsw-alias-label-primary)',
          },
        },
        React.createElement('h2', { style: { margin: '0 0 8px', fontSize: '20px' } }, 'API 套件'),
        React.createElement(
          'p',
          { style: { margin: '0 0 16px', color: 'var(--dsw-alias-label-secondary)', lineHeight: '1.6' } },
          'dsh-api-kit T01 工程骨架已加载。API 套件管理、OpenAPI 导入和安全调用将在后续任务中实现。',
        ),
        React.createElement(
          'p',
          { style: { margin: 0, color: 'var(--dsw-alias-label-secondary)', fontSize: '13px' } },
          '当前版本不会发起网络请求，也不会保存或读取凭据。',
        ),
      )
    }

    async function apply(ctx) {
      const slots = ctx.get('slots')
      if (slots === undefined || typeof slots.inject !== 'function') return

      slots.inject('conversation.input.left', () => slots.register(
        { name: 'conversation.input.left', id: 'dsh-api-kit', order: 95, label: 'API 套件' },
        () => React.createElement(KitButton),
      ))

      slots.inject('settings.section', () => slots.register(
        { name: 'settings.section', id: 'api-kit', order: 30, label: 'API 套件' },
        () => React.createElement(SettingsPlaceholder),
      ))
    }

    return { apply }
  },
})
