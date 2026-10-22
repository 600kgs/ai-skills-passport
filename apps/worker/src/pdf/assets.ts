// vector artwork redrawn from btu's mockup (Visual Reference/Passport.png) until btu sends
// the real files. every text line has a fixed length, so it can never spill out of its shape.
import type { Category } from "@passport/core";

const ORANGE = "#ff6a00";
const RED = "#f2464b";
const PURPLE = "#6a1be6";
const NAVY = "#1b2a6b";

// svg text squeezed or stretched to exactly `len` units wide
const fit = (x: number, y: number, size: number, weight: number, len: number, text: string, fill = "#fff") =>
  `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="middle" textLength="${len}" lengthAdjust="spacingAndGlyphs">${text}</text>`;

const svg = (viewBox: string, widthMm: number, body: string, cls = "art") =>
  `<svg class="${cls}" viewBox="${viewBox}" style="width:${widthMm}mm" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

// the three stamp types. width in mm; the applied stamp is wider, as in the mockup
export function stamp(c: Category, widthMm = 24, tilt = 0): string {
  if (c === "AI Skill") return svg("0 0 120 104", widthMm, `
    <polygon points="60,2 118,102 2,102" fill="${RED}"/>
    <polygon points="60,15 105,95 15,95" fill="none" stroke="#fff" stroke-width="1.6"/>
    ${fit(60, 56, 15, 800, 18, "AI")}${fit(60, 71, 15, 800, 42, "SKILL")}
    ${fit(60, 81, 8, 300, 36, "FOCUSED")}${fit(60, 90, 8, 300, 42, "LEARNING")}`, "art stamp");
  if (c === "AI Applied Skill") return svg("-4 -10 158 76", widthMm * 1.45, `<g transform="rotate(${tilt} 75 28)">
    <rect width="150" height="56" fill="${PURPLE}"/>
    <rect x="6" y="6" width="138" height="44" fill="none" stroke="#fff" stroke-width="1.2"/>
    ${fit(75, 27, 15, 800, 122, "AI APPLIED SKILL")}${fit(75, 41, 10.5, 300, 98, "APPLIED LEARNING")}</g>`, "art stamp");
  return svg("0 0 100 100", widthMm, `
    <circle cx="50" cy="50" r="49" fill="${NAVY}"/>
    <circle cx="50" cy="50" r="43" fill="none" stroke="#fff" stroke-width="1.2"/>
    ${fit(50, 30, 9, 800, 11, "AI")}${fit(50, 42, 11.5, 800, 56, "ADVANCED")}${fit(50, 54, 11.5, 800, 32, "SKILL")}
    ${fit(50, 65, 7, 300, 38, "EXTENDED")}${fit(50, 73, 7, 300, 38, "ACADEMIC")}${fit(50, 81, 7, 300, 36, "LEARNING")}`, "art stamp");
}

// btu's bold eight-spoke asterisk
const spokes = (cx: number, cy: number, len: number, w: number, fill: string) =>
  [0, 45, 90, 135].map((a) => `<rect x="${cx - w / 2}" y="${cy - len / 2}" width="${w}" height="${len}" rx="${w / 2}" fill="${fill}" transform="rotate(${a} ${cx} ${cy})"/>`).join("");
export const asterisk = (widthMm: number, fill = ORANGE) => svg("0 0 24 24", widthMm, spokes(12, 12, 23, 4.4, fill), "art asterisk");

// "how the passport grows" icons, simple filled shapes in btu orange
const ICONS = {
  learn: `<circle cx="12" cy="5" r="3.4"/><path d="M2.5 10.5l9.5 2.4 9.5-2.4v9.2l-9.5 2.4-9.5-2.4z"/><path d="M12 12.9v9.2" stroke="#fff" stroke-width="1"/>`,
  demonstrate: `<rect x="10.5" y="2.5" width="12" height="9" rx="1"/><circle cx="6" cy="5.5" r="2.8"/><path d="M3 9.5h6l4.5-2.5 1 1.6-5 3.4v4.5H8.2v6.5H6.4v-6.5H5.6v6.5H3.8z"/>`,
  earn: spokes(12, 12, 21, 4, "currentColor"),
  verify: `<path d="M12 1.5l2.6 2 3.2-.5 1.3 3 3 1.3-.5 3.2 2 2.6-2 2.6.5 3.2-3 1.3-1.3 3-3.2-.5-2.6 2-2.6-2-3.2.5-1.3-3-3-1.3.5-3.2-2-2.6 2-2.6-.5-3.2 3-1.3 1.3-3 3.2.5z"/><path d="M7.8 12.2l2.8 2.8 5.6-5.6" fill="none" stroke="#fff" stroke-width="1.8"/>`,
  profile: `<circle cx="12" cy="7.5" r="4.6"/><path d="M3.5 22.5a8.5 8.2 0 0 1 17 0z"/>`,
};
export const icon = (name: keyof typeof ICONS, widthMm = 7) =>
  `<svg class="art icon" viewBox="0 0 24 24" style="width:${widthMm}mm;color:${ORANGE}" fill="${ORANGE}" xmlns="http://www.w3.org/2000/svg">${ICONS[name]}</svg>`;

// mkhedruli to mtavruli (georgian capitals), as on btu's logo
const mtavruli = (s: string) => s.replace(/[ა-ჺ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x0bc0));

// btu's logo: wordmark, divider, georgian name, and the striped chevron under it
export function btuLogo(widthMm = 34): string {
  const stripes = Array.from({ length: 6 }, (_, i) => `<polyline points="-2,${21 + i * 3.4} 19,${31 + i * 3.4} 40,${21 + i * 3.4}" fill="none" stroke="#111" stroke-width="1.7"/>`).join("");
  return svg("0 0 104 48", widthMm, `
    <text x="0" y="17" font-size="21" font-weight="900" fill="#111" textLength="38" lengthAdjust="spacingAndGlyphs">BTU</text>
    <rect x="41.5" y="2.5" width="1" height="15" fill="#111"/>
    ${["ბიზნესისა და", "ტექნოლოგიების", "უნივერსიტეტი"].map((l, i) => `<text x="45" y="${7 + i * 5.2}" font-size="4.6" font-weight="700" fill="#111">${mtavruli(l)}</text>`).join("")}
    <clipPath id="btu-shield"><path d="M0 20.5h38v13l-19 13-19-13z"/></clipPath>
    <g clip-path="url(#btu-shield)">${stripes}</g>`, "art logo");
}

// the cover's sticker cluster, in mm. drawn back to front so the overlaps match the mockup
export function coverStickers(widthMm = 146): string {
  const ring = "M 29 40 m -19.5 0 a 19.5 19.5 0 1 1 39 0 a 19.5 19.5 0 1 1 -39 0";
  return svg("0 0 152 104", widthMm, `
    <g transform="rotate(6 86 22)">
      <rect x="45" y="10" width="82" height="25" fill="${ORANGE}"/>
      <rect x="47.5" y="12.5" width="77" height="20" fill="none" stroke="#111" stroke-width="0.8"/>
      ${fit(86, 21.2, 6.2, 900, 70, "ISSUED BY BUSINESS AND", "#111")}${fit(86, 29, 6.2, 900, 70, "TECHNOLOGY UNIVERSITY", "#111")}
    </g>
    <g transform="rotate(27 52 84)">
      <rect x="10" y="74" width="84" height="21" fill="#ff1f8a"/>
      <rect x="13" y="77" width="78" height="15" rx="3" fill="none" stroke="#fff" stroke-width="1.3"/>
      ${fit(52, 88.2, 10, 900, 70, "LATEST AI SKILLSET")}
    </g>
    <circle cx="29" cy="40" r="25" fill="#3df08e"/>
    <circle cx="29" cy="40" r="15.5" fill="none" stroke="#111" stroke-width="0.9"/>
    <path id="badge-ring" d="${ring}" fill="none"/>
    <text font-size="4.9" font-weight="900" fill="#111"><textPath href="#badge-ring" startOffset="1" textLength="118" lengthAdjust="spacing">SKILLS IN AI&#160;&#160;&#160;INTERNATIONALLY RECOGNISED&#160;</textPath></text>
    ${spokes(29, 40, 17, 3.4, "#111")}
    <polygon points="82,33 119,70 45,70" fill="#19d3f5"/>
    <polyline points="68,49 82,35.5 96,49" fill="none" stroke="#111" stroke-width="0.9"/>
    <polyline points="71,51 82,40 93,51" fill="none" stroke="#111" stroke-width="0.9"/>
    ${fit(82, 56, 5.4, 900, 7, "AI", "#111")}${fit(82, 61.6, 5.4, 900, 19, "SKILLS", "#111")}${fit(82, 67.3, 5.4, 900, 46, "DIGITAL PASSPORT", "#111")}
    <g transform="rotate(-17 128 37)">
      <rect x="99" y="25" width="58" height="25" fill="#c62aa0"/>
      <rect x="102" y="28" width="52" height="19" fill="none" stroke="#fff" stroke-width="0.6" stroke-dasharray="1.6 1.2"/>
      ${fit(128, 36.4, 7.6, 900, 44, "BLOCKCHAIN")}${fit(128, 44.4, 7.6, 900, 32, "VERIFIED")}
    </g>`, "art stickers");
}
