## Why

The session-scoped API Kit control in `conversation.input.left` is functionally correct, but its white, bordered rectangular surface and inherited 16px typography make it look like a settings-form button rather than a native DSH input-bar scope control. Long Kit and Environment names can also wrap and change the tool-row height, while the fixed accessible name does not communicate the current selection. This is the next focused polish step after the picker dialog and settings-page hardening have already reached a stable state.

## What Changes

- Restyle the API Kit input-bar trigger as a lightweight DSH scope chip while preserving an outer interactive hit area of at least 44px in height.
- Add the DSH API icon and a downward chevron, with the chevron and chip surface communicating the expandable picker affordance.
- Align the trigger typography with adjacent DSH input-bar controls by explicitly using inherited font context plus a compact single-line size and line height.
- Add distinct hover, focus-visible, active-selection, expanded, disabled/loading, and invalid visual states using existing DSH semantic tokens.
- Replace the full Kit/Environment concatenation shown in the input bar with a compact, single-line summary; retain full context in `title`, accessible naming, and the existing picker dialog.
- Generate a dynamic `aria-label` that identifies the current Kit count/summary, Environment, production warning when applicable, and the action to edit the selection.
- Preserve the existing session activation behavior, draft-versus-committed scope semantics, dialog focus entry/trapping/restoration, loading/error handling, RPC descriptors, and security boundaries.
- Add contract coverage for the trigger DOM structure, icon/chevron affordances, tokenized states, compact-summary rules, dynamic accessible naming, and the absence of direct network or Registry behavior changes.
- Add isolated `3091` browser smoke coverage for empty, single-Kit, multi-Kit, long-name, production-Environment, expanded, keyboard, light/dark, narrow-width, and no-overflow states. The active `3080` instance MUST NOT be refreshed, installed into, restarted, or operated during verification.

## Capabilities

### New Capabilities

<!-- No new standalone capability is introduced; this changes the existing session picker UI contract. -->

### Modified Capabilities

- `plugin-settings-ui`: refine the session API Kit picker trigger's DSH-native visual treatment, compact selection summary, expanded/active state semantics, and accessible naming without changing session activation behavior.

## Impact

- **Client:** `lib/client.js`, primarily the `ApiKitControl` trigger rendering and scoped CSS; a DSH primitives client dependency/injection may be added if the runtime contract confirms it is safe and available.
- **Tests:** `test/client-contract.test.mjs` plus isolated browser smoke/measurement notes or fixtures as appropriate; existing full Node regression remains unchanged.
- **OpenSpec:** add a delta spec, design, and task plan under this change; the main `plugin-settings-ui` spec is not modified until implementation verification and explicit sync/archive follow-up.
- **Runtime/dependencies:** use the current DSH `@deepseek-ai/dsh-client-ui-primitives` API icon and chevron when available, with a reviewed compatibility fallback if the host does not expose the optional module. No new RPC, HTTP request, Registry field, credential handling, or network execution is introduced.
- **Security:** preserve the current Host-authoritative session activation and safe projection boundaries; no URLs, credentials, secrets, or execution targets are added to the browser UI.
