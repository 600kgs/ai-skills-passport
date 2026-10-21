// html for one passport version. layout follows btu's mockup (Visual Reference/Passport.png):
// cover, about, then skillset pages (10 stamps each) and detail pages (5 rows each).
import QRCode from "qrcode";
import type { Category } from "@passport/core";

export type Skill = { name: string; category: Category; description: string; earnedThrough?: string | null; dateEarned: string };
export type Passport = {
  passportId: string; firstName: string; lastName: string; firstIssued: string;
  version: number; verificationCode: string; verifyUrl: string; skills: Skill[];
};

const PER_GRID_PAGE = 10;
const PER_TABLE_PAGE = 5;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const chunk = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
const date = (iso: string) => iso.split("-").reverse().join(".");

// the three stamps, redrawn from the mockup until btu sends real assets
function stamp(c: Category, size = 22): string {
  if (c === "AI Skill") return `<svg class="stamp" viewBox="0 0 100 88" style="width:${size}mm">
    <polygon points="50,2 98,86 2,86" fill="#f2464b"/>
    <text x="50" y="58" text-anchor="middle" font-size="13" font-weight="900" fill="#fff">AI SKILL</text>
    <text x="50" y="74" text-anchor="middle" font-size="7.5" fill="#fff">FOCUSED LEARNING</text></svg>`;
  if (c === "AI Applied Skill") return `<svg class="stamp" viewBox="0 0 140 56" style="width:${size * 1.4}mm">
    <g transform="rotate(-6 70 28)"><rect x="4" y="8" width="132" height="40" fill="#6a1be6"/>
    <text x="70" y="28" text-anchor="middle" font-size="13" font-weight="900" fill="#fff">AI APPLIED SKILL</text>
    <text x="70" y="41" text-anchor="middle" font-size="9" fill="#fff">APPLIED LEARNING</text></g></svg>`;
  return `<svg class="stamp" viewBox="0 0 100 100" style="width:${size}mm">
    <circle cx="50" cy="50" r="47" fill="#1b2a6b"/>
    <text x="50" y="44" text-anchor="middle" font-size="10" font-weight="900" fill="#fff">AI ADVANCED</text>
    <text x="50" y="56" text-anchor="middle" font-size="10" font-weight="900" fill="#fff">SKILL</text>
    <text x="50" y="68" text-anchor="middle" font-size="6" fill="#fff">EXTENDED ACADEMIC</text></svg>`;
}

function footer(p: Passport, qr: string): string {
  return `<footer>
    <div class="brand"><span>AI SKILLS</span><b>DIGITAL PASSPORT</b></div>
    <div class="btu">BTU</div>
    <div class="ids">
      <div><small>Passport ID</small>${esc(p.passportId)}</div>
      <div><small>Verification code (version ${p.version})</small>${esc(p.verificationCode)}</div>
    </div>
    <div class="qr">${qr}</div>
  </footer>`;
}

