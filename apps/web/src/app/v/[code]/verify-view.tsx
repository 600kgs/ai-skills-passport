"use client";

// verification runs in the visitor's browser: the record comes straight from solana,
// the pdf is hashed locally and never uploaded. our server only says "latest or not".
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { findRecord, normalizeCode, sha256, verdict, type ChainRecord } from "@passport/core";
import type { IssuerDocument } from "@/app/.well-known/btu-passport-issuer.json/route";
import type { VerifyInfo } from "@/app/api/verify/[code]/route";
import { VerdictStamp } from "@/components/verdict-stamp";
import { useDict } from "@/i18n/client";
import { formatDate } from "@/i18n/format";

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
  const [file, setFile] = useState<{ name: string; hash: Uint8Array } | null>(null);
  const [dragging, setDragging] = useState(false);

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
    fetch(`/api/verify/${code}`).then(async (r) => (r.ok ? setInfo(await r.json()) : null)).catch(() => null);
  }, [code]);

  async function check(f: File | undefined) {
    if (f) setFile({ name: f.name, hash: await sha256(new Uint8Array(await f.arrayBuffer())) });
  }

  const rec = record.state === "done" ? record.value : null;
  // the chain's version is the truth; the server only answers "is it the latest"
  const latest = info && rec && info.versionNo === rec.version ? { isLatest: info.isLatest } : null;
  const v = verdict({ record: rec, latest, fileHash: file?.hash ?? null });
  const outcome = record.state === "done" ? v.outcome : "checking";
  const outdatedNote = info && !info.isLatest ? `${v_.newerVersion} V${info.latest.versionNo}, ${day(info.latest.issuedAt)}` : undefined;

  return (
    <main>
      <section className="bg-panel">
        <div className="mx-auto max-w-6xl px-4 pt-20 pb-12 sm:pt-24">
          <p className="font-display text-2xl text-blue">{v_.codeLabel}</p>
          <p className="font-display text-5xl tracking-wider text-ink sm:text-6xl">{code ?? v_.invalidCode}</p>
          <div className="mt-8">
            {record.state === "error"
              ? <p role="alert" className="border-l-[12px] border-magenta bg-white p-6 text-lg">{v_.chainError}</p>
              : <VerdictStamp outcome={outcome} extra={v.outcome === "authentic-outdated" ? outdatedNote : undefined} />}
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-14 md:grid-cols-2">
        <section aria-labelledby="record-h">
          <h2 id="record-h" className="border-b-4 border-blue pb-2 font-display text-4xl text-ink">{v_.recordTitle}</h2>
          {record.state === "loading" && <p className="mt-5 text-muted">{v_.reading}</p>}
          {record.state === "done" && !rec && <p className="mt-5 text-lg">{v_.noRecord}</p>}
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
              {info && info.skills.length > 0 && (
                <Row label={`${v_.skills} (${info.skills.length})`}>
                  <ul className="space-y-1.5">
                    {info.skills.map((s) => <li key={s.name}><span className="font-semibold text-ink">{s.name}</span> <span className="text-sm text-muted">{s.category}</span></li>)}
                  </ul>
                </Row>
              )}
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
            <input type="file" accept="application/pdf" className="sr-only" disabled={!rec} aria-label={rec ? v_.drop : v_.waitForRecord} onChange={(e) => check(e.target.files?.[0])} />
            <svg aria-hidden viewBox="0 0 48 48" className="size-12 text-magenta" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 6h14l8 8v28H14z" /><path d="M28 6v8h8M25 36V22m-6 6 6-6 6 6" />
            </svg>
            <span className="mt-4 font-display text-2xl text-ink">{rec ? v_.drop : v_.waitForRecord}</span>
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[9rem_1fr] sm:gap-4">
      <dt className="font-display text-xl text-blue">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
