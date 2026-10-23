import Link from "next/link";
import { Suspense } from "react";
import { allPassports } from "@/lib/admin";
import { day, plural } from "../format";
import { requireAdmin } from "../guard";

export default function AdminPassportsPage() {
  return (
    <main>
      <Suspense fallback={<p className="mt-10 text-muted">Loading...</p>}>
        <Passports />
      </Suspense>
    </main>
  );
}

async function Passports() {
  await requireAdmin();
  const rows = await allPassports();

  return (
    <section aria-labelledby="passports-h" className="mt-10">
      <h1 id="passports-h" className="text-3xl font-black">{plural(rows.length, "passport")}</h1>
      <p className="mt-2 max-w-prose text-muted">The latest version of each. Older versions still verify, marked as outdated.</p>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[56rem] border-collapse text-left">
          <thead>
            <tr className="border-b-2 border-foreground">
              {["Passport", "Holder", "Version", "Verification code", "Issued", "Skills", ""].map((h, i) => (
                <th key={i} scope="col" className="py-2 pr-4 font-black">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.passportId} className="border-b border-line align-top">
                <td className="py-3 pr-4 font-bold whitespace-nowrap">{p.passportId}</td>
                <td className="py-3 pr-4">{p.firstName} {p.lastName}<span className="block text-sm text-muted">{p.email}</span></td>
                {p.code ? (
                  <>
                    <td className="py-3 pr-4">V{p.versionNo}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      <Link href={`/v/${p.code}`} className="font-bold tracking-wider underline">{p.code}</Link>
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">{p.issuedAt && day(p.issuedAt)}</td>
                    <td className="py-3 pr-4">{p.skillCount}</td>
                    <td className="py-3 whitespace-nowrap"><a href={`/api/pdf/${p.code}`} className="font-bold underline">PDF</a></td>
                  </>
                ) : (
                  <td colSpan={5} className="py-3 text-muted">Not issued yet. First issued date in the sheet: {day(p.firstIssued)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
