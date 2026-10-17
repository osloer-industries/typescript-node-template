## Summary

Describe the change and why it is needed.

Use a Conventional Commit title, for example `feat: add JSON output` or `fix(cli): handle empty input`. The squash-merge commit uses this title so Release Please can calculate the version and changelog.

## Acceptance criteria

- [ ] Behavior matches the linked issue (or PR summary) and tests cover success, failure, and boundary cases where relevant
- [ ] Public exports, CLI behavior, plugin interfaces, or MCP tools are documented when changed

## Verification

See [AGENTS.md](../AGENTS.md) for the verification ladder. At minimum:

- [ ] `npm run check`
- [ ] `npm audit --omit=dev` when dependencies or the lockfile changed
- [ ] Setup or scenario changes exercised via `scripts/setup.test.ts` when `scripts/setup-lib.mjs` profiles changed
- [ ] Documentation updated if behavior changed
- [ ] No secrets, credentials, or generated files committed

## Related issue

Closes #
