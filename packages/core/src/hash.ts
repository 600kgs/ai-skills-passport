// web crypto, so the same code runs in the worker and in the verifier's browser
export async function sha256(data: Uint8Array | string): Promise<Uint8Array> {
  // copy into a plain ArrayBuffer-backed array, which is what subtle.digest's types accept
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

export const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

export const equalBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);
