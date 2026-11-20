/** Regex patterns for agent guidance scanning (plain ESM; not type-stripped). */

export const NPM_RUN_PATTERN = /\bnpm run(?:-script)? +([!#$%&'*+.0-9:A-Z^_a-z~-]+)/gu;

export const NODE_CMD_PATTERN = /\bnode +(\S+)/gu;