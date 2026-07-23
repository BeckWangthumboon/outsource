import { afterEach, describe, expect, test } from "bun:test";
import { Result } from "better-result";
import { access, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { clearApiKey, getApiKey, storeApiKey } from "../src/auth.js";

const TEST_KEY = "key_test_secret_value_abc123";
const OTHER_KEY = "key_other_secret_value_xyz789";

let home: string | undefined;
let savedApiKey: string | undefined;

afterEach(async () => {
  if (savedApiKey === undefined) delete process.env.CURSOR_API_KEY;
  else process.env.CURSOR_API_KEY = savedApiKey;
  savedApiKey = undefined;
  if (home) await rm(home, { recursive: true, force: true });
  home = undefined;
});

async function writeAuthFile(key: string, contents?: string) {
  const dir = join(home!, ".config", "outsource");
  await Bun.write(join(dir, "auth.json"), contents ?? `${JSON.stringify({ cursorApiKey: key })}\n`);
}

function expectNoKeyLeak(value: unknown) {
  const text = JSON.stringify(value);
  expect(text).not.toContain(TEST_KEY);
  expect(text).not.toContain(OTHER_KEY);
}

describe("credential lookup", () => {
  test("environment variable takes precedence over file", async () => {
    home = await mkdtemp(join(tmpdir(), "outsource-home-"));
    savedApiKey = process.env.CURSOR_API_KEY;
    process.env.CURSOR_API_KEY = TEST_KEY;
    await writeAuthFile(OTHER_KEY);

    const result = await getApiKey(home);
    expect(Result.isOk(result) && result.value).toEqual({ key: TEST_KEY, source: "environment" });
  });

  test("reads file credential when env is unset", async () => {
    home = await mkdtemp(join(tmpdir(), "outsource-home-"));
    savedApiKey = process.env.CURSOR_API_KEY;
    delete process.env.CURSOR_API_KEY;
    await writeAuthFile(TEST_KEY);

    const result = await getApiKey(home);
    expect(Result.isOk(result) && result.value).toEqual({ key: TEST_KEY, source: "file" });
  });

  test("reports missing credential when nothing is configured", async () => {
    home = await mkdtemp(join(tmpdir(), "outsource-home-"));
    savedApiKey = process.env.CURSOR_API_KEY;
    delete process.env.CURSOR_API_KEY;

    const result = await getApiKey(home);
    expect(Result.isError(result) && result.error.code).toBe("missing_credential");
    expectNoKeyLeak(result);
  });
});

describe("auth file handling", () => {
  test("missing auth.json is handled cleanly", async () => {
    home = await mkdtemp(join(tmpdir(), "outsource-home-"));
    savedApiKey = process.env.CURSOR_API_KEY;
    delete process.env.CURSOR_API_KEY;

    const result = await getApiKey(home);
    expect(Result.isError(result) && result.error.code).toBe("missing_credential");
  });

  test.each([
    ["not-json", "not valid JSON"],
    ["{}", "invalid format"],
    ['{"cursorApiKey":""}', "valid cursorApiKey"],
    ['{"cursorApiKey":123}', "valid cursorApiKey"],
  ])("malformed auth.json (%s) returns configuration_error", async (contents, fragment) => {
    home = await mkdtemp(join(tmpdir(), "outsource-home-"));
    savedApiKey = process.env.CURSOR_API_KEY;
    delete process.env.CURSOR_API_KEY;
    await writeAuthFile(TEST_KEY, `${contents}\n`);

    const result = await getApiKey(home);
    expect(Result.isError(result)).toBe(true);
    if (Result.isError(result)) {
      expect(result.error.code).toBe("configuration_error");
      expect(result.error.message).toContain(fragment);
      expectNoKeyLeak(result);
    }
  });
});

describe("store and clear", () => {
  test("stores and reads the file credential", async () => {
    home = await mkdtemp(join(tmpdir(), "outsource-home-"));
    expect(Result.isOk(await storeApiKey(TEST_KEY, home))).toBe(true);

    const path = join(home, ".config", "outsource", "auth.json");
    const parsed = JSON.parse(await readFile(path, "utf8")) as { cursorApiKey: string };
    expect(parsed.cursorApiKey).toBe(TEST_KEY);

    const loaded = await getApiKey(home);
    expect(Result.isOk(loaded) && loaded.value).toEqual({ key: TEST_KEY, source: "file" });
  });

  test("writes auth file with mode 0600", async () => {
    home = await mkdtemp(join(tmpdir(), "outsource-home-"));
    expect(Result.isOk(await storeApiKey(TEST_KEY, home))).toBe(true);

    const path = join(home, ".config", "outsource", "auth.json");
    const mode = (await stat(path)).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  test("creates parent directory with mode 0700", async () => {
    home = await mkdtemp(join(tmpdir(), "outsource-home-"));
    expect(Result.isOk(await storeApiKey(TEST_KEY, home))).toBe(true);

    const dir = join(home, ".config", "outsource");
    const mode = (await stat(dir)).mode & 0o777;
    expect(mode).toBe(0o700);
  });

  test("clear removes the auth file", async () => {
    home = await mkdtemp(join(tmpdir(), "outsource-home-"));
    await storeApiKey(TEST_KEY, home);
    const path = join(home, ".config", "outsource", "auth.json");

    expect(Result.isOk(await clearApiKey(home))).toBe(true);
    await expect(access(path)).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("clear succeeds when auth file is already missing", async () => {
    home = await mkdtemp(join(tmpdir(), "outsource-home-"));
    expect(Result.isOk(await clearApiKey(home))).toBe(true);
  });

  test("API keys never appear in error messages", async () => {
    home = await mkdtemp(join(tmpdir(), "outsource-home-"));
    await writeAuthFile(TEST_KEY, "not-json\n");

    const result = await getApiKey(home);
    expect(Result.isError(result)).toBe(true);
    if (Result.isError(result)) {
      expectNoKeyLeak({ code: result.error.code, message: result.error.message, hint: result.error.hint });
    }
  });
});
