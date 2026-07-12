import { afterEach, describe, expect, test } from "bun:test";
import { Result } from "better-result";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readModel, writeModel } from "../src/config.js";

let home: string | undefined;
afterEach(async () => { if (home) await rm(home, { recursive: true, force: true }); home = undefined; });
describe("configuration", () => {
  test("round trips the selected model", async () => { home = await mkdtemp(join(tmpdir(), "outsource-home-")); expect(Result.isOk(await writeModel("claude-test", home))).toBe(true); const loaded = await readModel(home); expect(Result.isOk(loaded) && loaded.value).toBe("claude-test"); });
  test("reports missing model", async () => { home = await mkdtemp(join(tmpdir(), "outsource-home-")); const loaded = await readModel(home); expect(Result.isError(loaded) && loaded.error.code).toBe("missing_model"); });
});
