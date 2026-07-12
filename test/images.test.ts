import { afterEach, describe, expect, test } from "bun:test";
import { Result } from "better-result";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { prepareImages } from "../src/images.js";

let directory: string | undefined;
afterEach(async () => { if (directory) await rm(directory, { recursive: true, force: true }); directory = undefined; });

describe("image preparation", () => {
  test("preserves mixed local and remote order", async () => {
    directory = await mkdtemp(join(tmpdir(), "outsource-")); await Bun.write(join(directory, "one.png"), new Uint8Array([1, 2, 3]));
    const result = await prepareImages(["https://example.com/zero.webp", "one.png", "https://example.com/two.jpg"], directory);
    expect(Result.isOk(result)).toBe(true); if (Result.isError(result)) return;
    expect(result.value[0]).toEqual({ url: "https://example.com/zero.webp" });
    expect(result.value[1]).toEqual({ data: "AQID", mimeType: "image/png" });
    expect(result.value[2]).toEqual({ url: "https://example.com/two.jpg" });
  });
  test("rejects HTTP URLs", async () => { const result = await prepareImages(["http://example.com/no.png"]); expect(Result.isError(result) && result.error.code).toBe("invalid_image"); });
});
