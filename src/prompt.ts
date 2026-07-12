type SecretInput = NodeJS.ReadableStream & { isTTY?: boolean; setRawMode?(mode: boolean): unknown };
type SecretOutput = NodeJS.WritableStream;

export async function readSecret(input: SecretInput = process.stdin, output: SecretOutput = process.stdout): Promise<string> {
  output.write("Cursor API key: ");
  input.setRawMode?.(true);
  input.resume();
  return new Promise<string>((resolve) => {
    let value = "";
    const finish = () => {
      input.removeListener("data", read);
      input.setRawMode?.(false);
      input.pause();
      output.write("\n");
      resolve(value.trim());
    };
    const read = (data: Buffer | string) => {
      for (const char of data.toString()) {
        if (char === "\r" || char === "\n") { finish(); return; }
        if (char === "\u0003") { input.removeListener("data", read); input.setRawMode?.(false); input.pause(); process.exit(130); }
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else value += char;
      }
    };
    input.on("data", read);
  });
}
