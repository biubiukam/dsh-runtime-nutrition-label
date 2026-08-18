# Contributing

English | [中文](CONTRIBUTING.zh.md)

Thanks for contributing to `dsh-runtime-nutrition-label`.

## Scope

Keep changes inside this standalone repository unless the change is explicitly coordinated with the parent `deepseek-harness` checkout. Do not add credentials, raw tool payloads, file contents, or signed URLs to source, fixtures, snapshots, issues, or pull requests.

## Local setup

```sh
corepack enable
CI=1 pnpm install --frozen-lockfile
CI=1 pnpm check
```

The supported Node versions are listed in `.node-version` and `package.json`. The repository uses pnpm, TypeScript, Vitest, tsdown, publint, Knip, and `oxlint` with type-aware checks.

## Change requirements

- Add or update tests for behavior changes.
- Update `README.md` and `README.zh.md` when the public contract changes.
- Update the relevant design document and its Chinese counterpart when the design changes.
- Keep snapshots bounded and privacy-preserving.
- Preserve reversible Cordis effects and call `next()` in waterfall listeners.
- Add a focused entry to `CHANGELOG.md` for user-visible changes.

## Pull requests

Explain the user-visible contract, failure behavior, privacy impact, compatibility assumptions, and commands run. A pull request that changes runtime behavior should include a test demonstrating the assembled plugin path, not only a pure helper test.

## Commit messages

Use concise imperative subjects, for example `Add bounded domain evidence`. Keep unrelated formatting and dependency churn out of the commit.

## Documentation

Maintain English and Simplified Chinese documents together. After editing a pair, run:

```sh
pnpm run verify-translation-pairing --write README.md
```

The parent harness documentation rules remain the source of truth for wording, links, and paired files.
