// a student downloads their own issued pdf: the exact file whose hash is on chain
import { normalizeCode } from "@passport/core";
import { currentUser } from "@/lib/auth";
import { pdfFor } from "@/lib/passports";

export async function GET(_req: Request, ctx: RouteContext<"/api/pdf/[code]">) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "sign in with your BTU account first" }, { status: 401 });
  const code = normalizeCode((await ctx.params).code);
  const pdf = code ? await pdfFor(code, user.email) : null;
  if (!pdf) return Response.json({ error: "not found" }, { status: 404 });
  return new Response(pdf.bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pdf.name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
