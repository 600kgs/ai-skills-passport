"use client";

import type { RecordInput, StudentInput } from "@passport/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useDict } from "@/i18n/client";
import { fill } from "@/i18n/format";
import type { ActionResult } from "../actions";
import { createRecord, removeRecord, saveRecord, saveStudent, searchStudents } from "./actions";

export type SkillOption = { skillId: string; name: string };
type Found = Awaited<ReturnType<typeof searchStudents>>[number];

const field = "w-full min-w-0 border-2 border-line bg-white px-3 py-2 text-lg text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-magenta";
const caption = "font-display text-xl text-blue";
const primary = "bg-magenta px-5 pt-2.5 pb-2 font-display text-2xl text-white hover:bg-magenta-deep disabled:opacity-60";
const secondary = "border-2 border-ink bg-white px-4 pt-2 pb-1.5 font-display text-xl text-ink hover:bg-ink hover:text-white disabled:opacity-60";
const today = () => new Date().toISOString().slice(0, 10);

function Result({ result }: { result: ActionResult | null }) {
  return (
    <p aria-live="polite" className={result ? `border-l-8 bg-white p-3 text-sm ${result.ok ? "border-blue" : "border-magenta"}` : "sr-only"}>
      {result?.message}
    </p>
  );
}

function useRun() {
  const network = useDict().admin.actions.network;
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const run = <R extends ActionResult>(action: () => Promise<R>, after?: (r: R) => void) => start(async () => {
    setResult(null);
    const r = await action().catch(() => ({ ok: false, message: network }) as R);
    setResult(r);
    after?.(r);
  });
  return { pending, result, run };
}

