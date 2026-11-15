# Architecture

Significant decisions that affect module layout, CI harness files, or the setup contract
are recorded as [Architecture Decision Records](adr/README.md).

This template stays small: one library entrypoint, one setup CLI, and shared quality gates.

## Layout

| Path | Role |
| --- | --- |
| `src/index.ts` | Application or library entry after setup (default template greeting until `npm run setup`). |
| `src/index.test.ts` | Unit tests colocated with the entry module. |
| `scripts/setup.mjs` | Thin CLI wrapper for project scaffolding. |
| `scripts/setup-lib.mjs` | Setup profiles, argument parsing, and file writes (testable core). |
| `scripts/setup.test.ts` | Unit and integration tests for setup. |
| `.github/workflows/` | CI, security, release, and title validation; org-shared jobs call [consuming-org-reusables.md](consuming-org-reusables.md). |

## Setup scenarios

`npm run setup` replaces `src/` and adjusts `package.json` for one of four profiles:

- **plugin** — provider-neutral plugin interface.
- **mcp** — stdio MCP server with Zod-validated tool inputs, plus generated
  `scripts/test-mcp.mjs` and `npm run test:mcp` (see [mcp-stdio-smoke-test.md](mcp-stdio-smoke-test.md)).
- **npm-package** — publishable library with validated string inputs.
- **cli** — bin package with validated argv handling.

Profiles live in `scripts/setup-lib.mjs`. Changing a profile requires updating its generated tests and
running integration tests in `scripts/setup.test.ts`.

## Dependency direction

- `src/` must not import from `scripts/` (enforced by Oxlint `no-restricted-imports` on `src/**`,
  banning `**/scripts/**`).
- `scripts/setup.mjs` imports only `scripts/setup-lib.mjs`.
- Avoid import cycles (enforced by Oxlint).

Future layer boundaries (for example core versus adapters in #49) should use the same pattern:
scoped `no-restricted-imports` overrides in `.oxlintrc.json` with a `patterns` group and a message
that cites this document.

## Public API

Treat exports from `src/index.ts` and `package.json` `exports` as semver-stable once published. Internal
helpers should stay unexported or documented as experimental in pull requests.

## Verification

Run `npm run check` before merging. Integration tests copy a minimal fixture into a temporary directory,
apply a setup profile, link the workspace `node_modules` (including `zod` and `@modelcontextprotocol/sdk`
devDependencies used as scenario fixtures), and run the full check pipeline there.
