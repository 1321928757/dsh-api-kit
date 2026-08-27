# dsh-api-kit

> A local-first DeepSeek Harness plugin for API Kits, OpenAPI import, session-scoped activation, and safe API calls.

## Current status

This release includes the **T05 manual Operation and minimal API Kit management foundation (0.1.0)** on top of the T01 bundle, T02 domain model, T03 Registry store, and T04 configuration foundation. It currently provides:

- Host, Client, and Typert bundle entry points;
- an `API Kit` placeholder in the conversation input row;
- an `API Kit` placeholder settings page;
- normalized Registry loading, schema migration, integrity checks, atomic saves, backups, damaged-file recovery, and in-memory snapshots;
- a Host-side configuration facade for service targets, environments, authentication profiles, Operations, and API Kits;
- strict Operation validation, enable/disable controls, Kit association, minimal Kit CRUD, link reconciliation, and safe views;
- a Typert/Host RPC configuration channel and a settings page for Kit/Operation CRUD;
- HTTP/HTTPS and host allowlist validation, production Agent opt-in, auth field validation, and referenced-delete protection;
- optional OpenAPI import archive modes: no archive by default, or an explicit sanitized/raw archive.

T08 fixed-target read-only calls are now implemented alongside the T07 discovery tools: `api_kits`, `api_operations`, `api_describe`, and `api_call`. `api_call` accepts only a stable `operationId` and declared parameters, executes GET/HEAD, builds the target from the registered Environment, resolves credentials per call on the Host, and enforces host allowlists, timeouts, and response-size limits. OpenAPI import, DNS/IP-level SSRF checks, recursive response redaction, auditing, dynamic context, and write operations remain deferred. Credentials are resolved only through a Host-only adapter and are never saved in the Registry.

### Session-scoped Kit selection

- The `conversation.input.left` “API Kit” control uses the independent slot id `dsh-api-kit`, at order `93`, so it can coexist with controls such as `dsh-mysql`.
- A session can select multiple API Kits and one common Environment. The selection is held only in a Host runtime `sessionId → { activeKitIds, environmentId }` map, not in the Registry; restarting DSH clears it.
- Two Kits are the recommended maximum. More are allowed, but the selector displays a warning that the model-visible operation scope has expanded.
- Host reads and future resolution revalidate Kit/Operation/Environment enabled state, Agent permissions, and environment compatibility on every access, so stale selections cannot remain usable.
- The selector shows safe metadata and environment names only. It never shows base URLs, credential references, or secrets. Production environments are visibly marked and still follow the Host Agent switch.

### T07 Agent discovery tools

- The Host registers three fixed global tools: `api_kits`, `api_operations`, and `api_describe`; it does not create one dynamic tool per Operation.
- Tools obtain the current session from `exec.agent.id` and revalidate activation before every call. The model cannot provide or forge a `sessionId`.
- `api_kits` returns safe Kit/Environment summaries; `api_operations` supports keyword, Tag, HTTP method, Service Target, and pagination filters; `api_describe` accepts only a discovered stable `operationId`.
- Only enabled, Agent-allowed Operations in active Kits that satisfy the Operation/Kit read or write policy intersection are discoverable or describable. Shared Operations are deterministically deduplicated.
- Tool results are capped at 64 KiB. Operation pages stop at complete item boundaries and expose pagination metadata; oversized descriptions fail closed with `DESCRIPTION_TOO_LARGE`.
- T07 only discovers and describes. It does not make HTTP requests, accept arbitrary URLs, or expose `baseUrl`, host allowlists, credential references, secrets, or internal stacks.
- T08 `api_call` executes only discovered GET/HEAD Operations. Targets come solely from the Environment, declared parameters are validated at runtime, credentials resolve on the Host, and responses are projected as bounded JSON or text. T08 does not follow redirects; DNS/IP-level SSRF checks, recursive redaction, and auditing remain T09 work.

The requirements baseline and incremental implementation plan are available here:

- [`docs/REQUIREMENTS.zh-CN.md`](./docs/REQUIREMENTS.zh-CN.md)
- [`docs/IMPLEMENTATION_PLAN.zh-CN.md`](./docs/IMPLEMENTATION_PLAN.zh-CN.md)

## Installation (future release)

```powershell
dsh plugin --profile web add github:1321928757/dsh-api-kit#v0.1.0
```

During development, install the local tgz into an isolated test profile instead of replacing the profile currently in use.

## Development checks

```powershell
pnpm test
pnpm run check
pnpm pack --dry-run
```

## Direction

- API definitions are organized as API Kits;
- the current session selects one or more Kits and an environment from the composer;
- the Agent discovers and calls APIs through `api_kits → api_operations → api_describe → api_call`;
- the Host resolves a fixed operation and environment and never accepts an arbitrary URL from the model;
- read-only access is the default and credentials stay on the Host;
- OpenAPI import, SSRF protection, response redaction, auditing, and a future MCP adapter will follow the implementation plan.

## References

- [DeepSeek Harness development docs](https://deepseek-harness.github.io/deepseek-harness/develop/basic/)
- [Develop a Tool](https://deepseek-harness.github.io/deepseek-harness/develop/basic/tool)
- [Plugin configuration](https://deepseek-harness.github.io/deepseek-harness/develop/basic/config)
- [Bundle packaging and installation](https://deepseek-harness.github.io/deepseek-harness/develop/basic/publish)
- [Official DSH repository](https://github.com/deepseek-ai/deepseek-harness)
- [DSH plugin authoring template skill](https://github.com/fuzhengwei/xfg-skills-dsp-plugin-template)
- [dsh-mysql reference implementation](https://github.com/1321928757/dsh-mysql)
- [OpenAPI Specification](https://spec.openapis.org/oas/latest.html)
- [MCP Tools specification](https://modelcontextprotocol.io/specification/latest/server/tools)

## License

[MIT](./LICENSE). This project is not affiliated with DeepSeek.
