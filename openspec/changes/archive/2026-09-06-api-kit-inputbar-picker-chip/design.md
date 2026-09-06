## Context

The existing `ApiKitControl` is mounted in the session-scoped `conversation.input.left` list and already owns the correct session activation RPC boundary, draft/committed state distinction, dialog focus handling, and safe projection. The change is limited to the trigger surface and its derived presentation. See `proposal.md` for motivation and `specs/plugin-settings-ui/spec.md` for the observable contract.

The current DSH `0.1.1-rc.2` conversation bundle uses compact input-bar controls with a roughly 28px visual control, `border-radius: 24px`, `13px` typography, `label-secondary`, `interactive-bg-hover`, and a chevron SVG primitive. The host input bar still gives plugin slot content a one-row tool budget, so the trigger needs a larger hit area without becoming a tall visual control.

## Goals / Non-Goals

**Goals:**

- Make the trigger read as a DSH-native API scope chip while preserving a robust 44px-or-greater button hit area.
- Keep long summaries single-line and bounded so the host tool row does not change height or overflow.
- Make visual active/expanded states and accessible naming follow the same scope that the user is currently seeing (committed when closed, draft when open).
- Reuse the host's API and chevron icon family where available, with a deterministic SVG fallback for compatibility.
- Keep this a presentation-only change with no new data, RPC, network, or security behavior.

**Non-Goals:**

- Do not redesign the existing picker dialog, its selection controls, focus trap, or footer actions.
- Do not change session activation validation, persistence, error mapping, or Host safety policy.
- Do not introduce persistent layout preferences, a new Slot, a new UI framework, or a custom global theme.
- Do not fold the broader deferred UI review items (`:has()` fallback across settings, breakpoint/overflow cleanup, live-region audit, or actionable configuration-problem navigation) into this change.

## Decisions

### 1. Keep the existing trigger button and add a presentation layer inside it

The outer element remains a semantic `<button type="button">` and keeps the existing trigger ref, click handler, `aria-expanded`, `aria-controls`, `aria-haspopup`, disabled/loading behavior, and focus restoration contract. Its content becomes a small flex row containing an icon, a separately bounded summary label, and a chevron. The outer button supplies the 44px hit area; the inner visual content is aligned to the host's approximately 28px input-bar rhythm rather than increasing the row's apparent height.

**Why:** Replacing the trigger with a generic `div`, separate nested button, or host takeover would risk keyboard semantics and focus restoration. Separating hit area from visual density resolves the review's apparent conflict between touch accessibility and DSH input-bar compactness.

**Alternative considered:** Shrink the button to 28–36px. Rejected because it would regress the already-verified touch-target requirement.

### 2. Use the DSH primitives module for icons, with a local currentColor SVG fallback

Declare `@deepseek-ai/dsh-client-ui-primitives` as an explicit client injection/peer capability and resolve `IconApiOutline14` and `IconChevronDownOutline14` at runtime. The client must tolerate a compatible host that does not expose the optional module by rendering local outline SVGs with `currentColor`, `viewBox="0 0 16 16"`, and the same 14px geometry. The fallback is decorative because the button's text and accessible name carry the meaning; it must never introduce emoji or hard-coded theme colors.

**Why:** The official icon family matches DSH's existing API/Operation and model-selection controls. A runtime fallback avoids making the entire slot disappear on older/partial hosts while preserving the same affordance.

**Alternative considered:** Always draw plugin-owned SVGs. Rejected as the default because it duplicates a host icon contract and is more likely to drift visually; retained only as the compatibility path.

### 3. Derive a compact summary separately from the full scope description

Add pure presentation helpers that receive the selected scope and return:

- visual summary: default API Kit text; one Kit name; or first Kit name plus `+ N`; append a compact Environment name when present;
- full title text: complete Kit/Environment information, including production or invalid state where useful;
- accessible name: current Kit count/summary, Environment and production status, invalid/loading state, and an explicit edit action.

The visual summary is always rendered inside a `min-width: 0` label with `white-space: nowrap`, `overflow: hidden`, and `text-overflow: ellipsis`. The complete data remains in the dialog, title, and accessible name rather than being forced into the input bar.

**Why:** The input bar is a scope indicator, not a configuration report. Keeping these representations separate prevents long names from controlling layout while retaining information for sighted hover users and assistive technology.

**Alternative considered:** Keep the existing concatenated string and rely on CSS ellipsis. Rejected because `white-space: normal` currently permits wrapping, and CSS ellipsis is unreliable for multiline content.

