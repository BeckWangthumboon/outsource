import { Result } from "better-result";
import { dirname, join } from "node:path";
import { err, failure, ok, type CliResult } from "./error.js";
import { runCommand, type CommandRunner } from "./process.js";

const SERVICE = "outsource";
const ACCOUNT = "api-key";

export type CredentialSource = "environment" | "file" | "keychain" | "secret-service";

export function authPath(home = process.env.HOME): CliResult<string> {
  if (!home) return err(failure("configuration_error", "HOME is not set; cannot locate credentials."));
  return ok(join(home, ".config", "outsource", "auth.json"));
}

function supportedPlatform(): CliResult<"darwin" | "linux"> {
  if (process.platform === "darwin" || process.platform === "linux") return ok(process.platform);
  return err(failure("credential_store_unavailable", `Secure credential storage is unsupported on ${process.platform}.`, { hint: "Use macOS, Linux, or CURSOR_API_KEY." }));
}

async function readFileCredential(home?: string): Promise<CliResult<{ key: string } | undefined>> {
  const path = authPath(home);
  if (Result.isError(path)) return err(path.error);
  try {
    const file = Bun.file(path.value);
    if (!(await file.exists())) return ok(undefined);
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      return err(failure("configuration_error", "The auth file is not valid JSON.", { hint: "Run 'outsource auth clear' and 'outsource auth set' to recreate it." }));
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return err(failure("configuration_error", "The auth file has an invalid format.", { hint: "Run 'outsource auth clear' and 'outsource auth set' to recreate it." }));
    }
    if (!("cursorApiKey" in parsed)) {
      return err(failure("configuration_error", "The auth file has an invalid format.", { hint: "Run 'outsource auth clear' and 'outsource auth set' to recreate it." }));
    }
    const key = (parsed as { cursorApiKey?: unknown }).cursorApiKey;
    if (typeof key !== "string" || !key.trim()) {
      return err(failure("configuration_error", "The auth file does not contain a valid cursorApiKey.", { hint: "Run 'outsource auth clear' and 'outsource auth set' to recreate it." }));
    }
    return ok({ key: key.trim() });
  } catch (cause) {
    return err(failure("configuration_error", "Could not read the auth file.", { cause }));
  }
}

async function writeFileCredential(key: string, home?: string): Promise<CliResult<void>> {
  const path = authPath(home);
  if (Result.isError(path)) return err(path.error);
  const dir = dirname(path.value);
  const tempPath = join(dir, `.auth.json.tmp-${process.pid}`);
  const payload = `${JSON.stringify({ cursorApiKey: key })}\n`;
  try {
    const { mkdir, rename, chmod, unlink } = await import("node:fs/promises");
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await Bun.write(tempPath, payload);
    await chmod(tempPath, 0o600);
    await rename(tempPath, path.value);
    return ok(undefined);
  } catch (cause) {
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(tempPath);
    } catch { /* ignore cleanup failures */ }
    return err(failure("configuration_error", "Could not write the auth file.", { cause }));
  }
}

async function clearFileCredential(home?: string): Promise<CliResult<void>> {
  const path = authPath(home);
  if (Result.isError(path)) return err(path.error);
  try {
    const { unlink } = await import("node:fs/promises");
    await unlink(path.value);
    return ok(undefined);
  } catch (cause) {
    if (cause && typeof cause === "object" && "code" in cause && cause.code === "ENOENT") return ok(undefined);
    return err(failure("configuration_error", "Could not remove the auth file.", { cause }));
  }
}

async function lookupOsCredential(os: "darwin" | "linux", runner: CommandRunner): Promise<CliResult<{ key: string; source: "keychain" | "secret-service" }>> {
  try {
    const command = os === "darwin"
      ? ["security", "find-generic-password", "-s", SERVICE, "-a", ACCOUNT, "-w"]
      : ["secret-tool", "lookup", "service", SERVICE, "account", ACCOUNT];
    const found = await runner(command);
    const key = found.stdout.trim();
    if (found.exitCode === 0 && key) return ok({ key, source: os === "darwin" ? "keychain" : "secret-service" });
    return err(failure("missing_credential", "No Cursor API key is configured.", { hint: "Run 'outsource auth set' or set CURSOR_API_KEY." }));
  } catch (cause) {
    return err(failure("credential_store_unavailable", "The secure credential store is unavailable.", { hint: os === "linux" ? "Install libsecret-tools (secret-tool), or set CURSOR_API_KEY." : "Check Keychain access, or set CURSOR_API_KEY.", cause }));
  }
}

export async function getApiKey(runner: CommandRunner = runCommand, home?: string): Promise<CliResult<{ key: string; source: CredentialSource }>> {
  const env = process.env.CURSOR_API_KEY?.trim();
  if (env) return ok({ key: env, source: "environment" });

  const os = supportedPlatform();
  if (Result.isError(os)) return err(os.error);

  const file = await readFileCredential(home);
  if (Result.isError(file)) return err(file.error);
  if (file.value) return ok({ key: file.value.key, source: "file" });

  return lookupOsCredential(os.value, runner);
}

type InputRunner = (command: string[], input: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>;

async function storeOsCredential(key: string, os: "darwin" | "linux", runner: CommandRunner, inputRunner: InputRunner): Promise<CliResult<void> | "unavailable"> {
  const command = os === "darwin"
    ? ["security", "add-generic-password", "-U", "-s", SERVICE, "-a", ACCOUNT, "-w", key]
    : ["secret-tool", "store", "--label", "Outsource Cursor API key", "service", SERVICE, "account", ACCOUNT];
  try {
    const result = os === "linux" ? await inputRunner(command, key) : await runner(command);
    if (result.exitCode === 0) return ok(undefined);
    return err(failure("credential_store_error", "Could not store the Cursor API key securely.", { cause: result.stderr }));
  } catch (cause) {
    return "unavailable";
  }
}

export async function storeApiKey(key: string, runner: CommandRunner = runCommand, home?: string, inputRunner: InputRunner = runWithInput): Promise<CliResult<void>> {
  const os = supportedPlatform();
  if (Result.isOk(os)) {
    const stored = await storeOsCredential(key, os.value, runner, inputRunner);
    if (stored === "unavailable") {
      return writeFileCredential(key, home);
    }
    return stored;
  }
  return err(os.error);
}

async function runWithInput(command: string[], input: string) {
  const proc = Bun.spawn(command, { stdin: "pipe", stdout: "pipe", stderr: "pipe" });
  proc.stdin.write(input); proc.stdin.end();
  const [stdout, stderr, exitCode] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  return { stdout, stderr, exitCode };
}

async function clearOsCredential(os: "darwin" | "linux", runner: CommandRunner): Promise<CliResult<void>> {
  try {
    const command = os === "darwin"
      ? ["security", "delete-generic-password", "-s", SERVICE, "-a", ACCOUNT]
      : ["secret-tool", "clear", "service", SERVICE, "account", ACCOUNT];
    const result = await runner(command);
    return result.exitCode === 0 || result.exitCode === 1
      ? ok(undefined)
      : err(failure("credential_store_error", "Could not clear the stored credential.", { cause: result.stderr }));
  } catch (cause) {
    return err(failure("credential_store_unavailable", "The secure credential store is unavailable.", { cause }));
  }
}

export async function clearApiKey(runner: CommandRunner = runCommand, home?: string): Promise<CliResult<void>> {
  const cleared = await clearFileCredential(home);
  if (Result.isError(cleared)) return err(cleared.error);

  const os = supportedPlatform();
  if (Result.isError(os)) return ok(undefined);

  return clearOsCredential(os.value, runner);
}
