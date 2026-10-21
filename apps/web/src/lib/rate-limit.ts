// fixed-window limit per visitor. codes are unguessable already; this just makes
// guessing at scale pointless. in memory is enough for a single web process.
const WINDOW_MS = 60_000;
const hits = new Map<string, { count: number; resetAt: number }>();

export function allow(key: string, limit = 30): boolean {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
    return true;
  }
  return ++h.count <= limit;
}

export const clientKey = (req: Request) =>
  req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
