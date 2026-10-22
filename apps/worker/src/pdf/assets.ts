// btu's official stamp and sticker artwork (Visual Reference, 2026-10-22) as png files in ./art,
// sent to the renderer next to the html. the asterisk, icons and logo are redrawn as svg.
import type { Category } from "@passport/core";

const ORANGE = "#ff6a00";

export const ART_FILES = [
  "stamp-skill.png", "stamp-applied.png", "stamp-advanced.png",
  "sticker-issued.png", "sticker-latest.png", "sticker-badge.png", "sticker-triangle.png", "sticker-blockchain.png",
];

const svg = (viewBox: string, widthMm: number, body: string, cls = "art") =>
  `<svg class="${cls}" viewBox="${viewBox}" style="width:${widthMm}mm" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

// the three stamp types. width in mm; the applied stamp is wider, and tilted where the mockup tilts it
export function stamp(c: Category, widthMm = 24, tilt = 0): string {
  if (c === "AI Skill") return `<img class="art stamp" src="stamp-skill.png" alt="AI Skill" style="width:${widthMm}mm">`;
  if (c === "AI Applied Skill") return `<img class="art stamp" src="stamp-applied.png" alt="AI Applied Skill" style="width:${widthMm * 1.45}mm;transform:rotate(${tilt}deg)">`;
  return `<img class="art stamp" src="stamp-advanced.png" alt="AI Advanced Skill" style="width:${widthMm}mm">`;
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

// the cover's sticker cluster, placed in mm as in the mockup. later images sit on top
const STICKERS: [file: string, left: number, top: number, width: number, rotate: number][] = [
  ["sticker-issued.png", 43, 10, 79, 6],
  ["sticker-latest.png", 9, 72, 81, 27],
  ["sticker-badge.png", 4, 14, 48, 0],
  ["sticker-triangle.png", 43, 31, 71, 0],
  ["sticker-blockchain.png", 95, 25, 56, -17],
];
export const coverStickers = () => `<div class="stickers">${STICKERS.map(([file, left, top, width, rotate]) =>
  `<img src="${file}" alt="" style="left:${left}mm;top:${top}mm;width:${width}mm;transform:rotate(${rotate}deg)">`).join("")}</div>`;
