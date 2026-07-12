import { err, failure, ok, type CliResult } from "./error.js";

export interface CommandResult { stdout: string; stderr: string; exitCode: number }
export type CommandRunner = (command: string[]) => Promise<CommandResult>;

export const runCommand: CommandRunner = async (command) => {
  const proc = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited,
  ]);
  return { stdout, stderr, exitCode };
};

export async function checked(runner: CommandRunner, command: string[], code: Parameters<typeof failure>[0], message: string): Promise<CliResult<string>> {
  try {
    const result = await runner(command);
    return result.exitCode === 0 ? ok(result.stdout.trim()) : err(failure(code, message, { cause: result.stderr.trim() }));
  } catch (cause) {
    return err(failure(code, message, { cause }));
  }
}
