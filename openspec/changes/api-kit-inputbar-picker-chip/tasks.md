## 1. Runtime and dependency compatibility

- [x] 1.1 Confirm the current DSH `@deepseek-ai/dsh-client-ui-primitives` client injection and icon exports against the inspected `0.1.1-rc.2` runtime; record the verified official path and the missing-module fallback behavior without changing host code, verified by a source/runtime contract check.
- [x] 1.2 Update only the plugin client metadata needed to expose the optional primitives capability (if required), preserving the existing bundle manifest and compatibility behavior; verify `pnpm run check` and the package manifest tests pass.

## 2. Input-bar picker presentation

- [x] 2.1 Add pure Client presentation helpers for compact Kit/Environment summaries, full title text, and dynamic accessible names, covering empty, single-Kit, multi-Kit, production, invalid, loading, committed, and draft scopes; verify with focused assertions in `test/client-contract.test.mjs` and existing `node --check`.
- [x] 2.2 Refactor the existing API Kit trigger content into one semantic button with an icon, bounded summary label, and chevron while preserving its ref, click handler, session loading behavior, `aria-expanded`, `aria-controls`, `aria-haspopup`, and dialog focus restoration; verify no RPC descriptor/call payload changes and no `fetch(` is introduced.
- [x] 2.3 Resolve official DSH API/chevron primitives when available and provide a local `currentColor` SVG fallback with equivalent decorative semantics when unavailable; verify both paths through static module/fallback assertions and a disposable runtime fixture where possible.
- [x] 2.4 Replace the trigger's rectangular surface with scoped DSH-tokenized chip styling: compact typography, pill radius, no heavy default border, hover/active/expanded/invalid/disabled states, visible focus, chevron direction feedback, and reduced-motion compatibility; verify contract selectors and computed light/dark styles in the isolated browser.
- [x] 2.5 Bound the trigger width and inner label with `min-width:0`, `white-space:nowrap`, overflow ellipsis, and container-aware sizing while retaining an outer hit area of at least 44px; verify outer/inner measurements and `scrollWidth === clientWidth` at 320px, 375px, 520px, and 557px.

## 3. Contract and regression coverage

- [x] 3.1 Extend `test/client-contract.test.mjs` to assert trigger DOM structure, official icon/fallback markers, compact summary rules, dynamic `aria-label`, `title`, active/expanded selectors, and continued safe JSON-only/session-picker boundaries; verify the focused client contract suite passes.
- [x] 3.2 Run syntax, manifest, full unit/regression, and diff checks (`node --check lib/client.js`, `node --check test/client-contract.test.mjs`, `node test/client-contract.test.mjs`, `pnpm test`, `pnpm run check`, `git diff --check`) and resolve any regression before browser verification.

## 4. Isolated browser verification and release handoff

- [x] 4.1 Pack a uniquely named local tarball and install it only into the disposable DSH profile/Home on port `3091`; verify the active `3080` process, page, profile, and installation remain untouched. Verified with `dsh-api-kit-0.1.0-dev-picker-chip-release.tgz` under `C:\Users\48444\.dsh-isolated-api-kit-3091`; the existing `3080` listener remained PID 35636 and was not refreshed or restarted.
- [x] 4.2 Exercise empty, single-Kit, multi-Kit, long Kit/Environment, production Environment, invalid/loading, expanded/closed, keyboard focus restoration, light/dark, reduced-motion, and narrow-width states using non-destructive session fixtures; verify compact summaries, dynamic accessible names, visual state changes, outer hit target, and no horizontal overflow. Empty/single/multi/production/long-name/expanded/closed fixtures passed on `3091`; official icons rendered; outer button measured 45px, inner chip ~28px, ellipsis had `scrollWidth > clientWidth`, and document/body horizontal overflow stayed false at 320/375/520/557px. Theme and reduced-motion selectors were statically covered; no populated invalid/loading fixture was available without introducing configuration failure state.
- [x] 4.3 Capture the isolated verification result and final OpenSpec validation (`openspec validate "api-kit-inputbar-picker-chip" --type change --strict`); record any missing-primitives or populated-scope limitation explicitly and leave `3080` running normally. The inspected host supplied official `IconApiOutline14` and `IconChevronDownOutline14`; fallback remains statically covered. `3080` stayed running normally throughout.
