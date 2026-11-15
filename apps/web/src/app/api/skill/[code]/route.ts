// one skill's public check, for the link a student put on linkedin. only that skill and the holder's name
import { normalizeCode } from "@passport/core";
import { allow, clientKey } from "@/lib/rate-limit";
import { skillByLink } from "@/lib/skill-links";

export async function GET(req: Request, ctx: RouteContext<"/api/skill/[code]">) {
  if (!allow(clientKey(req))) return Response.json({ error: "Too many checks. Try again in a minute." }, { status: 429 });
  const code = normalizeCode((await ctx.params).code);
  const info = code ? await skillByLink(code) : null;
  if (!info) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(info, { headers: { "Cache-Control": "no-store" } });
}
