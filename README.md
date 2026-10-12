# dsh-api-kit

> A local-first DeepSeek Harness Web profile bundle for registering approved API definitions, importing OpenAPI JSON, selecting API Kits per conversation, and calling fixed HTTP Operations from Agent tools.

[中文文档](./README.zh-CN.md)

> **Data boundary:** Registry definitions and non-sensitive settings are stored locally. Credential values are resolved on the Host at request time and are not returned to the browser, Agent tools, or the runtime context. API parameters and projected API responses are still ordinary tool data and may be sent to the LLM provider configured for your DSH session.

## At a glance

| Surface | What it provides |
| --- | --- |
| **Settings → API Kit** | Create and manage Kits, Operations, Environments, and Service Targets; inspect safe authentication metadata and import OpenAPI/Swagger JSON with preview and explicit confirmation. |
| **Conversation input** | Activate one or more API Kits and one common logical Environment for the current conversation. |
| **Agent tools / runtime** | Discover registered Operations, read their safe contracts, call fixed GET/HEAD endpoints, and prepare or execute policy-gated writes with Host approval. |

## Features

- **API Kits and Operations:** Organize approved HTTP Operations by project or service domain. Operations retain method, relative path, parameters, request body, responses, tags, authentication reference, and an explicit Agent policy.
- **OpenAPI JSON import:** Preview and import OpenAPI 3.0/3.1 or Swagger 2.0 JSON. The workflow reports paths, tags, operations, diagnostics, and new/update/conflict/skip classifications before one atomic Registry commit.
- **Environment and Service Target separation:** An Environment represents a logical stage such as `demo`, `dev`, or production. A Service Target represents a logical service and stores a separate endpoint and network policy for each bound Environment.
- **Session-scoped activation:** The conversation picker stores activation in a Host-only in-memory map keyed by the authoritative session ID. Each active Kit must share the selected Environment.
- **Fixed-target execution:** Agent calls use a stable `operationId`, declared parameters, a registered Service Target endpoint, and the Operation path. The model cannot supply an arbitrary URL, host, proxy, redirect policy, session ID, or credential value.
- **Host-only authentication:** Settings can create, edit, enable/disable, bind, and delete safe Auth Profile metadata for no auth, Bearer, Basic, header/query API key, and OAuth2 Client Credentials. Secrets are set/replaced/removed through Host credentials only and are resolved only when a request is executed. Query API keys remain disabled by default and are marked as URL-risky.
- **Response governance and audit:** Responses are bounded and conservatively redacted. Calls and policy rejections are written to a local allowlisted JSONL audit file.
- **Accessible Web UI:** Settings and the session picker use DSH theme tokens, keyboard/focus handling, semantic status feedback, responsive layouts, touch-sized primary controls, and reduced-motion support.
- **Compact session scope label:** The composer shows a bounded five-character summary with `...` for long Kit or Environment combinations, while the full safe scope remains available through the button title, accessible name, and picker dialog.

## Agent tools

All tools are fixed registrations. They do not accept arbitrary URLs or expose a `sessionId` argument; the Host obtains the authoritative session from the current Agent execution context.

| Tool | Parameters | Network / result |
| --- | --- | --- |
| `api_kits` | No business parameters. | No network. Returns bounded Kit and Environment summaries for the current session, including active IDs and read/write counts. |
| `api_operations` | Optional `query`, exact `tag`, `method`, `serviceTargetId`, `offset` (default `0`), and `limit` (default `20`, maximum `100`). | No network. Searches only Operations discoverable through the current session’s active Kits and Environment. |
| `api_describe` | Required `operationId` returned by `api_operations`. | No network. Returns the complete safe call contract, including declared parameters, request/response schema previews, policy metadata, and relative path; it does not return credentials or arbitrary target URLs. |
| `api_call` | Required `operationId`; optional `pathParams`, `query`, `headers`, and `body` fields. Only declared path/query/business-header keys are accepted. | Executes fixed **GET/HEAD** Operations. `body`, cookie parameters, undeclared keys, controlled headers, invalid schema values, and policy violations are rejected. Write methods produce a confirmation intent instead of sending HTTP. |
| `api_write_prepare` | Required `operationId`; optional declared `pathParams`, `query`, `headers`, and JSON `body`. | No network. Creates a short-lived, single-use Host confirmation intent only when the Operation and active Kit policies allow the write. |
| `api_write_execute` | Required `operationId` and `confirmationToken`; the same logical request fields used during preparation. | Sends one write only after the Host has approved the matching intent. The token is bound to the Session, Operation, method, Service Target, Environment, request fingerprint, and current Registry fingerprint; replay and mismatches fail closed. |

