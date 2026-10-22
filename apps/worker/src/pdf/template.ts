// html for one passport version. layout follows btu's mockup (Visual Reference/Passport.png):
// cover, about, then skillset pages (10 stamps each) and detail pages (5 rows each).
// deliberate differences: a4 landscape, qr + verification code in the footer, mockup typos fixed.
import QRCode from "qrcode";
import type { Category } from "@passport/core";
import { asterisk, btuLogo, coverStickers, icon, stamp } from "./assets.ts";

export type Skill = { name: string; category: Category; description: string; earnedThrough?: string | null; dateEarned: string };
export type Passport = {
  passportId: string; firstName: string; lastName: string; firstIssued: string;
  version: number; verificationCode: string; verifyUrl: string; skills: Skill[];
};

export const PER_GRID_PAGE = 10;
export const PER_TABLE_PAGE = 5;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const chunk = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
const date = (iso: string) => iso.split("-").reverse().join(".");

function footer(p: Passport, qr: string): string {
  return `<footer>
    <div class="brand"><span>AI SKILLS</span><b>DIGITAL PASSPORT</b></div>
    ${btuLogo()}
    <div class="ids">
      <div><small>Passport ID</small>${esc(p.passportId)}</div>
      <div><small>Verification code (version ${p.version})</small>${esc(p.verificationCode)}</div>
    </div>
    <div class="qr">${qr}</div>
  </footer>`;
}

// page 2 is the same for everyone: btu's explanation of the passport and its stamps
const ABOUT = `
  <div class="about-left">
    <h2><b>ABOUT</b><br><b>THE AI SKILLS</b><br>DIGITAL PASSPORT</h2>
    <p>The BTU AI Skills Digital Passport is your personalized and verifiable record of AI competencies developed throughout your university experience.</p>
    <p>AI Skill Stamps may be earned through eligible academic courses, workshops, masterclasses, hackathons, intensive programs, guest speaker sessions, and other AI-related learning experiences recognized by BTU.</p>
    <p>Participation in the Passport is voluntary. There is no required number or combination of stamps and no predefined pathway. Students select learning opportunities according to their interests, studies, professional objectives, and desired areas of AI competence.</p>
    <p>As new competencies are developed and recognized, additional stamps are added to the Passport, progressively creating an individual AI competency profile.</p>
    <div class="row-asterisks">${Array.from({ length: 9 }, () => asterisk(4.2)).join("")}</div>
  </div>
  <div class="about-right">
    <h3 class="orange">UNDERSTANDING AI SKILLS STAMPS</h3>
    <div class="types-top">
      <div class="type">
        <div class="type-head"><div><b>AI SKILL</b><span>FOCUSED LEARNING</span></div>${stamp("AI Skill", 15)}</div>
        <p>Awarded through an eligible focused learning experience, such as a workshop, masterclass, seminar, guest speaker session, or similar short-format activity.</p>
        <p><b>Represents:</b> Development of a defined AI competency.</p>
      </div>
      <div class="type">
        <div class="type-head"><div><b>AI APPLIED SKILL</b><span>APPLIED LEARNING</span></div>${stamp("AI Applied Skill", 15)}</div>
        <p>Awarded through an eligible extended practical learning experience, typically lasting two to three days, such as an intensive workshop, bootcamp, hackathon, or challenge.</p>
        <p><b>Represents:</b> Hands-on application of a defined AI competency.</p>
      </div>
    </div>
    <div class="types-bottom">
      <div>
        <div class="type">
          <div class="type-head"><div><b>AI ADVANCED SKILL</b><span>EXTENDED ACADEMIC LEARNING</span></div>${stamp("AI Advanced Skill", 13)}</div>
          <p>Awarded through the successful completion of an eligible semester-long academic course in which the respective AI competency constitutes a defined and assessed component of the course learning outcomes.</p>
          <p><b>Represents:</b> Extended and formally assessed development of an AI competency.</p>
        </div>
        <div class="important">
          <b>IMPORTANT</b>
          <p>The three stamp types represent different learning formats and depths of engagement. They do not constitute a mandatory sequence.</p>
          <p>A student does not need to earn an AI Skill before earning an AI Applied Skill or AI Advanced Skill.</p>
        </div>
      </div>
      <div class="grows">
        <h4>HOW THE<br>PASSPORT GROWS</h4>
        <div>${icon("learn")}<span>LEARN</span></div>
        <div>${icon("demonstrate")}<span>DEMONSTRATE</span></div>
        <div>${icon("earn", 5.5)}<span>EARN</span></div>
        <div>${icon("verify", 6)}<span>VERIFY</span></div>
        <div>${icon("profile")}<span>BUILD YOUR<br>AI PROFILE</span></div>
      </div>
    </div>
  </div>`;