export async function renderHtml(p: Passport): Promise<string> {
  const qr = await QRCode.toString(p.verifyUrl, { type: "svg", margin: 0, errorCorrectionLevel: "M" });
  const f = footer(p, qr);

  const cover = `<section class="page cover">
    <h1><b>AI SKILLS</b><span>DIGITAL PASSPORT</span></h1>
    <div class="asterisks">✱<br>✱<br>✱</div>
    <dl>
      <div><dt>Name:</dt><dd>${esc(p.firstName)}</dd></div>
      <div><dt>Surname:</dt><dd>${esc(p.lastName)}</dd></div>
      <div class="issue"><dt>Date of issue:</dt><dd>${date(p.firstIssued)}</dd></div>
    </dl>
    <div class="stickers">
      <span class="s1">ISSUED BY BUSINESS AND TECHNOLOGY UNIVERSITY</span>
      <span class="s2">BLOCKCHAIN VERIFIED</span>
      <span class="s3">LATEST AI SKILLSET</span>
    </div>${f}</section>`;

  const about = `<section class="page about">
    <h2><b>ABOUT</b><br><b>THE AI SKILLS</b><br>DIGITAL PASSPORT</h2>
    <p>The BTU AI Skills Digital Passport is a personalised and verifiable record of AI competencies developed throughout your university experience. New stamps are added as competencies are recognised; earlier stamps never change.</p>
    <div class="types">
      <div>${stamp("AI Skill", 16)}<h3>AI Skill</h3><p>Focused learning: a workshop, masterclass or similar short activity.</p></div>
      <div>${stamp("AI Applied Skill", 14)}<h3>AI Applied Skill</h3><p>Applied learning: a bootcamp, hackathon or multi-day challenge.</p></div>
      <div>${stamp("AI Advanced Skill", 16)}<h3>AI Advanced Skill</h3><p>Extended academic learning: a semester-long, assessed course.</p></div>
    </div>${f}</section>`;

  const grids = chunk(p.skills, PER_GRID_PAGE).map((skills, i, all) => `<section class="page grid">
    <h2><b>VERIFIED AI SKILLSET</b></h2><p class="sub">Collection of BTU-verified AI skill stamps${all.length > 1 ? ` (${i + 1}/${all.length})` : ""}</p>
    <div class="cards">${Array.from({ length: PER_GRID_PAGE }, (_, k) => {
      const s = skills[k];
      return s ? `<div class="card"><time>${date(s.dateEarned)}</time>${stamp(s.category)}<h4>${esc(s.name)}</h4><span>${s.category}</span></div>`
        : `<div class="card empty"></div>`;
    }).join("")}</div>${f}</section>`);

  const tables = chunk(p.skills, PER_TABLE_PAGE).map((skills, i, all) => `<section class="page table">
    <h2><b>AI SKILLS DETAILED INFORMATION</b></h2><p class="sub">Detailed record of verified AI skills and learning experiences${all.length > 1 ? ` (${i + 1}/${all.length})` : ""}</p>
    <table><thead><tr><th>Stamp type</th><th>Skill</th><th>Description</th><th>Earned through</th><th>Date earned</th></tr></thead>
    <tbody>${skills.map((s) => `<tr><td>${stamp(s.category, 13)}</td><td class="name">${esc(s.name)}</td>
      <td>${esc(s.description)}</td><td>${esc(s.earnedThrough || "-")}</td><td>${date(s.dateEarned)}</td></tr>`).join("")}</tbody></table>${f}</section>`);

  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face { font-family: Archivo; font-weight: 400; src: url(archivo-400.woff2); }
  @font-face { font-family: Archivo; font-weight: 700; src: url(archivo-700.woff2); }
  @font-face { font-family: Archivo; font-weight: 900; src: url(archivo-900.woff2); }
  @font-face { font-family: NotoGeorgian; font-weight: 400; src: url(georgian-400.woff2); }
  @font-face { font-family: NotoGeorgian; font-weight: 700; src: url(georgian-700.woff2); }
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Archivo, NotoGeorgian, sans-serif; color: #111; }
  .page { width: 297mm; height: 210mm; padding: 14mm 16mm 0; position: relative; overflow: hidden; page-break-after: always; }
  h1 { font-size: 40pt; line-height: 1; } h1 b { display: block; font-weight: 900; } h1 span { display: block; font-weight: 400; font-size: 38pt; }
  h2 { font-size: 20pt; font-weight: 400; line-height: 1.05; } h2 b { font-weight: 900; }
  .sub { font-weight: 700; font-size: 9pt; margin: 2mm 0 6mm; }
  .asterisks { position: absolute; right: 22mm; top: 14mm; color: #ff6a00; font-size: 22pt; line-height: 1.1; }
  .cover h1 { border-bottom: 0.4mm solid #ccc; padding-bottom: 8mm; width: 85%; }
  dl { margin-top: 10mm; font-size: 15pt; } dl div { display: flex; gap: 4mm; margin-bottom: 4mm; }
  dt { font-weight: 900; text-transform: uppercase; } dd { font-weight: 400; }
  dl .issue { position: absolute; left: 150mm; top: 66mm; font-size: 12pt; }
  .stickers span { position: absolute; font-weight: 900; padding: 2mm 4mm; font-size: 11pt; }
  .s1 { left: 140mm; top: 92mm; background: #ff6a00; transform: rotate(4deg); border: 0.6mm solid #111; }
  .s2 { left: 200mm; top: 112mm; background: #d61f8f; color: #fff; transform: rotate(-12deg); }
  .s3 { left: 130mm; top: 130mm; background: #ff2f74; color: #fff; transform: rotate(18deg); font-size: 14pt; }
  .about > p { width: 110mm; font-size: 9pt; line-height: 1.5; margin-top: 6mm; }
  .types { position: absolute; left: 140mm; top: 16mm; width: 140mm; display: grid; gap: 6mm; }
  .types div { display: grid; grid-template-columns: 28mm 1fr; column-gap: 4mm; align-items: center; }
  .types .stamp { grid-row: span 2; } .types h3 { font-size: 11pt; font-weight: 900; } .types p { font-size: 8.5pt; }
  .cards { display: grid; grid-template-columns: repeat(5, 1fr); gap: 3mm; }
  .card { border: 0.3mm solid #ccc; border-radius: 2mm; height: 62mm; text-align: center; padding: 3mm 2mm; display: flex; flex-direction: column; align-items: center; gap: 2mm; }
  .card time { font-size: 7pt; border-bottom: 0.3mm solid #ccc; width: 100%; padding-bottom: 1.5mm; }
  .card h4 { font-size: 9pt; font-weight: 900; text-transform: uppercase; margin-top: auto; } .card span { font-size: 8pt; text-transform: uppercase; margin-bottom: 2mm; }
  table { width: 100%; border-collapse: collapse; font-size: 7.5pt; }
  th { font-size: 10pt; font-weight: 900; text-transform: uppercase; padding: 3mm; border-bottom: 0.3mm solid #ccc; }
  td { border: 0.3mm solid #ddd; padding: 2mm 3mm; text-align: center; height: 21mm; }
  td.name { font-weight: 900; font-size: 9pt; text-transform: uppercase; }
  footer { position: absolute; left: 16mm; right: 16mm; bottom: 8mm; display: flex; align-items: flex-end; gap: 8mm; }
  .brand { background: #ff6a00; padding: 1.5mm 3mm; font-size: 10pt; line-height: 1.1; } .brand span, .brand b { display: block; } .brand b { font-weight: 900; }
  .btu { font-weight: 900; font-size: 16pt; }
  .ids { margin-left: auto; text-align: right; font-size: 8pt; font-weight: 700; } .ids small { display: block; font-weight: 400; color: #555; }
  .qr svg { width: 18mm; height: 18mm; display: block; }
  </style></head><body>${cover}${about}${grids.join("")}${tables.join("")}</body></html>`;
}
