import { err, failure, ok, type CliResult } from "./error.js";
import { runCommand, type CommandRunner } from "./process.js";

const source = "BeckWangthumboon/outsource";
const name = "outsource";
const agent = "universal";

export interface SkillCommandResult { output: string }

async function skills(
  args: string[],
  message: string,
  runner: CommandRunner = runCommand,
): Promise<CliResult<SkillCommandResult>> {
  try {
    const result = await runner(["npx", "skills", ...args]);
    if (result.exitCode !== 0) {
      return err(failure("skill_install_error", message, {
        hint: "Ensure Node.js and npm are installed, then try again.",
        cause: result.stderr.trim(),
      }));
    }
    return ok({ output: result.stdout.trim() });
  } catch (cause) {
    return err(failure("skill_install_error", message, {
      hint: "Ensure Node.js and npm are installed, then try again.",
      cause,
    }));
  }
}

/** Installs the bundled skill through skills.sh into the global universal skills directory. */
export function installSkill(force = false, runner: CommandRunner = runCommand): Promise<CliResult<SkillCommandResult>> {
  return skills([
    "add", source, "--skill", name, "--agent", agent, "--global",
    ...(force ? ["--yes"] : []),
  ], "Could not install the Outsource skill with skills.sh.", runner);
}

export function skillStatus(runner: CommandRunner = runCommand): Promise<CliResult<SkillCommandResult>> {
  return skills(["list", "--global", "--agent", agent], "Could not list global universal skills with skills.sh.", runner);
}

export function uninstallSkill(runner: CommandRunner = runCommand): Promise<CliResult<SkillCommandResult>> {
  return skills(["remove", name, "--global", "--agent", agent, "--yes"], "Could not remove the Outsource skill from global universal skills with skills.sh.", runner);
}
