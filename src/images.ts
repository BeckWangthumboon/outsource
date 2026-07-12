import { extname, resolve } from "node:path";
import { err, failure, ok, type CliResult } from "./error.js";
import type { SDKImage } from "@cursor/sdk";

const MAX_BYTES = 10 * 1024 * 1024;
const TYPES: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp" };

export async function prepareImages(inputs: string[], cwd = process.cwd()): Promise<CliResult<SDKImage[]>> {
  const images: SDKImage[] = [];
  for (const input of inputs) {
    if (/^https:\/\//i.test(input)) { images.push({ url: input }); continue; }
    if (/^[a-z]+:\/\//i.test(input)) return err(failure("invalid_image", `Image URL '${input}' must use HTTPS.`));
    const path = resolve(cwd, input); const mimeType = TYPES[extname(path).toLowerCase()];
    if (!mimeType) return err(failure("invalid_image", `Image '${input}' has an unsupported type.`, { hint: "Use PNG, JPEG, GIF, or WebP images." }));
    const file = Bun.file(path);
    if (!(await file.exists())) return err(failure("invalid_image", `Image '${input}' does not exist.`));
    if (file.size > MAX_BYTES) return err(failure("image_too_large", `Image '${input}' exceeds the 10 MiB limit.`));
    images.push({ data: Buffer.from(await file.arrayBuffer()).toString("base64"), mimeType });
  }
  return ok(images);
}
