# npm overrides for transitive audits

`npm audit --omit=dev` reports vulnerabilities in the **production** dependency tree.
Sometimes the fix exists only in a newer transitive version and upstream has not released
yet. npm **`overrides`** in `package.json` force a single resolved version for a package
name across the tree.

This template already uses a minimal example:

```json
"overrides": {
  "basic-ftp": "6.2.3"
}
```

## When an override is acceptable

1. **`npm audit --omit=dev`** shows a high or critical finding on a **transitive**
   production dependency.
2. The overridden version is a **patch or minor** upgrade that matches the parent package's
   supported range, or release notes confirm compatibility.
3. **`npm run check`** and integration tests pass after the override.
4. You record **why** the override exists (link to advisory or upstream issue).

Prefer upgrading a **direct** dependency first. Use overrides for transitive gaps, not to
skip audits.

## How to add one

1. Add the override with an **exact** version (match `.npmrc` `save-exact=true` policy).
2. Run `npm install --save-exact` (or the minimal install that refreshes the lockfile).
3. Run `npm audit --omit=dev --audit-level=high` and `npm run check`.
4. Document the override in the pull request and, if long-lived, in a short comment in
   `package.json` above the `overrides` block or in the advisory tracking issue.

## Retiring an override

1. After a direct or transitive dependency bump, run `npm audit --omit=dev` and confirm the
   advisory no longer applies.
2. Remove the override entry and regenerate `package-lock.json`.
3. Run `npm run check` and mention the removal in the pull request.

Do not use overrides to pin vulnerable versions, disable audits, or replace required
dependency upgrades without review.
