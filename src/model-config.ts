import type { SDKModel } from "@cursor/sdk";
import { Result } from "better-result";
import { err, failure, ok, type CliResult } from "./error.js";

export interface ModelParameterValue {
  id: string;
  value: string;
}

export interface ModelSelection {
  id: string;
  params: ModelParameterValue[];
}

export function findCatalogModel(modelId: string, catalog: SDKModel[]): SDKModel | undefined {
  return catalog.find((item) => item.id === modelId || item.aliases?.includes(modelId));
}

export function parseParamAssignment(raw: string): CliResult<ModelParameterValue> {
  const index = raw.indexOf("=");
  if (index <= 0 || index === raw.length - 1) {
    return err(failure("invalid_model_param", `Malformed parameter assignment '${raw}'.`, { hint: "Use --param <id=value>." }));
  }
  const id = raw.slice(0, index).trim();
  const value = raw.slice(index + 1).trim();
  if (!id || !value) {
    return err(failure("invalid_model_param", `Malformed parameter assignment '${raw}'.`, { hint: "Use --param <id=value>." }));
  }
  return ok({ id, value });
}

export function validateModelSelection(modelId: string, paramAssignments: string[], catalog: SDKModel[]): CliResult<ModelSelection> {
  const parsed: ModelParameterValue[] = [];
  const seen = new Set<string>();
  for (const assignment of paramAssignments) {
    const param = parseParamAssignment(assignment);
    if (Result.isError(param)) return err(param.error);
    if (seen.has(param.value.id)) {
      return err(failure("duplicate_model_param", `Parameter '${param.value.id}' was provided more than once.`, { hint: "Provide each parameter ID at most once." }));
    }
    seen.add(param.value.id);
    parsed.push(param.value);
  }

  const model = findCatalogModel(modelId, catalog);
  if (!model) {
    return err(failure("model_unavailable", `Model '${modelId}' is not available to this Cursor account.`, { hint: "Run 'outsource models' to list valid model IDs." }));
  }

  const definitions = new Map((model.parameters ?? []).map((definition) => [definition.id, definition]));
  for (const param of parsed) {
    const definition = definitions.get(param.id);
    if (!definition) {
      return err(failure("unsupported_model_param", `Parameter '${param.id}' is not supported by model '${model.id}'.`, { hint: "Run 'outsource models' to inspect supported parameters." }));
    }
    if (!definition.values.some((option) => option.value === param.value)) {
      const allowed = definition.values.map((option) => option.value).join(", ");
      return err(failure("unsupported_model_param_value", `Value '${param.value}' is not supported for parameter '${param.id}'.`, { hint: `Supported values: ${allowed}.` }));
    }
  }

  return ok({ id: model.id, params: parsed });
}
