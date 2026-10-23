import { Suspense } from "react";
import { requireAdmin } from "../guard";
import { UploadForm } from "./upload-form";

export default function AdminUploadPage() {
  return (
    <main>
      <Suspense fallback={<p className="mt-10 text-muted">Loading...</p>}>
        <Upload />
      </Suspense>
    </main>
  );
}

async function Upload() {
  await requireAdmin();
  return (
    <section aria-labelledby="upload-h" className="mt-10">
      <h1 id="upload-h" className="text-3xl font-black">Add records from Excel</h1>
      <p className="mt-3 max-w-prose text-muted">
        For many records at once. The rows are added to the Google Sheet, under the last record, and from there they work
        like rows typed in by hand. Nothing is added until you&apos;ve seen the check.
      </p>
      <ul className="mt-6 max-w-prose list-disc space-y-2 pl-5">
        <li>
          Use the <a href="/api/admin/template" className="font-bold underline">template</a>, or any .xlsx with the same column names, in any order.
        </li>
        <li>For a student who already has a passport, Passport ID and First Issued can stay empty.</li>
        <li>
          Without a Verification Status column, every row counts as confirmed. With it, an empty cell means pending:
          the row waits on the overview for someone to confirm it.
        </li>
      </ul>
      <UploadForm />
    </section>
  );
}
