# MCP stdio smoke test

The **mcp** setup profile scaffolds a credential-free end-to-end check that runs after
`npm run build`:

1. Start the compiled server as a child process with stdio pipes.
2. Complete the MCP `initialize` handshake and `notifications/initialized`.
3. Call `tools/list` and assert the tool names match the project contract.
4. Optionally call one **read-only, credential-free** tool (the template uses `greet`).

This is stronger than unit tests alone because it exercises the real stdio transport and
compiled entrypoint. It does not replace handler unit tests or integration tests against
external APIs.

## Commands

After `npm run setup -- --scenario mcp`:

```sh
npm run test:mcp
```

Unattended setup with `--yes` runs `npm run check` and then `npm run test:mcp` for the mcp
scenario.

## Implementation

- Reusable helper: `scripts/mcp-stdio-smoke.mjs` (`runMcpStdioSmoke`, `runProjectMcpSmokeEntry`).
- Generated project files: `scripts/test-mcp.mjs` (thin CLI wrapper) and a copy of
  `scripts/mcp-stdio-smoke.mjs`.

When you add or rename MCP tools, update `defaultProjectMcpSmoke` in
`scripts/mcp-stdio-smoke.mjs` and keep at least one credential-free `tools/call` in the
smoke test when possible.

## Optional live / session checks

Projects that read a local session file may add a **separate** flag (for example `--live`)
that performs one read-only account call. That path must never print session material or
full API payloads to logs. Document the flag in the project README and keep it out of CI
unless a dedicated, secret-backed job is intentional.

See [mcp-account-data-agents.md](mcp-account-data-agents.md) for agent safety rules when
tools touch account data.
