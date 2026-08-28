# dsh-api-kit

> A local-first DeepSeek Harness profile bundle for API Kits, OpenAPI definitions, session-scoped enablement, and controlled API calls.

## Status

T14 is complete on top of the T13 settings page and session Kit picker. It adds policy-gated write intent confirmation and Host-only OAuth2 Client Credentials support. The fixed tools are `api_kits`, `api_operations`, `api_describe`, `api_call`, `api_write_prepare`, and `api_write_execute`.

- Definitions and non-sensitive configuration stay in the local Registry; real credentials are resolved per request on the Host only.
- `api_call` accepts only a stable `operationId` and declared parameters; GET/HEAD execute directly while write methods only produce a confirmation intent and never send HTTP.
- `api_write_prepare` creates a short-lived, single-use confirmation intent without network access. `api_write_execute` sends a write only after a Host-owned approved intent is presented with the same Session, Environment, target, request, and Registry bindings.
- The target is built only from a registered Environment `baseUrl` and Operation path. The model cannot provide a URL, host, session ID, proxy, or redirect policy.
- The Environment hostname must be allowlisted. Every DNS answer is checked; loopback, link-local, metadata, reserved/documentation addresses, and high-risk IPv4-mapped IPv6 addresses are rejected.
- RFC1918, IPv6 ULA, and CGNAT addresses additionally require `allowPrivateNetwork: true` and a matching `allowedCidrs` entry. A hostname allowlist alone never enables private access.
- The pinned transport connects to a checked IP while retaining the registered hostname for HTTPS SNI and the HTTP Host header. Production requests do not use a proxy, implicit retry, or automatic redirect.
- 301/302/303/307/308 return the safe `REDIRECT_NOT_ALLOWED` error without exposing or following `Location`.
- JSON success and error bodies are recursively redacted using defaults plus Operation `policy.redactKeys`; text, XML, JavaScript, unknown content types, and non-2xx bodies also receive conservative sensitive-value redaction before depth, array, string, key, and byte governance. Response headers are not returned.
- OAuth2 supports only HTTPS fixed token endpoints, Client Credentials, and `client_secret_basic`/`client_secret_post`. Secrets are resolved per request on the Host; token caches are isolated by Profile and Environment, with redirects denied.
- Every `api_call` policy rejection and network attempt is written to `$DSH_HOME/storages/dsh-api-kit/audit/audit-YYYY-MM-DD.jsonl`. Audit records use an allowlist, lazily retain 14 days by default, and never contain credentials, headers, URL, body, stack, or cause. Audit failures do not affect the business result.

## T13 UI quality and usability

- Settings and the session picker consume the DSH Inspect-confirmed `--dsw-*` tokens for light/dark surfaces, text, borders, and state colors; Server URLs remain display-only.
- Primary controls are at least 44px high and support visible focus, Tab/Shift+Tab, Enter/Space, and Escape. The picker manages focus on open, traps Tab within the dialog, and restores focus to its trigger on close.
- The settings layout becomes single-column/wrapping at 720px/520px. Long names and diagnostics wrap, the picker stays within the viewport, and reduced-motion users get no spinner/transition animation.
- RPC loads and submissions use request-generation and unmount guards. Binding lists preserve partial successes and expose retry actions; malformed JSON is reported beside its field while the draft is preserved.
- Errors such as `IMPORT_STALE_PREVIEW` explain the recovery action, and loading, empty, success, and error states use text/ARIA feedback rather than color alone.
- T13 local contract/full regression and isolated-profile installation are complete. Because this repository has no dedicated browser smoke script, real browser theme, keyboard, and narrow-screen interaction still require a pre-release check in a repeatable browser environment.

## Session-scoped Kit selection

- The `conversation.input.left` API Kit control uses slot ID `dsh-api-kit` and order `93`.
- A session can activate multiple Kits and one common Environment. Selection is held in a Host-only in-memory map keyed by the authoritative session ID.
- Every read and tool call revalidates Kit/Operation/Environment state, Agent permissions, and environment compatibility.
- The selector and Agent tools do not expose base URLs, host allowlists, credential references, or secrets.

## Agent tools

- `api_kits`: list safe Kit and Environment summaries for the current session.
- `api_operations`: discover Operations by keyword, Tag, method, Service Target, and pagination.
- `api_describe`: return the complete safe calling contract for a stable `operationId`.
- `api_call`: call a fixed Operation using only declared path/query/business-header parameters; writes produce a confirmation intent only.
- `api_write_prepare`: prepare an allowed write without network access.
- `api_write_execute`: execute one write with a Host-approved, fully bound confirmation token; no approve tool is exposed to the model.

