# Contributing

1. Install Node.js 24.22.0.
2. Run `npm ci`.
3. Create a focused branch and add tests with the change.
4. Run `npm run check` and `npm audit --omit=dev`.
5. Open a pull request using the provided template and a Conventional Commit title.

Coverage must remain at least 80% for branches, functions, lines, and statements. Keep dependencies exact and commit lockfile changes. Never commit secrets or generated output.

Use Conventional Commit prefixes such as `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, and `chore:`. Release Please treats `feat:` as a minor release and `fix:` as a patch release. Use a `BREAKING CHANGE:` footer or `!` marker for a major release.

Pull request titles are validated automatically. Squash merging uses the validated title as the commit subject on `main`, giving Release Please one reliable Conventional Commit per pull request. Dependabot uses `chore(deps):` for npm updates and `ci(deps):` for GitHub Actions updates.

## Merge order

When several pull requests are open at once, merge in this order to keep `main` and downstream branches consistent:

1. Feature and baseline pull requests (human or agent work on `main`).
2. The Release Please release pull request (version bump and changelog).
3. Grouped GitHub Actions Dependabot updates (`ci(deps)`).
4. Grouped npm development-dependency Dependabot updates (`chore(deps)`).
5. Single transitive lockfile bumps that Dependabot opens on their own.

After each merge, refresh or rebase any later pull requests in the queue so they pick up the latest `main` before you merge them.
