// btu's official stickers in the same arrangement as the passport cover (apps/worker/src/pdf/assets.ts),
// converted from mm on a 151 x 100 mm area to percentages. decoration only
const STICKERS: [file: string, left: number, top: number, width: number, rotate: number][] = [
  ["sticker-issued.png", 43, 10, 79, 6],
  ["sticker-latest.png", 9, 72, 81, 27],
  ["sticker-badge.png", 4, 14, 48, 0],
  ["sticker-triangle.png", 43, 31, 71, 0],
  ["sticker-blockchain.png", 95, 25, 56, -17],
];

export function StickerCluster({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`relative aspect-[151/100] ${className}`}>
      {STICKERS.map(([file, left, top, width, rotate]) => (
        // eslint-disable-next-line @next/next/no-img-element -- fixed decorative pngs
        <img key={file} src={`/art/${file}`} alt="" className="absolute"
          style={{ left: `${(left / 151) * 100}%`, top: `${top}%`, width: `${(width / 151) * 100}%`, transform: `rotate(${rotate}deg)` }} />
      ))}
    </div>
  );
}
