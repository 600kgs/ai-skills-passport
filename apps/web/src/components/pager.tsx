import Link from "next/link";
import { pageWindow, queryString } from "@passport/core";
import { fill } from "@/i18n/format";
import type { Dict } from "@/i18n/dictionaries";

type Params = Record<string, string | number | null | undefined>;
const link = "underline decoration-magenta decoration-2 underline-offset-2 hover:text-magenta";

// one page control for every admin list: previous and next, numbered pages with gaps, and a box to jump to any page.
// the jump is a plain get form carrying the list's filters, so it works without javascript
export function Pager({ path, params, page, pages, t }: { path: string; params: Params; page: number; pages: number; t: Dict["admin"]["pager"] }) {
  if (pages <= 1) return null;
  const href = (p: number) => `${path}${queryString({ ...params, page: p > 1 ? p : null })}`;
  const kept = Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== "");
  return (
    <nav aria-label={t.label} className="mt-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-t-2 border-line pt-5">
      <ul className="flex flex-wrap items-center gap-1">
        <li>{page > 1 ? <Link href={href(page - 1)} className={`px-2 font-display text-xl text-ink ${link}`}>← {t.prev}</Link> : <span className="px-2 font-display text-xl text-muted">← {t.prev}</span>}</li>
        {pageWindow(page, pages).map((p, i) => (
          <li key={p === "gap" ? `gap-${i}` : p}>
            {p === "gap" ? <span className="px-1 text-muted" aria-hidden>…</span>
              : p === page ? <span aria-current="page" className="block min-w-9 bg-blue px-2 pt-1 pb-0.5 text-center font-display text-xl text-white">{p}</span>
              : <Link href={href(p)} className="block min-w-9 px-2 pt-1 pb-0.5 text-center font-display text-xl text-ink hover:bg-panel" aria-label={fill(t.goTo, { page: p })}>{p}</Link>}
          </li>
        ))}
        <li>{page < pages ? <Link href={href(page + 1)} className={`px-2 font-display text-xl text-ink ${link}`}>{t.next} →</Link> : <span className="px-2 font-display text-xl text-muted">{t.next} →</span>}</li>
      </ul>
      <form action={path} method="get" className="flex items-center gap-2">
        {kept.map(([k, v]) => <input key={k} type="hidden" name={k} value={String(v)} />)}
        <label htmlFor={`jump-${path}`} className="text-muted">{fill(t.pageOf, { page, pages })}. {t.jump}</label>
        <input id={`jump-${path}`} name="page" type="number" min={1} max={pages} required
          className="h-10 w-20 border-2 border-line bg-white px-2 text-lg text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-magenta" />
        <button type="submit" className="h-10 border-2 border-ink px-3 font-display text-lg text-ink hover:bg-ink hover:text-white">{t.go}</button>
      </form>
    </nav>
  );
}
