# Agent Guidelines

These instructions apply to every human or automated contributor. Keep this file
provider-neutral. Do not add `CLAUDE.md`, `.cursor/`, or equivalent duplicate
instruction files.

## Priorities

1. Keep the template small, reusable, secure, and provider-neutral.
2. Preserve exact dependency versions and the committed npm lockfile.
3. Add or update tests for every behavior change.
4. Never commit credentials, tokens, private keys, or local environment files.

## Toolchain and commands

- Use the Node.js 22 version declared by `.nvmrc` and `.node-version`.
- Install reproducibly with `npm ci`. Use `npm install --save-exact` when a
  dependency intentionally changes, then commit `package-lock.json`.
- Run `npm run check` before submitting a change. This runs Oxlint, the
  TypeScript compiler, coverage, and the production build.
- Run `npm audit --omit=dev` whenever dependencies or the lockfile change.
- Keep `npm run typecheck` as the authoritative TypeScript diagnostic step.
  Oxlint's type-aware rules supplement it but do not replace it.

## Architecture and implementation

- Use strict TypeScript, ECMAScript modules, and explicit `.js` extensions for
  relative imports compiled with NodeNext.
- Keep public APIs small and document intentional changes to exports, CLI
  behavior, plugin interfaces, or MCP tools.
- Avoid import cycles, floating promises, excessive nesting, and functions with
  cyclomatic complexity above 15.
- Prefer focused modules and pure functions. Do not hide lint findings with
  disable comments unless the exception is narrowly scoped and explained.
- Preserve all four setup scenarios: `plugin`, `mcp`, `npm-package`, and `cli`.

## Tests and security

- Add tests for success, failure, and boundary behavior affected by a change.
- Keep branch, function, line, and statement coverage at or above 80%.
- Treat external input, environment variables, file paths, and network results
  as untrusted. Validate before use and avoid logging sensitive values.
- Keep GitHub Actions permissions minimal and pin third-party actions to full
  commit SHAs.

## Contributions and releases

- Make focused changes and do not rewrite unrelated files.
- Use a Conventional Commit pull request title such as `feat:`, `fix:`,
  `refactor:`, `test:`, `docs:`, `chore:`, or `ci:`. The squash commit title on
  `main` is Release Please's release input.
- Do not edit generated Release Please versions or changelogs outside its
  release pull request unless correcting release metadata deliberately.
- Never bypass required reviews, checks, or organization rules.
