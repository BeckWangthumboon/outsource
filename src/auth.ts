import { Result } from "better-result";
import { dirname, join } from "node:path";
import { err, failure, ok, type CliResult } from "./error.js";

export type CredentialSource = "environment" | "file";

export function authPath(home = process.env.HOME): CliResult<string> {
  if (!home) return err(failure("configuration_error", "HOME is not set; cannot locate credentials."));
  return ok(join(home, ".config", "outsource", "auth.json"));
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

export async function getApiKey(home?: string): Promise<CliResult<{ key: string; source: CredentialSource }>> {
  const env = process.env.CURSOR_API_KEY?.trim();
  if (env) return ok({ key: env, source: "environment" });

  const file = await readFileCredential(home);
  if (Result.isError(file)) return err(file.error);
  if (file.value) return ok({ key: file.value.key, source: "file" });

  return err(failure("missing_credential", "No Cursor API key is configured.", { hint: "Run 'outsource auth set' or set CURSOR_API_KEY." }));
}

export function storeApiKey(key: string, home?: string): Promise<CliResult<void>> {
  return writeFileCredential(key, home);
}

export function clearApiKey(home?: string): Promise<CliResult<void>> {
  return clearFileCredential(home);
}
