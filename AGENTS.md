# Agent Guidelines

These instructions apply to every human or automated contributor. Keep this file
provider-neutral: the canonical map, verification ladder, and change recipes live
here.

<!-- org-agent-workflow:start v0.1.4 -->

## Agent workflow (org-wide, keep identical across osloer-industries repos)

These rules apply to every agent (Cursor, Grok Bot, any other) working in this repo.

### Quality

- Never cut corners on quality or architecture. Fix root causes. No `continue-on-error`, `|| true`, skipped or
  deleted tests, lowered thresholds, ignore or suppress comments, `NOSONAR`, exclusions, new lint/Sonar rule
  exceptions or overrides, audit ignores, `--legacy-peer-deps`, or `--force`.
- SonarCloud issues are resolved only by fixing code, never by marking them false positive or won't-fix.
- Scripts are TypeScript, never Python; use the repo's runtime and package manager (`engines` / `packageManager`).
- `AGENTS.md` is the only agent instruction file; never add `CLAUDE.md` or tool-specific rule files.

### CI and workflows

- Pin GitHub Actions by full commit SHA with an accurate version comment. Org reusables from
  `osloer-industries/.github` are pinned `@<full sha> # v0.x.y` (a release tag, never `# main`).
- Every CI job feeds the single `ci-passed` aggregate job, including Workflow security, CodeQL and the SonarCloud
  zero-issues job. `ci-passed` is the only required status check.
- Only Dependabot patch/minor bumps and patch/minor release PRs auto-merge. Majors (or pre-1.0 breaking changes)
  never auto-merge; they wait for a human.
- Run the repo's linters, tests and pre-commit checks locally before pushing. The pre-commit hook is never skipped
  (`--no-verify` is not allowed).
- Never poll CI from the shell. If your environment delivers CI notifications for the PR head, wait for them and fix
  failures; otherwise push and stop.

### Pull requests

- Keep PRs focused and reviewable, link the issues they close, and prefer simplification (less code, fewer
  dependencies, removed duplication).
- Resolve conflicts by merging the base branch in. Never rebase a pushed branch, never force-push, never bypass
  branch protection.
- A PR is ready for review only when all of these hold: it has no conflicts and is up to date with `main`; every check
  on the current head is green (pending is not ready); and it has no unresolved review threads, requested changes or
  open SonarCloud issues. Fix anything short of that yourself. Ask a human only when a real decision or ambiguity
  needs one.
- Never touch secrets, permissions, repo settings or rulesets without explicit human approval.

<!-- org-agent-workflow:end -->

## Repository map

| Path | Purpose |
| --- | --- |
| `src/` | Application or library source and colocated Vitest files. |
| `scripts/setup.mjs` | CLI entry for `npm run setup`. |
| `scripts/setup-lib.mjs` | Setup profiles and testable helpers. |
| `scripts/setup.test.ts` | Setup unit and integration tests. |
| `docs/architecture.md` | Module boundaries, scenarios, and dependency rules. |
| `docs/adr/` | Architecture Decision Records (significant harness and layout choices). |
| `docs/adr/0009-tooling-and-quality-gate-stack.md` | Why each linter, test tool, and CI integration is in the stack ([ADR 0009](docs/adr/0009-tooling-and-quality-gate-stack.md)). |
| `docs/mcp-stdio-smoke-test.md` | Credential-free MCP stdio smoke test after build. |
| `docs/mcp-account-data-agents.md` | Approval-gated writes and redaction for account-backed MCP tools. |
| `docs/playwright-ci-dependencies.md` | Playwright browsers vs `npm ci --ignore-scripts` in CI. |
| `docs/npm-overrides.md` | When and how to use npm `overrides` for transitive audit fixes. |
| `docs/sonar-quality-gate.md` | SonarCloud patterns and local SonarJS ESLint enforcement ([ADR 0009](docs/adr/0009-tooling-and-quality-gate-stack.md)). |
| `knip.config.ts` | Unused files, exports, and dependencies ([ADR 0009](docs/adr/0009-tooling-and-quality-gate-stack.md)). |
| `scripts/agents-check.ts` | Validates paths and `npm run` scripts cited in agent guidance (`npm run agents:check`). |
| `.oxlintrc.json` | Oxlint rules ([ADR 0009](docs/adr/0009-tooling-and-quality-gate-stack.md)). |
| `packages/eslint-sonarjs/` | SonarJS `recommended` rules via ESLint (TypeScript 6 parser; root uses TS 7) ([ADR 0009](docs/adr/0009-tooling-and-quality-gate-stack.md)). |
| `.github/workflows/` | CI and security automation ([ADR 0009](docs/adr/0009-tooling-and-quality-gate-stack.md)); shared jobs call [org reusables](docs/consuming-org-reusables.md) with pinned SHAs. |
| `docs/consuming-org-reusables.md` | How callers pin `osloer-industries/.github` workflows; links the org contract doc. |
| `docs/fleet-adoption.md` | Per-repo adoption of org reusables and template CI features ([ADR 0011](docs/adr/0011-fleet-adoption-table.md)). |
| `lefthook.yml` | Pre-commit hooks ([ADR 0009](docs/adr/0009-tooling-and-quality-gate-stack.md)). |
| `scripts/agent-hooks/` | Provider-neutral agent guard hook scripts ([docs/agent-guard-hooks.md](docs/agent-guard-hooks.md)). |
| `.agents/skills/` | Shared Agent Skills (`SKILL.md` per skill); index and rules in [docs/agent-skills.md](docs/agent-skills.md). |
| `scripts/agents-check.ts` | `agents:check` gate; `index` subcommand regenerates the Skills table (`npm run agents:index`). |

