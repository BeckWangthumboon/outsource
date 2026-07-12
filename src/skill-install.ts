import { cp, mkdir, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { err, failure, ok, type CliResult } from "./error.js";

export interface SkillPaths { source: string; destination: string }

export function skillPaths(options: { codexHome?: string; home?: string; packageRoot?: string } = {}): CliResult<SkillPaths> {
  const home = options.home ?? process.env.HOME;
  const codexHome = options.codexHome ?? process.env.CODEX_HOME ?? (home ? join(home, ".codex") : undefined);
  if (!codexHome) return err(failure("skill_install_error", "Cannot locate the Codex home directory.", { hint: "Set CODEX_HOME or HOME." }));
  const packageRoot = options.packageRoot ?? join(import.meta.dir, "..");
  return ok({ source: join(packageRoot, "skills", "outsource"), destination: join(codexHome, "skills", "outsource") });
}

async function exists(path: string): Promise<boolean> { try { await stat(path); return true; } catch { return false; } }

export async function installSkill(paths: SkillPaths, force = false): Promise<CliResult<{ path: string }>> {
  try {
    if (!(await exists(paths.source))) return err(failure("skill_install_error", "The packaged Outsource skill is missing.", { hint: "Reinstall Outsource from GitHub." }));
    if (await exists(paths.destination)) {
      if (!force) return err(failure("skill_already_installed", `The Outsource skill is already installed at ${paths.destination}.`, { hint: "Run 'outsource skill install --force' to replace it." }));
      await rm(paths.destination, { recursive: true, force: true });
    }
    await mkdir(dirname(paths.destination), { recursive: true });
    await cp(paths.source, paths.destination, { recursive: true });
    return ok({ path: paths.destination });
  } catch (cause) { return err(failure("skill_install_error", "Could not install the Outsource skill.", { cause })); }
}

export async function skillStatus(paths: SkillPaths): Promise<CliResult<{ installed: boolean; path: string }>> {
  return ok({ installed: await exists(paths.destination), path: paths.destination });
}

export async function uninstallSkill(paths: SkillPaths): Promise<CliResult<{ path: string }>> {
  try {
    if (!(await exists(paths.destination))) return err(failure("skill_not_installed", `The Outsource skill is not installed at ${paths.destination}.`));
    await rm(paths.destination, { recursive: true });
    return ok({ path: paths.destination });
  } catch (cause) { return err(failure("skill_install_error", "Could not uninstall the Outsource skill.", { cause })); }
}
