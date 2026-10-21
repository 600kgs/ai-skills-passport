// issued pdfs, stored once under their own sha256 and never rewritten.
// re-rendering gives different bytes, so this file is the only valid copy.
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface PdfStore {
  put(sha256Hex: string, pdf: Uint8Array): Promise<string>; // returns the stored path
  get(sha256Hex: string): Promise<Uint8Array | null>;
}

export function fileStore(dir: string): PdfStore {
  const pathOf = (sha: string) => join(dir, "pdfs", `${sha}.pdf`);
  return {
    async put(sha, pdf) {
      const path = pathOf(sha);
      if (existsSync(path)) return path;
      await mkdir(join(dir, "pdfs"), { recursive: true });
      // write then rename, so a crash never leaves a half-written pdf under a valid name
      await writeFile(`${path}.tmp`, pdf);
      await rename(`${path}.tmp`, path);
      return path;
    },
    async get(sha) {
      const path = pathOf(sha);
      return existsSync(path) ? new Uint8Array(await readFile(path)) : null;
    },
  };
}
