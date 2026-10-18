/** @typedef {{ yes?: boolean, verify?: boolean, noVerify?: boolean, scenario?: string, name?: string, description?: string }} SetupCliArgs */

/**
 * @param {readonly string[]} args
 * @returns {SetupCliArgs}
 */
export function parseArgs(args) {
  /** @type {SetupCliArgs} */
  const values = {};
  for (let i = 0; i < args.length; i += 1) {
    const argument = args[i];
    if (argument === "--yes") values.yes = true;
    else if (argument === "--verify") values.verify = true;
    else if (argument === "--no-verify") values.noVerify = true;
    else if (argument?.startsWith("--")) {
      const value = args[i + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}`);
      values[argument.slice(2)] = value;
      i += 1;
    }
  }
  return values;
}

/**
 * @param {string} value
 * @returns {string}
 */
export function packageName(value) {
  if (!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(value)) {
    throw new Error(`Invalid npm package name: ${value}`);
  }
  return value;
}

/** @param {SetupCliArgs} parsed */
export function shouldVerifyAfterSetup(parsed) {
  if (parsed.noVerify) return false;
  if (parsed.verify) return true;
  return Boolean(parsed.yes);
}

/**
 * @param {string} nodeVersion
 * @param {string | undefined} engines
 */
export function assertNodeEngine(nodeVersion, engines) {
  if (!engines) return;
  const major = Number(nodeVersion.split(".")[0]);
  const minMatch = engines.match(/>=\s*(\d+)/);
  const maxMatch = engines.match(/<\s*(\d+)/);
  if (!minMatch && !maxMatch) return;
  const minMajor = minMatch ? Number(minMatch[1]) : undefined;
  const maxExclusive = maxMatch ? Number(maxMatch[1]) : undefined;
  if (minMajor !== undefined && major < minMajor) {
    throw new Error(
      `Node.js ${minMajor}+ is required (${engines}). Found ${nodeVersion}. Use .nvmrc or .node-version.`,
    );
  }
  if (maxExclusive !== undefined && major >= maxExclusive) {
    throw new Error(
      `Node.js must be below ${maxExclusive} (${engines}). Found ${nodeVersion}. Use .nvmrc or .node-version.`,
    );
  }
}
