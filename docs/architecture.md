# Technical Architecture

English | [中文](architecture.zh.md)

## Placement

Runtime Nutrition Label is an out-of-tree Cordis service plugin. It consumes the DSH tool registry and event streams but does not modify the Agent Loop, tool implementations, filesystem providers, or session persistence.

The npm package also acts as a DSH bundle. `package.json` declares `dsh.bundle.patch`, and the shipped root `cordis.patch.yml` inserts the service and command rows. The official CLI therefore records the package in a profile's ordered bundle list after a successful `dsh plugin add`; later profile and home patch layers can replace the service configuration or disable the command row.

## Components

- `RuntimeNutritionLabelService` registers `ctx.runtimeNutritionLabels`, subscribes to lifecycle events, and exposes the public snapshot API.
- `RuntimeNutritionCollector` owns mutable state and publishes deeply frozen snapshots.
- `config.ts` validates declarations, attribution ranges, side-effect rules, and retention limits at load time.
- `command.ts` is an optional human command consumer and does not add model-visible context.
- `invariant.ts` registers the package-owned invariant companion. Aggregate consistency is owned by the collector; event payload validity remains with the DSH producers.
- `cordis.patch.yml` is the profile bundle layer that mounts the service and command from the installed npm package.

## Event flow

1. `tools/pre-execute` records the configured owner, argument byte count, effect classification, URL hostnames, and a start timestamp before downstream policies run.
2. `tools/result` records success or failure, result byte count, and elapsed time.
3. `tools/change` refreshes schema byte counts from the complete visible tool registry.
4. `fs/write-intent` and `fs/edit-intent` associate a target with the current tool actor.
5. `fs/observed` commits a read or write observation. A write is counted only when an intent for the same target preceded the observation.
6. `snapshot()` folds the private state into a sorted, bounded, deeply frozen JSON value.

Waterfall listeners prepend their observation and always delegate with `next()`. The collector never denies or rewrites a call.

## Attribution

The DSH events expose tool execution and actor relationships, not a universal plugin-owner identity. Configuration therefore maps exact tool names and non-overlapping prefixes to stable label ids. Unmatched tools can be grouped under `unattributed` or ignored. Exact effect rules take precedence over prefix rules.

## Privacy and bounds

The collector measures JSON byte sizes but never stores the serialized payload. URL traversal is depth- and node-bounded and retains hostnames only. File samples follow `pathDisplay` and `fileSampleLimit`. Evidence records and output domain samples are bounded by configuration.

## Lifecycle and disposal

The service is a Cordis `Service`; its provider registration and event listeners are effects owned by the plugin fiber. Unloading the fiber removes the service and all listeners. The optional command plugin owns its command registration separately.

The bundle layer uses stable row ids `runtime-nutrition-label` and `runtime-nutrition-label-command`. A profile override targets those ids; removing the package through `dsh plugin` removes its dependency and bundle layer together.

## Failure behavior

Invalid configuration fails at load time. An unknown label id fails snapshot and reset queries with a `RangeError`. A tool schema refresh failure is logged and does not change the last successful observation state. Collection is observational: it does not turn an instrumentation failure into a tool denial.

## Compatibility boundary

The standalone package keeps only Cordis as a normal peer dependency because the current public DSH RC graph has a missing transitive type package. The `dsh.runtimePeers` metadata documents the DSH runtime packages that must be present in a real deployment, while `src/*compat.d.ts` supplies compile-time declarations for standalone development.
