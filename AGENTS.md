# Agent Guidelines

These instructions apply to any human or automated contributor.

## Priorities

1. Keep the template small, secure, and provider-neutral.
2. Preserve exact dependency versions and the committed npm lockfile.
3. Add or update tests for every behavior change.
4. Never commit credentials, tokens, private keys, or local environment files.

## Required checks

Run `npm run check` before submitting a change. When dependencies change, also run `npm audit --omit=dev` and commit `package-lock.json`.

## Conventions

- Use Node.js 22, npm, strict TypeScript, and ECMAScript modules.
- Use Oxlint and Vitest.
- Keep dependency ranges exact, without `~` or `^`.
- Prefer open standards and avoid tool-specific instruction files.
- Make focused changes and do not rewrite unrelated files.
