import { describe, expect, test } from "bun:test";
import { Result } from "better-result";
import { normalizeGitHubRemote, resolveRepository, validateBranchName } from "../src/git.js";
import type { CommandRunner } from "../src/process.js";

describe("Git repository resolution", () => {
  test.each([
    ["git@github.com:acme/widget.git", "https://github.com/acme/widget"],
    ["ssh://git@github.com/acme/widget", "https://github.com/acme/widget"],
    ["https://github.com/acme/widget.git", "https://github.com/acme/widget"],
  ])("normalizes %s", (input, expected) => { const result = normalizeGitHubRemote(input); expect(Result.isOk(result) && result.value).toBe(expected); });

  test("rejects unsupported hosts", () => { const result = normalizeGitHubRemote("https://gitlab.com/acme/widget"); expect(Result.isError(result) && result.error.code).toBe("unsupported_remote"); });

  test.each(["HEAD", "deadbeef", "feature..bad", "refs/@{bad", "bad name", ".hidden", "topic.lock"])("rejects branch %s", (branch) => { expect(Result.isError(validateBranchName(branch))).toBe(true); });

  test("detects remote default branch", async () => {
    const runner: CommandRunner = async (command) => {
      const joined = command.join(" ");
      if (joined.includes("rev-parse")) return { stdout: "/repo\n", stderr: "", exitCode: 0 };
      if (joined.includes("remote get-url")) return { stdout: "git@github.com:acme/widget.git\n", stderr: "", exitCode: 0 };
      if (joined.includes("symbolic-ref")) return { stdout: "origin/main\n", stderr: "", exitCode: 0 };
      return { stdout: "", stderr: "unexpected", exitCode: 1 };
    };
    const result = await resolveRepository(undefined, runner);
    expect(Result.isOk(result) && result.value).toEqual({ root: "/repo", repository: "https://github.com/acme/widget", startingRef: "main" });
  });

  test("verifies an explicit remote branch", async () => {
    const calls: string[] = [];
    const runner: CommandRunner = async (command) => { calls.push(command.join(" ")); const joined = calls.at(-1)!; if (joined.includes("rev-parse")) return { stdout: "/repo", stderr: "", exitCode: 0 }; if (joined.includes("remote get-url")) return { stdout: "https://github.com/acme/widget", stderr: "", exitCode: 0 }; return { stdout: "abc refs/heads/release/next", stderr: "", exitCode: 0 }; };
    const result = await resolveRepository("release/next", runner);
    expect(Result.isOk(result) && result.value.startingRef).toBe("release/next");
    expect(calls.at(-1)).toContain("ls-remote --exit-code --heads origin refs/heads/release/next");
  });
});
