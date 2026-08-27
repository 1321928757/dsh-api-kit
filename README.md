# dsh-api-kit

> A local-first DeepSeek Harness plugin for API Kits, OpenAPI import, session-scoped activation, and safe API calls.

## Current status

This release includes the **T03 Registry persistence foundation (0.1.0)** on top of the T01 bundle skeleton and T02 domain model. It currently provides:

- Host, Client, and Typert bundle entry points;
- an `API Kit` placeholder in the conversation input row;
- an `API Kit` placeholder settings page;
- normalized Registry loading, schema migration, integrity checks, atomic saves, backups, damaged-file recovery, and in-memory snapshots;
- optional OpenAPI import archive modes: no archive by default, or an explicit sanitized/raw archive.

The Registry core is not yet connected to a DSH Host Service. API Kit CRUD, authentication profiles, `api_*` Agent tools, and real HTTP requests are not implemented, and credentials are never saved or read.

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
