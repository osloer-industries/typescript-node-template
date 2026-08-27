# Repository Guide

These instructions apply to every human and automated contributor. Keep this
template small, secure, and provider-neutral. Do not add provider-specific
instruction files or session artifacts.

## Runtime and commands

Use Node.js 22 and npm. Dependencies must use exact versions, and
`package-lock.json` is authoritative and must be committed with dependency
changes.

| Command | Purpose |
| --- | --- |
| `npm ci` | Install the locked dependency set. |
| `npm run lint` | Run Oxlint, including type-aware promise checks. |
| `npm run typecheck` | Run the authoritative `tsc --noEmit` typecheck. |
| `npm test` | Run unit tests. |
| `npm run test:coverage` | Run tests and enforce 80% coverage. |
| `npm run build` | Compile the distributable into `dist/`. |
| `npm run check` | Run all local quality gates. |
| `npm audit --omit=dev` | Audit production dependencies. |

Before submitting a change, run `npm run check`. When dependencies change,
also run `npm audit --omit=dev`.

## Architecture and testing

- Keep production code in `src/`. Tests belong beside the code as
  `*.test.ts` or `*.spec.ts`.
- Keep the package ESM-only and preserve strict TypeScript settings.
- Keep public exports deliberate and compatible with the package export map.
- Use Vitest for behavior-focused unit tests. Add or update tests for every
  behavior change and keep the coverage threshold at 80% for all metrics.
- Oxlint enforces correctness, suspicious patterns, cycles, focused-test
  prevention, and promise misuse. `tsc --noEmit` remains the typecheck of
  record. Do not replace it with Oxlint's experimental type checking.

## Setup CLI scenarios

The setup CLI supports `plugin`, `mcp`, `npm-package`, and `cli` scenarios.
Keep each generated scenario provider-neutral, secure by default, and covered
by the repository quality commands. Update the README when a scenario's
behavior or generated files change.

## Security and dependencies

- Never commit credentials, tokens, private keys, local environment files, or
  npm authentication data.
- Keep `.npmrc` free of tokens. If a secret is committed, revoke and rotate it
  immediately.
- Preserve the production audit, CodeQL, dependency review, Dependabot, and
  SonarQube Cloud placeholder workflow. SonarQube Cloud Automatic Analysis
  must stay disabled when GitHub Actions provides analysis.
- Do not weaken action SHA pins, workflow permissions, timeouts, concurrency,
  or audit severity without an explicit security reason.

## Releases and contributions

- Use Conventional Commits and semantic pull request titles. Preferred types
  are `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`,
  `revert`, `style`, and `test`.
- Release Please uses the organization `RELEASE_TOKEN`. Do not replace it with
  a personal token or bypass its pull request checks.
- Keep changes focused and independently reviewable. Do not mix dependency
  updates with unrelated behavior or policy changes.
- Rulesets and branch-protection changes are manual. Document recommendations,
  but do not change them automatically.
