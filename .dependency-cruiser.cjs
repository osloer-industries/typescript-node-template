// Module graph gate — TypeScript 7 uses parser: "swc" (see ADR 0009, docs/architecture.md).
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment:
        "Break the import cycle by extracting shared types or depending inward; see docs/architecture.md.",
      from: {},
      to: { circular: true },
    },
    {
      name: "src-not-scripts",
      severity: "error",
      comment:
        "Application code under src/ must not import scripts/; use public src APIs or move shared code into src/. See docs/architecture.md.",
      from: { path: "^src" },
      to: { path: "^scripts" },
    },
    {
      name: "not-to-unresolvable",
      severity: "error",
      comment:
        "Fix the import path or add the dependency; unresolvable edges hide broken builds. See docs/architecture.md.",
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: "src-not-to-dev-dep",
      severity: "error",
      comment:
        "Move the package to dependencies when src/ needs it at runtime (setup profiles must declare runtime deps in dependencies). See docs/architecture.md and ADR 0009.",
      from: { path: "^src", pathNot: "\\.test\\.ts$" },
      to: { dependencyTypes: ["npm-dev", "npm-no-pkg", "npm-unknown"] },
    },
    {
      name: "no-orphans",
      severity: "warn",
      comment:
        "Remove unused modules or wire them into the graph from an entrypoint or test. See docs/architecture.md.",
      from: { orphan: true, pathNot: ["\\.test\\.ts$", "\\.d\\.m?ts$"] },
      to: {},
    },
  ],
  options: {
    parser: "swc",
    exclude: { path: "^(src|scripts|packages)/.*\\.d\\.m?ts$" },
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
    doNotFollow: { path: "node_modules" },
  },
};