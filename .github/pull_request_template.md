# Pull request

## Summary

Describe the change and why it is needed.

Use a Conventional Commit title, for example `feat: add JSON output` or `fix(cli): handle empty input`.
The squash-merge commit uses this title so Release Please can calculate the version and changelog.

## Acceptance criteria

- [ ] Behavior matches the linked issue (or PR summary) and tests cover success, failure, and boundary cases where relevant
- [ ] Public exports, CLI behavior, plugin interfaces, or MCP tools are documented when changed

## Verification

See [AGENTS.md](../AGENTS.md) for the verification ladder. At minimum:

- [ ] `npm run check` (includes `lint:md` and `lint:md-links`)
- [ ] `npm audit --omit=dev` when dependencies or the lockfile changed
- [ ] Setup or scenario changes exercised via `scripts/setup.test.ts` when `scripts/setup-lib.mjs` profiles changed
- [ ] Documentation updated if behavior changed
- [ ] No secrets, credentials, or generated files committed

## Ready for review

See [AGENTS.md](../AGENTS.md) (Agent workflow). Confirm all of the following before requesting review:

- [ ] No merge conflicts; branch is up to date with `main` (merge `main` in — do not rebase or force-push)
- [ ] Every required check on the current head is green (pending is not ready)
- [ ] No unresolved review threads, requested changes, or open SonarCloud issues
- [ ] Linked issues are referenced in the PR description

## Related issue

Closes #
