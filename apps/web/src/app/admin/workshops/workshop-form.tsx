"use client";

import type { WorkshopInput, WorkshopStatus } from "@passport/core";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useDict } from "@/i18n/client";
import type { ActionResult } from "../actions";
import { changeStatus, saveWorkshop } from "./actions";

const field = "w-full min-w-0 border-2 border-line bg-white px-3 py-2 text-lg text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-magenta";
const caption = "font-display text-xl text-blue";
const hint = "text-sm text-muted";

function Result({ result }: { result: ActionResult | null }) {
  return (
    <p aria-live="polite" className={result ? `border-l-8 bg-white p-3 text-sm ${result.ok ? "border-blue" : "border-magenta"}` : "sr-only"}>
      {result?.message}
    </p>
  );
}

const empty: WorkshopInput = {
  kind: "workshop", title: "", titleEn: "", description: "", descriptionEn: "", trainer: "",
  startsAt: "", endsAt: "", location: "", skillId: "", registrationUrl: "",
};

export function WorkshopForm({ id, initial, skills }: { id: number | null; initial?: WorkshopInput; skills: { skillId: string; name: string }[] }) {
  const d = useDict();
  const t = d.admin.workshops;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [w, setW] = useState<WorkshopInput>(initial ?? empty);
  const text = (k: keyof WorkshopInput) => ({ value: (w[k] as string | null) ?? "", onChange: (e: { target: { value: string } }) => setW({ ...w, [k]: e.target.value }) });

  return (
    <form className="grid gap-5 sm:grid-cols-2" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        setResult(null);
        const r = await saveWorkshop(id, w).catch(() => ({ ok: false, message: d.admin.actions.network }) as ActionResult & { id?: number });
        setResult(r);
        if (r.ok && id === null && r.id) router.push(`/admin/workshops/${r.id}`);
        else if (r.ok) router.refresh();
      });
    }}>
      <fieldset className="sm:col-span-2">
        <legend className={caption}>{t.kind}</legend>
        <div className="mt-1 flex gap-6">
          {(["workshop", "hackathon"] as const).map((k) => (
            <label key={k} className="flex items-center gap-2">
              <input type="radio" name="kind" checked={w.kind === k} onChange={() => setW({ ...w, kind: k })} className="size-5 accent-magenta" />
              <span>{k === "workshop" ? d.workshops.workshop : d.workshops.hackathon}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1 sm:col-span-2"><span className={caption}>{t.titleField}</span><input required {...text("title")} className={field} /></label>
      <label className="flex flex-col gap-1 sm:col-span-2"><span className={caption}>{t.description}</span><textarea required rows={3} {...text("description")} className={field} /></label>
      <label className="flex flex-col gap-1"><span className={caption}>{t.startsAt}</span><input type="datetime-local" required {...text("startsAt")} className={field} /></label>
      <label className="flex flex-col gap-1"><span className={caption}>{t.endsAt}</span><input type="datetime-local" {...text("endsAt")} className={field} /></label>
      <p className={`${hint} sm:col-span-2`}>{t.timeHint}</p>
      <label className="flex flex-col gap-1"><span className={caption}>{t.location}</span><input required {...text("location")} className={field} /></label>
      <label className="flex flex-col gap-1"><span className={caption}>{t.trainer}</span><input required {...text("trainer")} className={field} /></label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className={caption}>{t.skill}</span>
        <select {...text("skillId")} className={field}>
          <option value="">{t.noBadge}</option>
          {skills.map((s) => <option key={s.skillId} value={s.skillId}>{s.skillId}, {s.name}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className={caption}>{t.registrationUrl}</span>
        <input type="url" required placeholder="https://forms.gle/..." {...text("registrationUrl")} className={field} />
        <span className={hint}>{t.registrationHint}</span>
      </label>
      <details className="sm:col-span-2">
        <summary className="cursor-pointer font-display text-xl text-ink">{t.english}</summary>
        <div className="mt-3 grid gap-4">
          <label className="flex flex-col gap-1"><span className={caption}>{t.titleEn}</span><input {...text("titleEn")} className={field} /></label>
          <label className="flex flex-col gap-1"><span className={caption}>{t.descriptionEn}</span><textarea rows={3} {...text("descriptionEn")} className={field} /></label>
        </div>
      </details>
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className="bg-magenta px-6 pt-3 pb-2.5 font-display text-2xl text-white hover:bg-magenta-deep disabled:opacity-60">
          {id === null ? t.create : t.save}
        </button>
      </div>
      <div className="sm:col-span-2"><Result result={result} /></div>
    </form>
  );
}

export function StatusButtons({ id, status }: { id: number; status: WorkshopStatus }) {
  const d = useDict();
  const t = d.admin.workshops;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const go = (s: WorkshopStatus, confirm?: string) => {
    if (confirm && !window.confirm(confirm)) return;
    start(async () => {
      setResult(null);
      setResult(await changeStatus(id, s).catch(() => ({ ok: false, message: d.admin.actions.network })));
      router.refresh();
    });
  };
  const button = "border-2 border-ink bg-white px-4 pt-2 pb-1.5 font-display text-xl text-ink hover:bg-ink hover:text-white disabled:opacity-60";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        {status !== "published" && <button type="button" disabled={pending} onClick={() => go("published")} className="bg-magenta px-5 pt-2 pb-1.5 font-display text-xl text-white hover:bg-magenta-deep disabled:opacity-60">{t.publish}</button>}
        {status === "published" && <button type="button" disabled={pending} onClick={() => go("draft")} className={button}>{t.unpublish}</button>}
        {status !== "cancelled" && <button type="button" disabled={pending} onClick={() => go("cancelled", t.confirmCancel)} className={button}>{t.cancel}</button>}
      </div>
      <Result result={result} />
    </div>
  );
}
