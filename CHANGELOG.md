# Changelog

## 0.1.0

- Created the initial dsh-api-kit profile bundle skeleton.
- Added Host, Client, and Typert entry points.
- Added placeholder API Kit composer control and settings section.
- Added a DSH-independent Registry store with schema migration, integrity validation, atomic writes, backups, damaged-file recovery, rollback-safe snapshots, and serialized updates.
- Added explicit OpenAPI archive modes: `none` by default, `sanitized`, and opt-in `raw`.
- Added Host-side service target, environment, and authentication profile configuration with safe views, reference protection, production opt-in, and request-time credential resolution.
- Added manual Operation CRUD, minimal API Kit CRUD, strict write validation, Kit/Operation link reconciliation, safe views, and Host-only configuration RPC.
- Added a settings page for creating, editing, enabling/disabling, associating, and deleting Operations and Kits without exposing credentials.
- Added T06 session-scoped API Kit and Environment selection in `conversation.input.left`, with Host-owned in-memory state, multi-Kit selection, compatibility diagnostics, lifecycle cleanup, and authoritative stale-state revalidation.
- Added T07 fixed Host-registered Agent tools `api_kits`, `api_operations`, and `api_describe`, with session-authoritative revalidation, policy intersection, safe summaries, filtering/pagination, stable operation descriptions, and bounded output.
- Deferred `api_call` HTTP execution, OpenAPI import, SSRF/DNS checks, response governance, and auditing to later implementation tasks.
