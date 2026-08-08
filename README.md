# TypeScript Node Template

A minimal Node.js 22 and TypeScript starter with secure defaults, exact dependencies, fast linting, coverage enforcement, and GitHub security automation.

## Included

- Node.js 22.23.1, npm, ECMAScript modules, and strict TypeScript 7
- Exact versions, `.npmrc` with `save-exact=true`, and committed `package-lock.json`
- Oxlint, typechecking, build, Vitest unit tests, and V8 coverage
- 80% minimum coverage for branches, functions, lines, and statements
- Pull request and `main` CI with `npm audit --omit=dev`
- CodeQL, SonarQube Cloud, Dependabot, and pull request dependency review
- Full commit SHA pins, minimal permissions, timeouts, and concurrency cancellation
- Secret-safe ignores, issue forms, and pull request guidance
- Provider-neutral `AGENTS.md`

## Start a project

```sh
npm ci
npm run setup
npm run check
```

The setup CLI supports these scenarios:

| Scenario | Result |
| --- | --- |
| `plugin` | Provider-neutral plugin interface and activation example |
| `mcp` | Stdio MCP server using the official TypeScript SDK |
| `npm-package` | Publishable npm library with exports |
| `cli` | Publishable command-line package with a `bin` entry |

For unattended setup:

```sh
npm run setup -- --scenario cli --name @your-scope/your-cli --description "A useful CLI" --yes
```

Review `SETUP.md`, update repository URLs in `package.json`, run `npm run check`, then remove `SETUP.md`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run lint` | Lint with Oxlint |
| `npm run typecheck` | Check types without emitting files |
| `npm test` | Run unit tests |
| `npm run test:coverage` | Test and enforce coverage thresholds |
| `npm run build` | Compile to `dist/` |
| `npm run check` | Run all local quality gates |
| `npm audit --omit=dev` | Audit production dependencies |

## SonarQube Cloud setup

The Sonar workflow skips safely until configured.

1. Import the repository into SonarQube Cloud.
2. Replace `YOUR_SONAR_ORGANIZATION` and `YOUR_SONAR_PROJECT_KEY` in `sonar-project.properties`.
3. Create a SonarQube Cloud token and add it in GitHub under **Settings > Secrets and variables > Actions** as `SONAR_TOKEN`.
4. In SonarQube Cloud, open **Project Settings > Analysis Method** and clear **Enabled for this project** under Automatic Analysis. Automatic Analysis and GitHub Actions analysis cannot be enabled together.
5. Push to `main` or open a pull request and confirm the Sonar check runs.

Never commit the token. On eligible plans, organization administrators can also disable Automatic Analysis for new projects under **Organization Settings > Analysis**.

## Recommended branch protection

Branch protection is intentionally not automated. After the first successful runs, protect `main` with:

- Pull requests required with at least one approval
- Stale approval dismissal and conversation resolution
- Required checks: `CI / Quality`, `CodeQL / Analyze JavaScript and TypeScript`, `Dependency review / Review dependency changes`, and `SonarQube Cloud / Analyze` after Sonar is configured
- Up-to-date branches when parallel development makes it useful
- Force pushes and branch deletion blocked
- Rules applied to administrators unless an emergency process exists
- Signed commits and linear history when the contributor workflow supports them

Do not require Sonar until its placeholders and secret are configured.

## Low-cost security and automation

This template includes immutable Action pins with Dependabot updates, high-severity dependency review, scheduled CodeQL, production audits, grouped development updates, CI cancellation, timeouts, and standardized contribution forms. Public repositories also receive GitHub dependency graph and secret scanning. Enable repository push protection in **Settings > Code security and analysis** when available.

Consider these additions only when the generated project needs them:

- npm Trusted Publishing with OIDC and provenance for published packages, instead of a long-lived token
- SBOM generation and GitHub artifact attestations for released binaries or containers
- OpenSSF Scorecard, a real `CODEOWNERS` file, and organization-wide Action SHA-pinning rules
- Generated-code drift checks, integration tests, container scanning, deployment environments, and observability

Automated publishing, broad write permissions, merge bots, and placeholder code owners are intentionally omitted because they require project-specific ownership and release decisions.

## Secrets

Copy `.env.example` to `.env` locally. Ignore rules cover environment files, private keys, credential files, and local npm authentication. Keep committed `.npmrc` free of tokens. If a secret is committed, revoke and rotate it immediately.

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and [LICENSE](LICENSE).
