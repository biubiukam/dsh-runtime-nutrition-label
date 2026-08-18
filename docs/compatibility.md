# Compatibility

English | [中文](compatibility.zh.md)

## Runtime

The package targets Node `^22.19.0 || >=24.0.0`, ESM, TypeScript strict mode, and pnpm 11. The supported package manager is recorded in `package.json`.

## DSH versions

The public API is designed for the DSH RC tool, filesystem, command, and invariant event contracts used by this repository. The plugin requires a compatible `@deepseek-ai/cordis` 4.x runtime.

The DSH package names and ranges that a deployment must provide are recorded under `package.json` → `dsh.runtimePeers`. They are not ordinary peer dependencies because the current public RC graph does not publish every transitive type package needed by a clean standalone installation.

## Installation paths

The npm release ships built `lib/` artifacts and a root bundle patch, so `dsh plugin --profile <name> add dsh-runtime-nutrition-label` installs and activates it without an install-time build. A GitHub source install uses `github:biubiukam/dsh-runtime-nutrition-label#<commit>` and runs the package's `prepare` build; pnpm 10 and later require the user to allow that build explicitly. Pin a commit before granting install-time execution.

## Event requirements

The service consumes `tools/pre-execute`, `tools/result`, `tools/change`, `fs/write-intent`, `fs/edit-intent`, and `fs/observed`. A deployment that does not provide filesystem events still receives tool and schema metrics; filesystem fields remain empty.

## Compatibility limits

- The plugin does not inspect private Cordis fiber internals to assign ownership.
- A provider that bypasses DSH tool or filesystem events cannot be observed by this package.
- A DSH release that changes event payload fields requires a matching compatibility update and test fixture.
- The command consumer requires a `ctx.commands` service; the collector service does not.

## Verification

Run `CI=1 pnpm check` against the standalone repository. A release check should also pack the package, install the tarball through `dsh plugin` into a disposable profile, confirm that the profile lists `dsh-runtime-nutrition-label` under `dsh.profile.bundles`, and inspect the composed configuration for both bundle rows.
