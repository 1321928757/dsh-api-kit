# Changelog

## 0.1.0

- Created the initial dsh-api-kit profile bundle skeleton.
- Added Host, Client, and Typert entry points.
- Added placeholder API Kit composer control and settings section.
- Added a DSH-independent Registry store with schema migration, integrity validation, atomic writes, backups, damaged-file recovery, rollback-safe snapshots, and serialized updates.
- Added explicit OpenAPI archive modes: `none` by default, `sanitized`, and opt-in `raw`.
- Added Host-side service target, environment, and authentication profile configuration with safe views, reference protection, production opt-in, and request-time credential resolution.
- Deferred DSH Typert/RPC wiring, API Kit CRUD, tools, and HTTP execution to later implementation tasks.
