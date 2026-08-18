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

## Releases

The GitHub Actions release workflow publishes only an existing `v<semver>` tag. It verifies that the tag version matches `package.json`, runs `pnpm check`, and publishes stable versions under the `latest` npm dist-tag. A prerelease uses the first identifier as its dist-tag, so `v0.1.0-alpha.0` publishes `0.1.0-alpha.0` under `alpha`.

To publish the first alpha for version `0.1.0`, update the package version, commit it, and push the commit and tag:

```sh
npm version 0.1.0-alpha.0 --no-git-tag-version
git add package.json
git commit -m "Release v0.1.0-alpha.0"
git tag v0.1.0-alpha.0
git push origin master v0.1.0-alpha.0
```

For a later alpha in the same prerelease line, use the next explicit version such as `npm version 0.1.0-alpha.1 --no-git-tag-version`. The workflow also supports manual dispatch when you provide an existing release tag; do not reuse a published npm version or tag.

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
