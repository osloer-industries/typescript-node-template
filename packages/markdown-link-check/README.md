# @osloer-industries/markdown-link-check

Fork of [tcort/markdown-link-check](https://github.com/tcort/markdown-link-check) focused on **repository-wide**
checks in Node.js ESM projects. Relative and same-repo links are validated on disk; `http(s)` links use
[`link-check`](https://www.npmjs.com/package/link-check).

Upstream validates one Markdown file at a time and treats many relative targets as URLs. This package resolves
paths from each Markdown file’s directory and walks the repo for CI-style checks.

## Install

```bash
npm install --save-dev @osloer-industries/markdown-link-check
```

Until the package is published to npm, depend on the GitHub repo or a `file:` path (as in [typescript-node-template](https://github.com/osloer-industries/typescript-node-template)).

## CLI

From the repository root:

```bash
markdown-link-check-repo
markdown-link-check-repo --config .markdown-link-check.json
```

Skipped directories: `node_modules`, `dist`, `coverage`, `.git`.

## Programmatic API

```js
import { readFileSync } from "node:fs";
import { checkMarkdownFileLinks } from "@osloer-industries/markdown-link-check";

const markdown = readFileSync("README.md", "utf8");
await checkMarkdownFileLinks(markdown, "/abs/path/README.md", {
  /* link-check options */
});
```

## License

ISC. See [LICENSE.md](./LICENSE.md) and [NOTICE.md](./NOTICE.md) for upstream attribution.
