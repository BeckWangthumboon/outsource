import { expect, test } from "bun:test";
import { PassThrough } from "node:stream";
import { readSecret } from "../src/prompt.js";

test("secret prompt restores and pauses input after Enter", async () => {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode(mode: boolean): void };
  input.isTTY = true;
  const rawModes: boolean[] = [];
  input.setRawMode = (mode) => { rawModes.push(mode); };
  const output = new PassThrough();
  let rendered = "";
  output.on("data", (chunk) => { rendered += chunk.toString(); });

  const secret = readSecret(input, output);
  input.write("secret-key\r");

  expect(await secret).toBe("secret-key");
  expect(rawModes).toEqual([true, false]);
  expect(input.isPaused()).toBe(true);
  expect(rendered).toBe("Cursor API key: \n");
});
