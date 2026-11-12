# Provider-neutral agent guard hooks

Phase 2 hardening ([issue #60](https://github.com/osloer-industries/typescript-node-template/issues/60))
ships **TypeScript hook scripts** under `scripts/agent-hooks/` that agents or Git hooks can
invoke without vendor-specific policy files. Provider wiring (for example `.claude/settings.json`)
is tracked separately ([#47](https://github.com/osloer-industries/typescript-node-template/issues/47))
and is not part of the template until owners decide.

Tooling context: [ADR 0003](adr/0003-typescript-scripts-on-node-24.md),
[ADR 0009](adr/0009-tooling-and-quality-gate-stack.md).

## Exit codes

| Code | Meaning | Typical use |
| --- | --- | --- |
| `0` | Ok | Allow the agent action or stop |
| `1` | Warn | Surface a problem; provider may allow retry |
| `2` | Block | Deny the action (Claude Code hook semantics) |

## Input contract

Hooks read **JSON from stdin** when it is not a TTY, otherwise **argv flags**:

| Field | Type | Scripts | Description |
| --- | --- | --- | --- |
| `paths` | `string[]` | `block-guardrail-edits` | Repository-relative paths the agent is about to write |
| `fastCheckStrike` | non-negative integer | `pre-stop-fast-check` | `0` = first failed stop attempt (warn); `≥ 1` = block |

Argv equivalents:

- `--paths path/a.ts,path/b.ts`
- `--fast-check-strike 0`

Example stdin for a PreToolUse-style edit guard:

```json
{ "paths": ["AGENTS.md", "src/index.ts"] }
```

Example stdin for a Stop hook after a failed fast check (second attempt):

```json
{ "fastCheckStrike": 1 }
```

## Scripts

### `block-guardrail-edits.ts`

Blocks writes to paths that match the same guardrail list as
[`scripts/check-guardrail-changes.ts`](../scripts/check-guardrail-changes.ts) and
[`CODEOWNERS`](../CODEOWNERS). Exit `2` when any path is a guardrail path.

```bash
node scripts/agent-hooks/block-guardrail-edits.ts --paths AGENTS.md,src/index.ts
```

### `pre-stop-fast-check.ts`

Runs `npm run check:fast` before an agent ends a turn. On failure:

- `fastCheckStrike` `0` → exit `1` (warn; fix and retry)
- `fastCheckStrike` `≥ 1` → exit `2` (block; hand off to a human)

Providers should increment `fastCheckStrike` across repeated failed stop attempts in the same session.

```bash
node scripts/agent-hooks/pre-stop-fast-check.ts --fast-check-strike 0
```

## Fast verification lane

`npm run check:fast` is the subset used by the stop hook: Oxlint, suppression baseline,
typecheck, SonarJS, and Vitest **excluding** `*.integration.test.ts` (setup scenario installs).
Use it while iterating; run full `npm run check` before opening a pull request (see `AGENTS.md`).

## Optional Lefthook integration

To fail locally when staging guardrail paths (human or agent), add a `pre-commit` command that
passes staged paths into `block-guardrail-edits`. The template does not enable this by default so
maintainers can edit harness files with CODEOWNERS review only.
