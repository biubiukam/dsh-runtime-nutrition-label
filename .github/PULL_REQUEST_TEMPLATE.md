## Summary

<!-- State the user-visible contract and the affected runtime seam. -->

## Privacy and compatibility

- [ ] This change does not retain raw tool arguments, raw results, file contents, credential values, or complete URLs.
- [ ] DSH runtime and Cordis compatibility assumptions are documented.
- [ ] English and Chinese documentation pairs are updated when needed.

## Verification

- [ ] `CI=1 pnpm lint`
- [ ] `CI=1 pnpm typecheck`
- [ ] `CI=1 pnpm test:coverage`
- [ ] `CI=1 pnpm build`
- [ ] `CI=1 pnpm hygiene`
- [ ] `git diff --check`

## Notes

<!-- Mention known limitations, migration notes, or follow-up work. -->
