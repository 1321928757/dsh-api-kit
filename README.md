# dsh-api-kit

> A local-first DeepSeek Harness plugin for API Kits, OpenAPI import, session-scoped activation, and safe API calls.

## Current status

This release includes the **T04 service target, environment, and authentication configuration foundation (0.1.0)** on top of the T01 bundle, T02 domain model, and T03 Registry store. It currently provides:

- Host, Client, and Typert bundle entry points;
- an `API Kit` placeholder in the conversation input row;
- an `API Kit` placeholder settings page;
- normalized Registry loading, schema migration, integrity checks, atomic saves, backups, damaged-file recovery, and in-memory snapshots;
- a Host-side configuration facade for service targets, environments, and authentication profiles;
- HTTP/HTTPS and host allowlist validation, production Agent opt-in, auth field validation, and referenced-delete protection;
- optional OpenAPI import archive modes: no archive by default, or an explicit sanitized/raw archive.

The configuration core is not yet connected to DSH Typert/RPC or browser forms. API Kit CRUD, `api_*` Agent tools, and real HTTP requests are not implemented. Credentials are resolved only through a Host-only adapter and are never saved in the Registry.

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
