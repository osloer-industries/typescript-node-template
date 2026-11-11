# Provider-neutral agent guard hooks

Phase 2 hardening ([issue #60](https://github.com/osloer-industries/typescript-node-template/issues/60))
ships **TypeScript hook scripts** under `scripts/agent-hooks/` plus **minimal provider wiring**
that invokes those scripts only. Policy and path normalization live in the shared scripts, not in
JSON wiring files.

Tooling context: [ADR 0003](adr/0003-typescript-scripts-on-node-24.md),
[ADR 0009](adr/0009-tooling-and-quality-gate-stack.md).

## Exit codes

| Code | Meaning | Typical use |
| --- | --- | --- |
| `0` | Ok | Allow the agent action or stop |
| `1` | Warn | Surface a problem; provider may allow retry |
| `2` | Block | Deny the action (Claude Code hook semantics) |

## Neutral input contract

Hooks accept **JSON on stdin** (provider-native payloads are normalized automatically) or **argv flags**:

| Field | Type | Scripts | Description |
| --- | --- | --- | --- |
| `paths` | `string[]` | `block-guardrail-edits` | Repository-relative paths the agent is about to write |
| `fastCheckStrike` | non-negative integer | `pre-stop-fast-check` | `0` = first failed stop attempt (warn); `≥ 1` = block |

Argv equivalents:

- `--paths path/a.ts,path/b.ts`
- `--fast-check-strike 0`

Provider adapters ([`provider-hook-adapter.ts`](../scripts/agent-hooks/provider-hook-adapter.ts))
map each vendor’s stdin JSON (for example `tool_input.file_path`, `workspace_roots`,
`stop_hook_active`, `loop_count`) into this neutral shape. Wiring files must not duplicate that logic.

## Shared scripts

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

Providers increment the strike across repeated failed stops (`stop_hook_active` on Claude Code,
`loop_count` on Cursor, and similar fields elsewhere).

```bash
node scripts/agent-hooks/pre-stop-fast-check.ts --fast-check-strike 0
```

## Provider wiring (committed)

Wiring is **command-only**: each file points at the shared scripts with `node` (exec form or a single
command string). No shell adapters, no duplicated guardrail prose. **`CLAUDE.md` is still forbidden**
([ADR 0002](adr/0002-agents-md-single-instruction-file.md)); only `.claude/settings.json` is tracked.

| Provider | File | Edit guard event | Stop event |
| --- | --- | --- | --- |
| Claude Code | [`.claude/settings.json`](../.claude/settings.json) | `PreToolUse` matcher `Edit\|Write\|MultiEdit` | `Stop` |
| Cursor | [`.cursor/hooks.json`](../.cursor/hooks.json) | `preToolUse` matcher `Write` | `stop` |
| Codex | [`.codex/hooks.json`](../.codex/hooks.json) | `PreToolUse` matcher `Write\|Edit` | `Stop` |

Codex loads project hooks from `.codex/hooks.json` when the project `.codex/` layer is **trusted**
([Codex hooks](https://developers.openai.com/codex/hooks)).

Vitest asserts that every wiring file parses and references both scripts
([`provider-wiring.test.ts`](../scripts/agent-hooks/provider-wiring.test.ts)).

## Fast verification lane

`npm run check:fast` is the subset used by the stop hook: Oxlint, suppression baseline,
typecheck, SonarJS, and Vitest **excluding** `*.integration.test.ts` (setup scenario installs).
Use it while iterating; run full `npm run check` before opening a pull request (see `AGENTS.md`).

## Adding another provider

1. **Extend the adapter only** — teach
   [`provider-hook-adapter.ts`](../scripts/agent-hooks/provider-hook-adapter.ts) how to read that
   vendor’s stdin JSON (paths and stop-strike fields). Keep wiring free of logic.
2. **Add a minimal wiring file** that invokes:
   - `node scripts/agent-hooks/block-guardrail-edits.ts` on pre-edit / pre-write events
   - `node scripts/agent-hooks/pre-stop-fast-check.ts` on stop / end-of-turn events
3. **Register guardrails** — add the wiring path to
   [`GUARDRAIL_PATH_PREFIXES`](../scripts/check-guardrail-changes.ts), [`CODEOWNERS`](../CODEOWNERS),
   and `PROVIDER_WIRING_RELATIVE_PATHS` in
   [`provider-wiring.ts`](../scripts/agent-hooks/provider-wiring.ts).
4. **Test** — extend `provider-wiring.test.ts` and add adapter fixtures in
   `provider-hook-adapter.test.ts`.

Do not add vendor instruction markdown (`CLAUDE.md`, `.cursorrules`, and similar). Keep operational
guidance in `AGENTS.md` only.

## Optional Lefthook integration

To fail locally when staging guardrail paths (human or agent), add a `pre-commit` command that
passes staged paths into `block-guardrail-edits`. The template does not enable this by default so
maintainers can edit harness files with CODEOWNERS review only.
