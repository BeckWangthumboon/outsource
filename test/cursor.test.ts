import { describe, expect, test } from "bun:test";
import { AgentBusyError, AuthenticationError, NetworkError, RateLimitError } from "@cursor/sdk";
import { mapCursorError, modelSelectionForSdk } from "../src/cursor.js";

describe("Cursor SDK error mapping", () => {
  test("busy is actionable and non-retryable", () => { const error = mapCursorError(new AgentBusyError("busy")); expect(error.code).toBe("agent_busy"); expect(error.retryable).toBe(false); });
  test("auth is non-retryable", () => expect(mapCursorError(new AuthenticationError("bad key")).code).toBe("authentication_error"));
  test("network and rate limits are retryable", () => { expect(mapCursorError(new NetworkError("offline")).retryable).toBe(true); expect(mapCursorError(new RateLimitError("slow down")).retryable).toBe(true); });
});

describe("Agent.create model selection", () => {
  test("passes model-only selection without params", () => {
    expect(modelSelectionForSdk({ id: "composer-2.5", params: [] })).toEqual({ id: "composer-2.5" });
  });

  test("passes explicit parameters in SDK array form", () => {
    expect(modelSelectionForSdk({ id: "composer-2.5", params: [{ id: "fast", value: "false" }] })).toEqual({
      id: "composer-2.5",
      params: [{ id: "fast", value: "false" }],
    });
  });
});
