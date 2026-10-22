# MCP servers and account data (agent guidance)

Use this document when an MCP server (stdio or remote) can read or change **account-scoped**
data: profiles, messages, bookings, billing, or session-backed API calls.

Keep rules **provider-neutral** in `AGENTS.md`; list project-specific tool names in the
repository README or a local `AGENTS` addendum.

## Sensitive material

Treat session files, cookies, bearer tokens, refresh tokens, and API responses as
**secret**. Never print, commit, upload, or paste them into issues, pull requests, or chat
logs.

## Approval-gated write tools

Before calling any MCP tool that **creates, updates, deletes, or sends** remote state, the
agent must obtain **explicit, per-call user approval**:

1. Name the **exact tool** and **target** (resource id, recipient, or equivalent).
2. Describe the **effect** in plain language.
3. **Wait** for the user to confirm that specific call.

Do not treat earlier general instructions, test plans, or tool availability as approval.

Maintain a written list of write tools in the project README. Example categories:

- Messaging (send, archive, start thread)
- Favorites or saved searches
- Exchange or booking actions that mutate state

## Read-only validation

Read-only tools may support debugging and tests. Return only the **minimum** summary needed.
Redact names, addresses, message bodies, dates, and identifiers unless the user explicitly
needs them.

Credential-free smoke tests (`npm run test:mcp`; see [mcp-stdio-smoke-test.md](mcp-stdio-smoke-test.md))
must not perform network I/O or read session files. Optional `--live` checks belong in
documented local flows only, not in default CI.

## Trusted origins

When the server calls HTTP APIs, validate URLs against an explicit allowlist before
requesting. Do not broaden allowed hosts without maintainer review.
