import { describe, expect, test } from "bun:test";
import { Result } from "better-result";
import { installSkill, skillStatus, uninstallSkill } from "../src/skill-install.js";
import type { CommandRunner } from "../src/process.js";

describe("skills.sh integration", () => {
  test("installs the Outsource skill globally for universal agents", async () => {
    const calls: string[][] = [];
    const runner: CommandRunner = async (command) => {
      calls.push(command);
      return { stdout: "Installed outsource", stderr: "", exitCode: 0 };
    };

    const result = await installSkill(false, runner);
    expect(Result.isOk(result) && result.value.output).toBe("Installed outsource");
    expect(calls).toEqual([[
      "npx", "skills", "add", "BeckWangthumboon/outsource", "--skill", "outsource",
      "--agent", "universal", "--global",
    ]]);
  });

  test("uses skills.sh non-interactively when forced", async () => {
    const runner: CommandRunner = async (command) => ({ stdout: command.join(" "), stderr: "", exitCode: 0 });
    const result = await installSkill(true, runner);
    expect(Result.isOk(result) && result.value.output).toContain("--yes");
  });

  test("delegates status and uninstall to the global universal skills scope", async () => {
    const calls: string[][] = [];
    const runner: CommandRunner = async (command) => {
      calls.push(command);
      return { stdout: "", stderr: "", exitCode: 0 };
    };

    expect(Result.isOk(await skillStatus(runner))).toBe(true);
    expect(Result.isOk(await uninstallSkill(runner))).toBe(true);
    expect(calls).toEqual([
      ["npx", "skills", "list", "--global", "--agent", "universal"],
      ["npx", "skills", "remove", "outsource", "--global", "--agent", "universal", "--yes"],
    ]);
  });

  test("reports skills.sh failures", async () => {
    const runner: CommandRunner = async () => ({ stdout: "", stderr: "npx unavailable", exitCode: 1 });
    const result = await installSkill(false, runner);
    expect(Result.isError(result) && result.error.code).toBe("skill_install_error");
  });
});
