"use client";

// verification runs in the visitor's browser: the record comes straight from solana,
// the pdf is hashed locally and never uploaded. our server only says "latest or not", and "revoked".
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { findRecord, normalizeCode, sha256, verdict, type ChainRecord } from "@passport/core";
import type { IssuerDocument } from "@/app/.well-known/btu-passport-issuer.json/route";
import type { VerifyInfo } from "@/app/api/verify/[code]/route";
import { VerdictStamp } from "@/components/verdict-stamp";
import { useDict } from "@/i18n/client";
import { fill, formatDate } from "@/i18n/format";

type Load<T> = { state: "loading" } | { state: "done"; value: T } | { state: "error" };
const short = (a: string) => `${a.slice(0, 4)}...${a.slice(-4)}`;

export default function VerifyView() {
  const t = useDict();
  const v_ = t.verify;
  const day = (iso: string) => formatDate(t.locale, iso);
  const code = normalizeCode(String(useParams<{ code: string }>().code ?? ""));
  const [issuer, setIssuer] = useState<IssuerDocument | null>(null);
  const [lookup, setRecord] = useState<Load<ChainRecord | null>>({ state: "loading" });
  // a malformed code can't have a record, so there's nothing to look up
  const record: Load<ChainRecord | null> = code ? lookup : { state: "done", value: null };
  const [info, setInfo] = useState<VerifyInfo | null>(null);
  const [infoDone, setInfoDone] = useState(false);
  const [file, setFile] = useState<{ name: string; hash: Uint8Array } | null>(null);
  // how many checks are shown as finished: they tick one at a time, never ahead of the real result
  const [revealed, setRevealed] = useState(0);
  const [dragging, setDragging] = useState(false);
  const verdictRef = useRef<HTMLDivElement>(null);

  // the verdict sits at the top and the drop area further down: after a check, bring the answer into view
  // if it isn't already (on a phone it's off screen). no behavior given, so the css decides: smooth, or
  // instant for reduced motion
  useEffect(() => {
    if (file) verdictRef.current?.scrollIntoView({ block: "nearest" });
  }, [file]);

  useEffect(() => {
    if (!code) return;
    (async () => {
      try {
        const doc: IssuerDocument = await (await fetch("/.well-known/btu-passport-issuer.json")).json();
        setIssuer(doc);
        setRecord({ state: "done", value: await findRecord(doc.rpcUrl, doc.authority, code) });
      } catch {
        setRecord({ state: "error" });
      }
    })();
    // a hung server must not hold the verdict back: after 5 s the version just counts as unconfirmed
    fetch(`/api/verify/${code}`, { signal: AbortSignal.timeout(5000) })
      .then(async (r) => (r.ok ? setInfo(await r.json()) : null)).catch(() => null).finally(() => setInfoDone(true));
  }, [code]);

  async function check(f: File | undefined) {
    if (f) setFile({ name: f.name, hash: await sha256(new Uint8Array(await f.arrayBuffer())) });
  }

  const rec = record.state === "done" ? record.value : null;
  // the chain's version is the truth; the server only answers "is it the latest"
  const latest = info && rec && info.versionNo === rec.version ? { isLatest: info.isLatest } : null;
  const revoked = info?.revoked ?? null;
  const v = verdict({ record: rec, latest, fileHash: file?.hash ?? null, revoked: !!revoked });
  const outdatedNote = info && !info.isLatest ? `${v_.newerVersion} V${info.latest.versionNo}, ${day(info.latest.issuedAt)}` : undefined;
  const revokedNote = revoked ? fill(v_.revokedOn, { date: day(revoked.at), reason: revoked.reason }) : undefined;

  const c = v_.checks;
  // a malformed code is never looked up, so it has no checks to show
  const steps: Step[] = !code ? [] : [
    { wait: c.issuerPending, done: issuer && { status: "ok", text: fill(c.issuer, { domain: issuer.domain }) } },
    // a revoked version's record is closed, so "no record" waits for our server to say why
    { wait: c.recordPending, done: record.state !== "done" || (!rec && !infoDone) ? null
      : revoked ? { status: "fail", text: fill(c.revoked, { date: day(revoked.at) }) }
      : rec ? { status: "ok", text: c.record } : { status: "fail", text: c.noRecord } },
  ];
  if (rec && !revoked) {
    steps.push(
      { wait: c.versionPending, done: !infoDone ? null
        : v.record === "latest" ? { status: "ok", text: fill(c.latest, { n: rec.version }) }
        : v.record === "outdated" && info ? { status: "warn", text: fill(c.outdated, { n: rec.version, m: info.latest.versionNo }) }
        : { status: "warn", text: c.unconfirmed } },
      { wait: c.fileIdle, done: !file ? { status: "idle", text: c.fileIdle } : v.file === "authentic" ? { status: "ok", text: c.fileOk } : { status: "fail", text: c.fileBad } },
    );
  }
  const settled = steps.findIndex((s) => !s.done);
  const ready = settled === -1 ? steps.length : settled;

  useEffect(() => {
    if (revealed >= ready) return;
    const id = setTimeout(() => setRevealed((r) => r + 1), matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 300);
    return () => clearTimeout(id);
  }, [revealed, ready]);

  // the stamp lands once every check above it has ticked
  const outcome = record.state === "done" && settled === -1 && revealed >= ready ? v.outcome : "checking";

  return (
    <main>
      <section className="bg-panel">
        <div className="mx-auto max-w-6xl px-4 pt-20 pb-12 sm:pt-24">
          <p className="font-display text-2xl text-blue">{v_.codeLabel}</p>
          <p className="font-display text-5xl tracking-wider text-ink sm:text-6xl">{code ?? v_.invalidCode}</p>
          <div ref={verdictRef} className="mt-8 scroll-mt-6">
            {record.state === "error"
              ? <p role="alert" className="border-l-[12px] border-magenta bg-white p-6 text-lg">{v_.chainError}</p>
              : <VerdictStamp key={outcome} outcome={outcome} extra={v.outcome === "authentic-outdated" ? outdatedNote : v.outcome === "revoked" ? revokedNote : undefined} />}
          </div>
          {record.state !== "error" && steps.length > 0 && (
            <section aria-labelledby="checks-h" className="mt-8">
              <h2 id="checks-h" className="font-display text-2xl text-blue">{v_.checksTitle}</h2>
              <ol className="mt-3 space-y-2.5">
                {steps.map((s, i) => <Check key={i} {...(i < revealed && s.done ? s.done : { status: "pending", text: s.wait })} />)}
              </ol>
            </section>
          )}
        </div>
      </section>

      {rec && info && !revoked && info.skills.length > 0 && (
        <section aria-labelledby="stamps-h" className="mx-auto max-w-6xl px-4 pt-14">
          <h2 id="stamps-h" className="border-b-4 border-blue pb-2 font-display text-4xl text-ink">{v_.skills} ({info.skills.length})</h2>
          {/* on a phone the stamps swipe sideways, with the next one peeking in, so the record below isn't pushed far down */}
          <ul tabIndex={0} aria-labelledby="stamps-h"
            className="-mx-4 mt-6 flex snap-x snap-mandatory scroll-px-4 gap-6 overflow-x-auto px-4 pb-4 focus-visible:outline-3 focus-visible:outline-magenta sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-y-10 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
            {info.skills.map((s, i) => (
              <li key={`${s.name}-${i}`} className="w-[42%] shrink-0 snap-start sm:w-auto">
                <div className="flex h-28 items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element -- small static pngs, nothing for the image optimizer to do */}
                  <img src={STAMP[s.category] ?? STAMP["AI Skill"]} alt={s.category} className={`max-h-full object-contain ${s.category === "AI Applied Skill" ? "max-w-[72%]" : "max-w-[85%]"}`}
                    style={{ transform: `rotate(${TILT[i % TILT.length]}deg)` }} />
                </div>
                <p className="mt-4 font-semibold leading-snug text-ink">{s.name}</p>
                {s.earnedThrough && <p className="mt-1 text-sm text-muted">{v_.earnedThrough} {s.earnedThrough}</p>}
                <p className="mt-0.5 text-sm text-muted">{day(s.dateEarned)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-14 md:grid-cols-2">
        <section aria-labelledby="record-h">
          <h2 id="record-h" className="border-b-4 border-blue pb-2 font-display text-4xl text-ink">{v_.recordTitle}</h2>
          {record.state === "loading" && <p className="mt-5 text-muted">{v_.reading}</p>}
          {record.state === "done" && !rec && infoDone && <p className="mt-5 text-lg">{revoked ? v_.revokedRecord : v_.noRecord}</p>}
          {rec && (
            <dl className="mt-5 divide-y divide-line">
              {info && (
                <>
                  <Row label={v_.issuedTo}><span className="text-xl font-bold text-ink">{info.holder}</span></Row>
                  <Row label={v_.passportId}>{info.passportId}</Row>
                </>
              )}
              <Row label={v_.version}>
                V{rec.version}{" "}
                {v.record === "latest" && <span className="ml-1 bg-blue px-2 py-0.5 font-display text-lg text-white">{v_.latest}</span>}
                {v.record === "outdated" && info && <span className="ml-1 bg-yellow px-2 py-0.5 font-display text-lg text-ink">{v_.latestIs} V{info.latest.versionNo}</span>}
              </Row>
              {info && <Row label={v_.issuedOn}>{day(info.issuedAt)}</Row>}
              <Row label={v_.issuer}>
                <p className="font-semibold text-ink">{issuer?.issuer ?? t.site.university}</p>
                <p className="mt-1">{v_.publishedBy} <b className="text-ink">{issuer?.domain ?? "..."}</b></p>
                <p className="mt-1">
                  <a className="underline decoration-magenta decoration-2 underline-offset-2 hover:text-magenta" href="/.well-known/btu-passport-issuer.json">{v_.issuerFile}</a>
                  {issuer && <> ({v_.credential} <span className="font-mono text-sm">{short(issuer.credential)}</span>)</>}
                </p>
                <p className="mt-2 text-sm text-muted">{v_.issuerExplain}</p>
              </Row>
              <Row label={v_.proof}>
                <a className="font-semibold text-ink underline decoration-magenta decoration-2 underline-offset-2 hover:text-magenta" target="_blank" rel="noreferrer"
                  href={`https://explorer.solana.com/address/${rec.address}?cluster=${issuer?.network ?? "devnet"}`}>
                  {v_.proofLink}
                </a>
              </Row>
            </dl>
          )}
        </section>

        <section aria-labelledby="file-h">
          <h2 id="file-h" className="border-b-4 border-blue pb-2 font-display text-4xl text-ink">{v_.fileTitle}</h2>
          <label
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); check(e.dataTransfer.files[0]); }}
            className={`mt-5 flex cursor-pointer flex-col items-center justify-center border-2 border-dashed px-6 py-14 text-center focus-within:border-magenta focus-within:outline-3 focus-within:outline-magenta ${dragging ? "border-magenta bg-magenta/5" : "border-[#bdbdbd] bg-panel"} ${rec ? "" : "cursor-not-allowed opacity-60"}`}
          >
            <input type="file" accept="application/pdf" className="sr-only" disabled={!rec} aria-label={rec ? v_.drop : revoked ? v_.revokedNoFile : v_.waitForRecord} onChange={(e) => check(e.target.files?.[0])} />
            <svg aria-hidden viewBox="0 0 48 48" className="size-12 text-magenta" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 6h14l8 8v28H14z" /><path d="M28 6v8h8M25 36V22m-6 6 6-6 6 6" />
            </svg>
            <span className="mt-4 font-display text-2xl text-ink">{rec ? v_.drop : revoked ? v_.revokedNoFile : v_.waitForRecord}</span>
            <span className="mt-2 max-w-sm text-sm text-muted">{v_.staysLocal}</span>
          </label>
          {file && (
            <p className={`mt-5 border-l-[12px] p-4 text-lg ${v.file === "authentic" ? "border-blue bg-blue/5" : "border-magenta bg-ink text-white"}`}>
              <span className="font-bold">{file.name}</span> {v.file === "authentic" ? v_.matches : v_.differs}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

// btu's own category stamps, the same art as on the pdf, set at a slight angle like ink stamps
const STAMP: Record<string, string> = {
  "AI Skill": "/art/stamp-skill.png", "AI Applied Skill": "/art/stamp-applied.png", "AI Advanced Skill": "/art/stamp-advanced.png",
};
const TILT = [-4, 3, -2, 5, -5, 2];

type Status = "pending" | "ok" | "warn" | "fail" | "idle";
// one check: what it says while waiting, and its result once known
type Step = { wait: string; done: { status: Exclude<Status, "pending">; text: string } | null };

const MARK: Record<Status, { tone: string; icon: React.ReactNode }> = {
  pending: { tone: "text-muted", icon: <circle cx="12" cy="12" r="8" strokeDasharray="3 3" /> },
  ok: { tone: "text-blue", icon: <><circle cx="12" cy="12" r="9" /><path d="m7.5 12.5 3 3 6-6.5" /></> },
  warn: { tone: "text-ink", icon: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5.5l3.5 2" /></> },
  fail: { tone: "text-magenta", icon: <><circle cx="12" cy="12" r="9" /><path d="m8.5 8.5 7 7m0-7-7 7" /></> },
  idle: { tone: "text-muted", icon: <circle cx="12" cy="12" r="9" /> },
};

function Check({ status, text }: { status: Status; text: string }) {
  const m = MARK[status];
  return (
    <li className={`flex items-start gap-3 text-lg ${status === "pending" || status === "idle" ? "text-muted" : "text-ink"}`}>
      <svg key={status} aria-hidden viewBox="0 0 24 24" className={`mt-0.5 size-6 shrink-0 ${m.tone} ${status === "pending" ? "animate-spin [animation-duration:3s] motion-reduce:animate-none" : "check-tick"}`}
        fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
        {m.icon}
      </svg>
      <span>{text}</span>
    </li>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[9rem_1fr] sm:gap-4">
      <dt className="font-display text-xl text-blue">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
