// the empty upload template: the columns a staff member fills in, nothing the system assigns
import { currentStaff } from "@/lib/auth";
import { uploadTemplate } from "@/lib/xlsx";

export async function GET() {
  if (!(await currentStaff("admin"))) return Response.json({ error: "admins only" }, { status: 403 });
  return new Response(new Uint8Array(await uploadTemplate()), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="passport-records-template.xlsx"',
      "Cache-Control": "private, no-store",
    },
  });
}
