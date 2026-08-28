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
- Added T08 fixed-target `api_call` execution for GET/HEAD Operations, including request-time Host authentication, declared parameter validation, host allowlist checks, cooperative cancellation, timeout and response-size limits, safe JSON/text projection, and injectable fake transport tests.
- Added T09 execution-time DNS/IP/CIDR SSRF policy, IPv4/IPv6 and mapped-address classification, DNS rebinding-resistant pinned HTTP transport, redirect denial, recursive JSON response redaction, and Host-only append-only JSONL audit logging for calls and policy rejections.
- T09 retains GET/HEAD-only execution and defers OpenAPI import, dynamic context, write operations, OAuth, SSE/WebSocket, automatic redirects, and independent MCP export.

## Unreleased / T10

- Added `lib/runtime-context.js` and Host `systemPrompt.context` registration for authoritative per-session, per-assembly API Kit summaries.
- Added runtime-context, registration, and MVP discovery-to-call tests. The context exposes Kit/environment metadata, discoverable operation counts, fixed tool workflow, and security limits without URLs, hosts, CIDRs, credential references/values, headers, cookies, or full schemas.
- T10 keeps GET/HEAD-only execution and defers OpenAPI import, write operations, OAuth, SSE/WebSocket, automatic redirects, and independent MCP export.

## Unreleased / T11

- Added the DSH-independent bounded OpenAPI JSON importer and preview builder for OpenAPI 3.0/3.1 and Swagger 2.0.
- Added local JSON Pointer `$ref` resolution with cycle/depth/count bounds, stable operation provenance, parameter/body/response normalization, server candidates, security templates, and actionable warnings/errors.
- Added deterministic new/update/conflict/skip preview classification without Registry mutation, network access, file access, or secret import; added importer tests and JSON fixtures.
- T11 intentionally deferred confirmation transactions, Tag filtering, multi-service/Kit/Environment/Auth assignment, YAML/URL/Git import, remote refs, OAuth2, uploads, and write-operation confirmation to T12 or later.

## Unreleased / T12

- Added `lib/openapi-import-transaction.js` with a DSH-independent preview/confirmation service. Confirmation re-parses the original bounded JSON, revalidates the current Registry and commits all selected Operations and Kit links through one serialized `store.update` transaction.
- Added bounded transaction IDs, document/Registry fingerprints, stale-preview rejection, dry-run mode, same-transaction idempotent replay, Tag/untagged selection, explicit `overwrite`/`keep-local`/`skip` conflict decisions, existing Target/Environment/Auth Profile/Kit bindings, and fail-closed security mapping.
- Added Host configuration/Gateway and Typert/Client descriptors for `previewOpenApiImport` and `confirmOpenApiImport`, plus a settings-page JSON paste/preview/bind/confirm workflow with explicit second confirmation.
- Server URLs remain display-only; the transaction does not create environments, import secrets, access the network, or enable write Operations for Agent execution. Archive persistence remains separate and best-effort after a successful Registry commit.
- Added T12 transaction tests, manifest checks, and package inclusion for the transaction module.

## Unreleased / T13

- Improved the settings page and session Kit picker for keyboard operation, focus-visible states, Escape handling, focus restoration, semantic status/error announcements, and accessible form labels.
- Added request-generation and mounted guards to prevent stale RPC responses from overwriting current Session or settings state; binding lists now preserve partial results and expose retry actions.
- Added explicit JSON field validation that preserves drafts, actionable import/preview error guidance, duplicate-action guards, and consistent busy/success feedback.
- Updated Client styling to use the inspected DSH light/dark tokens, responsive 720px/520px layouts, viewport-bounded picker behavior, 44px controls, long-text wrapping, and reduced-motion support. T13 does not change Host/RPC behavior or enter write-operation/OAuth work.
