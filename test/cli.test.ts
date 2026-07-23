import { expect, test } from "bun:test";

test("reports the package version", async () => {
  const result = Bun.spawn(["bun", "src/cli.ts", "--version"], { cwd: import.meta.dir + "/..", stdout: "pipe", stderr: "pipe" });
  expect(await new Response(result.stdout).text()).toBe("0.1.6\n");
  expect(await result.exited).toBe(0);
});