export async function renderHtml(p: Passport): Promise<string> {
  const qr = await QRCode.toString(p.verifyUrl, { type: "svg", margin: 0, errorCorrectionLevel: "M" });
  const f = footer(p, qr);

  const cover = `<section class="page cover">
    <h1><b>AI SKILLS</b><span>DIGITAL PASSPORT</span></h1>
    <div class="asterisks">${asterisk(9)}${asterisk(9)}${asterisk(9)}</div>
    <dl>
      <div><dt>Name:</dt><dd>${esc(p.firstName)}</dd></div>
      <div><dt>Surname:</dt><dd>${esc(p.lastName)}</dd></div>
      <div class="issue"><dt>Date of issue:</dt><dd>${date(p.firstIssued)}</dd></div>
    </dl>
    ${coverStickers()}${f}</section>`;

  const about = `<section class="page about">${ABOUT}${f}</section>`;

  const grids = chunk(p.skills, PER_GRID_PAGE).map((skills, i, all) => `<section class="page grid">
    <h2><b>VERIFIED AI SKILLSET</b></h2><p class="sub">Collection of BTU-verified AI skill stamps${all.length > 1 ? ` (${i + 1}/${all.length})` : ""}</p>
    <div class="cards">${Array.from({ length: PER_GRID_PAGE }, (_, k) => {
      const s = skills[k];
      return s ? `<div class="card"><time>${date(s.dateEarned)}</time><div class="art-box">${stamp(s.category, 23, -6)}</div><h4>${esc(s.name)}</h4><span>${s.category}</span></div>`
        : `<div class="card empty"></div>`;
    }).join("")}</div>${f}</section>`);

  const tables = chunk(p.skills, PER_TABLE_PAGE).map((skills, i, all) => `<section class="page table">
    <h2><b>AI SKILLS DETAILED INFORMATION</b></h2><p class="sub">Detailed record of verified AI skills and learning experiences${all.length > 1 ? ` (${i + 1}/${all.length})` : ""}</p>
    <table><thead><tr><th>Stamp type</th><th>Skill</th><th>Description</th><th>Earned through</th><th>Date earned</th></tr></thead>
    <tbody>${skills.map((s) => `<tr><td>${stamp(s.category, 16, -6)}</td><td class="name">${esc(s.name)}</td>
      <td>${esc(s.description)}</td><td>${esc(s.earnedThrough || "-")}</td><td>${date(s.dateEarned)}</td></tr>`).join("")}</tbody></table>${f}</section>`);

  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face { font-family: Poppins; font-weight: 300; src: url(poppins-300.woff2); }
  @font-face { font-family: Poppins; font-weight: 400; src: url(poppins-400.woff2); }
  @font-face { font-family: Poppins; font-weight: 700; src: url(poppins-700.woff2); }
  @font-face { font-family: Poppins; font-weight: 800; src: url(poppins-800.woff2); }
  @font-face { font-family: Poppins; font-weight: 900; src: url(poppins-900.woff2); }
  @font-face { font-family: NotoGeorgian; font-weight: 400; src: url(georgian-400.woff2); }
  @font-face { font-family: NotoGeorgian; font-weight: 700; src: url(georgian-700.woff2); }
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Poppins, NotoGeorgian, sans-serif; color: #111; }
  .page { width: 297mm; height: 210mm; padding: 15mm 17mm 0; position: relative; overflow: hidden; page-break-after: always; }
  .page::before { content: ""; position: absolute; inset: 5mm; border: 0.4mm solid #d9d9d9; border-radius: 4mm; pointer-events: none; }
  .art { display: block; overflow: visible; }
  h1 { font-size: 46pt; line-height: 0.98; letter-spacing: -0.5pt; } h1 b { display: block; font-weight: 800; } h1 span { display: block; font-weight: 300; }
  h2 { font-size: 21pt; font-weight: 300; line-height: 1.02; } h2 b { font-weight: 800; }
  .sub { font-weight: 700; font-size: 9pt; margin: 2mm 0 6mm; }
  .asterisks { position: absolute; right: 24mm; top: 16mm; display: grid; gap: 2.5mm; }
  .cover h1 { border-bottom: 0.4mm solid #ccc; padding-bottom: 7mm; width: 86%; }
  dl { margin-top: 11mm; font-size: 19pt; } dl div { display: flex; align-items: baseline; gap: 4mm; margin-bottom: 4mm; }
  dt { font-weight: 800; text-transform: uppercase; } dd { font-weight: 300; }
  dl .issue { position: absolute; left: 160mm; top: 74mm; font-size: 14pt; }
  .stickers { position: absolute; left: 132mm; top: 79mm; } .stickers img { position: absolute; }
  .about { display: grid; grid-template-columns: 82mm 1fr; column-gap: 6mm; }
  .about p { font-size: 7.6pt; line-height: 1.45; font-weight: 300; text-align: justify; }
  .about-left p { margin-top: 3.6mm; } .about-left h2 { font-size: 23pt; margin-bottom: 2mm; }
  .row-asterisks { display: flex; justify-content: space-between; margin-top: 5mm; }
  .about-right { border-left: 0.3mm solid #ccc; padding-left: 6mm; height: 158mm; }
  .orange { color: #ff6a00; font-size: 21pt; font-weight: 800; line-height: 1; padding-bottom: 2.5mm; border-bottom: 0.3mm solid #ccc; }
  .types-top { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 0.3mm solid #ccc; padding: 3mm 0 4mm; }
  .types-top .type:first-child { padding-right: 5mm; border-right: 0.3mm solid #ccc; } .types-top .type:last-child { padding-left: 5mm; }
  .type-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 2mm; margin-bottom: 1.5mm; }
  .type-head b { display: block; font-size: 10pt; font-weight: 800; line-height: 1.1; } .type-head span { display: block; font-size: 8.5pt; font-weight: 300; }
  .type p + p { margin-top: 2mm; } .type p b { font-weight: 700; }
  .types-bottom { display: grid; grid-template-columns: 1fr 42mm; column-gap: 5mm; padding-top: 4mm; }
  .types-bottom > div:first-child { padding-right: 5mm; border-right: 0.3mm solid #ccc; }
  .important { background: #e4e3e8; border-radius: 2.5mm; padding: 3mm 4mm; margin-top: 4mm; }
  .important b { font-size: 8pt; font-weight: 800; } .important p { margin-top: 1.5mm; font-size: 7pt; }
  .grows { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 2.6mm; }
  .grows h4 { font-size: 10pt; font-weight: 800; line-height: 1.05; margin-bottom: 1mm; }
  .grows div { display: flex; flex-direction: column; align-items: center; gap: 1mm; font-size: 7.4pt; font-weight: 300; line-height: 1.1; }
  .cards { display: grid; grid-template-columns: repeat(5, 1fr); gap: 3mm; }
  .card { border: 0.3mm solid #ccc; border-radius: 2mm; height: 63mm; text-align: center; padding: 2.5mm 2mm; display: flex; flex-direction: column; align-items: center; gap: 1.5mm; }
  .card time { font-size: 6.5pt; border-bottom: 0.3mm solid #ccc; width: 100%; padding-bottom: 1.5mm; }
  .card .art-box { height: 25mm; display: flex; align-items: center; justify-content: center; margin-top: 3mm; }
  .card h4 { font-size: 8.5pt; font-weight: 800; text-transform: uppercase; line-height: 1.15; margin-top: auto; } .card span { font-size: 7.5pt; font-weight: 300; text-transform: uppercase; margin-bottom: 2mm; }
  table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 6.6pt; border: 0.3mm solid #ccc; border-radius: 2.5mm; overflow: hidden; }
  th { font-size: 9.5pt; font-weight: 800; text-transform: uppercase; padding: 3mm; white-space: nowrap; border-bottom: 0.3mm solid #ccc; }
  td { border-top: 0.3mm solid #ddd; border-left: 0.3mm solid #ddd; padding: 2mm 3mm; text-align: center; height: 20mm; font-weight: 300; text-transform: uppercase; }
  td:first-child, th:first-child { border-left: 0; } tbody tr:first-child td { border-top: 0; }
  td .art { margin: 0 auto; } td.name { font-weight: 800; font-size: 8.5pt; }
  footer { position: absolute; left: 17mm; right: 17mm; bottom: 10mm; display: flex; align-items: flex-end; gap: 9mm; }
  .brand { background: #ff6a00; padding: 1.5mm 3mm; font-size: 10.5pt; line-height: 1.1; } .brand span, .brand b { display: block; } .brand span { font-weight: 300; } .brand b { font-weight: 800; }
  .ids { margin-left: auto; text-align: right; font-size: 8pt; font-weight: 700; } .ids small { display: block; font-weight: 300; color: #555; }
  .qr svg { width: 17mm; height: 17mm; display: block; }
  </style></head><body>${cover}${about}${grids.join("")}${tables.join("")}</body></html>`;
}
