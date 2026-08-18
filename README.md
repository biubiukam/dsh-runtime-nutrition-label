# dsh-runtime-nutrition-label

English | [中文](README.zh.md)

Evidence-backed runtime nutrition labels for DeepSeek Harness tool namespaces and plugin identities.

This is a community-maintained plugin published from [`biubiukam/dsh-runtime-nutrition-label`](https://github.com/biubiukam/dsh-runtime-nutrition-label). It is not an official DeepSeek AI package or endorsement.

## What it provides

This plugin observes the DSH tool and filesystem event seams and publishes a bounded JSON snapshot for each configured plugin identity. A label separates author or deployer declarations from facts observed during the current process window.

- Declared capabilities: network, credentials, subprocess, persistence, and expected domains.
- Observed tool metrics: schema bytes, calls, successes, failures, duration statistics, argument/result byte totals, and configured side-effect classifications.
- Observed filesystem metrics: reads, writes, unique target count, and privacy-controlled path samples.
- Observed network destinations: hostnames found in HTTP(S) URL arguments, never complete URLs.
- Bounded evidence records with `declared`, `observed`, and `inferred` provenance.

The first release deliberately does not compress these fields into a scalar grade. Declarations, runtime observations, and deployment policy have different evidence quality and must remain distinguishable.

## Install with DSH

```sh
dsh plugin --profile web add dsh-runtime-nutrition-label
dsh --profile web
```

The package declares a `dsh.bundle` patch, so `dsh plugin` installs it into the selected profile, appends it to `dsh.profile.bundles`, and automatically mounts both the `ctx.runtimeNutritionLabels` service and `/nutrition-label` command. The default configuration attributes visible tools to the reserved `unattributed` label until the profile supplies explicit mappings.

For a direct Cordis composition that does not use DSH profiles, install the package as an ordinary dependency:

```sh
pnpm add dsh-runtime-nutrition-label
```

The package has a normal peer dependency on `@deepseek-ai/cordis`. DSH runtime packages are listed under the package-specific `dsh.runtimePeers` metadata because the current public DSH RC dependency graph does not publish every transitive type package required for a clean standalone install. A DSH deployment must provide compatible `@deepseek-ai/dsh-tools`, `@deepseek-ai/dsh-fs`, `@deepseek-ai/dsh-commands`, and `@deepseek-ai/dsh-invariants` implementations. The metadata can move back to ordinary peer dependencies when that public graph is complete.

## Composition

The shipped [`cordis.patch.yml`](cordis.patch.yml) inserts the service and command rows. Attribution is explicit: this plugin does not infer Cordis fiber ownership from an opaque runtime object, so a profile configures exact tool names or prefixes by overriding the `runtime-nutrition-label` row in its own `cordis.patch.yml`:

```yaml
- id: runtime-nutrition-label
  config:
    plugins:
      - id: mcp-github
        displayName: GitHub MCP
        tools:
          prefixes:
            - mcp__github__
        declared:
          network: true
          credentials: true
          domains:
            - api.github.com
        effects:
          - prefixes:
              - mcp__github__create_
              - mcp__github__merge_
            effect: write
```

The bundle enables the separate human command consumer by default. Disable only that row when the profile should collect labels without exposing `/nutrition-label [plugin-id]`:

```yaml
- id: runtime-nutrition-label-command
  disabled: true
```

See [`examples/cordis.patch.yml`](examples/cordis.patch.yml) for a complete profile override.

## Configuration

`plugins[].tools` requires at least one exact name or prefix. Exact tool ownership must be unique, and prefix ranges may not overlap. The reserved label id `unattributed` is used for unmatched tools when `includeUnattributed` is enabled.

`effects` are ordered rules scoped to one configured plugin. Exact names take precedence over prefixes, and an unmatched tool has effect `unknown`. The effect is a configured classification, not proof that a provider performed the operation.

`evidenceLimit`, `fileSampleLimit`, `domainSampleLimit`, `argumentScanMaxDepth`, and `argumentScanMaxNodes` are validated positive or non-negative safe integers at load time. `pathDisplay` accepts `omit`, `basename`, or `full`; `omit` is the recommended default for shared reports.

## Snapshot contract

The service exposes:

```ts
ctx.runtimeNutritionLabels.snapshot()
ctx.runtimeNutritionLabels.snapshot('mcp-github')
ctx.runtimeNutritionLabels.reset()
ctx.runtimeNutritionLabels.ownerOfTool('mcp__github__create_issue')
```

Snapshots are deeply frozen and have `schemaVersion: 1`. They include an ISO timestamp, a monotonic in-process `revision`, configured declarations, observed aggregates, and bounded evidence records. The service never stores raw tool arguments, raw tool results, file contents, credential values, or complete URLs.

## Evidence semantics

### Declared

`declared` fields come from plugin authors or deployment configuration. They describe intended or possible capabilities and remain present even when the current process has not exercised them.

### Observed

`observed` fields come from DSH event payloads or the visible tool schema registry. Filesystem writes count only after a write or edit intent is followed by an authoritative `fs/observed` event.

### Inferred

`inferred` evidence records explain classifications derived from explicit configuration, such as a tool being marked `write` by an effect rule. Inference is never presented as an observed provider fact.

## Privacy model

- Tool and result sizes are retained as byte counts, not payloads.
- URL scanning retains hostnames only and ignores URL paths, queries, fragments, and credentials.
- File samples are optional and can be omitted entirely; the collector does not read file contents.
- Evidence records are capped per label and are intended for local diagnostics, not an audit archive.
- Credential declarations contain booleans and expected reference metadata only; secret values never enter the snapshot.

## Model Experience

This package does not add a model-facing tool or prompt section. The optional `/nutrition-label` command is dispatched by a human command consumer and does not change model history.

### Human command report

#### What the model sees

None, because the command is human-facing and returns Markdown to the command adapter.

#### Token effect

Zero direct tokens. A caller may choose to copy the report into a conversation, but that copy is outside this package.

#### KV Cache effect

No direct model request and no cache invalidation. Runtime observation continues independently of model prompt assembly.

## Known Limitations and Deferred Work

- Tool attribution depends on exact names and prefixes supplied by the deployment; generic runtime events do not prove Cordis plugin ownership.
- Generic DSH events cannot fully prove subprocess creation, credential resolution, persistence, or hidden provider-side network activity.
- Network evidence only covers HTTP(S) URL strings found in bounded tool arguments.
- The package intentionally does not publish a scalar safety or trust grade.
- The current standalone package uses `dsh.runtimePeers` until the public DSH RC dependency graph is complete.
- The snapshot is process-local; durable session events and long-term storage are outside this package.

## Extension points

The collector is a pure state fold and can be consumed without the command plugin. A deployment can add another renderer, export snapshots to a local telemetry sink, or attach policy decisions to the same `tools/*` and `fs/*` events without changing the JSON contract.

## Development

```sh
CI=1 pnpm install --frozen-lockfile
CI=1 pnpm check
```

`pnpm check` runs `oxlint`, TypeScript, coverage, the build, and package hygiene. See [CONTRIBUTING.md](CONTRIBUTING.md) for the contributor workflow and [docs/architecture.md](docs/architecture.md) for the implementation model.

## License

MIT. See [LICENSE](LICENSE).
