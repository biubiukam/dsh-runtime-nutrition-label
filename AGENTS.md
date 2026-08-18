# Local Agent Instructions

This directory is the standalone repository for `dsh-runtime-nutrition-label`.

- Keep the implementation compatible with the deepseek-harness Cordis, TypeScript, pnpm, Vitest, tsdown, and `oxlint` conventions.
- Treat the parent checkout's unrelated `package.json` change as user-owned; do not revert it.
- Do not modify `vendor/` or the parent lockfile.
- Keep raw tool arguments, raw results, file contents, credential values, and complete URLs out of code, fixtures, snapshots, and documentation examples.
- Every public behavior change needs tests and updates to the English and Chinese documentation pair.
- Waterfall listeners must call `next()` unless they intentionally own a denial result.
- Validate the standalone repository with `CI=1 pnpm check` before claiming completion.