## Skills

Shared skills use the [Agent Skills](https://agentskills.io) layout under `.agents/skills/<name>/SKILL.md`.
Regenerate this index with `npm run agents:index` after adding or editing a skill. See
[docs/agent-skills.md](docs/agent-skills.md).

<!-- agents:skills:begin -->
| Skill | Description | Path |
| --- | --- | --- |
| pr-ready | Before review — use Lefthook pre-commit without bypass, run npm run check, keep ci-passed green on the PR head, and follow the pull request template. | `.agents/skills/pr-ready/SKILL.md` |
| verify-change | Run check:fast while iterating and the full check ladder before a pull request; interpret gate failures and the two-strike stop-hook rule from docs/agent-guard-hooks.md. | `.agents/skills/verify-change/SKILL.md` |
| write-adr | Add an Architecture Decision Record under docs/adr using the README template and update the ADR index table. | `.agents/skills/write-adr/SKILL.md` |
<!-- agents:skills:end -->

Markdown link checking uses the org fork
[`@osloer-industries/markdown-link-check`](https://github.com/osloer-industries/markdown-link-check)
(pinned in root `package.json` via a `github:…#tag` devDependency). Dependabot does not bump git-tag
dependencies; when the fork publishes a new annotated tag, update the `#v…` ref in `package.json`, run
`npm install`, and commit the lockfile change.

## Verification

While iterating (including in-loop agent stop hooks — [docs/agent-guard-hooks.md](docs/agent-guard-hooks.md)),
prefer **`npm run check:fast`**: Oxlint, suppression baseline, `agents:check`, typecheck, SonarJS, and unit tests
(`test:fast` excludes `*.integration.test.ts` setup installs). CI and pre-merge verification still
use the full ladder below.

**`npm run precommit`** (Lefthook after `npm run prepare`, and CI **Quality**) runs Oxlint, the
suppression baseline, SonarJS ESLint (including `no-await-in-loop` / S9382 and
`@typescript-eslint/require-await` / S7503), jscpd, typecheck, and the full Vitest suite.
Run **`npm run precommit` before every push**. Never commit with `git commit --no-verify`, and
never set `HUSKY=0`, `LEFTHOOK=0`, or `SKIP` to bypass hooks. Never suppress Sonar-style rules
(no new `eslint-disable`, `NOSONAR`, baseline increases, or Sonar exclusions).

Run gates in this order when preparing a pull request:

1. `npm run lint` (Oxlint — [ADR 0009](docs/adr/0009-tooling-and-quality-gate-stack.md))
2. `npm run lint:suppressions` (shrink-only suppression baseline — [ADR 0006](docs/adr/0006-escape-hatch-lint-and-suppression-baseline.md))
3. `npm run check:ts-only` (shrink-only untyped JS allowlist — `quality/js-allowlist.json`)
4. `npm run agents:check` (paths and npm scripts cited in agent guidance — [ADR 0009](docs/adr/0009-tooling-and-quality-gate-stack.md))
5. `npm run lint:sonarjs` (SonarJS via `eslint-plugin-sonarjs` — [ADR 0009](docs/adr/0009-tooling-and-quality-gate-stack.md))
6. `npm run lint:dup` (jscpd on Markdown, workflow YAML, and shell under `.jscpd.json` paths — [ADR 0009](docs/adr/0009-tooling-and-quality-gate-stack.md);
   TypeScript/JavaScript duplication is gated by SonarCloud on the pull request)
7. `npm run lint:md` and `npm run lint:md-links` ([ADR 0009](docs/adr/0009-tooling-and-quality-gate-stack.md))
8. `npm run typecheck` (root TypeScript 7 plus `packages/eslint-sonarjs` TypeScript 6 — [ADR 0009](docs/adr/0009-tooling-and-quality-gate-stack.md))
9. `npm run test` or `npm run test:coverage` (Vitest — [ADR 0009](docs/adr/0009-tooling-and-quality-gate-stack.md))
10. `npm run build` (root `typescript` — [ADR 0009](docs/adr/0009-tooling-and-quality-gate-stack.md))
11. `npm run lint:knip` (unused files, exports, and dependencies — [ADR 0009](docs/adr/0009-tooling-and-quality-gate-stack.md);
   runs after `build` so `package.json` dist entries resolve)
12. `npm run precommit` (Lefthook `pre-commit`; steps 1–4, 6, and `npm run test`)
13. `npm run check` (precommit plus no-`CLAUDE.md`, `check:ts-only`, `agents:check`, markdown, coverage, build, and knip)
   before opening a pull request
14. `npm audit --omit=dev` when `package.json` or `package-lock.json` changes ([ADR 0009](docs/adr/0009-tooling-and-quality-gate-stack.md))

`npm run test:mutation` runs Stryker on `src/` (see `stryker.config.mjs` for the TypeScript 7 workaround). It is a
separate CI job, not part of `check`.

After `npm ci`, run `npm run prepare` once locally to install Lefthook pre-commit hooks ([ADR 0009](docs/adr/0009-tooling-and-quality-gate-stack.md))
(CI uses `npm ci --ignore-scripts`, so hooks are not installed in Actions).

After editing setup profiles, rely on `scripts/setup.test.ts` integration cases for all four scenarios.

For the **mcp** scenario, also run `npm run test:mcp` when MCP tools or the stdio entrypoint
change (included in unattended `--yes` setup). See [docs/mcp-stdio-smoke-test.md](docs/mcp-stdio-smoke-test.md).

When touching `scripts/`, setup, or CI install steps, follow
[docs/sonar-quality-gate.md](docs/sonar-quality-gate.md) so **SonarCloud CI analysis** stays green
(use `scripts/run-npm.mjs`, prefer `--ignore-scripts` on npm ci/install).

## Continuous integration

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) is the main pipeline: workflow security;
**Quality** runs `npm run precommit` (run full `npm run check` before merge), setup smoke matrix, mutation testing,
**journey e2e** (`npm run test:e2e`), CodeQL, Sonar scan (`sonarqube-cloud-node.yml` with coverage upload),
Sonar zero-open-issues, fleet adoption doc check, then org **`ci-passed.yml`** (`ci-passed` job).
Repositories created from this template must keep **SonarCloud Automatic Analysis disabled** and use the CI scan
instead ([docs/sonar-quality-gate.md](docs/sonar-quality-gate.md)). Fleet callers should require only the
**`ci-passed / ci-passed`** check context—not individual jobs
([docs/consuming-org-reusables.md](docs/consuming-org-reusables.md)); this template’s default-branch ruleset registers
that context on `main`.

**End-to-end tests:** `scripts/journey.e2e.test.ts` exercises the README path (`npm ci` → setup CLI with `--yes`
so verify runs `npm run check` and `npm pack --dry-run` → run the built entrypoint) without importing `setup-lib`.
Replace `journey.e2e.test.ts` and the `journey-e2e` CI job with your product’s primary user journey after
scaffolding; keep black-box coverage through public npm scripts and documented entry points.

`sonarcloud-zero-issues.yml` is **pull_request-only**; callers must not run it on `push`, and any job listed under
`ci-passed` that is skipped on `push` must be treated as success by the aggregate gate ([docs/fleet-adoption.md](docs/fleet-adoption.md#sonar-zero-open-issues-and-ci-passed)).

## Fleet adoption

Every new or changed template harness feature, `.github/workflows/**` caller, or org reusable pin must:

1. Update the matching row in [docs/fleet-adoption.md](docs/fleet-adoption.md) (state, pin, caveat, PR/issue links).
2. Open or reference adoption work in each consuming repository and record the link in that table.

Pull requests that change `.github/workflows/**` or `.github/actions/**` without updating
`docs/fleet-adoption.md` fail CI (`scripts/check-fleet-adoption-doc.ts`).

## Change recipes

| Change | Touch | Tests |
| --- | --- | --- |
| New exported function or type | `src/index.ts`, README if public | `src/index.test.ts` success, failure, boundary |
| New MCP tool | MCP profile in `scripts/setup-lib.mjs`, generated handler | Profile tests + integration scenario `mcp` + `npm run test:mcp` |
| New CLI flag or argv rule | CLI profile in `scripts/setup-lib.mjs` | Profile tests + integration scenario `cli` |
| New setup scenario | `scripts/setup-lib.mjs`, README, SETUP docs | `scripts/setup.test.ts` unit + integration |
| npm via child_process | `scripts/run-npm.mjs` only | Do not add new `execFileSync("npm", …)` call sites |

## Do not edit without reason

- `package-lock.json` — only with intentional dependency changes via `npm ci` / exact install policy.
- Release Please manifest, changelogs, and version bumps outside the release pull request.
- Pin SHAs in GitHub Actions workflows except when bumping dependencies via Dependabot or a focused CI change.
- Org reusable workflows (`uses: osloer-industries/.github/…`) share one tag-backed SHA per bump (`# v0.x.y`
  comment, not `# main`); see [docs/consuming-org-reusables.md](docs/consuming-org-reusables.md).

## Agent and local working files

- Never commit agent session state, tool caches or per-tool instruction and config files. The
  "Agent and local working files" block in `.gitignore` lists them
  and the org `agent-files-guard` CI check rejects them ([ADR 0010](docs/adr/0010-agent-and-local-files-not-committed.md)).
- Do not work around it with `git add -f` or by removing `.gitignore` entries. To commit one on
  purpose, a maintainer adds the path to `.github/agent-files.allow` with a `# reason:` comment.
- Exception: shared skills live in `.agents/skills/<name>/SKILL.md` (Agent Skills standard). That
  path and `AGENTS.md` are the only agent paths committed by default. Do not copy skills into
  vendor-specific skill folders (for example under `.claude/<name>/skills/`).
- Claude Code (2.1.277+) reads `AGENTS.md` only when no `CLAUDE.md` or `CLAUDE.local.md`
  exists at or above the working directory (including vendor paths such as .claude/CLAUDE.md).
  Do not create those files, even
  locally: they silently switch this file off. For personal additions, set Project instructions
  to `claude-md-and-agents-md` in Claude Code's `/config`.

## Priorities

1. Keep the template small, reusable, secure, and provider-neutral.
2. Preserve exact dependency versions and the committed npm lockfile.
3. Add or update tests for every behavior change.
4. Never commit credentials, tokens, private keys, or local environment files.

## Toolchain and commands

- Use the Node.js 24 version declared by `.nvmrc` and `.node-version`.
- Install reproducibly with `npm ci`. Use `npm install --save-exact` when a
  dependency intentionally changes, then commit `package-lock.json`.
- Run `npm run precommit` before every push (Lefthook) and `npm run check` before submitting a change.
  `check` adds no-`CLAUDE.md`, markdown, coverage, production build, and knip (after build so `package.json`
  dist entries resolve). SonarCloud owns TypeScript/JavaScript duplication (Sonar way fails above **3%**
  duplicated new lines) and the org zero-open-issues check — see [docs/sonar-quality-gate.md](docs/sonar-quality-gate.md).
- Run `npm audit --omit=dev` whenever dependencies or the lockfile change. For transitive
  production findings, follow [docs/npm-overrides.md](docs/npm-overrides.md) before adding
  npm `overrides`.
- Keep `npm run typecheck` as the authoritative TypeScript diagnostic step.
  Oxlint's type-aware rules supplement it but do not replace it.

## Enforced escape-hatch rules (Oxlint)

These rules are CI-enforced. Known agent workarounds are listed so you fix the
root cause instead of bypassing the check.

| Rule | Agent workaround to avoid |
| --- | --- |
| `typescript/no-explicit-any` | Typing values as `unknown` then narrowing, or a proper generic/interface. |
| `typescript/ban-ts-comment` (all directives, even described `@ts-expect-error`) | Fix the type error; in tests pass bad input as `unknown` through the real parser. |
| `typescript/no-non-null-assertion` | Guard with `if`, optional chaining, or an explicit throw on invalid state. |
| `typescript/consistent-type-assertions` (`never`: every `as`/`<T>`; `as const` and `satisfies` allowed) | Parse external data with a schema, narrow with type guards, build typed test fixtures. |
| `osloer/no-definite-assignment` (`scripts/oxlint-plugin-osloer.ts`) | Initialise `x!:` fields and variables, or type them `T \| undefined` and narrow. |
| `unicorn/no-abusive-eslint-disable` | Do not blanket-disable rules; shrink the suppression baseline instead. |
| `no-empty` (`allowEmptyCatch: false`) | Handle errors explicitly; do not use empty `catch` blocks. |
| `reportUnusedDisableDirectives` | Do not add disable comments that hide real findings. |

SonarJS `recommended` (via `npm run lint:sonarjs`) also enforces `sonarjs/no-trivial-assertions`
(for example `expect(true).toBe(true)`). **Gap:** a `catch` block that contains only a
comment (no statements) is not flagged by Oxlint `no-empty` or SonarJS `no-ignored-exceptions`;
fix the error path or rethrow instead of comment-only swallowing.

The suppression baseline (`scripts/suppression-baseline.json`) may only **shrink**. Regenerate
with `node scripts/count-suppressions.ts --write-baseline` after intentional cleanup.
Tracked `*.mjs` / `*.cjs` / `*.js` / `*.jsx` / `*.d.mts` must appear in **`quality/js-allowlist.json`**
(shrink-only; stale entries fail). Run `npm run check:ts-only`; shrink with
`node scripts/check-ts-only.ts --write-allowlist` after converting a file.

## Architecture and implementation

- Use strict TypeScript, ECMAScript modules, and explicit `.js` extensions for
  relative imports compiled with NodeNext.
- Keep public APIs small and document intentional changes to exports, CLI
  behavior, plugin interfaces, or MCP tools.
- `src/` must not import from `scripts/`; Oxlint enforces this via `no-restricted-imports` on
  `src/**` (see [architecture.md](docs/architecture.md)).
- Avoid import cycles, floating promises, excessive nesting, and functions with
  cyclomatic complexity above 15.
- Prefer focused modules and pure functions. Do not hide lint findings with
  disable comments unless the exception is narrowly scoped and explained.
- Preserve all four setup scenarios: `plugin`, `mcp`, `npm-package`, and `cli`. Unattended
  setup (`--yes`) should keep running `npm run check` (and `npm pack --dry-run` when
  publishable) unless `--no-verify` is passed on the setup CLI (not a git pre-commit bypass).

## Tests and security

- Add tests for success, failure, and boundary behavior affected by a change.
- For pure exported functions, prefer a `@fast-check/vitest` `test.prop` when a single
  invariant covers more ground than fixed examples (`src/index.test.ts`; [ADR 0009](docs/adr/0009-tooling-and-quality-gate-stack.md)).
- Keep branch, function, line, and statement coverage at or above 80% for `src/`
  and testable `scripts/` modules. Cover CLI wiring with focused unit tests or
  CI smoke jobs when direct unit coverage is impractical.
- Treat external input, environment variables, file paths, and network results
  as untrusted. Validate before use and avoid logging sensitive values.

## MCP servers with account data

When a project exposes MCP tools backed by user accounts or sessions, agents must follow
[docs/mcp-account-data-agents.md](docs/mcp-account-data-agents.md): per-call approval before
write tools, minimum-necessary read summaries, no secret material in logs, and credential-free
`npm run test:mcp` in CI unless a dedicated secret-backed job is documented.

Browser automation dependencies (for example Playwright) must follow
[docs/playwright-ci-dependencies.md](docs/playwright-ci-dependencies.md): CI keeps
`npm ci --ignore-scripts`; install browsers locally or in an explicit CI step.

## Contributions and releases

- Use a Conventional Commit pull request title such as `feat:`, `fix:`,
  `refactor:`, `test:`, `docs:`, `chore:`, or `ci:`. The squash commit title on
  `main` is Release Please's release input.
- Do not edit generated Release Please versions or changelogs outside its
  release pull request unless correcting release metadata deliberately.
- Pre-1.0 versioning uses `bump-minor-pre-major` in `release-please-config.json`; cut `1.0.0` only via
  `Release-As: 1.0.0`. New repos from the template should reset `.release-please-manifest.json` to `0.0.0`
  (see [CONTRIBUTING.md](CONTRIBUTING.md)).
- Never bypass required reviews, checks, or organization rules.

For system design and scenario behavior, read [docs/architecture.md](docs/architecture.md).
