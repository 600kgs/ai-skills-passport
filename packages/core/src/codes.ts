// verification codes: crockford base32, 10 chars (~50 bits), printed as XXXX-XXXX-XX.
// no I, L, O, U, so codes survive being read aloud or typed from paper.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const LENGTH = 10;

export function newVerificationCode(): string {
  const random = crypto.getRandomValues(new Uint8Array(LENGTH));
  const raw = Array.from(random, (b) => ALPHABET[b % 32]).join("");
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
}

// accepts what people actually type: lowercase, spaces, missing dashes, O for 0, I/L for 1
export function normalizeCode(input: string): string | null {
  const raw = input.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  if (raw.length !== LENGTH || [...raw].some((c) => !ALPHABET.includes(c))) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
}
