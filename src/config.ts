import { Result } from "better-result";
import { parse, stringify } from "smol-toml";
import { dirname, join } from "node:path";
import { err, failure, ok, type CliResult } from "./error.js";

export function configPath(home = process.env.HOME): CliResult<string> {
  if (!home) return err(failure("configuration_error", "HOME is not set; cannot locate configuration."));
  return ok(join(home, ".config", "outsource", "config.toml"));
}

export async function readModel(home?: string): Promise<CliResult<string>> {
  const path = configPath(home); if (Result.isError(path)) return err(path.error);
  try {
    const file = Bun.file(path.value);
    if (!(await file.exists())) return err(failure("missing_model", "No default model is configured.", { hint: "Run 'outsource config set-model <model-id>'." }));
    const value = parse(await file.text()) as { defaults?: { model?: unknown } };
    return typeof value.defaults?.model === "string" && value.defaults.model.trim()
      ? ok(value.defaults.model) : err(failure("missing_model", "The configuration does not contain defaults.model.", { hint: "Run 'outsource config set-model <model-id>'." }));
  } catch (cause) { return err(failure("configuration_error", "Could not read the configuration file.", { cause })); }
}

export async function writeModel(model: string, home?: string): Promise<CliResult<void>> {
  const path = configPath(home); if (Result.isError(path)) return err(path.error);
  try { await Bun.write(path.value, stringify({ defaults: { model } })); return ok(undefined); }
  catch (cause) {
    try { const { mkdir } = await import("node:fs/promises"); await mkdir(dirname(path.value), { recursive: true, mode: 0o700 }); await Bun.write(path.value, stringify({ defaults: { model } })); return ok(undefined); }
    catch (nested) { return err(failure("configuration_error", "Could not write the configuration file.", { cause: nested ?? cause })); }
  }
}
