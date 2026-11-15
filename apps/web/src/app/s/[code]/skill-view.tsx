"use client";

// one skill a student shared on linkedin. like /v, the chain record is read in the visitor's browser;
// our server says which record lists the skill and whether btu withdrew it
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { findRecordAt, normalizeCode, type ChainRecord } from "@passport/core";
import type { IssuerDocument } from "@/app/.well-known/btu-passport-issuer.json/route";
import { Check, Row, STAMP, type Step } from "@/app/v/[code]/verify-view";
import { VerdictStamp } from "@/components/verdict-stamp";
import type { SkillCheck } from "@/lib/skill-links";
import { useDict } from "@/i18n/client";
import { fill, formatDate } from "@/i18n/format";

type Load<T> = { state: "loading" } | { state: "done"; value: T } | { state: "error" };
const short = (a: string) => `${a.slice(0, 4)}...${a.slice(-4)}`;

export default function SkillView() {
  const t = useDict();
  const s_ = t.skill;
  const v_ = t.verify;
  const code = normalizeCode(String(useParams<{ code: string }>().code ?? ""));
  const [issuer, setIssuer] = useState<IssuerDocument | null>(null);
  const [info, setInfo] = useState<Load<SkillCheck | null>>(code ? { state: "loading" } : { state: "done", value: null });
  const [record, setRecord] = useState<Load<ChainRecord | null>>({ state: "loading" });
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    if (!code) return;
    (async () => {
      try {
        const r = await fetch(`/api/skill/${code}`);
        const found: SkillCheck | null = r.ok ? await r.json() : r.status === 404 ? null : Promise.reject(r.status);
        setInfo({ state: "done", value: found });
        const doc: IssuerDocument = await (await fetch("/.well-known/btu-passport-issuer.json")).json();
        setIssuer(doc);
        setRecord({ state: "done", value: found?.record ? await findRecordAt(doc.rpcUrl, doc.authority, found.record) : null });
      } catch {
        setRecord({ state: "error" });
      }
    })();
  }, [code]);

  const skill = info.state === "done" ? info.value : null;
  const rec = record.state === "done" ? record.value : null;
  const c = s_.checks;
  const steps: Step[] = !skill ? [] : [
    { wait: v_.checks.issuerPending, done: issuer && { status: "ok", text: fill(v_.checks.issuer, { domain: issuer.domain }) } },
    { wait: c.skillPending, done: skill.status === "confirmed" ? { status: "ok", text: c.current } : { status: "fail", text: c.withdrawn } },
  ];
  if (skill?.status === "confirmed") {
    steps.push({ wait: v_.checks.recordPending, done: record.state !== "done" ? null : rec ? { status: "ok", text: c.record } : { status: "fail", text: c.noRecord } });
  }
  const settled = steps.findIndex((s) => !s.done);
  const ready = settled === -1 ? steps.length : settled;

  useEffect(() => {
    if (revealed >= ready) return;
    const id = setTimeout(() => setRevealed((r) => r + 1), matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 300);
    return () => clearTimeout(id);
  }, [revealed, ready]);

  // the result, in the verify page's colours: blue confirmed, black withdrawn or not found
  const result = info.state !== "done" || (skill && (settled !== -1 || revealed < ready)) ? "checking"
    : !skill ? "unknown" : skill.status === "withdrawn" ? "withdrawn" : rec ? "confirmed" : "noRecord";
  const tone = { checking: "checking", confirmed: "authentic-latest", withdrawn: "revoked", noRecord: "unknown", unknown: "unknown" } as const;
  const words = s_.outcomes[result];

  return (
    <main>
      <section className="overflow-x-clip bg-panel">
        <div className="mx-auto max-w-6xl px-4 pt-20 pb-12 sm:pt-24">
          <p className="font-display text-2xl text-blue">{s_.label}</p>
          {skill ? (
            // btu's category stamp beside the skill, like the ink stamp on the pdf; above it on a phone
            <div className="mt-4 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-10">
              {/* eslint-disable-next-line @next/next/no-img-element -- small static pngs, nothing for the image optimizer to do */}
              <img src={STAMP[skill.skill.category] ?? STAMP["AI Skill"]} alt={skill.skill.category}
                className="h-20 w-auto max-w-[80%] shrink-0 -rotate-[4deg] object-contain sm:h-36 sm:max-w-none" />
              <div className="min-w-0">
                <h1 className="font-display text-4xl leading-none break-words text-ink sm:text-6xl">{skill.skill.name}</h1>
                <p className="mt-3 text-lg">{fill(s_.earnedBy, { name: skill.holder })}</p>
              </div>
            </div>
          ) : (
            <p className="font-display text-5xl tracking-wider text-ink sm:text-6xl">{code ?? s_.invalid}</p>
          )}
          <div className="mt-8">
            {record.state === "error"
              ? <p role="alert" className="border-l-[12px] border-magenta bg-white p-6 text-lg">{v_.chainError}</p>
              : <VerdictStamp key={result} outcome={tone[result]} title={words.title} extra={words.detail} />}
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

      {skill && (
        <section aria-labelledby="record-h" className="mx-auto max-w-3xl px-4 py-14">
          <h2 id="record-h" className="border-b-4 border-blue pb-2 font-display text-4xl text-ink">{v_.recordTitle}</h2>
          <dl className="mt-5 divide-y divide-line">
            <Row label={v_.issuedTo}><span className="text-xl font-bold text-ink">{skill.holder}</span></Row>
            <Row label={s_.skill}>{skill.skill.name}</Row>
            <Row label={s_.category}>{skill.skill.category}</Row>
            {skill.skill.earnedThrough && <Row label={v_.earnedThrough}>{skill.skill.earnedThrough}</Row>}
            <Row label={s_.dateEarned}>{formatDate(t.locale, skill.skill.dateEarned)}</Row>
            <Row label={s_.credentialId}>{skill.credentialId}</Row>
            <Row label={v_.issuer}>
              <p className="font-semibold text-ink">{issuer?.issuer ?? t.site.university}</p>
              <p className="mt-1">{v_.publishedBy} <b className="text-ink">{issuer?.domain ?? "..."}</b></p>
              <p className="mt-1">
                <a className="underline decoration-magenta decoration-2 underline-offset-2 hover:text-magenta" href="/.well-known/btu-passport-issuer.json">{v_.issuerFile}</a>
                {issuer && <> ({v_.credential} <span className="font-mono text-sm">{short(issuer.credential)}</span>)</>}
              </p>
            </Row>
            {rec && (
              <Row label={v_.proof}>
                <a className="font-semibold text-ink underline decoration-magenta decoration-2 underline-offset-2 hover:text-magenta" target="_blank" rel="noreferrer"
                  href={`https://explorer.solana.com/address/${rec.address}?cluster=${issuer?.network ?? "devnet"}`}>
                  {v_.proofLink}
                </a>
              </Row>
            )}
          </dl>
          <p className="mt-6 text-muted">{s_.privateNote}</p>
        </section>
      )}
    </main>
  );
}
