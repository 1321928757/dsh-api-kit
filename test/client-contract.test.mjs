import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const client = await readFile(path.join(root, 'lib/client.js'), 'utf8')

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
  assert.match(client, /overflow-x:clip/)
  assert.match(client, /state-success-primary/)
})

test('T14 aligns the session picker and action buttons with DSH controls', () => {
  assert.match(client, /dsh-api-kit-picker-button\{height:28px;min-height:28px/)
  assert.match(client, /background:var\(--dsw-alias-bg-input/)
  assert.match(client, /button-primary-fill/)
  assert.match(client, /button-primary-hover/)
  assert.match(client, /label-primary-foreground/)
  assert.match(client, /dsh-api-kit-button\.primary:hover:not\(:disabled\)/)
  assert.match(client, /dsh-api-kit-button\.danger:hover:not\(:disabled\)/)
  assert.doesNotMatch(client, /\.dsh-api-kit-button\.primary\{background:var\(--dsw-alias-brand-primary\);color:var\(--dsw-alias-label-primary\)/)
})

test('T13 provides keyboard focus and semantic status/error feedback', () => {
  for (const marker of ['focus-visible', 'aria-expanded', 'aria-controls', 'aria-modal', 'aria-labelledby', 'role: \'alert\'', 'aria-live', 'fieldset', 'legend', 'Escape']) assert.match(client, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(client, /returnFocusRef/)
  assert.match(client, /querySelectorAll\('button:not\(\[disabled\]\)/)
  assert.match(client, /min-height:44px/)
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
