import { afterEach, describe, expect, test } from "bun:test";
import { Result } from "better-result";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { installSkill, skillPaths, skillStatus, uninstallSkill } from "../src/skill-install.js";

let root: string | undefined;
afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }); root = undefined; });

describe("Codex skill installation", () => {
  test("installs, reports, replaces, and uninstalls the bundled skill", async () => {
    root = await mkdtemp(join(tmpdir(), "outsource-skill-"));
    const packageRoot = join(root, "package");
    const codexHome = join(root, "codex");
    await Bun.write(join(packageRoot, "skills", "outsource", "SKILL.md"), "---\nname: outsource\ndescription: test\n---\n");
    const paths = skillPaths({ packageRoot, codexHome });
    expect(Result.isOk(paths)).toBe(true); if (Result.isError(paths)) return;

    expect(Result.isOk(await installSkill(paths.value))).toBe(true);
    expect(await Bun.file(join(paths.value.destination, "SKILL.md")).text()).toContain("name: outsource");
    const status = await skillStatus(paths.value);
    expect(Result.isOk(status) && status.value.installed).toBe(true);
    const duplicate = await installSkill(paths.value);
    expect(Result.isError(duplicate) && duplicate.error.code).toBe("skill_already_installed");
    expect(Result.isOk(await installSkill(paths.value, true))).toBe(true);
    expect(Result.isOk(await uninstallSkill(paths.value))).toBe(true);
    const removed = await skillStatus(paths.value);
    expect(Result.isOk(removed) && removed.value.installed).toBe(false);
  });
});
