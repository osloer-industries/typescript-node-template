---
name: write-adr
description: Add an Architecture Decision Record under docs/adr using the README template and update the ADR index table.
---

# Write an ADR

Use this skill when a harness, tooling, or layout decision should be recorded for future
contributors and agents.

## Steps

1. Read the format and index rules in [docs/adr/README.md](../../../docs/adr/README.md).
2. Pick the next sequential number by scanning existing numbered files under `docs/adr/`.
3. Add a new numbered ADR file under `docs/adr/` (next `NNNN-short-title.md` pattern in
   [docs/adr/README.md](../../../docs/adr/README.md)) with **Status**, **Context**, **Decision**,
   **Consequences**, and **Alternatives considered** sections.
4. Add a row to the index table in [docs/adr/README.md](../../../docs/adr/README.md).
5. If the decision affects agent workflow or verification, add a short pointer from
   [AGENTS.md](../../../AGENTS.md) instead of duplicating the ADR body.
6. Run `npm run lint:md` and `npm run lint:md-links` on the new files.

## Do not

- Change release tooling or version manifests unless the ADR explicitly covers a release cut.
- Commit vendor-specific instruction files; [AGENTS.md](../../../AGENTS.md) remains the single
  provider-neutral guide (ADR 0002).
