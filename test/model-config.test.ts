import { describe, expect, test } from "bun:test";
import { Result } from "better-result";
import type { SDKModel } from "@cursor/sdk";
import { parseParamAssignment, validateModelSelection } from "../src/model-config.js";

const catalog: SDKModel[] = [
  {
    id: "composer-2.5",
    displayName: "Composer 2.5",
    parameters: [{ id: "fast", values: [{ value: "true" }, { value: "false" }] }],
  },
  {
    id: "claude-test",
    displayName: "Claude Test",
    aliases: ["claude-alias"],
  },
];

describe("model parameter validation", () => {
  test("accepts a valid model without parameters", () => {
    const result = validateModelSelection("composer-2.5", [], catalog);
    expect(Result.isOk(result) && result.value).toEqual({ id: "composer-2.5", params: [] });
  });

  test("accepts valid parameters for a model", () => {
    const result = validateModelSelection("composer-2.5", ["fast=false"], catalog);
    expect(Result.isOk(result) && result.value).toEqual({ id: "composer-2.5", params: [{ id: "fast", value: "false" }] });
  });

  test("resolves model aliases to canonical IDs", () => {
    const result = validateModelSelection("claude-alias", [], catalog);
    expect(Result.isOk(result) && result.value.id).toBe("claude-test");
  });

  test("rejects unavailable models", () => {
    const result = validateModelSelection("missing-model", [], catalog);
    expect(Result.isError(result) && result.error.code).toBe("model_unavailable");
  });

  test("rejects malformed parameter assignments", () => {
    const missingValue = parseParamAssignment("fast");
    expect(Result.isError(missingValue) && missingValue.error.code).toBe("invalid_model_param");
    const missingId = parseParamAssignment("=false");
    expect(Result.isError(missingId) && missingId.error.code).toBe("invalid_model_param");
    const emptyValue = parseParamAssignment("fast=");
    expect(Result.isError(emptyValue) && emptyValue.error.code).toBe("invalid_model_param");
    const missingEquals = validateModelSelection("composer-2.5", ["fast"], catalog);
    expect(Result.isError(missingEquals) && missingEquals.error.code).toBe("invalid_model_param");
  });

  test("rejects duplicate parameter IDs", () => {
    const result = validateModelSelection("composer-2.5", ["fast=false", "fast=true"], catalog);
    expect(Result.isError(result) && result.error.code).toBe("duplicate_model_param");
  });

  test("rejects unsupported parameter IDs", () => {
    const result = validateModelSelection("composer-2.5", ["thinking=high"], catalog);
    expect(Result.isError(result) && result.error.code).toBe("unsupported_model_param");
  });

  test("rejects unsupported parameter values", () => {
    const result = validateModelSelection("composer-2.5", ["fast=maybe"], catalog);
    expect(Result.isError(result) && result.error.code).toBe("unsupported_model_param_value");
  });

  test("rejects parameters for models without parameter definitions", () => {
    const result = validateModelSelection("claude-test", ["fast=false"], catalog);
    expect(Result.isError(result) && result.error.code).toBe("unsupported_model_param");
  });
});
