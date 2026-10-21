// renders sample passports through gotenberg and reports pages, size, timing,
// and whether the same input gives byte-identical pdfs.
import { createHash, randomInt } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { renderHtml, type Category, type Passport, type Skill } from "./template.ts";

const GOTENBERG = process.env.GOTENBERG_URL ?? "http://localhost:3000";
const FONT_DIR = "node_modules/@fontsource";
const FONTS: Record<string, string> = {
  "archivo-400.woff2": `${FONT_DIR}/archivo/files/archivo-latin-400-normal.woff2`,
  "archivo-700.woff2": `${FONT_DIR}/archivo/files/archivo-latin-700-normal.woff2`,
  "archivo-900.woff2": `${FONT_DIR}/archivo/files/archivo-latin-900-normal.woff2`,
  "georgian-400.woff2": `${FONT_DIR}/noto-sans-georgian/files/noto-sans-georgian-georgian-400-normal.woff2`,
  "georgian-700.woff2": `${FONT_DIR}/noto-sans-georgian/files/noto-sans-georgian-georgian-700-normal.woff2`,
};

// crockford base32 without look-alikes, about 50 bits: not guessable, easy to type
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const newCode = () => {
  const c = Array.from({ length: 10 }, () => ALPHABET[randomInt(32)]).join("");
  return `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8)}`;
};

const CATALOG: [string, Category, string][] = [
  ["AI Literacy", "AI Skill", "Fundamentals of AI capabilities, limitations, and responsible use."],
  ["Prompt Engineering Fundamentals", "AI Skill", "Writing effective prompts for generative AI and evaluating responses."],
  ["AI Ethics & Responsible Use", "AI Skill", "Identifying bias, privacy issues, and ethical risks in AI use."],
  ["AI Productivity Tools", "AI Skill", "Using AI tools to improve efficiency in routine tasks."],
  ["AI-Assisted Research", "AI Skill", "Researching information with AI assistance and critically verifying sources."],
  ["AI Data Analysis", "AI Applied Skill", "Cleaning, analyzing, and interpreting data using AI tools."],
  ["Marketing Content with Generative AI", "AI Applied Skill", "Generating, editing, and assessing marketing content with generative AI."],
  ["AI Workflow Automation", "AI Applied Skill", "Automating workflows using AI tools and system integrations."],
  ["AI Financial Analysis", "AI Applied Skill", "Analyzing financial data and supporting evidence-based conclusions with AI."],
  ["AI Business Decision Support", "AI Applied Skill", "Using AI-driven analytics to support business decisions."],
  ["Machine Learning Model Development", "AI Advanced Skill", "Building, training, and evaluating machine-learning models."],
  ["Natural Language Processing", "AI Advanced Skill", "Applying natural language processing methods to textual data."],
];
const skills = (n: number): Skill[] => CATALOG.slice(0, n).map(([name, category, description], i) => ({
  name, category, description, dateEarned: `2026-${String(9 + Math.floor(i / 6)).padStart(2, "0")}-${String(10 + (i % 6) * 3).padStart(2, "0")}`,
  earnedThrough: i === 7 ? "AI Automation Bootcamp (3-day intensive)" : undefined,
}));

const passport = (id: string, first: string, last: string, n: number): Passport => {
  const code = newCode();
  return { passportId: id, firstName: first, lastName: last, firstIssued: "2026-09-15", version: 1,
    verificationCode: code, verifyUrl: `https://passport.example/v/${code}`, skills: skills(n) };
};

async function render(p: Passport): Promise<{ pdf: Buffer; ms: number }> {
  const form = new FormData();
  form.append("files", new Blob([await renderHtml(p)], { type: "text/html" }), "index.html");
  for (const [name, path] of Object.entries(FONTS)) form.append("files", new Blob([readFileSync(path)]), name);
  form.append("preferCssPageSize", "true");
  form.append("printBackground", "true");
  const t = Date.now();
  const res = await fetch(`${GOTENBERG}/forms/chromium/convert/html`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`gotenberg ${res.status}: ${await res.text()}`);
  return { pdf: Buffer.from(await res.arrayBuffer()), ms: Date.now() - t };
}

const pages = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex").slice(0, 16);

async function main() {
  mkdirSync("out", { recursive: true });
  const samples = [
    passport("BTU-AI-000125", "Giorgi", "Kapanadze", 12), // 12 skills -> 2 grid + 3 table pages
    passport("BTU-AI-000133", "Nino", "Maisuradze", 3),
    passport("BTU-AI-000134", "ანა", "კიკნაძე", 3), // georgian script check
  ];
  for (const p of samples) {
    const { pdf, ms } = await render(p);
    const file = `out/${p.passportId}-v${p.version}.pdf`;
    writeFileSync(file, pdf);
    const expected = 2 + Math.ceil(p.skills.length / 10) + Math.ceil(p.skills.length / 5);
    console.log(`${file}: ${pages(pdf)} pages (expected ${expected}), ${(pdf.length / 1024).toFixed(0)} KB, ${ms} ms, sha ${sha(pdf)}`);
  }

  // same input twice: if the bytes differ, we must store the issued pdf and never re-render it
  const again = await render(samples[0]);
  const first = readFileSync(`out/${samples[0].passportId}-v1.pdf`);
  console.log(`\nre-render of the same passport: ${first.equals(again.pdf) ? "byte-identical" : "DIFFERENT bytes"}`);

  // throughput: 20 renders, 4 at a time, like a burst after a semester import
  const t = Date.now();
  const queue = Array.from({ length: 20 }, () => passport("BTU-AI-LOAD", "Load", "Test", 8));
  await Promise.all(Array.from({ length: 4 }, async () => { while (queue.length) await render(queue.pop()!); }));
  const per = (Date.now() - t) / 20;
  console.log(`burst: 20 pdfs, 4 parallel -> ${per.toFixed(0)} ms per pdf, ~${Math.round(3_600_000 / per)} per hour on this machine`);
}

main().catch((e) => { console.error(`failed: ${(e as Error).message}`); process.exit(1); });
