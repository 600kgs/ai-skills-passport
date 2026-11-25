"use client";

import type { Role } from "@passport/core";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useDict } from "@/i18n/client";
import { fill } from "@/i18n/format";
import type { ActionResult } from "../actions";
import { deleteStaff, saveStaff } from "./actions";

const ROLE_LIST: Role[] = ["viewer", "editor", "admin", "superadmin"];
const field = "h-12 min-w-0 border-2 border-line bg-white px-3 text-lg text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-magenta";
const button = "border-2 border-ink bg-white px-4 pt-2 pb-1.5 font-display text-xl text-ink hover:bg-ink hover:text-white disabled:opacity-60";

function useRun() {
  const network = useDict().admin.actions.network;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const run = (action: () => Promise<ActionResult>) => start(async () => {
    setResult(null);
    setResult(await action().catch(() => ({ ok: false, message: network })));
    router.refresh();
  });
  return { pending, result, run };
}

function Result({ result }: { result: ActionResult | null }) {
  return (
    <p aria-live="polite" className={result ? `mt-2 border-l-8 bg-white p-3 text-sm ${result.ok ? "border-blue" : "border-magenta"}` : "sr-only"}>
      {result?.message}
    </p>
  );
}

export function AddStaff() {
  const t = useDict().admin.people;
  const { pending, result, run } = useRun();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("viewer");
  return (
    <form className="mt-6" onSubmit={(e) => { e.preventDefault(); run(() => saveStaff(email, role)); }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1">
          <span className="font-display text-xl text-blue">{t.email}</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@btu.edu.ge" className={field} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-display text-xl text-blue">{t.role}</span>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={field}>
            {ROLE_LIST.map((r) => <option key={r} value={r}>{t.roles[r]}</option>)}
          </select>
        </label>
        <button type="submit" disabled={pending} className="h-12 bg-magenta px-5 pt-1 font-display text-2xl text-white hover:bg-magenta-deep disabled:opacity-60">{t.add}</button>
      </div>
      <Result result={result} />
    </form>
  );
}

export function StaffRow({ email, role }: { email: string; role: Role }) {
  const t = useDict().admin.people;
  const { pending, result, run } = useRun();
  const [next, setNext] = useState<Role>(role);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor={`role-${email}`}>{t.role}</label>
        <select id={`role-${email}`} value={next} onChange={(e) => setNext(e.target.value as Role)} className={field}>
          {ROLE_LIST.map((r) => <option key={r} value={r}>{t.roles[r]}</option>)}
        </select>
        <button type="button" disabled={pending || next === role} onClick={() => run(() => saveStaff(email, next))} className={button}>{t.save}</button>
        <button type="button" disabled={pending}
          onClick={() => { if (window.confirm(fill(t.confirmRemove, { email }))) run(() => deleteStaff(email)); }}
          className={button}>{t.remove}</button>
      </div>
      <Result result={result} />
    </div>
  );
}