Recommended flow: `api_kits → api_operations → api_describe → api_call`; writes use `api_write_prepare → human approval → api_write_execute`. The model must not guess URLs, hosts, credentials, bypass session activation, or approve its own confirmation.

## Dynamic runtime context

For every model-step prompt assembly, the Host provider re-reads the current session activation and Registry state using the Agent's authoritative session ID. It contributes a short summary containing active Kit names/descriptions, the selected Environment, discoverable/read-only/write counts, fixed tool names, the discovery-to-call workflow, and the read-only/SSRF/response/audit boundaries. It never includes base URLs, concrete hosts or CIDRs, credential references or values, request headers/cookies, or full OpenAPI schemas. Disabling or clearing a Kit or Environment is reflected on the next assembly; the DSH runtime projection replaces or clears the previous snapshot.

## OpenAPI JSON import and confirmation

T12 adds a settings workflow: paste JSON → preview → choose Tags, registered Service Target, Environment, Auth Profile and one or more Kits → decide conflicts → explicit confirmation and one atomic Registry write. The Host re-parses the document and current Registry at confirmation and never trusts browser-supplied candidate fields; validation, concurrency, or persistence failure leaves the whole batch uncommitted.

- `previewOpenApiImport(args)` returns bounded preview data, document and Registry fingerprints, Tag/service counts, and a transactionId; it never stores the full source document.
- `confirmOpenApiImport(args)` requires the original JSON, transactionId, preview fingerprints, and explicit bindings. Only existing Targets/Environments/Auth Profiles/Kits are accepted. Repeating a successful confirmation with the same transactionId and selection is idempotent.
- Tag selection applies only to the current source-key selection. Conflicts support `overwrite`, `keep-local`, and `skip`. Write operations retain the non-Agent-callable safe default.
- Server URLs remain display-only and never create Environments. Import archiving is disabled by default; an archive failure does not roll back or invalidate the Registry commit.


T11 exposes the DSH-independent `buildOpenApiImportPreview(input, options)` function (also exported as `previewOpenApiImport`) for OpenAPI 3.0/3.1 and Swagger 2.0 JSON strings or objects. It performs bounded normalization of paths, parameters, request bodies, responses, server candidates, and authentication templates, resolves only local JSON Pointer `$ref` values, and produces stable Operation provenance plus new/update/conflict/skip classifications.

- `serverCandidates` are display-only confirmation candidates. They never create or trust an Environment; Swagger `host/basePath/schemes` are not direct call targets either.
- Authentication templates contain only non-sensitive metadata for Bearer, Basic, Header/Query API Keys, and OAuth2 Client Credentials. Secrets are never imported, and Query API Keys remain disabled by default. OpenID Connect, mTLS, remote `$ref`, YAML, and URL/Git import remain outside the importer scope. OAuth2 does not include authorization code, PKCE, OIDC discovery, refresh-token persistence, browser callbacks, or arbitrary token endpoints.
- Preview accepts only in-memory JSON, performs no file or network access, and does not mutate the Registry or the input object. Candidates without registered Service Target/Auth Profile bindings carry `needsBinding` for the T12 confirmation transaction.
- Invalid versions, paths, external/cyclic/missing refs, controlled headers, invalid response statuses, and uploads produce structured diagnostics instead of silently creating callable definitions. Write operations remain disabled for Agent execution by default.

## Installation

```powershell
dsh plugin --profile web add github:1321928757/dsh-api-kit#v0.1.0
```

For development, install the local tgz into an isolated test profile rather than replacing a profile currently in use.

## Development checks

```powershell
pnpm test
pnpm run check
pnpm pack --dry-run
```

## Security boundary

Write operations and OAuth2 remain disabled by default. A write can reach the network only when both the Operation and Kit allow it and a short-lived Host-approved confirmation matches the Session, Environment, target, request, and Registry fingerprints. The Host confirmation RPC supports approve/reject/cancel; unavailable approval answers fail closed. OAuth2 is limited to HTTPS Client Credentials with an Environment-allowlisted, DNS/IP-validated endpoint and no redirects. Authorization code, PKCE, refresh tokens, OIDC discovery, browser callbacks, arbitrary endpoints, file upload, SSE/WebSocket, implicit retries, and an independent MCP Server are not supported. Private access requires explicit matching CIDRs. This bundle is not an arbitrary-URL internet or intranet proxy.

## License

[MIT](./LICENSE). This project is not affiliated with DeepSeek.
