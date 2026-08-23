# Contributing

1. Install Node.js 22.23.1.
2. Run `npm ci`.
3. Create a focused branch and add tests with the change.
4. Run `npm run check` and `npm audit --omit=dev`.
5. Open a pull request using the provided template.

Coverage must remain at least 80% for branches, functions, lines, and statements. Keep dependencies exact and commit lockfile changes. Never commit secrets or generated output.

Use Conventional Commit prefixes such as `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, and `chore:`. Release Please treats `feat:` as a minor release and `fix:` as a patch release. Use a `BREAKING CHANGE:` footer or `!` marker for a major release.