function RecordFields({ skills, value, onChange }: { skills: SkillOption[]; value: RecordInput; onChange: (v: RecordInput) => void }) {
  const t = useDict().admin.records;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className={caption}>{t.skill}</span>
        <select required value={value.skillId} onChange={(e) => onChange({ ...value, skillId: e.target.value })} className={field}>
          <option value="">{t.chooseSkill}</option>
          {skills.map((s) => <option key={s.skillId} value={s.skillId}>{s.skillId}, {s.name}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className={caption}>{t.dateEarned}</span>
        <input type="date" required value={value.dateEarned} onChange={(e) => onChange({ ...value, dateEarned: e.target.value })} className={field} />
      </label>
      <label className="flex flex-col gap-1">
        <span className={caption}>{t.earnedThrough}</span>
        <input value={value.earnedThrough ?? ""} onChange={(e) => onChange({ ...value, earnedThrough: e.target.value })} className={field} />
      </label>
      <fieldset className="sm:col-span-2">
        <legend className={caption}>{t.verification}</legend>
        <div className="mt-1 flex flex-wrap gap-6">
          {(["PENDING", "CONFIRMED"] as const).map((v) => (
            <label key={v} className="flex items-center gap-2">
              <input type="radio" name="verification" checked={value.verification === v} onChange={() => onChange({ ...value, verification: v })} className="size-5 accent-magenta" />
              <span>{v === "PENDING" ? t.pending : t.confirmNow}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

const STUDENT_FIELDS = ["studentId", "firstName", "lastName", "email", "program", "educationLevel", "status"] as const;

function StudentFields({ value, onChange, locked = [] }: { value: StudentInput; onChange: (v: StudentInput) => void; locked?: readonly string[] }) {
  const t = useDict().admin.records.studentFields;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {STUDENT_FIELDS.map((k) => (
        <label key={k} className="flex flex-col gap-1">
          <span className={caption}>{t[k]}</span>
          <input required readOnly={locked.includes(k)} type={k === "email" ? "email" : "text"} value={value[k]}
            onChange={(e) => onChange({ ...value, [k]: e.target.value })} className={`${field} read-only:bg-panel`} />
        </label>
      ))}
    </div>
  );
}

const emptyStudent: StudentInput = { studentId: "", firstName: "", lastName: "", email: "", program: "", educationLevel: "", status: "Active" };

export function NewRecordForm({ skills }: { skills: SkillOption[] }) {
  const t = useDict().admin.records;
  const router = useRouter();
  const { pending, result, run } = useRun();
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [picked, setPicked] = useState<Found | null>(null);
  const [student, setStudent] = useState<StudentInput>(emptyStudent);
  const [record, setRecord] = useState<RecordInput>({ skillId: "", dateEarned: today(), earnedThrough: "", verification: "PENDING" });

  const searching = mode === "existing" && q.trim().length >= 2;
  useEffect(() => {
    if (!searching) return;
    const id = setTimeout(() => { searchStudents(q).then(setFound).catch(() => setFound([])); }, 250);
    return () => clearTimeout(id);
  }, [q, searching]);
  const shown = searching ? found : [];

  return (
    <form className="mt-6 space-y-8" onSubmit={(e) => {
      e.preventDefault();
      run(() => createRecord(mode === "existing" ? picked?.studentId ?? null : null, mode === "new" ? student : null, record),
        (r) => { if (r.ok && r.recordId) router.push(`/admin/records/${r.recordId}`); });
    }}>
      <fieldset>
        <legend className="font-display text-3xl text-ink">{t.student}</legend>
        <div className="mt-3 flex flex-wrap gap-6">
          {(["existing", "new"] as const).map((m) => (
            <label key={m} className="flex items-center gap-2">
              <input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} className="size-5 accent-magenta" />
              <span>{m === "existing" ? t.existingStudent : t.newStudent}</span>
            </label>
          ))}
        </div>
        {mode === "existing" ? (
          <div className="mt-4">
            {picked ? (
              <p className="flex flex-wrap items-center gap-3">
                <span className="font-semibold text-ink">{picked.firstName} {picked.lastName}</span>
                <span className="text-muted">{picked.studentId}, {picked.email}{picked.passportId ? `, ${picked.passportId}` : ""}</span>
                <button type="button" className="underline decoration-magenta decoration-2 underline-offset-2" onClick={() => setPicked(null)}>{t.change}</button>
              </p>
            ) : (
              <>
                <label className="flex flex-col gap-1">
                  <span className={caption}>{t.search}</span>
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchHint} className={field} />
                </label>
                {shown.length > 0 && (
                  <ul className="mt-2 divide-y divide-line border-2 border-line bg-white">
                    {shown.map((s) => (
                      <li key={s.studentId}>
                        <button type="button" onClick={() => setPicked(s)} className="w-full px-3 py-2 text-left hover:bg-panel">
                          <span className="font-semibold text-ink">{s.firstName} {s.lastName}</span> <span className="text-muted">{s.studentId}, {s.email}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="mt-4"><StudentFields value={student} onChange={setStudent} /></div>
        )}
      </fieldset>
      <fieldset>
        <legend className="font-display text-3xl text-ink">{t.record}</legend>
        <div className="mt-3"><RecordFields skills={skills} value={record} onChange={setRecord} /></div>
      </fieldset>
      <button type="submit" disabled={pending || (mode === "existing" && !picked)} className={primary}>{t.add}</button>
      <Result result={result} />
    </form>
  );
}

export function EditRecordForm({ recordId, skills, initial }: { recordId: string; skills: SkillOption[]; initial: RecordInput }) {
  const t = useDict().admin.records;
  const router = useRouter();
  const { pending, result, run } = useRun();
  const [record, setRecord] = useState<RecordInput>(initial);
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(() => saveRecord(recordId, record), (r) => r.ok && router.refresh()); }}>
      <RecordFields skills={skills} value={record} onChange={setRecord} />
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className={primary}>{t.save}</button>
        <button type="button" disabled={pending} className={secondary}
          onClick={() => { if (window.confirm(fill(t.confirmDelete, { rec: recordId }))) run(() => removeRecord(recordId), (r) => r.ok && router.refresh()); }}>
          {t.delete}
        </button>
      </div>
      <Result result={result} />
    </form>
  );
}

export function EditStudentForm({ initial, identityLocked }: { initial: StudentInput; identityLocked: boolean }) {
  const t = useDict().admin.records;
  const router = useRouter();
  const { pending, result, run } = useRun();
  const [student, setStudent] = useState<StudentInput>(initial);
  const locked = identityLocked ? ["studentId", "firstName", "lastName", "email"] : ["studentId"];
  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault();
      const { studentId, ...patch } = student;
      run(() => saveStudent(studentId, patch), (r) => r.ok && router.refresh());
    }}>
      {identityLocked && <p className="max-w-prose text-sm text-muted">{t.identityLocked}</p>}
      <StudentFields value={student} onChange={setStudent} locked={locked} />
      <button type="submit" disabled={pending} className={secondary}>{t.saveStudent}</button>
      <Result result={result} />
      <p className="text-sm"><Link href="/admin/records" className="underline decoration-magenta decoration-2 underline-offset-2">{t.back}</Link></p>
    </form>
  );
}
