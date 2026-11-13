import { ensureEslintSonarjsDependencies } from "./lint-sonarjs.mjs";

/** Vitest global setup: SonarJS ESLint deps are not in the root lockfile tree. */
export default function vitestGlobalSetup() {
  ensureEslintSonarjsDependencies();
}
