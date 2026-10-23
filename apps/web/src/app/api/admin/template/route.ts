// the empty upload template: the sheet's input columns, nothing else
import { currentAdmin } from "@/lib/auth";
import { uploadTemplate } from "@/lib/xlsx";

export async function GET() {
  if (!(await currentAdmin())) return Response.json({ error: "admins only" }, { status: 403 });
  return new Response(new Uint8Array(await uploadTemplate()), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="passport-records-template.xlsx"',
      "Cache-Control": "private, no-store",
    },
  });
}
