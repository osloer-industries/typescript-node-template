# Contributing

1. Install Node.js 24.22.0.
2. Run `npm ci` (or `npm ci --ignore-scripts` to match CI; then run `npm run prepare` locally to install Git hooks).
3. Create a focused branch and add tests with the change.
4. Run `npm run check` (Oxlint, SonarJS ESLint, jscpd, markdownlint, markdown link checks, TypeScript, tests, and build)
   and `npm audit --omit=dev`.
5. Open a pull request using the provided template and a Conventional Commit title.

Coverage must remain at least 80% for branches, functions, lines, and statements. Keep dependencies exact
and commit lockfile changes. Never commit secrets or generated output.

The template pins `@osloer-industries/markdown-link-check` from
[osloer-industries/markdown-link-check](https://github.com/osloer-industries/markdown-link-check) using a
`github:owner/repo#tag` specifier (not npm). Dependabot will not open pull requests for that pin; after a
new annotated tag on the fork, set the tag in root `package.json`, run `npm install`, and commit
`package-lock.json`.

Use Conventional Commit prefixes such as `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, and `chore:`.
Release Please treats `feat:` as a minor release and `fix:` as a patch release. Use a `BREAKING CHANGE:`
footer or `!` marker for a major release.

Pull request titles are validated automatically. Squash merging uses the validated title as the commit
subject on `main`, giving Release Please one reliable Conventional Commit per pull request. Dependabot
uses `chore(deps):` for npm updates and `ci(deps):` for GitHub Actions updates.
