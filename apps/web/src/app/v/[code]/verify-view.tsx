"use client";

// verification runs in the visitor's browser: the record comes straight from solana,
// the pdf is hashed locally and never uploaded. our server only says "latest or not".
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { findRecord, normalizeCode, sha256, verdict, type ChainRecord } from "@passport/core";
import type { IssuerDocument } from "@/app/.well-known/btu-passport-issuer.json/route";
import type { VerifyInfo } from "@/app/api/verify/[code]/route";
import { VerdictStamp } from "@/components/verdict-stamp";

type Load<T> = { state: "loading" } | { state: "done"; value: T } | { state: "error"; message: string };
const short = (a: string) => `${a.slice(0, 4)}...${a.slice(-4)}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

export default function VerifyView() {
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
        setRecord({ state: "error", message: "Couldn't reach Solana to read the record. Check your connection and reload." });
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
  const outdatedNote = info && !info.isLatest ? `Version ${info.latest.versionNo} was issued on ${day(info.latest.issuedAt)}` : undefined;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-16">
      <Link href="/" className="inline-block leading-none focus-visible:outline-2 focus-visible:outline-btu-orange">
        <span className="block text-lg font-black">AI SKILLS</span>
        <span className="block text-lg">DIGITAL PASSPORT</span>
      </Link>

      <section className="mt-10">
        <p className="text-sm text-muted">Verification code</p>
        <p className="text-2xl font-black tracking-wider">{code ?? "Not a valid code"}</p>
        <div className="mt-6">
          {record.state === "error" ? <p className="border-l-4 border-btu-red pl-4">{record.message}</p>
            : <VerdictStamp outcome={outcome} extra={v.outcome === "authentic-outdated" ? outdatedNote : undefined} />}
        </div>
      </section>

      <div className="mt-12 grid gap-10 md:grid-cols-2">
        <section aria-labelledby="record-h">
          <h2 id="record-h" className="border-b-2 border-foreground pb-2 text-xl font-black">Official record</h2>
          {record.state === "loading" && <p className="mt-4 text-muted">Reading the record on Solana...</p>}
          {record.state === "done" && !rec && (
            <p className="mt-4">There&apos;s no passport with this code. Check the code printed next to the QR code and try again.</p>
          )}
          {rec && (
            <dl className="mt-4 space-y-3">
              {info && (
                <>
                  <Row label="Issued to">{info.holder}</Row>
                  <Row label="Passport ID">{info.passportId}</Row>
                </>
              )}
              <Row label="Version">
                V{rec.version}{" "}
                {v.record === "latest" && <span className="font-bold text-btu-navy">(latest)</span>}
                {v.record === "outdated" && info && <span className="font-bold text-btu-orange">(latest is V{info.latest.versionNo})</span>}
              </Row>
              {info && <Row label="Issued on">{day(info.issuedAt)}</Row>}
              {info && info.skills.length > 0 && (
                <Row label={`Skills (${info.skills.length})`}>
                  <ul className="space-y-1">{info.skills.map((s) => <li key={s.name}>{s.name} <span className="text-sm text-muted">{s.category}</span></li>)}</ul>
                </Row>
              )}
              <Row label="Issuer">
                Business and Technology University. Its signing key is published at{" "}
                <a className="underline" href="/.well-known/btu-passport-issuer.json">this site&apos;s issuer file</a>
                {issuer && <> (credential <span className="font-mono text-sm">{short(issuer.credential)}</span>)</>}, and this record belongs to it.
              </Row>
              <Row label="Proof">
                <a className="font-bold underline" href={`https://explorer.solana.com/address/${rec.address}?cluster=${issuer?.network ?? "devnet"}`} target="_blank" rel="noreferrer">
                  View the record on Solana Explorer
                </a>
              </Row>
            </dl>
          )}
        </section>

        <section aria-labelledby="file-h">
          <h2 id="file-h" className="border-b-2 border-foreground pb-2 text-xl font-black">Check the PDF file</h2>
          <label
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); check(e.dataTransfer.files[0]); }}
            className={`mt-4 flex cursor-pointer flex-col items-center justify-center border-2 border-dashed px-4 py-10 text-center focus-within:border-btu-orange ${dragging ? "border-btu-orange bg-orange-50" : "border-line"}`}
          >
            <input type="file" accept="application/pdf" className="sr-only" disabled={!rec} onChange={(e) => check(e.target.files?.[0])} />
            <span className="font-bold">{rec ? "Drop the passport PDF here, or choose a file" : "Available once a record is found"}</span>
            <span className="mt-2 text-sm text-muted">The file stays on your device. Only its fingerprint is compared with the record.</span>
          </label>
          {file && (
            <p className={`mt-4 border-l-4 pl-4 ${v.file === "authentic" ? "border-btu-navy" : "border-btu-red"}`}>
              <span className="font-bold">{file.name}</span>{" "}
              {v.file === "authentic" ? "matches the version BTU issued, byte for byte." : "doesn't match the issued version. It was changed after issue, or it's a different file."}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