Recommended read flow:

```text
api_kits → api_operations → api_describe → api_call
```

Write flow:

```text
api_write_prepare → human approval → api_write_execute
```

The model has no approval tool and cannot approve its own confirmation token.

## Requirements and compatibility

- Supported runtime range: DSH `>=0.2.0-rc.2 <0.3.0` and Node.js `>=20`; the plugin uses strict Host Typert JSON codecs, Host credentials, the Cordis 4.0.4 line, and the Web profile bundle loader.
- The Client bundle requires React and optionally consumes the `@deepseek-ai/dsh-client-ui-primitives` peer. Cordis Client service dependencies are declared through plugin `inject: ['remote', 'slots']`.
- The plugin uses DSH Web Client slots `conversation.input.left` (session scope) and `settings.section` (root scope), plus a Host Typert service named `apiKitConfig` in the `api-kit` namespace.
- The package exposes a Web bundle and does not claim compatibility with non-Web profiles, arbitrary OpenAPI vendor extensions, or DSH 0.3+. Verify releases in an isolated profile before production rollout.
- OAuth2 requires a Host credentials provider and secure HTTP transport. Registered internal endpoints are supported while local, link-local, metadata, and reserved addresses remain blocked.

## DSH 0.2 upgrade notes

- Existing Registry `secretRef` values are not rewritten during plugin upgrade. Legacy `dsh-api-kit/auth/<id>` sentinels are adapted at the Host credentials boundary; malformed old references remain stored and fail closed until corrected.
- New Auth Profiles use `DSH_API_KIT_AUTH_V2_<hash>` defaults, so punctuation/case variants cannot overwrite another Profile's credential slot. Explicit refs remain unchanged.
- Legacy default-ref collisions are shown as Profile IDs plus the shared reference. Unrelated metadata edits are allowed; a user can resolve the collision by assigning an explicit, valid, unique reference to one Profile. The plugin never guesses which stored secret belongs to which Profile.
- Back up the DSH profile before upgrading and keep the old package available for rollback. Rollback must not delete or rename credentials created by either package version.
- Verify Host startup, both Web slot contributions, settings-to-RPC flows, and stored credential status using an isolated profile before rollout. Never run smoke checks against a profile currently serving user sessions.

## Install, update, or remove

### Install from GitHub

The current repository version is `0.1.1`:

```powershell
dsh plugin --profile web add github:1321928757/dsh-api-kit#v0.1.1
```

Restart the existing `dsh web` process after installing or updating so the new bundle enters the Web boot graph. This command installs into the `web` profile; use another isolated profile for testing.

### Verify that the profile loads the bundle

```powershell
dsh --profile web --dump-config | findstr dsh-api-kit
```

Then open DSH Web and confirm both of these entries are present:

1. **Settings → API Kit**;
2. **API 套件** in the conversation input bar.

If the configuration row is present but the UI is missing, stop the old Web process, restart it, refresh the page, and inspect the boot logs before troubleshooting the configuration itself.

### Update or remove

```powershell
dsh plugin --profile web update dsh-api-kit@latest
dsh plugin --profile web remove dsh-api-kit
```

Use the pinned GitHub tag form when you need a reproducible version instead of `@latest`.

### Local development install

Build a package snapshot and install it into an isolated profile. This avoids replacing a profile currently used by DSH Web and avoids Windows cross-drive `link:` path problems.

```powershell
pnpm pack
# Copy the generated tgz to a convenient local path if the profile is on another drive.
dsh plugin --profile demo add C:\path\to\dsh-api-kit-0.1.1.tgz
dsh --profile demo --dump-config | findstr dsh-api-kit
```

Restart the DSH process for that profile after each package update.

## Quick start

