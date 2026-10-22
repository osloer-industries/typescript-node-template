export type SetupScenario = "plugin" | "mcp" | "npm-package" | "cli";

export interface SetupProfile {
  description: string;
  source: string;
  test: string;
  publishable?: boolean;
  bin?: boolean;
  dependencies?: Record<string, string>;
}

export const profiles: Record<SetupScenario, SetupProfile>;

export function parseArgs(args: readonly string[]): Record<string, string | boolean | undefined>;

export function packageName(value: string): string;

export function shouldVerifyAfterSetup(parsed: {
  noVerify?: boolean;
  verify?: boolean;
  yes?: boolean;
}): boolean;

export function assertNodeEngine(nodeVersion: string, engines: string | undefined): void;

export function assertKnownScenario(scenario: string | undefined): SetupScenario;

export interface SetupReader {
  question(prompt: string): Promise<string>;
}

export function resolveSetupOptions(
  parsed: Record<string, string | boolean | undefined>,
  reader: SetupReader | undefined
): Promise<{
  scenario: SetupScenario;
  name: string;
  description: string;
  profile: SetupProfile;
}>;

export function writeMcpSmokeScripts(baseDir: string): void;

export function applySetup(
  selected: {
    scenario: SetupScenario;
    name: string;
    description: string;
    profile: SetupProfile;
  },
  options?: { runInstall?: boolean; baseDir?: string }
): void;

export function runSetupCli(argv: readonly string[]): Promise<void>;
