import { afterEach, describe, expect, test } from "bun:test";
import { Result } from "better-result";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parse } from "smol-toml";
import { readModel, readModelSelection, writeModel, writeModelSelection } from "../src/config.js";

let home: string | undefined;
afterEach(async () => { if (home) await rm(home, { recursive: true, force: true }); home = undefined; });

describe("configuration", () => {
  test("round trips the selected model without parameters", async () => {
    home = await mkdtemp(join(tmpdir(), "outsource-home-"));
    expect(Result.isOk(await writeModelSelection({ id: "claude-test", params: [] }, home))).toBe(true);
    const loaded = await readModelSelection(home);
    expect(Result.isOk(loaded) && loaded.value).toEqual({ id: "claude-test", params: [] });
    const contents = await readFile(join(home, ".config", "outsource", "config.toml"), "utf8");
    expect(contents).not.toContain("params");
  });

  test("round trips model parameters", async () => {
    home = await mkdtemp(join(tmpdir(), "outsource-home-"));
    const selection = { id: "composer-2.5", params: [{ id: "fast", value: "false" }] };
    expect(Result.isOk(await writeModelSelection(selection, home))).toBe(true);
    const loaded = await readModelSelection(home);
    expect(Result.isOk(loaded) && loaded.value).toEqual(selection);
    const parsed = parse(await readFile(join(home, ".config", "outsource", "config.toml"), "utf8")) as { defaults?: { model?: string; params?: Array<{ id: string; value: string }> } };
    expect(parsed.defaults?.model).toBe("composer-2.5");
    expect(parsed.defaults?.params).toEqual([{ id: "fast", value: "false" }]);
  });

  test("reads legacy model-only configuration", async () => {
    home = await mkdtemp(join(tmpdir(), "outsource-home-"));
    const path = join(home, ".config", "outsource", "config.toml");
    await Bun.write(path, "[defaults]\nmodel = \"legacy-model\"\n");
    const loaded = await readModelSelection(home);
    expect(Result.isOk(loaded) && loaded.value).toEqual({ id: "legacy-model", params: [] });
    const legacy = await readModel(home);
    expect(Result.isOk(legacy) && legacy.value).toBe("legacy-model");
  });

  test("replacing the model clears previous parameters", async () => {
    home = await mkdtemp(join(tmpdir(), "outsource-home-"));
    await writeModelSelection({ id: "composer-2.5", params: [{ id: "fast", value: "false" }] }, home);
    expect(Result.isOk(await writeModelSelection({ id: "claude-test", params: [] }, home))).toBe(true);
    const loaded = await readModelSelection(home);
    expect(Result.isOk(loaded) && loaded.value).toEqual({ id: "claude-test", params: [] });
    const contents = await readFile(join(home, ".config", "outsource", "config.toml"), "utf8");
    expect(contents).not.toContain("params");
  });

  test("reports missing model", async () => {
    home = await mkdtemp(join(tmpdir(), "outsource-home-"));
    const loaded = await readModelSelection(home);
    expect(Result.isError(loaded) && loaded.error.code).toBe("missing_model");
  });

  test("writeModel wrapper preserves model-only format", async () => {
    home = await mkdtemp(join(tmpdir(), "outsource-home-"));
    expect(Result.isOk(await writeModel("claude-test", home))).toBe(true);
    const loaded = await readModelSelection(home);
    expect(Result.isOk(loaded) && loaded.value).toEqual({ id: "claude-test", params: [] });
  });
});
