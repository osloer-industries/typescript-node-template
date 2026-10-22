import type { ExecFileSyncOptions } from "node:child_process";

export function npmExecutablePath(): string;

export function runNpm(args: readonly string[], options?: ExecFileSyncOptions): void;
