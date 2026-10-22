// html -> pdf through gotenberg (headless chromium in its own container)
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { renderHtml, type Passport } from "./template.ts";

export type Renderer = (p: Passport) => Promise<Uint8Array>;

const require = createRequire(import.meta.url);
const FONTS: Record<string, string> = {
  "poppins-300.woff2": "@fontsource/poppins/files/poppins-latin-300-normal.woff2",
  "poppins-400.woff2": "@fontsource/poppins/files/poppins-latin-400-normal.woff2",
  "poppins-700.woff2": "@fontsource/poppins/files/poppins-latin-700-normal.woff2",
  "poppins-800.woff2": "@fontsource/poppins/files/poppins-latin-800-normal.woff2",
  "poppins-900.woff2": "@fontsource/poppins/files/poppins-latin-900-normal.woff2",
  "georgian-400.woff2": "@fontsource/noto-sans-georgian/files/noto-sans-georgian-georgian-400-normal.woff2",
  "georgian-700.woff2": "@fontsource/noto-sans-georgian/files/noto-sans-georgian-georgian-700-normal.woff2",
};
// read once at startup; they're sent with every render
const fontFiles = Object.entries(FONTS).map(([name, pkg]) => [name, readFileSync(require.resolve(pkg))] as const);

export function gotenbergRenderer(baseUrl: string): Renderer {
  return async (p) => {
    const form = new FormData();
    form.append("files", new Blob([await renderHtml(p)], { type: "text/html" }), "index.html");
    for (const [name, bytes] of fontFiles) form.append("files", new Blob([bytes]), name);
    form.append("preferCssPageSize", "true");
    form.append("printBackground", "true");
    form.append("metadata", JSON.stringify({ Title: `AI Skills Digital Passport ${p.passportId} V${p.version}`, Author: "Business and Technology University" }));
    const res = await fetch(`${baseUrl}/forms/chromium/convert/html`, { method: "POST", body: form, signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`gotenberg ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return new Uint8Array(await res.arrayBuffer());
  };
}