1. **Create an Environment.** In **Settings → API Kit → Connection configuration**, add an ID such as `demo`. Keep production environments disabled for Agent use unless you explicitly need them.
2. **Create a Service Target.** Bind it to one or more Environments and configure one endpoint per binding, for example `demo → https://api.example.test`. The endpoint host is automatically included in the fixed host allowlist; review timeouts and response limits.
3. **Register internal API hosts directly.** RFC1918, IPv6 ULA, and CGNAT DNS results are allowed for a hostname explicitly derived from or added to the Environment/Service Target allowlist. Loopback, link-local, metadata, multicast, and reserved addresses remain blocked.
4. **Manage or bind an Auth Profile.** In **Settings → API Kit → Auth Profile**, create or edit safe metadata for no auth, Bearer, Basic, header/query API key, or OAuth2 Client Credentials; enable/disable or delete unreferenced profiles; and set, replace, or remove credentials through the Host-only credentials flow. Store only a credential reference in the Registry. The Web UI shows only `hasSecret`, credential source, and writable status, never the secret or `secretRef`. Query API keys are explicitly marked as URL-risky and remain disabled until allowed by policy.
5. **Import the API definition.** Paste an OpenAPI 3.0/3.1 or Swagger 2.0 JSON document, choose **Validate and preview**, select Tags and an existing Service Target/Environment/Auth Profile, resolve conflicts, and use **Confirm and import**. `servers[].url` and Swagger `host/basePath/schemes` are display-only candidates; they never become trusted call targets automatically.
6. **Activate the scope.** In the conversation input bar, open **API 套件**, select one or more enabled Kits, and select a compatible common Environment.
7. **Ask the Agent to use the fixed flow.** It should discover an Operation, describe its required parameters, and call it by `operationId`. Start with read-only GET/HEAD Operations and add a SQL-like `LIMIT` or API-side pagination yourself when the upstream service supports it.
8. **Treat writes as a separate change.** A write must be enabled by both the Operation and Kit policy and must pass Host approval. Preparation never contacts the API; execution consumes the approved intent once.

## Feature tour

### Settings → API Kit

The settings section has three main areas:

- **OpenAPI import:** paste JSON, preview bounded metadata and diagnostics, choose Tags and bindings, review conflicts, and explicitly confirm one atomic import;
- **Connection configuration:** maintain logical Environments and Service Targets with per-Environment endpoints, registered-host validation, timeouts, and response limits; inspect available Auth Profile metadata without exposing secrets;
- **API Kit workbench:** create an empty Kit, inspect its Operations, enable/disable Operations, edit policies, and remove referenced objects only after their links are cleared.

Malformed JSON is reported beside the field while the draft is preserved. Import failures such as `IMPORT_STALE_PREVIEW` include a recovery hint to preview the original document again.

### Conversation input

The **API 套件** picker is session-scoped rather than a global switch. It shows safe names, availability, compatibility, and diagnostics. It does not show base URLs, host/CIDR policy, credential references, or secret values.

The composer keeps this scope label compact even when a Kit or Environment has a long name. The visible label is capped at five characters plus `...`; the complete safe scope remains available from the button title, accessible name, and picker dialog.

