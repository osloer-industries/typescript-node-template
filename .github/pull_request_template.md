## Summary

Describe the change and why it is needed.

Use a Conventional Commit title, for example `feat: add JSON output` or `fix(cli): handle empty input`. The squash-merge commit uses this title so Release Please can calculate the version and changelog.

## Acceptance criteria

Map the linked issue (or task template) into checkboxes you can verify before merge:

- [ ] Behavior matches the issue summary and acceptance criteria
- [ ] Tests added or updated when behavior changed (see [AGENTS.md](AGENTS.md))
- [ ] No secrets, credentials, or environment-specific paths in commits or templates

## Verification

Follow the verification ladder in [AGENTS.md](AGENTS.md) (start with `npm ci` when dependencies changed, then the gates below).

- [ ] `npm run check`
- [ ] `npm audit --omit=dev` when `package.json` or `package-lock.json` changed
- [ ] Documentation updated if behavior, exports, CLI, plugin, or MCP surfaces changed

Scenario-specific hints (when your change touches that setup path):

- [ ] **plugin** — run setup/tests relevant to the plugin profile
- [ ] **mcp** — run setup/tests relevant to the MCP profile
- [ ] **npm-package** — run setup/tests relevant to the npm-package profile
- [ ] **cli** — run setup/tests relevant to the CLI profile

## Related issue

Closes #
