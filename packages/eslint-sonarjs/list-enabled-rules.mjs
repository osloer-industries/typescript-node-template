import sonarjs from "eslint-plugin-sonarjs";

const enabled = Object.entries(sonarjs.configs.recommended.rules)
  .filter(([, severity]) => severity === "error" || severity === 2)
  .map(([name]) => name)
  .toSorted((a, b) => a.localeCompare(b));

for (const rule of enabled) {
  process.stdout.write(`${rule}\n`);
}
