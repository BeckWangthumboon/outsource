import { Result } from "better-result";
import { parse, stringify } from "smol-toml";
import { dirname, join } from "node:path";
import { err, failure, ok, type CliResult } from "./error.js";
import type { ModelParameterValue, ModelSelection } from "./model-config.js";

export function configPath(home = process.env.HOME): CliResult<string> {
  if (!home) return err(failure("configuration_error", "HOME is not set; cannot locate configuration."));
  return ok(join(home, ".config", "outsource", "config.toml"));
}

function parseStoredParams(raw: unknown): CliResult<ModelParameterValue[]> {
  if (raw === undefined) return ok([]);
  if (!Array.isArray(raw)) return err(failure("configuration_error", "The configuration contains an invalid defaults.params value."));
  const params: ModelParameterValue[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return err(failure("configuration_error", "The configuration contains an invalid defaults.params entry."));
    }
    const { id, value } = entry as { id?: unknown; value?: unknown };
    if (typeof id !== "string" || !id.trim() || typeof value !== "string" || !value.trim()) {
      return err(failure("configuration_error", "The configuration contains an invalid defaults.params entry."));
    }
    params.push({ id, value });
  }
  return ok(params);
}

export async function readModelSelection(home?: string): Promise<CliResult<ModelSelection>> {
  const path = configPath(home); if (Result.isError(path)) return err(path.error);
  try {
    const file = Bun.file(path.value);
    if (!(await file.exists())) return err(failure("missing_model", "No default model is configured.", { hint: "Run 'outsource config set-model <model-id>'." }));
    const value = parse(await file.text()) as { defaults?: { model?: unknown; params?: unknown } };
    const model = value.defaults?.model;
    if (typeof model !== "string" || !model.trim()) {
      return err(failure("missing_model", "The configuration does not contain defaults.model.", { hint: "Run 'outsource config set-model <model-id>'." }));
    }
    const params = parseStoredParams(value.defaults?.params);
    if (Result.isError(params)) return err(params.error);
    return ok({ id: model, params: params.value });
  } catch (cause) { return err(failure("configuration_error", "Could not read the configuration file.", { cause })); }
}

export async function writeModelSelection(selection: ModelSelection, home?: string): Promise<CliResult<void>> {
  const path = configPath(home); if (Result.isError(path)) return err(path.error);
  const payload = selection.params.length
    ? { defaults: { model: selection.id, params: selection.params.map((param) => ({ id: param.id, value: param.value })) } }
    : { defaults: { model: selection.id } };
  try { await Bun.write(path.value, stringify(payload)); return ok(undefined); }
  catch (cause) {
    try { const { mkdir } = await import("node:fs/promises"); await mkdir(dirname(path.value), { recursive: true, mode: 0o700 }); await Bun.write(path.value, stringify(payload)); return ok(undefined); }
    catch (nested) { return err(failure("configuration_error", "Could not write the configuration file.", { cause: nested ?? cause })); }
  }
}

export async function readModel(home?: string): Promise<CliResult<string>> {
  const selection = await readModelSelection(home);
  if (Result.isError(selection)) return err(selection.error);
  return ok(selection.value.id);
}

export async function writeModel(model: string, home?: string): Promise<CliResult<void>> {
  return writeModelSelection({ id: model, params: [] }, home);
}
