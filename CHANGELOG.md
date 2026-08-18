# Changelog

English | [中文](CHANGELOG.zh.md)

## Unreleased

- Validate tag and package versions before npm publication and route prerelease versions to their matching npm dist-tag.

## [0.1.0] - 2026-08-18

### Added

- Evidence-backed runtime labels for configured DSH tool namespaces.
- Bounded tool, filesystem, network, side-effect, and evidence metrics.
- Optional `/nutrition-label [plugin-id]` human command.
- DSH bundle metadata and a root patch that activate the service and command after `dsh plugin add`.
- Community package ownership under `biubiukam/dsh-runtime-nutrition-label` with the unscoped npm name `dsh-runtime-nutrition-label`.
- Standalone TypeScript, Vitest, tsdown, publint, Knip, and `oxlint` workflow.
