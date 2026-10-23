import { getDict } from "@/i18n/server";
import { requireAdmin } from "../guard";
import { UploadForm } from "./upload-form";

const link = "font-semibold text-ink underline decoration-magenta decoration-2 underline-offset-2 hover:text-magenta";

export default async function AdminUploadPage() {
  await requireAdmin();
  const t = (await getDict()).admin.upload;
  return (
    <section aria-labelledby="upload-h" className="mt-10">
      <h2 id="upload-h" className="font-display text-4xl text-ink">{t.title}</h2>
      <p className="mt-3 max-w-prose text-lg text-muted">{t.lead}</p>
      <ul className="mt-6 max-w-prose space-y-2 border-l-8 border-blue bg-panel p-5 pl-9 [list-style:square]">
        <li>{t.tipTemplateBefore} <a href="/api/admin/template" className={link}>{t.tipTemplateLink}</a>{t.tipTemplateAfter}</li>
        <li>{t.tipKnown}</li>
        <li>{t.tipStatus}</li>
      </ul>
      <UploadForm />
    </section>
  );
}
