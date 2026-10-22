# Publishing this fork

## Create the GitHub repository

An org admin (or a token with `repo` + org repo creation) must create:

`https://github.com/osloer-industries/markdown-link-check`

Then push this directory as the default branch:

```bash
cd packages/markdown-link-check
git init
git add .
git commit -m "feat: initial fork with repository-relative link checks"
git branch -M main
git remote add origin git@github.com:osloer-industries/markdown-link-check.git
git push -u origin main
```

Alternatively, from the monorepo root:

```bash
git subtree split -P packages/markdown-link-check -b markdown-link-check-export
git push git@github.com:osloer-industries/markdown-link-check.git markdown-link-check-export:main
```

## Publish to npm

```bash
cd packages/markdown-link-check
npm test
npm publish --access public
```

Scoped package: `@osloer-industries/markdown-link-check`.

## Consume from typescript-node-template

After publish, replace the template `devDependencies` entry:

```json
"@osloer-industries/markdown-link-check": "4.0.0"
```

Until then, the template uses `"file:packages/markdown-link-check"`.
