import { Result } from "better-result";
import { err, failure, ok, type CliResult } from "./error.js";
import { runCommand, type CommandRunner } from "./process.js";

const SERVICE = "cursor-cloud";
const ACCOUNT = "api-key";

function platform(): CliResult<"darwin" | "linux"> {
  if (process.platform === "darwin" || process.platform === "linux") return ok(process.platform);
  return err(failure("credential_store_unavailable", `Secure credential storage is unsupported on ${process.platform}.`, { hint: "Use macOS, Linux, or CURSOR_API_KEY." }));
}

export async function getApiKey(runner: CommandRunner = runCommand): Promise<CliResult<{ key: string; source: "environment" | "keychain" | "secret-service" }>> {
  const env = process.env.CURSOR_API_KEY?.trim();
  if (env) return ok({ key: env, source: "environment" });
  const os = platform(); if (Result.isError(os)) return err(os.error);
  const command = os.value === "darwin"
    ? ["security", "find-generic-password", "-s", SERVICE, "-a", ACCOUNT, "-w"]
    : ["secret-tool", "lookup", "service", SERVICE, "account", ACCOUNT];
  try {
    const found = await runner(command);
    const key = found.stdout.trim();
    if (found.exitCode === 0 && key) return ok({ key, source: os.value === "darwin" ? "keychain" : "secret-service" });
    return err(failure("missing_credential", "No Cursor API key is configured.", { hint: "Run 'cursor-cloud auth set' or set CURSOR_API_KEY." }));
  } catch (cause) {
    return err(failure("credential_store_unavailable", "The secure credential store is unavailable.", { hint: os.value === "linux" ? "Install libsecret-tools (secret-tool), or set CURSOR_API_KEY." : "Check Keychain access, or set CURSOR_API_KEY.", cause }));
  }
}

export async function storeApiKey(key: string, runner: CommandRunner = runCommand): Promise<CliResult<void>> {
  const os = platform(); if (Result.isError(os)) return err(os.error);
  const command = os.value === "darwin"
    ? ["security", "add-generic-password", "-U", "-s", SERVICE, "-a", ACCOUNT, "-w", key]
    : ["secret-tool", "store", "--label", "Cursor Cloud API key", "service", SERVICE, "account", ACCOUNT];
  try {
    const result = os.value === "linux" ? await runWithInput(command, key) : await runner(command);
    return result.exitCode === 0 ? ok(undefined) : err(failure("credential_store_error", "Could not store the Cursor API key securely.", { cause: result.stderr }));
  } catch (cause) { return err(failure("credential_store_unavailable", "The secure credential store is unavailable.", { hint: os.value === "linux" ? "Install libsecret-tools (secret-tool)." : undefined, cause })); }
}

async function runWithInput(command: string[], input: string) {
  const proc = Bun.spawn(command, { stdin: "pipe", stdout: "pipe", stderr: "pipe" });
  proc.stdin.write(input); proc.stdin.end();
  const [stdout, stderr, exitCode] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  return { stdout, stderr, exitCode };
}

export async function clearApiKey(runner: CommandRunner = runCommand): Promise<CliResult<void>> {
  const os = platform(); if (Result.isError(os)) return err(os.error);
  const command = os.value === "darwin"
    ? ["security", "delete-generic-password", "-s", SERVICE, "-a", ACCOUNT]
    : ["secret-tool", "clear", "service", SERVICE, "account", ACCOUNT];
  try { const result = await runner(command); return result.exitCode === 0 || result.exitCode === 1 ? ok(undefined) : err(failure("credential_store_error", "Could not clear the stored credential.", { cause: result.stderr })); }
  catch (cause) { return err(failure("credential_store_unavailable", "The secure credential store is unavailable.", { cause })); }
}
