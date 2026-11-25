// excel downloads of the records and passports lists, with the same filters as the pages
import { passportFilters, recordFilters } from "@passport/core";
import { listRecords } from "@passport/ledger";
import { listPassports } from "@/lib/admin";
import { currentStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { tableXlsx } from "@/lib/xlsx";

const ALL = 100_000;

export async function GET(request: Request) {
  if (!(await currentStaff("viewer"))) return Response.json({ error: "staff only" }, { status: 403 });
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const day = new Date().toISOString().slice(0, 10);
  let file: Buffer;
  let name: string;
  if (params.kind === "passports") {
    const { rows } = await listPassports({ ...passportFilters(params), page: 1 }, ALL);
    file = await tableXlsx("Passports", ["Passport ID", "First name", "Last name", "Email", "First issued", "Latest version", "Verification code", "Issued at", "Skills"],
      rows.map((p) => [p.passportId, p.firstName, p.lastName, p.email, p.firstIssued, p.versionNo ? `V${p.versionNo}` : "", p.code, p.issuedAt?.toISOString().slice(0, 10) ?? "", p.skillCount]));
    name = `passports-${day}.xlsx`;
  } else if (params.kind === "records") {
    const { rows } = await listRecords(getDb(), { ...recordFilters(params), page: 1 }, ALL);
    file = await tableXlsx("Skill records", ["Record ID", "Student ID", "First name", "Last name", "Email", "Passport ID", "Skill ID", "Skill", "Date earned", "Verification", "State", "Source"],
      rows.map((r) => [r.recordId, r.studentId, r.firstName, r.lastName, r.email, r.passportId, r.skillId, r.skillName, r.dateEarned, r.verification, r.state, r.source]));
    name = `passport-records-${day}.xlsx`;
  } else {
    return Response.json({ error: "kind must be records or passports" }, { status: 400 });
  }
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