![API Kit picker with a compact five-character scope label](https://raw.githubusercontent.com/1321928757/dsh-api-kit/main/assets/conversation-picker-selected.png)

The expanded picker keeps the complete Kit and Environment metadata visible for selection and review without putting long names into the composer toolbar.

![Expanded API Kit picker](https://raw.githubusercontent.com/1321928757/dsh-api-kit/main/assets/conversation-picker-selected-expanded.png)

## Security and permissions

The application-layer controls below narrow what this bundle can do. They do not replace least-privilege database/service accounts, upstream authorization, network segmentation, or TLS configuration.

| Guardrail | What is enforced | Important boundary |
| --- | --- | --- |
| Fixed target | The Host constructs a URL only from a registered Service Target endpoint and a relative Operation path. | This is not an arbitrary-URL internet or intranet proxy. The model cannot choose a host, proxy, redirect policy, or credentials. |
| Host allowlist | The endpoint hostname must be registered. Every DNS answer is checked before production transport uses a pinned address. | A hostname allowlist is not a complete authorization boundary; DNS and server-side permissions still matter. |
| SSRF / private network | Loopback, link-local, metadata, multicast, reserved/documentation, and high-risk mapped addresses are rejected. RFC1918, IPv6 ULA, and CGNAT answers are accepted only for a registered hostname, after all DNS answers are classified and the chosen address is pinned. | Register only trusted API hosts; do not use this plugin as an arbitrary intranet proxy. |
| Transport | Production requests connect to the checked IP while retaining the registered hostname for HTTPS SNI and HTTP `Host`. No proxy, implicit retry, or automatic redirect is used. | HTTP itself may be unsuitable for sensitive data; deployment-level TLS and network controls remain your responsibility. |
| Request shape | Only declared path/query/business-header parameters are accepted. Controlled headers, undeclared keys, unsafe relative paths, cookie parameters, and invalid JSON Schema values are rejected. | The declaration and schema must be correct; an API-side authorization policy remains necessary. |
| Credentials | Credential values are resolved on the Host at request time. Safe views expose status/metadata, not `secretRef`, passwords, tokens, or client secrets. | Credential storage and the configured DSH Host remain trusted components. API results are still model-visible tool output. |
| Read/write policy | GET/HEAD are the direct read path. Writes require Operation `allowAgentCall`, Operation `allowWrite` and confirmation policy, active Kit write policy, and a matching Host-approved one-shot intent. | Defaults are fail-closed, but an administrator can deliberately enable a write. Approval does not grant broader target or credential access. |
| Response governance | JSON is recursively redacted using defaults and Operation `policy.redactKeys`; text, XML, JavaScript, unknown types, and non-2xx bodies receive conservative sensitive-value redaction. Depth, array, string, object-key, byte, timeout, and response-size limits apply. Response headers are not returned. | The response limit is an application read/projection limit. It is not a guarantee that the upstream server stopped scanning or sending data before the Host received it. |
| Audit | Calls and policy rejections are projected to an allowlisted JSONL record with no URL, path, query, headers, body, credentials, stack, or error cause. Files are lazily cleaned after 14 days by default. | Audit is best-effort: an audit write failure does not change the business result. Protect the local DSH home directory. |

## Known limitations

- Only **JSON** OpenAPI/Swagger documents are imported. YAML, URL/Git import, remote `$ref`, and unsupported vendor-specific schema behavior are out of scope. Local JSON Pointer `$ref` values are bounded by depth/count limits; missing or cyclic references produce diagnostics.
- `servers[].url` and Swagger `host/basePath/schemes` are display-only. A previously registered Service Target and its Environment endpoint are always required for an imported Operation.
- The fixed Agent read path executes only GET/HEAD. `OPTIONS` can be registered/discovered but is not a direct `api_call` method. POST/PUT/PATCH/DELETE require the separate write-confirmation flow.
- Write preparation is offline, short-lived, single-use, and bound to the current Registry. The model cannot approve a token; if Host approval is unavailable, execution fails closed.
- Only JSON request bodies are supported for writes. Cookie parameters, multipart/file uploads, GraphQL, SSE, WebSocket, automatic redirects, implicit retries, and an independent MCP Server are not supported.
- Authentication supports no auth, Bearer, Basic, header/query API keys, and OAuth2 Client Credentials. Query API keys are disabled by default. OAuth2 does not implement authorization code, PKCE, OIDC discovery, refresh-token persistence, browser callbacks, arbitrary token endpoints, or non-HTTPS token endpoints.
- Response governance happens while reading and projecting the response. A large upstream query may still consume server, network, and Host resources; add request-side filters and pagination/`LIMIT` values where the API supports them.
- The Registry is local to the DSH profile. Session activation is in-memory and session-scoped; after a new session or process restart, select the Kit and Environment again.
- This repository has no dedicated browser smoke script. Before release, verify both light/dark themes, keyboard focus, narrow-screen layout, connection errors, and the installed profile in a repeatable DSH Web environment.

## How it works

```text
Settings / conversation picker
        │ DSH slots + Typert JSON RPC
        ▼
Host bundle (apiKitConfig + fixed Agent tools)
        │
        ├── local Registry: Kits, Operations, Environments, Targets, auth metadata
        ├── Host credentials: request-time secret resolution
        ├── pinned HTTP transport: registered-host + DNS/IP validation
        └── runtime context: bounded session summary for prompt assembly
```

- The Host entry mounts the `apiKitConfig` service, registers the fixed Agent tools, and registers a dynamic `systemPrompt.context` provider.
- The browser bundle registers `conversation.input.left` with slot ID `dsh-api-kit` and `settings.section` with ID `api-kit`.
- Typert uses the `api-kit` namespace and `apiKitConfig` service. Client calls unwrap the standard `{ ok, value }` gateway envelope before using the safe value.
- The Registry is stored by default at `$DSH_HOME/storages/dsh-api-kit/registry.json`; atomic updates, backups, integrity checks, and legacy migration are handled by the Host store.
- Audit records are stored by default at `$DSH_HOME/storages/dsh-api-kit/audit/audit-YYYY-MM-DD.jsonl`.
- Runtime context is rebuilt for every model-step prompt assembly from the current authoritative session activation and Registry. It contains counts, names, workflow, and boundaries, not URLs, concrete hosts, CIDRs, credential references, headers, cookies, or full schemas.
- Dispose and Agent lifecycle events clear session activation, pending write confirmations, OAuth client caches, and mounted client contributions.

## FAQ and troubleshooting

<details>
<summary><b>The API Kit button or Settings section is missing</b></summary>

Confirm that the package is installed into the profile you are running:

```powershell
dsh --profile web --dump-config | findstr dsh-api-kit
```

Restart the existing `dsh web` process and refresh the page. Installing a package does not inject it into an already-running boot graph. If it still does not appear, check the DSH boot log and confirm the profile is a Web profile.

</details>

<details>
<summary><b>The Agent says no Kit or Environment is active</b></summary>

Open the conversation’s **API 套件** picker, select at least one enabled Kit, and choose one compatible Environment. Multiple Kits must have a common Environment. If a Kit or Environment was disabled or edited after selection, reselect it so Host validation can rebuild the current scope.

</details>

<details>
<summary><b>The import preview or confirmation failed</b></summary>

For `JSON_INVALID`, fix the JSON syntax beside the input field. For `IMPORT_STALE_PREVIEW`, `IMPORT_TRANSACTION_MISMATCH`, or `IMPORT_DOCUMENT_MISMATCH`, paste the original unchanged JSON and run preview again. Ensure every selected Operation has an existing enabled Service Target, a bound Environment endpoint, and at least one existing Kit (or use the new-Kit import path in the UI). Server URLs in the document do not create trusted targets.

</details>

<details>
<summary><b>The API call cannot connect or is rejected by the target policy</b></summary>

Check the Service Target’s endpoint for the selected Environment, its registered hostname, port, and DNS answers. Registered RFC1918/ULA/CGNAT hosts are supported without private CIDR toggles; loopback, link-local, metadata, multicast, and reserved addresses remain blocked. Requests originate from the DSH Host, not from the browser. Redirects are intentionally returned as `REDIRECT_NOT_ALLOWED`; register the final fixed endpoint instead.

</details>

<details>
<summary><b>The response is empty, truncated, or too large</b></summary>

Check the upstream status and the Operation/endpoint response limits. The tool returns a bounded projection and may redact malformed or sensitive content. Reduce the API query with filters, pagination, or a service-supported `LIMIT`; the application limit does not guarantee that the upstream service avoided a large scan.

</details>

<details>
<summary><b>Why was a write refused?</b></summary>

Writes require a write method, Operation and Kit write policies, a Host approval, and the exact request/Registry/session binding used during preparation. `api_write_prepare` never contacts the network. A missing approval, stale Registry, token replay, changed parameters, disabled Kit/Target, missing credential, unsupported body, or unavailable approval UI fails closed. Query the Operation with `api_describe` and start a new prepare flow.

</details>

<details>
<summary><b>Can the browser or model see my password or token?</b></summary>

The browser-facing safe views do not include `secretRef`, password, token, client secret, request headers, or response headers. The Host resolves credentials per request. However, the projected API response and tool arguments are model-facing data and may be sent to the LLM provider configured for the session. Credential metadata and Registry files are local to the DSH profile, but this does not make API response data local-only.

</details>

<details>
<summary><b>Where are configuration and audit logs stored?</b></summary>

By default:

```text
$DSH_HOME/storages/dsh-api-kit/registry.json
$DSH_HOME/storages/dsh-api-kit/audit/audit-YYYY-MM-DD.jsonl
```

If `DSH_HOME` is not set, the implementation falls back to the DSH home directory (typically `~/.dsh`). Registry backups, damaged-file recovery artifacts, and audit retention are managed by the Host components.

</details>

## Development and verification

This repository is an ESM package with DSH-independent Host/domain modules and a browser bundle. The available checks are:

```powershell
pnpm test
pnpm run check
pnpm pack --dry-run
git diff --check
```

`pnpm test` runs the configuration, session, discovery, executor, SSRF, redaction, Registry, OpenAPI import, OAuth2, confirmation, transport, and client-contract regression tests. `pnpm run check` validates bundle metadata, exported entry points, Typert descriptors, tool registrations, import boundaries, and client UI guards. `pnpm pack --dry-run` verifies the package’s `files` allowlist and should include both README files, `CHANGELOG.md`, the bundle entries, and the selected regression tests.

There is no dedicated browser smoke script in this repository. A release candidate should therefore be installed into an isolated DSH profile and checked manually in a real DSH Web process.

## License and disclaimer

[MIT](./LICENSE). This project is not affiliated with DeepSeek. Use production endpoints, credentials, and write policies only after reviewing your organization’s security and authorization requirements.
