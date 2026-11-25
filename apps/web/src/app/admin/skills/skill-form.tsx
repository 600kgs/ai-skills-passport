"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useDict } from "@/i18n/client";
import type { ActionResult } from "../actions";
import { saveSkill, type SkillForm as Values } from "./actions";

const CATEGORY_LIST = ["AI Skill", "AI Applied Skill", "AI Advanced Skill"];
const field = "min-w-0 border-2 border-line bg-white px-3 py-2 text-lg text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-magenta";
const label = "flex flex-col gap-1";
const caption = "font-display text-xl text-blue";

// add a skill (no initial values) or edit one (its id then stays fixed)
export function SkillForm({ initial }: { initial?: Values }) {
  const d = useDict();
  const t = d.admin.skills;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [v, setV] = useState<Values>(initial ?? { skillId: "", name: "", category: CATEGORY_LIST[0]!, description: "", active: true });
  const set = (k: keyof Values) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });

  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        setResult(null);
        const r = await saveSkill(v).catch(() => ({ ok: false, message: d.admin.actions.network }));
        setResult(r);
        if (r.ok) router.refresh();
      });
    }}>
      <label className={label}>
        <span className={caption}>{t.id}</span>
        <input required value={v.skillId} onChange={set("skillId")} readOnly={!!initial} placeholder="SKL-013" className={field} />
      </label>
      <label className={label}>
        <span className={caption}>{t.category}</span>
        <select value={v.category} onChange={set("category")} className={field}>
          {CATEGORY_LIST.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label className={`${label} sm:col-span-2`}>
        <span className={caption}>{t.name}</span>
        <input required value={v.name} onChange={set("name")} className={field} />
      </label>
      <label className={`${label} sm:col-span-2`}>
        <span className={caption}>{t.description}</span>
        <textarea required rows={3} value={v.description} onChange={set("description")} className={field} />
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} className="size-5 accent-magenta" />
        <span>{t.active}</span>
      </label>
      <div className="sm:text-right">
        <button type="submit" disabled={pending} className="bg-magenta px-5 pt-2.5 pb-2 font-display text-2xl text-white hover:bg-magenta-deep disabled:opacity-60">
          {initial ? t.save : t.add}
        </button>
      </div>
      <p aria-live="polite" className={result ? `border-l-8 bg-white p-3 text-sm sm:col-span-2 ${result.ok ? "border-blue" : "border-magenta"}` : "sr-only"}>
        {result?.message}
      </p>
    </form>
  );
}