### 4. Use committed-versus-draft scope consistently for all trigger presentation

When the popover is closed, the trigger label, active class, title, and accessible name derive from the committed scope. When open, they derive from the draft scope, so the trigger previews the choices being edited. `aria-expanded` controls only the expanded state; `is-active` indicates that a Kit/Environment selection exists. Invalid and loading states remain orthogonal to selection presence.

**Why:** The component already uses this distinction for its text. Extending it to all presentation and ARIA fields prevents a visual label and screen-reader label from describing different states.

**Alternative considered:** Keep the trigger on committed scope while open. Rejected because it would make draft changes invisible until save and create a mismatch with the dialog's summary.

### 5. Match DSH state tokens without a heavy border

The base visual chip uses `bg-layer-2` (with the existing DSH input-bar surface fallback), secondary text, pill radius, and no high-contrast border. Hover uses `interactive-bg-hover`; expanded and selected states use `interactive-bg-active` or a similarly low-noise active surface; focus-visible keeps a clear tokenized ring/box shadow. Loading/disabled uses the existing opacity and disabled semantics, while invalid retains a text/state cue rather than relying on red alone.

Transitions remain limited to color/background/border/transform for the chevron, and the existing reduced-motion rule disables them. A focused browser measurement will confirm the computed font; the selector will use an explicit compact `13px/18px` rule with the smallest targeted specificity needed to win over host input-bar typography.

### 6. Preserve the existing dialog and session RPC contract

No RPC descriptor or call site changes are needed. The trigger continues to call `load`, `save`, and `clear` through the existing paths. Contract tests will assert the unchanged RPC names and absence of `fetch`, while isolated browser smoke will exercise only the trigger and non-destructive session selection fixture. The active `3080` instance is excluded from all install, refresh, restart, and browser operations.

## Risks / Trade-offs

- [Risk] An explicit primitives injection can be absent on an older host → Resolve it defensively and render the local currentColor SVG fallback; verify both paths in the isolated 3091 profile or a static compatibility test.
- [Risk] A nested visual wrapper may make computed height measurements ambiguous → Measure the outer button's bounding box and the inner chip separately at 320/375/520/557px; require outer height >=44px, inner visual height close to the host compact rhythm, and no horizontal overflow.
- [Risk] Long Kit/Environment names can still consume all available width → Apply `min-width:0` to the trigger, wrapper, and label; cap width with container-aware sizing; assert `white-space:nowrap`, ellipsis, and `scrollWidth === clientWidth` in browser smoke.
- [Risk] The draft label may expose uncommitted selection while the dialog is open → This is intentional and must be paired with the existing draft scope summary and cancel/close semantics; closing without applying must restore committed presentation.
- [Risk] The trigger's 44px hit area may still look like a tall button if host CSS overrides font/line-height → Use a compact inner row and verify computed styles in 3091; adjust only the scoped trigger selector, not host globals.
- [Risk] Static contract tests may prove strings but miss the visual relationship → Add browser measurements and screenshots for light/dark, selected/expanded, long-name, and narrow-width fixtures; do not treat source assertions as a substitute for smoke.

## Migration Plan

1. Confirm the current primitives runtime exposure and add the explicit client injection/optional dependency metadata required for the official icon path.
2. Implement the scoped trigger wrapper, icon resolution/fallback, compact summary helpers, dynamic `title`/`aria-label`, and state styles without touching RPC payloads or dialog markup outside the trigger.
3. Extend `test/client-contract.test.mjs` for trigger structure, tokenized states, summaries, accessible naming, icon fallback, and no-network invariants.
4. Pack the plugin under a uniquely named local tarball and install it only into the disposable `DSH_HOME`/profile for port `3091`; never operate the active `3080` instance.
5. Run empty and populated fixtures for single Kit, multi-Kit, long names, production Environment, expanded/closed, keyboard focus restoration, light/dark theme, 320–560px widths, and no horizontal overflow. If available, test the missing-primitives fallback separately.
6. Run `node --check`, client contract tests, the full `pnpm test`, `pnpm run check`, `git diff --check`, and strict OpenSpec validation. Rollback is limited to the client bundle and package metadata; no Registry or Host migration is required.

## Open Questions

None. The official primitive path with a local SVG compatibility fallback, compact summary vocabulary, committed/draft presentation rule, 44px outer hit area, and isolated 3091 verification boundary are fixed for implementation.
