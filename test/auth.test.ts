import { afterEach, expect, test } from "bun:test";
import { Result } from "better-result";
import { clearApiKey, getApiKey } from "../src/auth.js";

const originalApiKey = process.env.CURSOR_API_KEY;

afterEach(() => {
  if (originalApiKey === undefined) delete process.env.CURSOR_API_KEY;
  else process.env.CURSOR_API_KEY = originalApiKey;
});

test("only looks up credentials stored by outsource", async () => {
  delete process.env.CURSOR_API_KEY;
  const commands: string[][] = [];
  const result = await getApiKey(async (command) => {
    commands.push(command);
    return { stdout: "", stderr: "not found", exitCode: 1 };
  });

  expect(Result.isError(result) && result.error.code).toBe("missing_credential");
  expect(commands).toHaveLength(1);
  expect(commands[0]).toContain("outsource");
  expect(commands[0]).not.toContain("cursor-cloud");
});

test("only clears credentials stored by outsource", async () => {
  const commands: string[][] = [];
  const result = await clearApiKey(async (command) => {
    commands.push(command);
    return { stdout: "", stderr: "", exitCode: 0 };
  });

  expect(Result.isOk(result)).toBe(true);
  expect(commands).toHaveLength(1);
  expect(commands[0]).toContain("outsource");
  expect(commands[0]).not.toContain("cursor-cloud");
});
