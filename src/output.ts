import type { CliError } from "./error.js";
export interface GlobalOptions { json?: boolean; debug?: boolean }
export function printSuccess(value: unknown, options: GlobalOptions, human?: string): void { if (options.json) console.log(JSON.stringify({ ok: true, ...asObject(value) }, null, 2)); else console.log(human ?? formatHuman(value)); }
export function printError(error: CliError, options: GlobalOptions): never {
  const body: Record<string, unknown> = { code: error.code, message: error.message, retryable: error.retryable };
  if (error.hint) body.hint = error.hint; if (error.requestId) body.requestId = error.requestId;
  if (options.debug && error.cause) body.debug = error.cause instanceof Error ? error.cause.stack : String(error.cause);
  if (options.json) console.error(JSON.stringify({ ok: false, error: body }, null, 2)); else { console.error(`Error: ${error.message}`); if (error.hint) console.error(`Hint: ${error.hint}`); if (error.requestId) console.error(`Request ID: ${error.requestId}`); if (options.debug && error.cause) console.error(error.cause); }
  process.exitCode = 1; throw new CommandFailure();
}
export class CommandFailure extends Error {}
function asObject(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : { value }; }
function formatHuman(value: unknown): string { if (Array.isArray(value)) return value.map(formatHuman).join("\n"); if (value && typeof value === "object") return Object.entries(value).map(([key, entry]) => `${key}: ${typeof entry === "object" ? JSON.stringify(entry) : entry}`).join("\n"); return String(value); }
