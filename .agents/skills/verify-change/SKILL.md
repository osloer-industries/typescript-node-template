---
name: verify-change
description: Run check:fast while iterating and the full check ladder before a pull request; interpret gate failures and the two-strike stop-hook rule from docs/agent-guard-hooks.md.
---

# Verify a change

Use this skill when implementing or fixing code and you need to know which verification
commands to run and how to read failures.

## Fast lane (in the loop)

1. Prefer **`npm run check:fast`**: Oxlint, suppression baseline, `check:ts-only`, `agents:check`,
   `lint:deps`, typecheck, SonarJS, and `test:fast` (Vitest without setup integration installs).
2. If a gate fails, fix the **root cause** in the output — do not add lint suppressions, skip
   tests, or weaken thresholds (see **Enforced escape-hatch rules** in
   [AGENTS.md](../../../AGENTS.md)).
3. Provider stop hooks may run `check:fast` before ending a turn. On failure, `fastCheckStrike`
   `0` warns and `≥ 1` blocks — see [docs/agent-guard-hooks.md](../../../docs/agent-guard-hooks.md).

## Before opening a pull request

Run the full ladder in [AGENTS.md](../../../AGENTS.md) (**Verification**), ending with
`npm run check`. When dependencies or the lockfile change, also run `npm audit --omit=dev`.

## Reading failures

| Gate | What to fix first |
| --- | --- |
| `lint` / `lint:sonarjs` | Type and style issues in cited files |
| `lint:suppressions` | Remove disable comments; shrink baseline only when counts drop |
| `check:ts-only` | Convert new `.mjs` to `.ts` or shrink `quality/js-allowlist.json` after conversion |
| `agents:check` | Broken `` `path/to/file` `` citations or unknown `npm run` script names |
| `lint:deps` | Module graph violations (cycles, devDep leaks, `src`→`scripts`, unresolvable imports) or 0 modules cruised |
| `typecheck` | TypeScript diagnostics (authoritative over Oxlint hints) |
| `test` / `test:coverage` | Failing or uncovered behavior |
| `build` / `lint:knip` | Compile errors or unused exports after build |
