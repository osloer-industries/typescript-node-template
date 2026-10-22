# Playwright and CI installs

Some Node projects depend on Playwright for local browser automation. Playwright packages
run **postinstall** scripts that download browser binaries. That conflicts with the
template's supply-chain default: **`npm ci --ignore-scripts`** in CI (see
[sonar-quality-gate.md](sonar-quality-gate.md) and `.github/workflows/ci.yml`).

## Recommended split

| Environment | Install | Browser binaries |
| --- | --- | --- |
| **CI (default)** | `npm ci --ignore-scripts` | Not installed; tests use mocked browser adapters or fakes |
| **Local dev** | `npm ci` or `npm install` | `npx playwright install chromium` (or the browsers you need) |

Document the local browser step in the project README next to other one-time setup (for
example immediately after `npm install`).

## When CI needs real browsers

Do **not** remove `--ignore-scripts` from the main quality job to fix Playwright. Instead,
add an explicit step in the job that needs browsers:

```yaml
- run: npm ci --ignore-scripts
- run: npx playwright install chromium --with-deps
```

Use a separate job or workflow if browser installs would slow every pull request. Pin
Playwright versions exactly like other dependencies.

## Tests

Prefer unit tests against a small **browser port** interface (launch, new context, close)
with Vitest mocks, so CI stays fast and credential-free. Reserve full browser flows for
local development or an optional CI job.
